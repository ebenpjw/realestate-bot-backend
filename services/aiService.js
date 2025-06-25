const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');
const CacheManager = require('../utils/cache');
const { AI, CACHE } = require('../constants');
const { ExternalServiceError } = require('../middleware/errorHandler');

class AIService {
  constructor() {
    this.openai = new OpenAI({ 
      apiKey: config.OPENAI_API_KEY,
      timeout: config.OPENAI_TIMEOUT || AI.TIMEOUT,
      maxRetries: AI.RETRY_ATTEMPTS
    });
    
    this.fallbackResponse = {
      messages: ["Sorry, I had a slight issue there. Could you say that again?"],
      lead_updates: {},
      action: 'continue'
    };
  }

  /**
   * Generate AI response for a lead conversation
   * @param {Object} params - Parameters for AI generation
   * @param {Object} params.lead - Lead information
   * @param {Array} params.previousMessages - Previous conversation messages
   * @returns {Promise<Object>} AI response with messages, updates, and action
   */
  async generateResponse({ lead, previousMessages = [] }) {
    try {
      // Validate inputs
      if (!lead || !lead.id) {
        throw new Error('Lead information is required');
      }

      const safePreviousMessages = Array.isArray(previousMessages) ? previousMessages : [];
      
      // Check cache first
      const cacheKey = `${CACHE.KEYS.AI_RESPONSE}_${lead.id}_${this._hashMessages(safePreviousMessages)}`;
      
      if (config.ENABLE_CACHING) {
        const cachedResponse = CacheManager.get('short', cacheKey);
        if (cachedResponse) {
          logger.debug({ leadId: lead.id }, 'AI response served from cache');
          return cachedResponse;
        }
      }

      // Generate fresh response
      const response = await this._generateFreshResponse(lead, safePreviousMessages);
      
      // Cache the response
      if (config.ENABLE_CACHING && response.action !== 'error') {
        CacheManager.set('short', cacheKey, response, CACHE.TTL.SHORT);
      }

      return response;

    } catch (error) {
      logger.error({ 
        err: error, 
        leadId: lead?.id,
        messageCount: previousMessages?.length 
      }, 'AI service error');
      
      return this.fallbackResponse;
    }
  }

