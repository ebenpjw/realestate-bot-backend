const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');
const whatsappService = require('./whatsappService');
const { findOrCreateLead } = require('../api/leadManager');
const { AI } = require('../constants');
const { ExternalServiceError } = require('../middleware/errorHandler');
const { toSgTime, formatForDisplay } = require('../utils/timezoneUtils');

class BotService {
  constructor(dependencies = {}) {
    // Dependency injection with defaults
    this.openai = dependencies.openai || new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      timeout: config.OPENAI_TIMEOUT || AI.TIMEOUT,
      maxRetries: AI.RETRY_ATTEMPTS
    });

    this.appointmentService = dependencies.appointmentService || require('./appointmentService');
    this.whatsappService = dependencies.whatsappService || require('./whatsappService');
    this.databaseService = dependencies.databaseService || require('./databaseService');
    this.supabase = dependencies.supabase || supabase;

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
    const operationId = `process-message-${senderWaId}-${Date.now()}`;
    let lead = null;

    try {
      logger.info({
        operationId,
        senderWaId,
        senderName,
        messageLength: userText?.length
      }, `[ENTRY] Processing WhatsApp message: "${userText?.substring(0, 100)}${userText?.length > 100 ? '...' : ''}"`);

      // 1. Find or create lead
      lead = await this._findOrCreateLead({ senderWaId, senderName, userText });

      // 2. Save user message to conversation history FIRST
      const { error: messageError } = await this.supabase.from('messages').insert({
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

      // 6. Send messages naturally (with human-like timing if multiple messages)
      if (response.message) {
        // If it's a single consolidated message, send it
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
      } else if (response.messages && response.messages.length > 0) {
        // Send multiple messages with natural timing
        for (let i = 0; i < response.messages.length; i++) {
          const message = response.messages[i];

          // Add small delay between messages to feel more human (except for first message)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
          }

          await whatsappService.sendMessage({ to: senderWaId, message });

          // Save each message to conversation history
          const { error: assistantMessageError } = await supabase.from('messages').insert({
            lead_id: lead.id,
            sender: 'assistant',
            message: message
          });

          if (assistantMessageError) {
            logger.error({ err: assistantMessageError, leadId: lead.id }, 'Failed to save assistant message');
          }
        }
      }

      logger.info({ leadId: lead.id, action: response.action }, 'Message processed successfully');

    } catch (err) {
      logger.error({ err, senderWaId }, 'Error processing message');

      // Send fallback message and save to conversation history
      try {
        const fallbackMessage = "Sorry, I had a slight issue there. Could you say that again?";
        await this.whatsappService.sendMessage({
          to: senderWaId,
          message: fallbackMessage
        });

        // Save fallback message to conversation history if we have a lead
        if (lead?.id) {
          await this.supabase.from('messages').insert({
            lead_id: lead.id,
            sender: 'assistant',
            message: fallbackMessage
          });
        }

        logger.warn({
          operationId,
          leadId: lead?.id,
          senderWaId
        }, '[EXIT] Sent fallback message due to processing error');

      } catch (fallbackErr) {
        logger.error({
          err: fallbackErr,
          operationId,
          leadId: lead?.id,
          senderWaId
        }, '[EXIT] Failed to send fallback message');
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

    // Handle appointment actions first - they take priority over AI messages
    if (['initiate_booking', 'reschedule_appointment', 'cancel_appointment', 'select_alternative'].includes(aiResponse.action)) {
      const appointmentResult = await this._handleAppointmentAction({
        action: aiResponse.action,
        lead,
        userMessage: aiResponse.user_message || userText
      });

      // If appointment action was handled successfully, use its message directly
      // This prevents contradictory messages from AI + appointment handler
      if (appointmentResult && appointmentResult.message) {
        return {
          message: appointmentResult.message,
          action: aiResponse.action,
          lead_updates: aiResponse.lead_updates,
          appointmentHandled: true
        };
      }
    }

    // If no appointment action or appointment action failed, use AI messages
    const messages = aiResponse.messages.filter(msg => msg);

    // Return in the new format that supports both single message and multiple messages
    if (messages.length === 1) {
      return {
        message: messages[0],
        action: aiResponse.action,
        lead_updates: aiResponse.lead_updates,
        appointmentHandled: false
      };
    } else {
      return {
        messages: messages,
        action: aiResponse.action,
        lead_updates: aiResponse.lead_updates,
        appointmentHandled: false
      };
    }
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
    You are Doro, a 28-year-old Singaporean real estate assistant. You're smart, casual, and genuinely helpful. Think of yourself as someone's savvy friend who happens to work in property and knows all the insider tips.
  </role_and_identity>

  <personality>
    • Casual Singlish when it feels natural (don't force it)
    • Confident but not pushy - you know your stuff
    • Break up messages like a real person texting (use message1 and message2)
    • No corporate speak or overly polite language
    • Don't repeat names constantly - that's weird
    • Conversational, like you're chatting with a friend
  </personality>

  <conversation_intelligence>
    • Ask follow-up questions that show you're listening
    • Build genuine interest before suggesting anything
    • Look for buying signals: urgency, specific questions, timeline mentions
    • Understand their story and motivations, not just data points
    • Only suggest consultation when they seem genuinely interested and engaged
    • Make them want to talk to your consultants, don't just offer it
  </conversation_intelligence>

  <natural_conversation_flow>
    • Start by understanding what's driving their interest
    • Ask about their situation, timeline, concerns
    • Share relevant market insights that add value
    • Build rapport through genuine conversation
    • When they're engaged and asking good questions, that's when you suggest speaking to a consultant
    • Let conversations evolve organically - no rigid scripts
  </natural_conversation_flow>

  <consultation_approach>
    • Don't jump straight to booking - build interest first
    • Use phrases like "might be worth chatting with" instead of "let's book an appointment"
    • Position consultants as helpful experts, not salespeople
    • Only use booking actions when they explicitly want to schedule something
    • Budget amounts (2m, $2M) are NOT booking triggers - they're conversation points
  </consultation_approach>

  <available_actions>
    <action name="continue">Use for normal conversation flow (95% of the time)</action>
    <action name="initiate_booking">ONLY when they explicitly want to book or mention specific times</action>
    <action name="select_alternative">When choosing from offered time slots</action>
    <action name="reschedule_appointment">When changing existing appointments</action>
    <action name="cancel_appointment">When cancelling existing appointments</action>
  </available_actions>

  <response_format>
    Respond ONLY in valid JSON format:
    {
      "message1": "First message (keep it conversational and natural)",
      "message2": "Second message if needed (like a follow-up text)",
      "lead_updates": {
        "intent": "own_stay|investment (if naturally discovered)",
        "budget": "budget_range (if naturally shared)",
        "status": "only update if appointment actually scheduled"
      },
      "action": "continue (default) | initiate_booking | reschedule_appointment | cancel_appointment | select_alternative",
      "user_message": "Include original message only for booking actions"
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

    // Extract messages - prioritize natural conversation flow
    if (response.message1?.trim()) {
      validated.messages.push(response.message1.trim());
    }
    if (response.message2?.trim()) {
      validated.messages.push(response.message2.trim());
    }

    // Fallback message if none provided
    if (validated.messages.length === 0) {
      validated.messages.push("Hey! How can I help you with your property search today?");
    }

    // Validate lead updates - be more lenient with natural conversation
    if (response.lead_updates && typeof response.lead_updates === 'object') {
      validated.lead_updates = response.lead_updates;
    }

    // Validate action - default to continue for natural flow
    const validActions = ['continue', 'initiate_booking', 'reschedule_appointment', 'cancel_appointment', 'select_alternative'];
    if (validActions.includes(response.action)) {
      validated.action = response.action;
    } else {
      // Default to continue if action is invalid - keeps conversation flowing
      validated.action = 'continue';
    }

    // Include user message only for actual booking actions
    if (['initiate_booking', 'reschedule_appointment', 'select_alternative'].includes(validated.action) && response.user_message) {
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
        .select('id, status, appointment_time, zoom_join_url, zoom_meeting_id')
        .eq('lead_id', leadId)
        .eq('status', 'scheduled')
        .limit(1)
        .maybeSingle();

      if (activeAppointment) {
        const appointmentDate = toSgTime(activeAppointment.appointment_time);
        const formattedDateTime = formatForDisplay(appointmentDate, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        let statusMessage = `Has scheduled appointment on ${formattedDateTime}`;

        // Include Zoom link if available and not placeholder
        if (activeAppointment.zoom_join_url && activeAppointment.zoom_join_url !== 'https://zoom.us/j/placeholder') {
          statusMessage += ` (Zoom: ${activeAppointment.zoom_join_url})`;
        }

        statusMessage += ' - can reschedule or cancel';

        return statusMessage;
      }
    } catch (error) {
      logger.warn({ err: error, leadId }, 'Error checking appointment status');
    }

    // CRITICAL FIX: Check for database inconsistencies and fix them
    // If lead status is 'booked' but no appointment exists, this is a data inconsistency
    if (leadStatus === 'booked') {
      logger.warn({ leadId, leadStatus }, 'INCONSISTENCY DETECTED: Lead marked as booked but no appointment found - fixing status');

      // Check if there are stored alternatives that should be processed
      const { data: leadData } = await supabase
        .from('leads')
        .select('booking_alternatives')
        .eq('id', leadId)
        .single();

      if (leadData?.booking_alternatives) {
        // Lead has alternatives but is marked as booked - should be waiting for selection
        await supabase.from('leads').update({
          status: 'booking_alternatives_offered'
        }).eq('id', leadId);

        return 'Has been offered alternative time slots - waiting for selection';
      } else {
        // No alternatives and no appointment - reset to qualified
        await supabase.from('leads').update({
          status: 'qualified'
        }).eq('id', leadId);

        return 'No appointment scheduled yet - ready to book consultation';
      }
    }

    // Fall back to lead status with accurate descriptions
    switch (leadStatus) {
      case 'booking_alternatives_offered':
        return 'Has been offered alternative time slots - waiting for selection';
      case 'appointment_cancelled':
        return 'Previously cancelled appointment - can book new one';
      case 'needs_human_handoff':
        return 'Requires human assistance for booking';
      case 'qualified':
        return 'Qualified lead - ready to book consultation';
      case 'new':
        return 'New lead - needs qualification before booking';
      default:
        return 'No appointment scheduled yet';
    }
  }

  /**
   * Validate agent assignment for appointment actions
   * @private
   */
  _validateAgentAssignment(lead) {
    const agentId = lead.assigned_agent_id;
    if (!agentId) {
      logger.error({ leadId: lead.id }, 'Cannot handle appointment action, lead is not assigned to an agent');
      return {
        valid: false,
        result: {
          success: false,
          message: "Apologies, I can't manage appointments right now as I can't find an available consultant. Please try again shortly."
        }
      };
    }
    return { valid: true, agentId };
  }

  /**
   * Check for existing appointments
   * @private
   */
  async _checkExistingAppointments(lead) {
    try {
      const { data: existingAppointment, error: appointmentCheckError } = await this.supabase
        .from('appointments')
        .select('id, status, appointment_time, agent_id')
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled')
        .limit(1)
        .maybeSingle();

      if (appointmentCheckError) {
        logger.error({ err: appointmentCheckError, leadId: lead.id }, 'Error checking existing appointments');
        return {
          valid: false,
          result: {
            success: false,
            message: "I'm having trouble checking your appointment status. Please try again in a moment."
          }
        };
      }

      return { valid: true, existingAppointment };
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in appointment check');
      return {
        valid: false,
        result: {
          success: false,
          message: "I'm having trouble checking your appointment status. Please try again in a moment."
        }
      };
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
   * Handle appointment actions and return structured result
   * @private
   */
  async _handleAppointmentAction({ action, lead, userMessage }) {
    try {
      // Validate agent assignment
      const agentValidation = this._validateAgentAssignment(lead);
      if (!agentValidation.valid) {
        return agentValidation.result;
      }

      const { agentId } = agentValidation;

      // Check existing appointments
      const appointmentCheck = await this._checkExistingAppointments(lead);
      if (!appointmentCheck.valid) {
        return appointmentCheck.result;
      }

      const { existingAppointment } = appointmentCheck;

      // Log the current appointment state for debugging
      logger.info({
        leadId: lead.id,
        action,
        hasExistingAppointment: !!existingAppointment,
        appointmentId: existingAppointment?.id,
        appointmentTime: existingAppointment?.appointment_time,
        leadStatus: lead.status
      }, 'Processing appointment action with current state');

      switch (action) {
        case 'initiate_booking':
          // Only allow new booking if no existing appointment
          if (existingAppointment) {
            logger.info({ leadId: lead.id, appointmentId: existingAppointment.id }, 'Attempted new booking but appointment already exists');
            const appointmentTime = toSgTime(existingAppointment.appointment_time);
            const formattedTime = formatForDisplay(appointmentTime);
            return {
              success: false,
              message: `You already have a consultation scheduled for ${formattedTime}. Would you like to reschedule it instead?`
            };
          }
          return await this._handleInitialBooking({ lead, agentId, userMessage });

        case 'reschedule_appointment':
          // Only allow reschedule if appointment exists
          if (!existingAppointment) {
            logger.info({ leadId: lead.id }, 'Attempted reschedule but no appointment exists - treating as new booking');
            return await this._handleInitialBooking({ lead, agentId, userMessage });
          }
          return await this._handleRescheduleAppointment({ lead, agentId, userMessage, existingAppointment });

        case 'cancel_appointment':
          // Only allow cancel if appointment exists
          if (!existingAppointment) {
            logger.info({ leadId: lead.id }, 'Attempted cancel but no appointment exists');
            return {
              success: false,
              message: "I couldn't find an existing appointment to cancel. Would you like to book a new consultation instead?"
            };
          }
          // Verify the appointment belongs to the correct agent
          if (existingAppointment.agent_id !== agentId) {
            logger.warn({ leadId: lead.id, appointmentAgentId: existingAppointment.agent_id, currentAgentId: agentId }, 'Agent mismatch for appointment cancellation');
            return {
              success: false,
              message: "I found your appointment, but there seems to be an issue with the consultant assignment. Let me have someone help you with this."
            };
          }
          return await this._handleCancelAppointment({ lead, existingAppointment });

        case 'select_alternative':
          // Validate that alternatives were actually offered
          if (lead.status !== 'booking_alternatives_offered' || !lead.booking_alternatives) {
            logger.info({ leadId: lead.id, leadStatus: lead.status }, 'Attempted alternative selection but no alternatives were offered');
            return {
              success: false,
              message: "I don't see any appointment alternatives to choose from. Let me help you find available times instead."
            };
          }
          // Ensure no existing appointment before processing alternative selection
          if (existingAppointment) {
            logger.info({ leadId: lead.id, appointmentId: existingAppointment.id }, 'Attempted alternative selection but appointment already exists');
            const appointmentTime = toSgTime(existingAppointment.appointment_time);
            const formattedTime = formatForDisplay(appointmentTime);
            return {
              success: false,
              message: `You already have a consultation scheduled for ${formattedTime}. Would you like to reschedule it instead?`
            };
          }
          return await this._handleAlternativeSelection({ lead, agentId, userMessage });

        default:
          logger.warn({ action, leadId: lead.id }, 'Unknown appointment action');
          return { success: false, message: '' };
      }
    } catch (error) {
      logger.error({ err: error, action, leadId: lead.id }, 'Error handling appointment action');
      return {
        success: false,
        message: "Sorry, I had an issue processing your appointment request. Please try again or let me know if you need help."
      };
    }
  }

  /**
   * Handle initial booking
   * @private
   */
  async _handleInitialBooking({ lead, agentId, userMessage }) {
    try {
      // CRITICAL FIX: Remove the blocking logic for 'booked' status
      // The _handleAppointmentAction already checks for actual appointments
      // This method should focus on booking logic, not status validation

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

      const result = await this.appointmentService.findAndBookAppointment({
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
        return {
          success: true,
          message: result.message
        };
      } else if (result.type === 'alternatives_offered') {
        // Store alternatives and update status
        await supabase.from('leads').update({
          status: 'booking_alternatives_offered',
          booking_alternatives: JSON.stringify(result.alternatives)
        }).eq('id', lead.id);
        return {
          success: true,
          message: result.message
        };
      }

      return {
        success: false,
        message: result.message || "I couldn't process your booking request. Please try again."
      };

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in initial booking');
      return {
        success: false,
        message: "I'm having trouble booking your appointment right now. Let me have our consultant contact you directly to arrange a suitable time."
      };
    }
  }

  /**
   * Handle appointment rescheduling
   * @private
   */
  async _handleRescheduleAppointment({ lead, agentId, userMessage, existingAppointment }) {
    try {
      // CRITICAL FIX: Use the passed existingAppointment parameter instead of querying again
      // If not provided, fall back to querying (for backward compatibility)
      let appointment = existingAppointment;

      if (!appointment) {
        const { data: queriedAppointment } = await supabase
          .from('appointments')
          .select('*')
          .eq('lead_id', lead.id)
          .eq('status', 'scheduled')
          .limit(1)
          .single();

        appointment = queriedAppointment;
      }

      if (!appointment) {
        return {
          success: false,
          message: "I couldn't find an existing appointment to reschedule. Would you like to book a new consultation instead?"
        };
      }

      // Use booking helper to find new time
      const { findMatchingSlot } = require('../api/bookingHelper');
      const { exactMatch, alternatives } = await findMatchingSlot(agentId, userMessage);

      if (exactMatch) {
        // Update the existing appointment
        await this.appointmentService.rescheduleAppointment({
          appointmentId: appointment.id,
          newAppointmentTime: exactMatch,
          reason: `Rescheduled via WhatsApp: ${userMessage}`
        });

        const formattedTime = formatForDisplay(toSgTime(exactMatch));
        return {
          success: true,
          message: `Perfect! I've rescheduled your consultation to ${formattedTime}.\n\nYour Zoom link remains the same: ${appointment.zoom_join_url}\n\nLooking forward to speaking with you soon!`
        };
      } else if (alternatives.length > 0) {
        // Offer alternatives for rescheduling
        const topAlternatives = alternatives.slice(0, 3);
        const alternativeText = topAlternatives.map((slot, index) =>
          `${index + 1}. ${formatForDisplay(toSgTime(slot))}`
        ).join('\n');

        // Store alternatives
        await supabase.from('leads').update({
          status: 'booking_alternatives_offered',
          booking_alternatives: JSON.stringify(topAlternatives)
        }).eq('id', lead.id);

        return {
          success: true,
          message: `I couldn't find availability for your exact preferred time, but here are some available slots for rescheduling:\n\n${alternativeText}\n\nWhich one works best for you? Just reply with the number!`
        };
      } else {
        return {
          success: false,
          message: "I'm sorry, but I couldn't find any available slots for your preferred time. Let me have our consultant reach out to you directly to find a suitable time. Is that okay?"
        };
      }
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in reschedule appointment');
      return {
        success: false,
        message: "I'm having trouble rescheduling your appointment right now. Let me have our consultant contact you directly to arrange a new time. Sorry for the inconvenience!"
      };
    }
  }

  /**
   * Handle appointment cancellation
   * @private
   */
  async _handleCancelAppointment({ lead, existingAppointment }) {
    try {
      // CRITICAL FIX: Use the passed existingAppointment parameter instead of querying again
      // If not provided, fall back to querying (for backward compatibility)
      let appointment = existingAppointment;

      if (!appointment) {
        const { data: queriedAppointment } = await supabase
          .from('appointments')
          .select('*')
          .eq('lead_id', lead.id)
          .eq('status', 'scheduled')
          .single();

        appointment = queriedAppointment;
      }

      if (!appointment) {
        return {
          success: false,
          message: "I couldn't find an existing appointment to cancel. Is there anything else I can help you with?"
        };
      }

      const result = await this.appointmentService.cancelAppointment({
        appointmentId: appointment.id
      });

      // Update lead status
      await supabase.from('leads').update({ status: 'appointment_cancelled' }).eq('id', lead.id);

      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in cancel appointment');
      return {
        success: false,
        message: "I'm having trouble cancelling your appointment right now. Let me have our consultant contact you directly."
      };
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
        return {
          success: false,
          message: "I don't have any alternative slots stored. Let me find some available times for you."
        };
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
        const result = await this.appointmentService.createAppointment({
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

        const formattedTime = formatForDisplay(toSgTime(selectedSlot));
        return {
          success: true,
          message: `Perfect! I've booked your consultation for ${formattedTime}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nI'll send you a reminder before the meeting!`
        };
      } else {
        return {
          success: false,
          message: "I'm not sure which time slot you'd prefer. Could you please specify by saying something like 'option 1' or 'the Monday slot'?"
        };
      }
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in alternative selection');
      return {
        success: false,
        message: "I'm having trouble booking your selected time slot. Let me have our consultant contact you directly."
      };
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

// Factory function for creating BotService with dependencies
function createBotService(dependencies = {}) {
  return new BotService(dependencies);
}

// Export singleton instance for backward compatibility
const botServiceInstance = new BotService();

module.exports = botServiceInstance;
module.exports.BotService = BotService;
module.exports.createBotService = createBotService;
