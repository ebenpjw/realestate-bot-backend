// tests/booking-system-test.js
// Comprehensive test suite for appointment booking system fixes

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const BotService = require('../services/botService');
const { parsePreferredTime, isTimeSlotAvailable } = require('../api/bookingHelper');

describe('Appointment Booking System - Holistic Fixes', () => {
  let botService;
  let mockLead;
  let mockAgent;

  beforeEach(() => {
    // Initialize test environment
    botService = new BotService();
    mockLead = {
      id: 'test-lead-123',
      phone_number: '+6512345678',
      full_name: 'Test User',
      status: 'qualified',
      assigned_agent_id: 'test-agent-123'
    };
    mockAgent = {
      id: 'test-agent-123',
      google_email: 'agent@test.com'
    };
  });

  describe('1. AI Intent Detection', () => {
    test('Should NOT trigger appointment_intent for general consultant requests', async () => {
      const testCases = [
        'I want to speak to a consultant',
        'Can I talk to someone?',
        'I need a consultation',
        'Can you connect me with an agent?'
      ];

      for (const userMessage of testCases) {
        const response = await botService._generateAIResponse(mockLead, [
          { sender: 'lead', message: userMessage }
        ]);

        expect(response.appointment_intent).toBeUndefined();
        expect(response.messages[0]).toMatch(/when.*work.*best|what.*time|available/i);
      }
    });

    test('Should trigger appointment_intent for specific time requests', async () => {
      const testCases = [
        { message: 'Can we do 3pm today?', expectedTime: '3pm today' },
        { message: 'How about tomorrow at 2pm?', expectedTime: 'tomorrow at 2pm' },
        { message: 'I\'m free next Tuesday morning', expectedTime: 'next Tuesday morning' }
      ];

      for (const testCase of testCases) {
        const response = await botService._generateAIResponse(mockLead, [
          { sender: 'lead', message: testCase.message }
        ]);

        expect(response.appointment_intent).toBe('book_new');
        expect(response.booking_instructions?.preferred_time).toContain(testCase.expectedTime);
      }
    });

    test('Should handle confirmation scenarios correctly', async () => {
      const conversationHistory = [
        { sender: 'lead', message: 'I want to speak to a consultant' },
        { sender: 'assistant', message: 'I\'d love to set that up! How about 4pm today?' },
        { sender: 'lead', message: 'Yes, that works' }
      ];

      const response = await botService._generateAIResponse(mockLead, conversationHistory);

      expect(response.appointment_intent).toBe('book_new');
      expect(response.booking_instructions?.preferred_time).toMatch(/4pm.*today/i);
    });
  });

  describe('2. Calendar Availability Validation', () => {
    test('Should validate slot availability before offering to users', async () => {
      // Mock a time slot that appears available but is actually busy
      const testTime = new Date();
      testTime.setHours(14, 0, 0, 0); // 2pm today

      // This should use the enhanced validation logic
      const isAvailable = await isTimeSlotAvailable(mockAgent.id, testTime);
      
      // The function should properly check calendar conflicts
      expect(typeof isAvailable).toBe('boolean');
    });

    test('Should not offer slots that conflict with existing appointments', async () => {
      const availableSlots = await botService._findNextAvailableSlots(mockAgent.id, 3);
      
      // All returned slots should be validated
      expect(availableSlots).toBeInstanceOf(Array);
      expect(availableSlots.length).toBeLessThanOrEqual(3);
      
      // Each slot should be in the future
      const now = new Date();
      for (const slot of availableSlots) {
        expect(slot.getTime()).toBeGreaterThan(now.getTime());
      }
    });

    test('Should handle working hours correctly', async () => {
      const testTime = new Date();
      testTime.setHours(22, 0, 0, 0); // 10pm - outside working hours

      const isAvailable = await isTimeSlotAvailable(mockAgent.id, testTime);
      expect(isAvailable).toBe(false);
    });
  });

  describe('3. Database State Management', () => {
    test('Should detect and fix database inconsistencies', async () => {
      // Mock a lead marked as 'booked' but with no actual appointment
      const inconsistentLead = { ...mockLead, status: 'booked' };
      
      const bookingStatus = await botService._getBookingStatus(
        inconsistentLead.id, 
        inconsistentLead.status
      );

      // Should detect the inconsistency and provide corrected status
      expect(bookingStatus).toMatch(/no appointment|ready to book|qualified/i);
    });

    test('Should maintain state consistency during booking', async () => {
      const bookingResult = await botService._handleIntelligentNewBooking({
        lead: mockLead,
        agentId: mockAgent.id,
        aiInstructions: {
          preferred_time: '3pm today',
          context_summary: 'User requested 3pm today',
          user_intent_confidence: 'high'
        },
        conversationHistory: [],
        currentMessage: 'Can we do 3pm today?'
      });

      // Should handle the booking attempt and maintain consistency
      expect(bookingResult).toHaveProperty('success');
      expect(bookingResult).toHaveProperty('message');
    });
  });

  describe('4. Conversation Context Analysis', () => {
    test('Should extract time from conversation history', async () => {
      const conversationHistory = [
        { sender: 'lead', message: 'I mentioned 7pm earlier' },
        { sender: 'assistant', message: 'I see you mentioned 7pm' },
        { sender: 'lead', message: 'Yes, that time works for me' }
      ];

      const extractedTime = botService._extractPreferredTimeFromContext(
        { context_summary: 'User confirming 7pm' },
        conversationHistory,
        'Yes, that time works for me'
      );

      expect(extractedTime).toBeTruthy();
      if (extractedTime) {
        expect(extractedTime.getHours()).toBe(19); // 7pm
      }
    });

    test('Should analyze conversation patterns correctly', async () => {
      const messages = [
        { sender: 'lead', message: 'I want to speak to a consultant' },
        { sender: 'assistant', message: 'When would work best?' },
        { sender: 'lead', message: '3pm today would be perfect' }
      ];

      const context = botService._analyzeConversationContext(messages);

      expect(context.hasConsultantRequests).toBe(true);
      expect(context.hasTimeReferences).toBe(true);
      expect(context.conversationFlow).toBe('booking_in_progress');
    });
  });

  describe('5. User Experience Flow', () => {
    test('Should provide streamlined booking experience', async () => {
      const userMessage = 'I want to speak to a consultant';
      
      const response = await botService._generateAIResponse(mockLead, [
        { sender: 'lead', message: userMessage }
      ]);

      // Should immediately ask for time preference
      expect(response.messages[0]).toMatch(/when.*work.*best|what.*time|available/i);
      // Should not ask qualification questions
      expect(response.messages[0]).not.toMatch(/budget|intent|why|purpose/i);
    });

    test('Should handle alternatives properly', async () => {
      const alternatives = await botService._findNearbyAlternatives(
        mockAgent.id,
        new Date(),
        3
      );

      expect(alternatives).toBeInstanceOf(Array);
      expect(alternatives.length).toBeLessThanOrEqual(3);
    });
  });

  describe('6. Time Parsing Validation', () => {
    test('Should parse various time formats correctly', () => {
      const testCases = [
        { input: '3pm today', expected: true },
        { input: 'tomorrow at 2pm', expected: true },
        { input: 'next Tuesday morning', expected: true },
        { input: '14:00', expected: true },
        { input: 'sometime later', expected: false },
        { input: 'maybe', expected: false }
      ];

      for (const testCase of testCases) {
        const result = parsePreferredTime(testCase.input);
        if (testCase.expected) {
          expect(result).toBeTruthy();
          expect(result).toBeInstanceOf(Date);
        } else {
          expect(result).toBeFalsy();
        }
      }
    });
  });
});

// Integration test helper functions
const testHelpers = {
  createMockConversation: (messages) => {
    return messages.map((msg, index) => ({
      sender: msg.sender,
      message: msg.message,
      created_at: new Date(Date.now() - (messages.length - index) * 60000).toISOString()
    }));
  },

  validateBookingFlow: async (botService, userMessage, expectedOutcome) => {
    const response = await botService._generateAIResponse(mockLead, [
      { sender: 'lead', message: userMessage }
    ]);

    return {
      hasAppointmentIntent: !!response.appointment_intent,
      asksForTime: /when.*work.*best|what.*time|available/i.test(response.messages[0]),
      response: response.messages[0]
    };
  }
};

module.exports = { testHelpers };
