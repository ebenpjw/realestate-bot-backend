// utils/appointmentStateMachine.js

/**
 * Appointment State Machine for Real Estate Bot
 * 
 * STATES:
 * - INITIAL: Lead just started, no qualification yet
 * - QUALIFYING: Bot is gathering intent and budget information
 * - QUALIFIED: Lead has provided intent and budget, ready to book
 * - SELECTING_TIME: Lead is choosing from available time slots
 * - CONFIRMING: Appointment details are being confirmed
 * - BOOKED: Appointment is successfully scheduled
 * - RESCHEDULING: Existing appointment is being rescheduled
 * - CANCELLED: Appointment was cancelled
 * - NEEDS_HUMAN: Requires human intervention
 */

const logger = require('../logger');

// State definitions
const STATES = {
  INITIAL: 'initial',
  QUALIFYING: 'qualifying', 
  QUALIFIED: 'qualified',
  SELECTING_TIME: 'selecting_time',
  CONFIRMING: 'confirming',
  BOOKED: 'booked',
  RESCHEDULING: 'rescheduling',
  CANCELLED: 'cancelled',
  NEEDS_HUMAN: 'needs_human_handoff'
};

// Valid state transitions
const TRANSITIONS = {
  [STATES.INITIAL]: [STATES.QUALIFYING, STATES.NEEDS_HUMAN],
  [STATES.QUALIFYING]: [STATES.QUALIFIED, STATES.INITIAL, STATES.NEEDS_HUMAN],
  [STATES.QUALIFIED]: [STATES.SELECTING_TIME, STATES.BOOKED, STATES.QUALIFYING, STATES.NEEDS_HUMAN],
  [STATES.SELECTING_TIME]: [STATES.CONFIRMING, STATES.QUALIFIED, STATES.NEEDS_HUMAN],
  [STATES.CONFIRMING]: [STATES.BOOKED, STATES.SELECTING_TIME, STATES.NEEDS_HUMAN],
  [STATES.BOOKED]: [STATES.RESCHEDULING, STATES.CANCELLED, STATES.NEEDS_HUMAN],
  [STATES.RESCHEDULING]: [STATES.BOOKED, STATES.CANCELLED, STATES.SELECTING_TIME, STATES.NEEDS_HUMAN],
  [STATES.CANCELLED]: [STATES.QUALIFIED, STATES.NEEDS_HUMAN],
  [STATES.NEEDS_HUMAN]: [STATES.QUALIFIED, STATES.BOOKED] // Human can resolve to any valid state
};

/**
 * Determine the current appointment state for a lead
 * @param {Object} lead - Lead object from database
 * @param {Object} activeAppointment - Active appointment if exists
 * @returns {string} Current state
 */
function getLeadState(lead, activeAppointment = null) {
  try {
    // If there's an active appointment, lead is in booked state
    if (activeAppointment && activeAppointment.status === 'scheduled') {
      return STATES.BOOKED;
    }

    // If appointment was cancelled, check if lead can book again
    if (activeAppointment && activeAppointment.status === 'cancelled') {
      return STATES.CANCELLED;
    }

    // Check lead status and qualification
    const leadStatus = lead.status || 'new';
    
    switch (leadStatus) {
      case 'new':
        return STATES.INITIAL;
        
      case 'qualifying':
        return STATES.QUALIFYING;
        
      case 'qualified':
        // Check if lead has sufficient qualification data
        if (lead.intent && lead.budget) {
          return STATES.QUALIFIED;
        }
        return STATES.QUALIFYING;
        
      case 'booking_alternatives_offered':
        return STATES.SELECTING_TIME;
        
      case 'appointment_confirming':
        return STATES.CONFIRMING;
        
      case 'booked':
        // Double-check with appointment data
        if (!activeAppointment) {
          logger.warn({ leadId: lead.id }, 'Lead marked as booked but no active appointment found');
          return STATES.QUALIFIED; // Reset to qualified state
        }
        return STATES.BOOKED;
        
      case 'appointment_cancelled':
        return STATES.CANCELLED;
        
      case 'needs_human_handoff':
        return STATES.NEEDS_HUMAN;
        
      default:
        logger.warn({ leadId: lead.id, leadStatus }, 'Unknown lead status, defaulting to initial');
        return STATES.INITIAL;
    }
  } catch (error) {
    logger.error({ err: error, leadId: lead?.id }, 'Error determining lead state');
    return STATES.NEEDS_HUMAN;
  }
}

