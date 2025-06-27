const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');
const whatsappService = require('./whatsappService');
const appointmentService = require('./appointmentService');
const { findOrCreateLead } = require('../api/leadManager');
const CacheManager = require('../utils/cache');
const { AI, CACHE } = require('../constants');
const { ExternalServiceError } = require('../middleware/errorHandler');

class BotService {
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

    // Valid lead update fields and their validation rules (matching actual database schema)
    this.VALID_LEAD_FIELDS = {
      'intent': (value) => {
        if (typeof value !== 'string') return false;
        const normalizedValue = value.toLowerCase().trim();
        const validIntents = [
          'own_stay', 'investment', 'hybrid', 'own stay', 'ownstay', 'own-stay',
          'buy', 'purchase', 'invest', 'owning', 'living', 'residence', 'home'
        ];
        return validIntents.includes(normalizedValue) || normalizedValue.includes('own') || normalizedValue.includes('stay');
      },
      'budget': (value) => {
        if (typeof value !== 'string') return false;
        const trimmedValue = value.trim();
        return trimmedValue.length > 0 && trimmedValue.length <= 255;
      },
      'status': (value) => {
        if (typeof value !== 'string') return false;
        const validStatuses = [
          'new', 'qualified', 'booked', 'booking_alternatives_offered',
          'appointment_cancelled', 'needs_human_handoff', 'converted', 'lost'
        ];
        return validStatuses.includes(value.toLowerCase().trim());
      },
      'location_preference': (value) => typeof value === 'string' && value.length <= 255 && value.trim().length > 0,
      'property_type': (value) => typeof value === 'string' && value.length <= 100 && value.trim().length > 0,
      'timeline': (value) => typeof value === 'string' && value.length <= 100 && value.trim().length > 0,
      'additional_notes': (value) => typeof value === 'string' && value.length <= 2000,
      'booking_alternatives': (value) => value === null || (typeof value === 'object' && Array.isArray(value)),
      'full_name': (value) => typeof value === 'string' && value.length <= 255 && value.trim().length > 0,
      'source': (value) => typeof value === 'string' && value.length <= 100 && value.trim().length > 0,
      'assigned_agent_id': (value) => typeof value === 'string' && value.length === 36 // UUID format
    };
  }

  /**
   * Main entry point - process incoming WhatsApp message
   */
  async processMessage({ senderWaId, userText, senderName }) {
    let lead = null;

    try {
      logger.info({ senderWaId, senderName }, `Received message: "${userText}"`);

      // 1. Find or create lead
      lead = await this._findOrCreateLead({ senderWaId, senderName, userText });

      // 2. Save user message to conversation history FIRST
      const { error: messageError } = await supabase.from('messages').insert({
        lead_id: lead.id,
        sender: 'lead',
        message: userText
      });

      if (messageError) {
        logger.error({ err: messageError, leadId: lead.id }, 'Failed to save user message');
        // Continue processing but log the error
      }

      // 3. Get conversation history (now includes current message)
      const previousMessages = await this._getConversationHistory(lead.id);

      // 4. Generate AI response with appointment handling
      const response = await this._generateCompleteResponse(lead, previousMessages, userText);

      // 5. Update lead with any changes from AI response
      if (response.lead_updates && Object.keys(response.lead_updates).length > 0) {
        lead = await this._updateLead(lead, response.lead_updates);
      }

      // 6. Send single consolidated message
      if (response.message) {
        await whatsappService.sendMessage({ to: senderWaId, message: response.message });

        // Save assistant response to conversation history
        const { error: assistantMessageError } = await supabase.from('messages').insert({
          lead_id: lead.id,
          sender: 'assistant',
          message: response.message
        });

        if (assistantMessageError) {
          logger.error({ err: assistantMessageError, leadId: lead.id }, 'Failed to save assistant message');
        }
      }

      logger.info({ leadId: lead.id, action: response.action }, 'Message processed successfully');

    } catch (err) {
      logger.error({ err, senderWaId }, 'Error processing message');

      // Send fallback message and save to conversation history
      try {
        const fallbackMessage = "Sorry, I had a slight issue there. Could you say that again?";
        await whatsappService.sendMessage({
          to: senderWaId,
          message: fallbackMessage
        });

        // Save fallback message to conversation history if we have a lead
        if (lead?.id) {
          await supabase.from('messages').insert({
            lead_id: lead.id,
            sender: 'assistant',
            message: fallbackMessage
          });
        }
      } catch (fallbackErr) {
        logger.error({ err: fallbackErr }, 'Failed to send fallback message');
      }
    }
  }

  /**
   * Find or create lead with error handling
   * @private
   */
  async _findOrCreateLead({ senderWaId, senderName, _userText }) {
    try {
      const lead = await findOrCreateLead({
        phoneNumber: senderWaId,
        fullName: senderName,
        source: 'WA Direct'
      });
      
      // Note: User message will be saved along with assistant response
      
      logger.info({ leadId: lead.id, senderWaId }, 'Lead found/created successfully');
      return lead;
    } catch (error) {
      logger.error({ err: error, senderWaId, senderName }, 'Critical error in lead creation');
      throw new Error(`Lead creation failed: ${error.message}`);
    }
  }

  /**
   * Get conversation history
   * @private
   */
  async _getConversationHistory(leadId) {
    const { data: history } = await supabase
      .from('messages')
      .select('sender, message')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    return history ? history.map(entry => ({ 
      sender: entry.sender, 
      message: entry.message 
    })).reverse() : [];
  }

  /**
   * Generate complete response including AI + appointment handling
   * @private
   */
  async _generateCompleteResponse(lead, previousMessages, userText) {
    // Generate AI response
    const aiResponse = await this._generateAIResponse(lead, previousMessages);

    // Combine AI messages
    const messages = aiResponse.messages.filter(msg => msg);

    // Handle appointment actions and add to messages
    if (['initiate_booking', 'reschedule_appointment', 'cancel_appointment', 'select_alternative'].includes(aiResponse.action)) {
      const appointmentMessage = await this._handleAppointmentAction({
        action: aiResponse.action,
        lead,
        userMessage: aiResponse.user_message || userText
      });

      if (appointmentMessage) {
        messages.push(appointmentMessage);
      }
    }

    return {
      message: messages.join('\n\n'),
      action: aiResponse.action,
      lead_updates: aiResponse.lead_updates
    };
  }

  /**
   * Generate AI response
   * @private
   */
  async _generateAIResponse(lead, previousMessages) {
    try {
      // Temporarily disable caching to fix conversation flow issues
      // TODO: Re-enable caching after fixing conversation history timing

      // Generate fresh response
      const response = await this._generateFreshAIResponse(lead, previousMessages);

      return response;

    } catch (error) {
      logger.error({ err: error, leadId: lead?.id }, 'AI service error');
      return this.fallbackResponse;
    }
  }

  /**
   * Generate fresh AI response from OpenAI
   * @private
   */
  async _generateFreshAIResponse(lead, previousMessages) {
    const prompt = await this._buildPrompt(lead, previousMessages);
    
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
  async _buildPrompt(lead, previousMessages) {
    const bookingStatus = await this._getBookingStatus(lead.id, lead.status);

    const memoryContext = `
<lead_data>
  <name>${lead.full_name || 'Not provided'}</name>
  <phone>${lead.phone_number || 'N/A'}</phone>
  <status>${lead.status || 'new'}</status>
  <budget>${lead.budget || 'Not yet known'}</budget>
  <intent>${lead.intent || 'Not yet known'}</intent>
  <booking_status>${bookingStatus}</booking_status>
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
    <rule id="6" name="Appointment Management">CRITICAL: ONLY use 'reschedule_appointment' or 'cancel_appointment' actions if booking_status shows "Has scheduled appointment". If booking_status shows "No appointment scheduled yet", "Previously cancelled appointment", or any other status, treat reschedule/cancel requests as new booking requests using 'initiate_booking' instead.</rule>
    <rule id="7" name="Dynamic Alternative Handling">CRITICAL: Always check the current booking_status in <lead_data>:
      - If booking_status is "No appointment scheduled yet" or "qualified": Use 'initiate_booking' for ANY time request
      - If booking_status is "booking_alternatives_offered": You have TWO options:
        * If they select from offered alternatives (e.g., "1", "2", "3", "option 1", "the Monday slot", "first one", "second", "third"), use 'select_alternative' action
        * If they request a NEW time not in the alternatives (e.g., "how about 6pm?", "tomorrow at 2pm"), use 'initiate_booking' action to check their new preferred time dynamically</rule>
    <rule id="8" name="Ignore Old Conversation">If the current booking_status shows "qualified" or "No appointment scheduled yet", IGNORE any previous mentions of time slots in the conversation history. Always use 'initiate_booking' to check new time requests fresh.</rule>
    <rule id="9" name="Flexible Booking">NEVER force users to pick only from pre-offered alternatives. If they suggest a new time, always check it dynamically using 'initiate_booking' action.</rule>
  </conversation_flow_rules>

  <tools>
    <tool name="initiate_booking">
      Use this when:
      - The lead agrees to a consultation call for the first time
      - The lead requests ANY specific time (e.g., "5pm today", "how about 6pm", "tomorrow at 2pm")
      - The lead suggests a new time different from offered alternatives
      - The current booking_status is "qualified" or "No appointment scheduled yet" and they mention any time
      IMPORTANT: Always use this for time requests when booking_status is NOT "booking_alternatives_offered"
      The system will intelligently check their time preference and either book it or offer new alternatives.
    </tool>
    <tool name="select_alternative">
      Use this ONLY when the lead clearly selects from previously offered alternatives (e.g., "option 1", "the Monday slot", "I'll take the 3pm").
    </tool>
    <tool name="reschedule_appointment">
      ONLY use this when booking_status shows "Has scheduled appointment" AND the lead wants to change their existing appointment time.
    </tool>
    <tool name="cancel_appointment">
      ONLY use this when booking_status shows "Has scheduled appointment" AND the lead wants to cancel their existing appointment.
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
  async _getBookingStatus(leadId, leadStatus) {
    // Check if there's an active appointment in the database
    try {
      const { data: activeAppointment } = await supabase
        .from('appointments')
        .select('id, status, appointment_time')
        .eq('lead_id', leadId)
        .eq('status', 'scheduled')
        .limit(1)
        .maybeSingle();

      if (activeAppointment) {
        return 'Has scheduled appointment - can reschedule or cancel';
      }
    } catch (error) {
      logger.warn({ err: error, leadId }, 'Error checking appointment status');
    }

    // Fall back to lead status
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
   * Update lead with validated data
   * @private
   */
  async _updateLead(lead, updates) {
    try {
      if (!lead?.id) {
        logger.error({ lead, updates }, 'Cannot update lead - invalid lead object');
        return lead;
      }

      const validatedUpdates = this._validateLeadUpdates(updates);

      if (Object.keys(validatedUpdates).length > 0) {
        // Add updated_at timestamp
        validatedUpdates.updated_at = new Date().toISOString();

        const { data: updatedLead, error } = await supabase
          .from('leads')
          .update(validatedUpdates)
          .eq('id', lead.id)
          .select()
          .single();

        if (error) {
          logger.error({ err: error, leadId: lead.id, updates: validatedUpdates }, 'Failed to update lead');
          return lead; // Return original lead if update fails
        }

        logger.info({ leadId: lead.id, updates: Object.keys(validatedUpdates) }, 'Lead updated successfully');
        return updatedLead;
      } else {
        logger.debug({ leadId: lead.id, originalUpdates: updates }, 'No valid updates to apply');
      }

      return lead;
    } catch (error) {
      logger.error({ err: error, leadId: lead?.id, updates }, 'Error updating lead');
      return lead;
    }
  }

  /**
   * Validate lead updates
   * @private
   */
  _validateLeadUpdates(updates) {
    const validatedUpdates = {};

    for (const [field, value] of Object.entries(updates)) {
      if (this.VALID_LEAD_FIELDS[field]) {
        try {
          if (this.VALID_LEAD_FIELDS[field](value)) {
            if (field === 'booking_alternatives' && Array.isArray(value)) {
              validatedUpdates[field] = JSON.stringify(value);
            } else if (typeof value === 'string') {
              validatedUpdates[field] = value.trim();
            } else {
              validatedUpdates[field] = value;
            }
            logger.debug({ field, value: validatedUpdates[field] }, 'Lead field validated successfully');
          } else {
            logger.warn({ field, value }, 'Invalid value for lead field, skipping update');
          }
        } catch (error) {
          logger.error({ err: error, field, value }, 'Error validating lead field');
        }
      } else {
        logger.warn({ field, value }, 'Unknown lead field, skipping update');
      }
    }

    return validatedUpdates;
  }

  /**
   * Handle appointment actions and return message
   * @private
   */
  async _handleAppointmentAction({ action, lead, userMessage }) {
    try {
      const agentId = lead.assigned_agent_id;
      if (!agentId) {
        logger.error({ leadId: lead.id }, 'Cannot handle appointment action, lead is not assigned to an agent');
        return "Apologies, I can't manage appointments right now as I can't find an available consultant. Please try again shortly.";
      }

      switch (action) {
        case 'initiate_booking':
          return await this._handleInitialBooking({ lead, agentId, userMessage });

        case 'reschedule_appointment':
          return await this._handleRescheduleAppointment({ lead, agentId, userMessage });

        case 'cancel_appointment':
          return await this._handleCancelAppointment({ lead });

        case 'select_alternative':
          return await this._handleAlternativeSelection({ lead, agentId, userMessage });

        default:
          logger.warn({ action, leadId: lead.id }, 'Unknown appointment action');
          return '';
      }
    } catch (error) {
      logger.error({ err: error, action, leadId: lead.id }, 'Error handling appointment action');
      return "Sorry, I had an issue processing your appointment request. Please try again or let me know if you need help.";
    }
  }

  /**
   * Handle initial booking
   * @private
   */
  async _handleInitialBooking({ lead, agentId, userMessage }) {
    try {
      // Check if lead is already booked - should not be offering new bookings
      if (lead.status === 'booked') {
        logger.warn({ leadId: lead.id, userMessage }, 'Attempted to book new appointment for already booked lead');
        return "You already have a consultation scheduled! Would you like to reschedule or cancel your existing appointment instead?";
      }

      // If alternatives were offered but user requests a new time, clear alternatives and process new request
      if (lead.status === 'booking_alternatives_offered') {
        logger.info({ leadId: lead.id, userMessage }, 'User requesting new time while alternatives offered - clearing alternatives and processing new request');

        // Clear alternatives status to allow new booking attempt
        await supabase.from('leads').update({
          status: 'qualified',
          booking_alternatives: null
        }).eq('id', lead.id);

        // Update lead object for this request
        lead.status = 'qualified';
        lead.booking_alternatives = null;
      }

      const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

      const result = await appointmentService.findAndBookAppointment({
        leadId: lead.id,
        agentId,
        userMessage,
        leadName: lead.full_name,
        leadPhone: lead.phone_number,
        consultationNotes
      });

      if (result.success) {
        // Update lead status to booked
        await supabase.from('leads').update({ status: 'booked' }).eq('id', lead.id);
        logger.info({ leadId: lead.id, appointmentId: result.appointment.id }, 'Appointment booked successfully');
      } else if (result.type === 'alternatives_offered') {
        // Store alternatives and update status
        await supabase.from('leads').update({
          status: 'booking_alternatives_offered',
          booking_alternatives: JSON.stringify(result.alternatives)
        }).eq('id', lead.id);
      }

      return result.message;

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in initial booking');
      return "I'm having trouble booking your appointment right now. Let me have our consultant contact you directly to arrange a suitable time.";
    }
  }

  /**
   * Handle appointment rescheduling
   * @private
   */
  async _handleRescheduleAppointment({ lead, agentId, userMessage }) {
    try {
      // Check if there's an existing appointment
      const { data: existingAppointment } = await supabase
        .from('appointments')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled')
        .limit(1)
        .single();

      if (!existingAppointment) {
        return "I couldn't find an existing appointment to reschedule. Would you like to book a new consultation instead?";
      }

      // Use booking helper to find new time
      const { findMatchingSlot } = require('../api/bookingHelper');
      const { exactMatch, alternatives } = await findMatchingSlot(agentId, userMessage);

      if (exactMatch) {
        // Update the existing appointment
        await appointmentService.rescheduleAppointment({
          appointmentId: existingAppointment.id,
          newTime: exactMatch,
          reason: `Rescheduled via WhatsApp: ${userMessage}`
        });

        return `Perfect! I've rescheduled your consultation to ${exactMatch.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${exactMatch.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}.\n\nYour Zoom link remains the same: ${existingAppointment.zoom_join_url}\n\nLooking forward to speaking with you soon!`;
      } else if (alternatives.length > 0) {
        // Offer alternatives for rescheduling
        const topAlternatives = alternatives.slice(0, 3);
        const alternativeText = topAlternatives.map((slot, index) =>
          `${index + 1}. ${slot.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${slot.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}`
        ).join('\n');

        // Store alternatives
        await supabase.from('leads').update({
          status: 'booking_alternatives_offered',
          booking_alternatives: JSON.stringify(topAlternatives)
        }).eq('id', lead.id);

        return `I couldn't find availability for your exact preferred time, but here are some available slots for rescheduling:\n\n${alternativeText}\n\nWhich one works best for you? Just reply with the number!`;
      } else {
        return "I'm sorry, but I couldn't find any available slots for your preferred time. Let me have our consultant reach out to you directly to find a suitable time. Is that okay?";
      }
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in reschedule appointment');
      return "I'm having trouble rescheduling your appointment right now. Let me have our consultant contact you directly to arrange a new time. Sorry for the inconvenience!";
    }
  }

  /**
   * Handle appointment cancellation
   * @private
   */
  async _handleCancelAppointment({ lead }) {
    try {
      const { data: existingAppointment } = await supabase
        .from('appointments')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled')
        .single();

      if (!existingAppointment) {
        return "I couldn't find an existing appointment to cancel. Is there anything else I can help you with?";
      }

      const result = await appointmentService.cancelAppointment({
        appointmentId: existingAppointment.id
      });

      // Update lead status
      await supabase.from('leads').update({ status: 'appointment_cancelled' }).eq('id', lead.id);

      return result.message;
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in cancel appointment');
      return "I'm having trouble cancelling your appointment right now. Let me have our consultant contact you directly.";
    }
  }

  /**
   * Handle alternative selection
   * @private
   */
  async _handleAlternativeSelection({ lead, agentId, userMessage }) {
    try {
      // Get stored alternatives from lead
      const storedAlternatives = lead.booking_alternatives ? JSON.parse(lead.booking_alternatives) : [];

      if (storedAlternatives.length === 0) {
        return "I don't have any alternative slots stored. Let me find some available times for you.";
      }

      // Parse user selection (e.g., "1", "3", "option 2", "the first one")
      const lowerMessage = userMessage.toLowerCase().trim();
      let selectedIndex = -1;

      // Check for direct number selection (1, 2, 3)
      const numberMatch = lowerMessage.match(/^(\d+)$/);
      if (numberMatch) {
        selectedIndex = parseInt(numberMatch[1]) - 1;
      } else {
        // Check for other selection patterns
        const selectionMatch = lowerMessage.match(/(?:option\s*)?(\d+)|first|second|third|1st|2nd|3rd/);
        if (selectionMatch) {
          if (selectionMatch[1]) {
            selectedIndex = parseInt(selectionMatch[1]) - 1;
          } else if (selectionMatch[0].includes('first') || selectionMatch[0].includes('1st')) {
            selectedIndex = 0;
          } else if (selectionMatch[0].includes('second') || selectionMatch[0].includes('2nd')) {
            selectedIndex = 1;
          } else if (selectionMatch[0].includes('third') || selectionMatch[0].includes('3rd')) {
            selectedIndex = 2;
          }
        }
      }

      logger.info({
        userMessage,
        lowerMessage,
        selectedIndex,
        storedAlternativesCount: storedAlternatives.length
      }, 'Parsing alternative selection');

      if (selectedIndex >= 0 && selectedIndex < storedAlternatives.length) {
        const selectedSlot = new Date(storedAlternatives[selectedIndex]);
        const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

        // Book the selected alternative
        const result = await appointmentService.createAppointment({
          leadId: lead.id,
          agentId,
          appointmentTime: selectedSlot,
          leadName: lead.full_name,
          leadPhone: lead.phone_number,
          consultationNotes
        });

        // Update lead status and clear alternatives
        await supabase.from('leads').update({
          status: 'booked',
          booking_alternatives: null
        }).eq('id', lead.id);

        return `Perfect! I've booked your consultation for ${selectedSlot.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${selectedSlot.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nI'll send you a reminder before the meeting!`;
      } else {
        return "I'm not sure which time slot you'd prefer. Could you please specify by saying something like 'option 1' or 'the Monday slot'?";
      }
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in alternative selection');
      return "I'm having trouble booking your selected time slot. Let me have our consultant contact you directly.";
    }
  }

  /**
   * Health check for bot service
   */
  async healthCheck() {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
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

module.exports = new BotService();
