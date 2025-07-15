const logger = require('../logger');
const EventEmitter = require('events');

/**
 * Generic State Manager
 * 
 * Provides reusable state management functionality with configurable
 * state transitions, validation, and persistence.
 */
class StateManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      states: options.states || [],
      transitions: options.transitions || {},
      initialState: options.initialState || null,
      stateTimeout: options.stateTimeout || 3600000, // 1 hour default
      storage: options.storage || 'memory', // 'memory', 'database', 'redis'
      validationRules: options.validationRules || {},
      ...options
    };
    
    // State storage (key -> StateObject)
    this.states = new Map();
    
    // Timeout timers (key -> Timer)
    this.timeoutTimers = new Map();
    
    // Metrics
    this.metrics = {
      stateChanges: 0,
      invalidTransitions: 0,
      timeouts: 0,
      errors: 0
    };
    
    logger.info('StateManager initialized', { 
      states: this.config.states,
      initialState: this.config.initialState,
      storage: this.config.storage
    });
  }

  /**
   * Get current state for a key
   */
  getState(key) {
    const stateObj = this.states.get(key);
    if (!stateObj) return null;
    
    return {
      current: stateObj.current,
      previous: stateObj.previous,
      data: { ...stateObj.data },
      createdAt: stateObj.createdAt,
      updatedAt: stateObj.updatedAt,
      timeInState: Date.now() - stateObj.updatedAt
    };
  }

  /**
   * Initialize state for a key
   */
  initState(key, initialState = this.config.initialState, data = {}) {
    if (this.states.has(key)) {
      logger.debug({ key }, 'State already initialized');
      return this.getState(key);
    }
    
    if (initialState && this.config.states.length > 0 && !this.config.states.includes(initialState)) {
      logger.warn({ key, initialState, validStates: this.config.states }, 'Invalid initial state');
      throw new Error(`Invalid initial state: ${initialState}`);
    }
    
    const now = Date.now();
    const stateObj = {
      current: initialState,
      previous: null,
      data: { ...data },
      createdAt: now,
      updatedAt: now,
      history: initialState ? [{ state: initialState, timestamp: now }] : []
    };
    
    this.states.set(key, stateObj);
    
    if (initialState) {
      this._startStateTimeout(key);
      this.emit('stateInitialized', { key, state: initialState, data });
    }
    
    logger.debug({ key, initialState }, 'State initialized');
    return this.getState(key);
  }

  /**
   * Transition to a new state
   */
  async transition(key, newState, data = {}, options = {}) {
    // Get current state
    let stateObj = this.states.get(key);
    
    // Initialize if not exists
    if (!stateObj) {
      if (options.autoInit) {
        this.initState(key, null, {});
        stateObj = this.states.get(key);
      } else {
        logger.warn({ key, newState }, 'Cannot transition - state not initialized');
        throw new Error(`State not initialized for key: ${key}`);
      }
    }
    
    const currentState = stateObj.current;
    
    // Validate transition
    if (this.config.transitions && Object.keys(this.config.transitions).length > 0) {
      const allowedTransitions = this.config.transitions[currentState] || [];
      if (!allowedTransitions.includes(newState)) {
        logger.warn({ 
          key, 
          currentState, 
          newState, 
          allowedTransitions 
        }, 'Invalid state transition');
        
        this.metrics.invalidTransitions++;
        
        if (!options.force) {
          throw new Error(`Invalid transition from ${currentState} to ${newState}`);
        }
      }
    }
    
    // Validate state
    if (this.config.states.length > 0 && !this.config.states.includes(newState)) {
      logger.warn({ key, newState, validStates: this.config.states }, 'Invalid state');
      throw new Error(`Invalid state: ${newState}`);
    }
    
    // Validate data
    if (this.config.validationRules[newState]) {
      const validationResult = this._validateStateData(newState, data);
      if (!validationResult.valid) {
        logger.warn({ 
          key, 
          newState, 
          validationErrors: validationResult.errors 
        }, 'Invalid state data');
        
        if (!options.skipValidation) {
          throw new Error(`Invalid state data: ${validationResult.errors.join(', ')}`);
        }
      }
    }
    
    // Prepare for transition
    const now = Date.now();
    const previousState = stateObj.current;
    
    // Execute pre-transition hook if provided
    if (options.beforeTransition) {
      try {
        await options.beforeTransition({
          key,
          fromState: previousState,
          toState: newState,
          currentData: stateObj.data,
          newData: data
        });
      } catch (error) {
        logger.error({ 
          err: error, 
          key, 
          fromState: previousState, 
          toState: newState 
        }, 'Error in beforeTransition hook');
        
        if (!options.continueOnHookError) {
          throw error;
        }
      }
    }
    
    // Update state
    stateObj.previous = previousState;
    stateObj.current = newState;
    stateObj.data = { ...stateObj.data, ...data };
    stateObj.updatedAt = now;
    stateObj.history.push({ state: newState, timestamp: now, data: { ...data } });
    
    // Limit history size
    if (options.maxHistorySize && stateObj.history.length > options.maxHistorySize) {
      stateObj.history = stateObj.history.slice(-options.maxHistorySize);
    }
    
    // Reset timeout
    this._resetStateTimeout(key);
    
    // Update metrics
    this.metrics.stateChanges++;
    
    // Emit event
    this.emit('stateChanged', {
      key,
      fromState: previousState,
      toState: newState,
      data: { ...data },
      timestamp: now
    });
    
    // Execute post-transition hook if provided
    if (options.afterTransition) {
      try {
        await options.afterTransition({
          key,
          fromState: previousState,
          toState: newState,
          data: stateObj.data
        });
      } catch (error) {
        logger.error({ 
          err: error, 
          key, 
          fromState: previousState, 
          toState: newState 
        }, 'Error in afterTransition hook');
        
        if (!options.continueOnHookError) {
          throw error;
        }
      }
    }
    
    logger.debug({ 
      key, 
      fromState: previousState, 
      toState: newState 
    }, 'State transition completed');
    
    return this.getState(key);
  }

  /**
   * Update state data without changing state
   */
  updateStateData(key, data = {}, options = {}) {
    const stateObj = this.states.get(key);
    
    if (!stateObj) {
      logger.warn({ key }, 'Cannot update data - state not initialized');
      throw new Error(`State not initialized for key: ${key}`);
    }
    
    // Validate data if current state has validation rules
    if (this.config.validationRules[stateObj.current]) {
      const validationResult = this._validateStateData(stateObj.current, {
        ...stateObj.data,
        ...data
      });
      
      if (!validationResult.valid && !options.skipValidation) {
        logger.warn({ 
          key, 
          state: stateObj.current, 
          validationErrors: validationResult.errors 
        }, 'Invalid state data update');
        
        throw new Error(`Invalid state data: ${validationResult.errors.join(', ')}`);
      }
    }
    
    // Update data
    stateObj.data = { ...stateObj.data, ...data };
    stateObj.updatedAt = Date.now();
    
    // Reset timeout
    this._resetStateTimeout(key);
    
    // Emit event
    this.emit('stateDataUpdated', {
      key,
      state: stateObj.current,
      data: { ...stateObj.data },
      timestamp: stateObj.updatedAt
    });
    
    logger.debug({ key, state: stateObj.current }, 'State data updated');
    
    return this.getState(key);
  }

  /**
   * Clear state for a key
   */
  clearState(key) {
    this._clearStateTimeout(key);
    this.states.delete(key);
    
    this.emit('stateCleared', { key });
    
    logger.debug({ key }, 'State cleared');
  }

  /**
   * Get all states
   */
  getAllStates() {
    const result = {};
    for (const [key] of this.states) {
      result[key] = this.getState(key);
    }
    return result;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Start state timeout
   * @private
   */
  _startStateTimeout(key) {
    this._clearStateTimeout(key);
    
    if (!this.config.stateTimeout) return;
    
    const timer = setTimeout(() => {
      this._handleStateTimeout(key);
    }, this.config.stateTimeout);
    
    this.timeoutTimers.set(key, timer);
  }

  /**
   * Reset state timeout
   * @private
   */
  _resetStateTimeout(key) {
    this._startStateTimeout(key);
  }

  /**
   * Clear state timeout
   * @private
   */
  _clearStateTimeout(key) {
    const timer = this.timeoutTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(key);
    }
  }

  /**
   * Handle state timeout
   * @private
   */
  _handleStateTimeout(key) {
    const stateObj = this.states.get(key);
    if (!stateObj) return;
    
    this.metrics.timeouts++;
    
    this.emit('stateTimeout', {
      key,
      state: stateObj.current,
      timeInState: Date.now() - stateObj.updatedAt
    });
    
    logger.warn({ 
      key, 
      state: stateObj.current, 
      timeInState: Date.now() - stateObj.updatedAt 
    }, 'State timeout occurred');
  }

  /**
   * Validate state data
   * @private
   */
  _validateStateData(state, data) {
    const rules = this.config.validationRules[state];
    if (!rules) return { valid: true, errors: [] };
    
    const errors = [];
    
    for (const [field, rule] of Object.entries(rules)) {
      if (rule.required && (data[field] === undefined || data[field] === null)) {
        errors.push(`Field '${field}' is required`);
        continue;
      }
      
      if (data[field] !== undefined && rule.validate) {
        try {
          const valid = rule.validate(data[field]);
          if (!valid) {
            errors.push(rule.message || `Field '${field}' is invalid`);
          }
        } catch (error) {
          errors.push(`Validation error for field '${field}': ${error.message}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = StateManager;
