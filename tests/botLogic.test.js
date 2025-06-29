// Tests for bot logic improvements and conversation flow

// Set up test environment variables before importing modules
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.WABA_NUMBER = '1234567890';
process.env.GUPSHUP_API_KEY = 'test-gupshup-key';
process.env.REFRESH_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.WEBHOOK_SECRET_TOKEN = 'test-webhook-secret';
process.env.META_VERIFY_TOKEN = 'test-meta-verify';
process.env.META_APP_SECRET = 'test-meta-secret';

// Mock OpenAI before any other imports
jest.mock('openai', () => {
  const mockCreate = jest.fn(() => Promise.resolve({
    choices: [{
      message: {
        content: JSON.stringify({
          message1: "Test response",
          action: "continue",
          lead_updates: {}
        })
      }
    }]
  }));

  const MockOpenAI = jest.fn(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    }
  }));

  // Return the constructor function directly for CommonJS require
  return MockOpenAI;
});

// Mock dependencies
jest.mock('../supabaseClient', () => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        limit: jest.fn(() => ({
          maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }))
}));

jest.mock('../services/appointmentService', () => ({
  findAndBookAppointment: jest.fn(),
  rescheduleAppointment: jest.fn(),
  cancelAppointment: jest.fn()
}));

// Import BotService after mocks are set up
const BotService = require('../services/botService');

describe('Bot Logic Improvements', () => {
  let botService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // BotService is exported as an instance, not a class
    botService = BotService;
  });

  describe('Conversation Flow Simplification', () => {
    test('should use simplified guidelines instead of rigid rules', async () => {
      const mockLead = {
        id: 'test-lead-id',
        phone_number: '+6512345678',
        full_name: 'Test User',
        status: 'new',
        assigned_agent_id: 'test-agent-id'
      };

      const mockMessages = [
        { sender: 'lead', message: 'Hi, I want to buy a property' }
      ];

      // The bot should process this without getting stuck in rigid rule checking
      const result = await botService.processMessage(mockLead, mockMessages, 'I want to buy a property');
      
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
    });

    test('should handle natural conversation flow', async () => {
      const mockLead = {
        id: 'test-lead-id',
        phone_number: '+6512345678',
        full_name: 'Test User',
        status: 'qualified',
        intent: 'own_stay',
        budget: '2m',
        assigned_agent_id: 'test-agent-id'
      };

      const mockMessages = [
        { sender: 'lead', message: 'Can we meet tomorrow at 3pm?' }
      ];

      // Should handle time requests naturally without overly complex rule checking
      const result = await botService.processMessage(mockLead, mockMessages, 'Can we meet tomorrow at 3pm?');
      
      expect(result).toBeDefined();
      expect(result.action).toBeDefined();
    });
  });

  describe('Appointment State Management', () => {
    test('should check database before processing appointment actions', async () => {
      const supabase = require('../supabaseClient');
      const mockLead = {
        id: 'test-lead-id',
        assigned_agent_id: 'test-agent-id',
        status: 'qualified'
      };

      // Mock database response for existing appointment check
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ 
                  data: { 
                    id: 'existing-appointment-id',
                    status: 'scheduled',
                    appointment_time: '2024-06-15T17:00:00Z',
                    agent_id: 'test-agent-id'
                  }, 
                  error: null 
                }))
              }))
            }))
          }))
        }))
      });

      // Test initiate_booking with existing appointment
      const result = await botService._handleAppointmentAction({
        action: 'initiate_booking',
        lead: mockLead,
        userMessage: 'I want to book at 3pm'
      });

      expect(result).toContain('already have a consultation scheduled');
      expect(supabase.from).toHaveBeenCalledWith('appointments');
    });

    test('should handle appointment cancellation with proper validation', async () => {
      const supabase = require('../supabaseClient');
      const mockLead = {
        id: 'test-lead-id',
        assigned_agent_id: 'test-agent-id',
        status: 'booked'
      };

      // Mock no existing appointment
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null }))
              }))
            }))
          }))
        }))
      });

      const result = await botService._handleAppointmentAction({
        action: 'cancel_appointment',
        lead: mockLead,
        userMessage: 'Cancel my appointment'
      });

      expect(result).toContain("couldn't find an existing appointment to cancel");
    });

    test('should validate agent assignment for appointment actions', async () => {
      const supabase = require('../supabaseClient');
      const mockLead = {
        id: 'test-lead-id',
        assigned_agent_id: 'test-agent-id',
        status: 'booked'
      };

      // Mock existing appointment with different agent
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ 
                  data: { 
                    id: 'existing-appointment-id',
                    status: 'scheduled',
                    appointment_time: '2024-06-15T17:00:00Z',
                    agent_id: 'different-agent-id'  // Different agent
                  }, 
                  error: null 
                }))
              }))
            }))
          }))
        }))
      });

      const result = await botService._handleAppointmentAction({
        action: 'cancel_appointment',
        lead: mockLead,
        userMessage: 'Cancel my appointment'
      });

      expect(result).toContain('issue with the consultant assignment');
    });

    test('should validate alternatives before selection', async () => {
      const supabase = require('../supabaseClient');
      const mockLead = {
        id: 'test-lead-id',
        assigned_agent_id: 'test-agent-id',
        status: 'new', // Not in alternatives offered state
        booking_alternatives: null
      };

      // Mock no existing appointment
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null }))
              }))
            }))
          }))
        }))
      });

      const result = await botService._handleAppointmentAction({
        action: 'select_alternative',
        lead: mockLead,
        userMessage: 'Option 1'
      });

      expect(result).toContain("don't see any appointment alternatives");
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      const supabase = require('../supabaseClient');
      const mockLead = {
        id: 'test-lead-id',
        assigned_agent_id: 'test-agent-id',
        status: 'qualified'
      };

      // Mock database error
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ 
                  data: null, 
                  error: { message: 'Database connection failed' }
                }))
              }))
            }))
          }))
        }))
      });

      const result = await botService._handleAppointmentAction({
        action: 'initiate_booking',
        lead: mockLead,
        userMessage: 'Book at 3pm'
      });

      expect(result).toContain('trouble checking your appointment status');
    });

    test('should handle missing agent assignment', async () => {
      const mockLead = {
        id: 'test-lead-id',
        assigned_agent_id: null, // No agent assigned
        status: 'qualified'
      };

      const result = await botService._handleAppointmentAction({
        action: 'initiate_booking',
        lead: mockLead,
        userMessage: 'Book at 3pm'
      });

      expect(result).toContain("can't find an available consultant");
    });
  });
});