/**
 * Check if a state transition is valid
 * @param {string} fromState - Current state
 * @param {string} toState - Target state
 * @returns {boolean} True if transition is valid
 */
function isValidTransition(fromState, toState) {
  if (!TRANSITIONS[fromState]) {
    logger.warn({ fromState, toState }, 'Invalid from state in transition check');
    return false;
  }
  
  return TRANSITIONS[fromState].includes(toState);
}

/**
 * Get next possible states from current state
 * @param {string} currentState - Current state
 * @returns {Array} Array of possible next states
 */
function getNextStates(currentState) {
  return TRANSITIONS[currentState] || [];
}

/**
 * Validate appointment action against current state
 * @param {string} action - Appointment action (initiate_booking, reschedule_appointment, etc.)
 * @param {string} currentState - Current lead state
 * @returns {Object} Validation result
 */
function validateAction(action, currentState) {
  const validations = {
    initiate_booking: {
      validStates: [STATES.QUALIFIED, STATES.CANCELLED],
      errorMessage: 'Cannot initiate booking - lead must be qualified first'
    },
    reschedule_appointment: {
      validStates: [STATES.BOOKED],
      errorMessage: 'Cannot reschedule - no active appointment found'
    },
    cancel_appointment: {
      validStates: [STATES.BOOKED, STATES.RESCHEDULING],
      errorMessage: 'Cannot cancel - no active appointment found'
    },
    select_alternative: {
      validStates: [STATES.SELECTING_TIME],
      errorMessage: 'Cannot select alternative - no alternatives were offered'
    }
  };

  const validation = validations[action];
  if (!validation) {
    return { valid: true }; // Unknown actions are allowed
  }

  const isValid = validation.validStates.includes(currentState);
  
  return {
    valid: isValid,
    errorMessage: isValid ? null : validation.errorMessage,
    currentState,
    action,
    validStates: validation.validStates
  };
}

/**
 * Get user-friendly state description
 * @param {string} state - State to describe
 * @returns {string} Human-readable description
 */
function getStateDescription(state) {
  const descriptions = {
    [STATES.INITIAL]: 'New lead - needs qualification',
    [STATES.QUALIFYING]: 'Gathering information about property needs',
    [STATES.QUALIFIED]: 'Ready to book consultation',
    [STATES.SELECTING_TIME]: 'Choosing from available time slots',
    [STATES.CONFIRMING]: 'Confirming appointment details',
    [STATES.BOOKED]: 'Has scheduled appointment',
    [STATES.RESCHEDULING]: 'Rescheduling existing appointment',
    [STATES.CANCELLED]: 'Previously cancelled appointment - can book new one',
    [STATES.NEEDS_HUMAN]: 'Requires human assistance'
  };

  return descriptions[state] || 'Unknown state';
}

/**
 * Suggest next action based on current state
 * @param {string} state - Current state
 * @returns {string} Suggested next action
 */
function suggestNextAction(state) {
  const suggestions = {
    [STATES.INITIAL]: 'Ask about property intent and budget',
    [STATES.QUALIFYING]: 'Continue gathering qualification information',
    [STATES.QUALIFIED]: 'Offer to book consultation appointment',
    [STATES.SELECTING_TIME]: 'Help choose from available time slots',
    [STATES.CONFIRMING]: 'Confirm appointment details',
    [STATES.BOOKED]: 'Provide appointment details or offer to reschedule',
    [STATES.RESCHEDULING]: 'Help find new appointment time',
    [STATES.CANCELLED]: 'Offer to book new appointment',
    [STATES.NEEDS_HUMAN]: 'Transfer to human agent'
  };

  return suggestions[state] || 'Continue conversation';
}

module.exports = {
  STATES,
  TRANSITIONS,
  getLeadState,
  isValidTransition,
  getNextStates,
  validateAction,
  getStateDescription,
  suggestNextAction
};
