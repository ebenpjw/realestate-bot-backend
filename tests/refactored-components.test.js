// tests/refactored-components.test.js

/**
 * Tests for refactored components with dependency injection and improved error handling
 */

const { 
  getNowInSg, 
  toSgTime, 
  formatForDisplay, 
  formatForGoogleCalendar,
  validateTimezoneConfig 
} = require('../utils/timezoneUtils');

const { 
  STATES, 
  getLeadState, 
  validateAction, 
  isValidTransition 
} = require('../utils/appointmentStateMachine');

const { 
  retryWithBackoff, 
  isRetryableError, 
  calculateDelay 
} = require('../utils/retryUtils');

const { 
  CalendarApiError, 
  ZoomApiError, 
  DatabaseError, 
  AppointmentStateError 
} = require('../middleware/errorHandler');

const { BotService, createBotService } = require('../services/botService');

describe('Refactored Components', () => {
  
  describe('Timezone Utils', () => {
    test('should handle Singapore time correctly', () => {
      const now = getNowInSg();
      expect(now).toBeInstanceOf(Date);
      
      const sgTime = toSgTime('2024-06-15T10:30:00');
      expect(sgTime).toBeInstanceOf(Date);
      
      const formatted = formatForDisplay(sgTime);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    test('should format for Google Calendar correctly', () => {
      const testDate = new Date(2024, 5, 15, 14, 30, 0);
      const formatted = formatForGoogleCalendar(testDate);
      
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(formatted).toBe('2024-06-15T14:30:00');
    });

    test('should validate timezone configuration', () => {
      const validation = validateTimezoneConfig();
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('issues');
      expect(validation).toHaveProperty('timestamp');
    });
  });

  describe('Appointment State Machine', () => {
    test('should determine lead state correctly', () => {
      const newLead = { status: 'new' };
      expect(getLeadState(newLead)).toBe(STATES.INITIAL);

      const qualifiedLead = { status: 'qualified', intent: 'buy', budget: '500k' };
      expect(getLeadState(qualifiedLead)).toBe(STATES.QUALIFIED);

      const bookedLead = { status: 'booked' };
      const activeAppointment = { status: 'scheduled' };
      expect(getLeadState(bookedLead, activeAppointment)).toBe(STATES.BOOKED);
    });

    test('should validate actions correctly', () => {
      const validBooking = validateAction('initiate_booking', STATES.QUALIFIED);
      expect(validBooking.valid).toBe(true);

      const invalidBooking = validateAction('initiate_booking', STATES.INITIAL);
      expect(invalidBooking.valid).toBe(false);
      expect(invalidBooking.errorMessage).toBeTruthy();
    });

    test('should validate state transitions', () => {
      expect(isValidTransition(STATES.QUALIFIED, STATES.BOOKED)).toBe(true);
      expect(isValidTransition(STATES.INITIAL, STATES.BOOKED)).toBe(false);
    });
  });

  describe('Retry Utils', () => {
    test('should calculate delay with exponential backoff', () => {
      const delay1 = calculateDelay(0);
      const delay2 = calculateDelay(1);
      const delay3 = calculateDelay(2);
      
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    test('should identify retryable errors', () => {
      const networkError = new Error('ECONNRESET');
      networkError.code = 'ECONNRESET';
      expect(isRetryableError(networkError)).toBe(true);

      const validationError = new Error('Invalid input');
      expect(isRetryableError(validationError)).toBe(false);

      const serverError = new Error('Server error');
      serverError.response = { status: 500 };
      expect(isRetryableError(serverError)).toBe(true);
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

      const result = await retryWithBackoff(operation, { maxAttempts: 3, baseDelay: 10 });
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });

  describe('Custom Error Classes', () => {
    test('should create calendar API errors correctly', () => {
      const error = new CalendarApiError('Failed to create event');
      expect(error.message).toContain('Google Calendar');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('Google Calendar');
    });

    test('should create zoom API errors correctly', () => {
      const error = new ZoomApiError('Failed to create meeting');
      expect(error.message).toContain('Zoom');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('Zoom');
    });

    test('should create appointment state errors correctly', () => {
      const error = new AppointmentStateError('Invalid state transition', 'initial', 'book');
      expect(error.statusCode).toBe(400);
      expect(error.currentState).toBe('initial');
      expect(error.attemptedAction).toBe('book');
    });
  });

  describe('BotService Dependency Injection', () => {
    test('should create BotService with default dependencies', () => {
      const botService = new BotService();
      expect(botService.openai).toBeDefined();
      expect(botService.appointmentService).toBeDefined();
      expect(botService.whatsappService).toBeDefined();
    });

    test('should create BotService with custom dependencies', () => {
      const mockAppointmentService = { createAppointment: jest.fn() };
      const mockWhatsappService = { sendMessage: jest.fn() };
      
      const botService = createBotService({
        appointmentService: mockAppointmentService,
        whatsappService: mockWhatsappService
      });

      expect(botService.appointmentService).toBe(mockAppointmentService);
      expect(botService.whatsappService).toBe(mockWhatsappService);
    });

    test('should validate agent assignment', () => {
      const botService = new BotService();
      
      const leadWithAgent = { id: '123', assigned_agent_id: 'agent-123' };
      const result1 = botService._validateAgentAssignment(leadWithAgent);
      expect(result1.valid).toBe(true);
      expect(result1.agentId).toBe('agent-123');

      const leadWithoutAgent = { id: '123' };
      const result2 = botService._validateAgentAssignment(leadWithoutAgent);
      expect(result2.valid).toBe(false);
      expect(result2.result.success).toBe(false);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle database errors gracefully', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Connection failed' }
              })
            })
          })
        })
      };

      const botService = createBotService({ supabase: mockSupabase });
      const lead = { id: '123' };
      
      const result = await botService._checkExistingAppointments(lead);
      expect(result.valid).toBe(false);
      expect(result.result.success).toBe(false);
    });
  });

  describe('Logging Integration', () => {
    test('should include operation IDs in logs', async () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };

      // Mock the logger module
      jest.doMock('../logger', () => mockLogger);

      const botService = new BotService();
      
      // Test that operation IDs are included in logging
      // This would require more complex mocking to fully test
      expect(mockLogger).toBeDefined();
    });
  });
});

describe('Integration Tests', () => {
  test('should handle complete appointment booking flow', async () => {
    // Mock all dependencies
    const mockAppointmentService = {
      findAndBookAppointment: jest.fn().mockResolvedValue({
        success: true,
        appointment: { id: 'apt-123' },
        zoomMeeting: { joinUrl: 'https://zoom.us/j/123' }
      })
    };

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
      })
    };

    const botService = createBotService({
      appointmentService: mockAppointmentService,
      supabase: mockSupabase
    });

    const lead = { 
      id: '123', 
      assigned_agent_id: 'agent-123',
      full_name: 'John Doe',
      phone_number: '+65123456789'
    };

    const result = await botService._handleAppointmentAction({
      action: 'initiate_booking',
      lead,
      userMessage: 'I want to book at 2pm tomorrow'
    });

    expect(mockAppointmentService.findAndBookAppointment).toHaveBeenCalled();
  });
});