  /**
   * Generate fresh AI response from OpenAI
   * @private
   */
  async _generateFreshResponse(lead, previousMessages) {
    const prompt = this._buildPrompt(lead, previousMessages);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: config.OPENAI_TEMPERATURE || AI.DEFAULT_TEMPERATURE,
        max_tokens: config.OPENAI_MAX_TOKENS || AI.MAX_TOKENS,
        response_format: { type: 'json_object' }
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      const parsedResponse = JSON.parse(responseText);
      
      // Validate response structure
      const validatedResponse = this._validateAIResponse(parsedResponse);
      
      logger.info({ 
        leadId: lead.id, 
        action: validatedResponse.action,
        messageCount: validatedResponse.messages.length,
        hasUpdates: Object.keys(validatedResponse.lead_updates || {}).length > 0
      }, 'AI response generated successfully');

      return validatedResponse;

    } catch (error) {
      if (error.name === 'APIError' || error.name === 'APIConnectionError') {
        throw new ExternalServiceError('OpenAI', error.message, error);
      }
      throw error;
    }
  }

  /**
   * Build the prompt for AI generation
   * @private
   */
  _buildPrompt(lead, previousMessages) {
    const memoryContext = `
<lead_data>
  <name>${lead.full_name || 'Not provided'}</name>
  <phone>${lead.phone_number || 'N/A'}</phone>
  <status>${lead.status || 'new'}</status>
  <budget>${lead.budget || 'Not yet known'}</budget>
  <intent>${lead.intent || 'Not yet known'}</intent>
  <booking_status>${this._getBookingStatus(lead.status)}</booking_status>
</lead_data>
<full_conversation_history>
${previousMessages.map(entry => `${entry.sender === 'lead' ? 'Lead' : 'Doro'}: ${entry.message}`).join('\n')}
</full_conversation_history>`;

    return `
<master_prompt>
  <role_and_identity>
    You are Doro, a savvy, casual, and highly competent real estate assistant in Singapore. Your tone is natural and helpful.
  </role_and_identity>

  <mission>
    Your only goal is to qualify a lead on their intent and budget, then guide them to a 1-hour Zoom consultation with a consultant.
  </mission>

  <conversation_flow_rules>
    <rule id="1" name="Check Memory First">Before asking ANYTHING, check the <lead_data>. NEVER ask for information you already have.</rule>
    <rule id="2" name="Qualification SOP">If qualification info is missing, follow this sequence one question at a time: 1. Intent (are they buying for own stay or for investment?) -> 2. Budget.</rule>
    <rule id="3" name="Pivot to Booking">Once both intent and budget are known, STOP asking questions. Immediately use a tactic from the <tactics_playbook> to offer the Zoom call.</rule>
    <rule id="4" name="Smart Booking">If the lead agrees to a call, use 'initiate_booking' action. Pay attention to time preferences like "tomorrow at 3pm", "Monday morning", "this evening", etc.</rule>
    <rule id="5" name="Handle Booking Responses">After booking attempts, respond appropriately to exact matches, alternative suggestions, or no availability scenarios.</rule>
    <rule id="6" name="Appointment Management">If they want to reschedule or cancel existing appointments, use 'reschedule_appointment' or 'cancel_appointment' actions. Check booking_status first.</rule>
    <rule id="7" name="Alternative Selection">If booking_status shows alternatives were offered, use 'select_alternative' action when they make a choice (e.g., "option 1", "the Monday slot", "3pm works").</rule>
    <rule id="8" name="Booking Context">Always check booking_status before suggesting actions. Don't offer to book if already booked, don't reschedule if no appointment exists.</rule>
  </conversation_flow_rules>

  <tools>
    <tool name="initiate_booking">
      Use this when the lead agrees to a consultation call. The system will intelligently match their time preferences or offer alternatives.
    </tool>
    <tool name="reschedule_appointment">
      Use this when a lead wants to change their existing appointment time. Include their new time preference.
    </tool>
    <tool name="cancel_appointment">
      Use this when a lead wants to cancel their existing appointment.
    </tool>
  </tools>

  <tactics_playbook>
    <tactic name="Value-First Approach">
      "I'd love to share some insights about the current market that could save you thousands. How about a quick 1-hour consultation where I can show you some exclusive opportunities that match your criteria?"
    </tactic>
    <tactic name="Urgency with Benefit">
      "The market is moving fast right now, and I have some properties that fit your profile perfectly. Let's hop on a 1-hour Zoom call so I can walk you through them before they're gone!"
    </tactic>
    <tactic name="Personalized Consultation">
      "Based on what you've shared about your [intent] and [budget], I have some specific recommendations that could be perfect for you. When would be a good time for a 1-hour consultation this week?"
    </tactic>
  </tactics_playbook>

  <response_format>
    Respond ONLY in valid JSON format:
    {
      "message1": "First message to send (required)",
      "message2": "Second message to send (optional)",
      "lead_updates": {
        "intent": "own_stay|investment (if discovered)",
        "budget": "budget_range (if discovered)",
        "status": "booked (if appointment is scheduled)"
      },
      "action": "continue|initiate_booking|reschedule_appointment|cancel_appointment|select_alternative",
      "user_message": "Include the user's original message for time parsing (when action is initiate_booking, reschedule_appointment, or select_alternative)"
    }
  </response_format>
</master_prompt>

${memoryContext}

Respond with appropriate messages and actions based on the conversation context.`;
  }

  /**
   * Validate AI response structure
   * @private
   */
  _validateAIResponse(response) {
    const validated = {
      messages: [],
      lead_updates: {},
      action: 'continue'
    };

    // Extract messages
    if (response.message1?.trim()) {
      validated.messages.push(response.message1.trim());
    }
    if (response.message2?.trim()) {
      validated.messages.push(response.message2.trim());
    }

    // Ensure at least one message
    if (validated.messages.length === 0) {
      validated.messages.push("I'm here to help you with your property needs. What can I assist you with?");
    }

    // Validate lead updates
    if (response.lead_updates && typeof response.lead_updates === 'object') {
      validated.lead_updates = response.lead_updates;
    }

    // Validate action
    const validActions = ['continue', 'initiate_booking', 'reschedule_appointment', 'cancel_appointment', 'select_alternative'];
    if (validActions.includes(response.action)) {
      validated.action = response.action;
    }

    // Include user message for time parsing actions
    if (['initiate_booking', 'reschedule_appointment', 'select_alternative'].includes(response.action) && response.user_message) {
      validated.user_message = response.user_message;
    }

    return validated;
  }

  /**
   * Get booking status description for AI context
   * @private
   */
  _getBookingStatus(leadStatus) {
    switch (leadStatus) {
      case 'booked':
        return 'Has scheduled appointment - can reschedule or cancel';
      case 'booking_alternatives_offered':
        return 'Has been offered alternative time slots - waiting for selection';
      case 'appointment_cancelled':
        return 'Previously cancelled appointment - can book new one';
      case 'needs_human_handoff':
        return 'Requires human assistance for booking';
      default:
        return 'No appointment scheduled yet';
    }
  }

  /**
   * Create a hash of messages for caching
   * @private
   */
  _hashMessages(messages) {
    const crypto = require('crypto');
    const messageString = messages.map(m => `${m.sender}:${m.message}`).join('|');
    return crypto.createHash('md5').update(messageString).digest('hex').substring(0, 8);
  }

  /**
   * Health check for AI service
   */
  async healthCheck() {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use same model as main service for consistency
        messages: [{ role: 'user', content: 'Say "OK" if you can respond.' }],
        max_tokens: 10,
        temperature: 0
      });

      return {
        status: 'healthy',
        model: 'gpt-4o-mini',
        response: response.choices[0]?.message?.content || 'No response'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new AIService();
