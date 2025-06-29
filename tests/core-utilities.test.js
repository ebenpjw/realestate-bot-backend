// tests/core-utilities.test.js

/**
 * Tests for core utility functions and state machine
 */

const { 
  STATES, 
  getLeadState, 
  validateAction, 
  isValidTransition,
  getStateDescription,
  suggestNextAction
} = require('../utils/appointmentStateMachine');

const { 
  retryWithBackoff, 
  isRetryableError, 
  calculateDelay,
  DEFAULT_RETRY_CONFIG
} = require('../utils/retryUtils');

const { 
  CalendarApiError, 
  ZoomApiError, 
  DatabaseError, 
  AppointmentStateError,
  AppointmentConflictError
} = require('../middleware/errorHandler');

describe('Core Utilities', () => {
  
  describe('Appointment State Machine', () => {
    test('should have all required states', () => {
      expect(STATES.INITIAL).toBe('initial');
      expect(STATES.QUALIFYING).toBe('qualifying');
      expect(STATES.QUALIFIED).toBe('qualified');
      expect(STATES.SELECTING_TIME).toBe('selecting_time');
      expect(STATES.CONFIRMING).toBe('confirming');
      expect(STATES.BOOKED).toBe('booked');
      expect(STATES.RESCHEDULING).toBe('rescheduling');
      expect(STATES.CANCELLED).toBe('cancelled');
      expect(STATES.NEEDS_HUMAN).toBe('needs_human_handoff');
    });

    test('should determine lead state correctly', () => {
      // New lead
      const newLead = { status: 'new' };
      expect(getLeadState(newLead)).toBe(STATES.INITIAL);

      // Qualifying lead
      const qualifyingLead = { status: 'qualifying' };
      expect(getLeadState(qualifyingLead)).toBe(STATES.QUALIFYING);

      // Qualified lead with complete data
      const qualifiedLead = { status: 'qualified', intent: 'buy', budget: '500k' };
      expect(getLeadState(qualifiedLead)).toBe(STATES.QUALIFIED);

      // Qualified lead without complete data should go to qualifying
      const incompleteQualifiedLead = { status: 'qualified', intent: 'buy' };
      expect(getLeadState(incompleteQualifiedLead)).toBe(STATES.QUALIFYING);

      // Lead with active appointment
      const bookedLead = { status: 'booked' };
      const activeAppointment = { status: 'scheduled' };
      expect(getLeadState(bookedLead, activeAppointment)).toBe(STATES.BOOKED);

      // Lead marked as booked but no appointment (inconsistent state)
      expect(getLeadState(bookedLead, null)).toBe(STATES.QUALIFIED);

      // Cancelled appointment
      const cancelledAppointment = { status: 'cancelled' };
      expect(getLeadState(bookedLead, cancelledAppointment)).toBe(STATES.CANCELLED);

      // Alternatives offered
      const alternativesLead = { status: 'booking_alternatives_offered' };
      expect(getLeadState(alternativesLead)).toBe(STATES.SELECTING_TIME);

      // Needs human handoff
      const humanLead = { status: 'needs_human_handoff' };
      expect(getLeadState(humanLead)).toBe(STATES.NEEDS_HUMAN);
    });

    test('should validate actions correctly', () => {
      // Valid booking from qualified state
      const validBooking = validateAction('initiate_booking', STATES.QUALIFIED);
      expect(validBooking.valid).toBe(true);
      expect(validBooking.errorMessage).toBeNull();

      // Invalid booking from initial state
      const invalidBooking = validateAction('initiate_booking', STATES.INITIAL);
      expect(invalidBooking.valid).toBe(false);
      expect(invalidBooking.errorMessage).toBeTruthy();

      // Valid reschedule from booked state
      const validReschedule = validateAction('reschedule_appointment', STATES.BOOKED);
      expect(validReschedule.valid).toBe(true);

      // Invalid reschedule from qualified state
      const invalidReschedule = validateAction('reschedule_appointment', STATES.QUALIFIED);
      expect(invalidReschedule.valid).toBe(false);

      // Valid alternative selection
      const validSelection = validateAction('select_alternative', STATES.SELECTING_TIME);
      expect(validSelection.valid).toBe(true);

      // Invalid alternative selection
      const invalidSelection = validateAction('select_alternative', STATES.QUALIFIED);
      expect(invalidSelection.valid).toBe(false);

      // Unknown action should be allowed
      const unknownAction = validateAction('unknown_action', STATES.QUALIFIED);
      expect(unknownAction.valid).toBe(true);
    });

    test('should validate state transitions', () => {
      // Valid transitions
      expect(isValidTransition(STATES.INITIAL, STATES.QUALIFYING)).toBe(true);
      expect(isValidTransition(STATES.QUALIFYING, STATES.QUALIFIED)).toBe(true);
      expect(isValidTransition(STATES.QUALIFIED, STATES.BOOKED)).toBe(true);
      expect(isValidTransition(STATES.BOOKED, STATES.RESCHEDULING)).toBe(true);
      expect(isValidTransition(STATES.CANCELLED, STATES.QUALIFIED)).toBe(true);

      // Invalid transitions
      expect(isValidTransition(STATES.INITIAL, STATES.BOOKED)).toBe(false);
      expect(isValidTransition(STATES.QUALIFYING, STATES.RESCHEDULING)).toBe(false);

      // Any state can go to needs human
      expect(isValidTransition(STATES.INITIAL, STATES.NEEDS_HUMAN)).toBe(true);
      expect(isValidTransition(STATES.QUALIFIED, STATES.NEEDS_HUMAN)).toBe(true);
      expect(isValidTransition(STATES.BOOKED, STATES.NEEDS_HUMAN)).toBe(true);
    });

    test('should provide state descriptions', () => {
      expect(getStateDescription(STATES.INITIAL)).toContain('New lead');
      expect(getStateDescription(STATES.QUALIFIED)).toContain('Ready to book');
      expect(getStateDescription(STATES.BOOKED)).toContain('scheduled appointment');
      expect(getStateDescription('unknown')).toContain('Unknown state');
    });

    test('should suggest next actions', () => {
      expect(suggestNextAction(STATES.INITIAL)).toContain('intent and budget');
      expect(suggestNextAction(STATES.QUALIFIED)).toContain('book consultation');
      expect(suggestNextAction(STATES.BOOKED)).toContain('reschedule');
      expect(suggestNextAction(STATES.NEEDS_HUMAN)).toContain('human agent');
    });
  });

  describe('Retry Utils', () => {
    test('should have correct default configuration', () => {
      expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.baseDelay).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_CONFIG.jitter).toBe(true);
    });

    test('should calculate delay with exponential backoff', () => {
      const config = { baseDelay: 1000, backoffMultiplier: 2, maxDelay: 10000, jitter: false };
      
      const delay0 = calculateDelay(0, config);
      const delay1 = calculateDelay(1, config);
      const delay2 = calculateDelay(2, config);
      
      expect(delay0).toBe(1000);
      expect(delay1).toBe(2000);
      expect(delay2).toBe(4000);
    });

    test('should cap delay at maximum', () => {
      const config = { baseDelay: 1000, backoffMultiplier: 2, maxDelay: 3000, jitter: false };
      
      const delay5 = calculateDelay(5, config); // Would be 32000 without cap
      expect(delay5).toBe(3000);
    });

    test('should add jitter when enabled', () => {
      const config = { baseDelay: 1000, backoffMultiplier: 2, maxDelay: 10000, jitter: true };
      
      const delay1 = calculateDelay(1, config);
      const delay2 = calculateDelay(1, config);
      
      // With jitter, delays should vary
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(2000);
      expect(delay2).toBeGreaterThanOrEqual(1000);
      expect(delay2).toBeLessThanOrEqual(2000);
    });

    test('should identify retryable errors', () => {
      // Network errors
      const networkError = new Error('Connection reset');
      networkError.code = 'ECONNRESET';
      expect(isRetryableError(networkError)).toBe(true);

      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';
      expect(isRetryableError(timeoutError)).toBe(true);

      // HTTP errors
      const serverError = new Error('Internal server error');
      serverError.response = { status: 500 };
      expect(isRetryableError(serverError)).toBe(true);

      const rateLimitError = new Error('Rate limited');
      rateLimitError.response = { status: 429 };
      expect(isRetryableError(rateLimitError)).toBe(true);

      // Non-retryable errors
      const validationError = new Error('Invalid input');
      validationError.response = { status: 400 };
      expect(isRetryableError(validationError)).toBe(false);

      const notFoundError = new Error('Not found');
      notFoundError.response = { status: 404 };
      expect(isRetryableError(notFoundError)).toBe(false);

      // Message-based detection
      const timeoutMessage = new Error('Request timeout occurred');
      expect(isRetryableError(timeoutMessage)).toBe(true);

      const quotaMessage = new Error('Quota exceeded for this request');
      expect(isRetryableError(quotaMessage)).toBe(true);
    });

    test('should retry operations with backoff', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Temporary failure');
          error.response = { status: 500 };
          throw error;
        }
        return 'success';
      });

      const result = await retryWithBackoff(
        operation, 
        { maxAttempts: 3, baseDelay: 10, jitter: false }, 
        'test-operation'
      );
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should fail after max attempts', async () => {
      const operation = jest.fn().mockImplementation(() => {
        const error = new Error('Persistent failure');
        error.response = { status: 500 };
        throw error;
      });

      await expect(
        retryWithBackoff(operation, { maxAttempts: 2, baseDelay: 10 }, 'test-operation')
      ).rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockImplementation(() => {
        const error = new Error('Validation failed');
        error.response = { status: 400 };
        throw error;
      });

      await expect(
        retryWithBackoff(operation, { maxAttempts: 3, baseDelay: 10 }, 'test-operation')
      ).rejects.toThrow('Validation failed');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Error Classes', () => {
    test('should create calendar API errors correctly', () => {
      const error = new CalendarApiError('Failed to create event');
      expect(error.message).toContain('Google Calendar');
      expect(error.message).toContain('Failed to create event');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('Google Calendar');
      expect(error.name).toBe('CalendarApiError');
    });

    test('should create zoom API errors correctly', () => {
      const originalError = new Error('Network timeout');
      const error = new ZoomApiError('Failed to create meeting', originalError);
      expect(error.message).toContain('Zoom');
      expect(error.message).toContain('Failed to create meeting');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('Zoom');
      expect(error.originalError).toBe(originalError);
    });

    test('should create database errors correctly', () => {
      const error = new DatabaseError('Connection failed');
      expect(error.message).toContain('Database');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('Database');
    });

    test('should create appointment state errors correctly', () => {
      const error = new AppointmentStateError('Invalid transition', 'initial', 'book');
      expect(error.statusCode).toBe(400);
      expect(error.currentState).toBe('initial');
      expect(error.attemptedAction).toBe('book');
      expect(error.name).toBe('AppointmentStateError');
    });

    test('should create appointment conflict errors correctly', () => {
      const conflictTime = new Date('2024-06-15T14:00:00');
      const error = new AppointmentConflictError('Time slot unavailable', conflictTime);
      expect(error.statusCode).toBe(409);
      expect(error.conflictingTime).toBe(conflictTime);
      expect(error.name).toBe('AppointmentConflictError');
    });
  });
});
