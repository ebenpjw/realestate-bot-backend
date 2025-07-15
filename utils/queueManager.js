const logger = require('../logger');
const EventEmitter = require('events');

/**
 * Generic Queue Manager
 * 
 * Provides reusable queue management functionality with configurable
 * batch processing, timeouts, and retry logic.
 */
class QueueManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      batchTimeoutMs: options.batchTimeoutMs || 5000,
      maxBatchSize: options.maxBatchSize || 10,
      maxQueueAge: options.maxQueueAge || 300000, // 5 minutes
      emergencyTimeout: options.emergencyTimeout || 30000,
      retryPolicy: {
        maxRetries: options.retryPolicy?.maxRetries || 3,
        backoff: options.retryPolicy?.backoff || 'exponential',
        baseDelay: options.retryPolicy?.baseDelay || 1000
      },
      ...options
    };
    
    // Queue storage (key -> Queue)
    this.queues = new Map();
    
    // Processing timers (key -> Timer)
    this.timers = new Map();
    
    // Processing state (key -> boolean)
    this.processingState = new Map();
    
    // Metrics
    this.metrics = {
      batchesProcessed: 0,
      itemsProcessed: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      retriesPerformed: 0,
      errors: 0
    };
    
    logger.info('QueueManager initialized', { config: this.config });
  }

  /**
   * Add item to queue
   */
  async enqueue(key, item, options = {}) {
    try {
      const timestamp = Date.now();
      const queueItem = {
        ...item,
        timestamp,
        retryCount: 0,
        ...options
      };

      // Check if already processing
      if (this.processingState.get(key)) {
        return this._addToExistingQueue(key, queueItem);
      }

      // Start new queue
      return this._startNewQueue(key, queueItem);
      
    } catch (error) {
      logger.error({ err: error, key }, 'Error enqueueing item');
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Process queue immediately
   */
  async processImmediately(key) {
    const queue = this.queues.get(key);
    if (!queue) {
      logger.warn({ key }, 'Queue not found for immediate processing');
      return;
    }

    this._clearTimer(key);
    return this._processQueue(key);
  }

  /**
   * Get queue status
   */
  getQueueStatus(key) {
    const queue = this.queues.get(key);
    if (!queue) return null;

    return {
      size: queue.items.length,
      created: queue.created,
      lastUpdated: queue.lastUpdated,
      isProcessing: this.processingState.get(key) || false,
      age: Date.now() - queue.created
    };
  }

  /**
   * Get all queue statuses
   */
  getAllQueueStatuses() {
    const statuses = {};
    for (const [key] of this.queues) {
      statuses[key] = this.getQueueStatus(key);
    }
    return statuses;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Clear queue
   */
  clearQueue(key) {
    this._clearTimer(key);
    this.queues.delete(key);
    this.processingState.delete(key);
    logger.debug({ key }, 'Queue cleared');
  }

  /**
   * Clear all queues
   */
  clearAllQueues() {
    for (const key of this.queues.keys()) {
      this.clearQueue(key);
    }
    logger.info('All queues cleared');
  }

  /**
   * Add to existing queue
   * @private
   */
  async _addToExistingQueue(key, item) {
    const queue = this.queues.get(key);
    
    if (!queue) {
      logger.warn({ key }, 'Queue not found for existing processing - creating new queue');
      return this._startNewQueue(key, item);
    }

    // Add item to queue
    queue.items.push(item);
    queue.lastUpdated = Date.now();

    // Check for overflow
    if (queue.items.length > this.config.maxBatchSize) {
      logger.warn({
        key,
        queueSize: queue.items.length,
        maxBatchSize: this.config.maxBatchSize
      }, 'Queue overflow detected - processing immediately');
      
      return this.processImmediately(key);
    }

    // Reset timer
    this._resetTimer(key);
    
    this.emit('itemAdded', { key, queueSize: queue.items.length });
    
    logger.debug({
      key,
      queueSize: queue.items.length,
      timeRemaining: this.config.batchTimeoutMs
    }, 'Item added to queue, timer reset');
  }

  /**
   * Start new queue
   * @private
   */
  async _startNewQueue(key, item) {
    // Mark as processing
    this.processingState.set(key, true);

    // Create new queue
    const queue = {
      items: [item],
      created: Date.now(),
      lastUpdated: Date.now(),
      key
    };

    this.queues.set(key, queue);

    // Start timer
    this._startTimer(key);

    this.emit('queueStarted', { key, batchTimeout: this.config.batchTimeoutMs });
    
    logger.debug({
      key,
      batchTimeout: this.config.batchTimeoutMs,
      queueCreated: true
    }, 'New queue started');
  }

  /**
   * Start batch timer
   * @private
   */
  _startTimer(key) {
    this._clearTimer(key);
    
    const timer = setTimeout(() => {
      this._processQueue(key);
    }, this.config.batchTimeoutMs);
    
    this.timers.set(key, timer);
  }

  /**
   * Reset batch timer
   * @private
   */
  _resetTimer(key) {
    this._startTimer(key);
  }

  /**
   * Clear timer
   * @private
   */
  _clearTimer(key) {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Process queue - to be overridden by subclasses
   * @private
   */
  async _processQueue(key) {
    const startTime = Date.now();
    const queue = this.queues.get(key);
    
    if (!queue) {
      logger.warn({ key }, 'Queue not found for processing');
      return;
    }

    try {
      this._clearTimer(key);
      
      const items = [...queue.items];
      const batchSize = items.length;
      
      logger.info({
        key,
        batchSize,
        queueAge: Date.now() - queue.created
      }, 'Processing queue batch');

      // Emit processing event
      this.emit('batchProcessing', { key, items, batchSize });

      // Process items (override this method in subclasses)
      const result = await this._processBatch(key, items);

      // Update metrics
      this.metrics.batchesProcessed++;
      this.metrics.itemsProcessed += batchSize;
      this.metrics.averageBatchSize = this.metrics.itemsProcessed / this.metrics.batchesProcessed;
      
      const processingTime = Date.now() - startTime;
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (this.metrics.batchesProcessed - 1) + processingTime) / 
        this.metrics.batchesProcessed;

      // Emit completion event
      this.emit('batchCompleted', { key, items, batchSize, processingTime, result });

      logger.info({
        key,
        batchSize,
        processingTime,
        totalBatches: this.metrics.batchesProcessed
      }, 'Queue batch processed successfully');

    } catch (error) {
      logger.error({ err: error, key }, 'Error processing queue batch');
      this.metrics.errors++;
      
      // Emit error event
      this.emit('batchError', { key, error, items: queue.items });
      
      // Retry logic could be implemented here
      await this._handleProcessingError(key, error);
      
    } finally {
      // Cleanup
      this.queues.delete(key);
      this.processingState.delete(key);
      this._clearTimer(key);
    }
  }

  /**
   * Process batch - override this method in subclasses
   * @private
   */
  async _processBatch(key, items) {
    // Default implementation - just log
    logger.info({ key, itemCount: items.length }, 'Processing batch (default implementation)');
    return { processed: items.length };
  }

  /**
   * Handle processing error
   * @private
   */
  async _handleProcessingError(key, error) {
    // Default error handling - could implement retry logic here
    logger.error({ key, err: error }, 'Batch processing failed');
  }
}

module.exports = QueueManager;
