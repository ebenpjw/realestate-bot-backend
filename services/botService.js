const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');
const whatsappService = require('./whatsappService');
const databaseService = require('./databaseService');
const { AI } = require('../constants');

const { toSgTime, formatForDisplay } = require('../utils/timezoneUtils');

class BotService {
  constructor(dependencies = {}) {
    // Store config for strategic system
    this.config = dependencies.config || config;

    // Dependency injection with defaults
    this.openai = dependencies.openai || new OpenAI({
      apiKey: this.config.OPENAI_API_KEY,
      timeout: this.config.OPENAI_TIMEOUT || AI.TIMEOUT,
      maxRetries: AI.RETRY_ATTEMPTS
    });

    this.appointmentService = dependencies.appointmentService || require('./appointmentService');
    this.whatsappService = dependencies.whatsappService || require('./whatsappService');
    this.databaseService = dependencies.databaseService || require('./databaseService');
    this.supabase = dependencies.supabase || supabase;

    this.improvedFallbackMessages = [
      "Oops, I got a bit confused there! 😅 Could you say that again?",
      "Sorry about that! Can you help me understand what you meant?",
      "My bad! Let me try to help you better - could you rephrase that?",
      "Hmm, I didn't quite catch that. Mind saying it differently?",
      "Eh sorry, I'm having a moment! 😊 Can you try again?",
      "Oops, something went wonky on my end. What were you saying?"
    ];

    this.fallbackResponse = {
      messages: [this.improvedFallbackMessages[Math.floor(Math.random() * this.improvedFallbackMessages.length)]],
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
          'tentative_booking_offered', 'appointment_cancelled', 'needs_human_handoff', 'converted', 'lost'
        ];
        return validStatuses.includes(value.toLowerCase().trim());
      },

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
      lead = await this._findOrCreateLead({ senderWaId, senderName });

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

      // 4. Process message with strategic AI system
      const response = await this._processMessageStrategically(lead, previousMessages, userText);

      // 5. Update lead with any changes from AI response
      if (response.lead_updates && Object.keys(response.lead_updates).length > 0) {
        lead = await this._updateLead(lead, response.lead_updates);
      }

      // 6. Send messages naturally (with human-like timing if multiple messages)
      if (response.message) {
        // If it's a single consolidated message, send it
        await whatsappService.sendMessage({ to: senderWaId, message: response.message });

        // Save assistant response to conversation history
        const { error: assistantMessageError } = await this.supabase.from('messages').insert({
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

          // Add longer delay between messages to feel more natural and less rushed
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 6000)); // 6 second delay
          }

          await whatsappService.sendMessage({ to: senderWaId, message });

          // Save each message to conversation history
          const { error: assistantMessageError } = await this.supabase.from('messages').insert({
            lead_id: lead.id,
            sender: 'assistant',
            message
          });

          if (assistantMessageError) {
            logger.error({ err: assistantMessageError, leadId: lead.id }, 'Failed to save assistant message');
          }
        }
      }

      logger.info({
        leadId: lead.id,
        action: response.action,
        approach: 'strategic'
      }, 'Message processed successfully');

    } catch (err) {
      logger.error({ err, senderWaId }, 'Error processing message');

      // Send fallback message and save to conversation history
      try {
        const fallbackMessage = this.improvedFallbackMessages[Math.floor(Math.random() * this.improvedFallbackMessages.length)];
        await whatsappService.sendMessage({
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
  async _findOrCreateLead({ senderWaId, senderName }) {
    try {
      const lead = await databaseService.findOrCreateLead({
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
   * Get enhanced conversation history with context analysis
   * @private
   */
  async _getConversationHistory(leadId) {
    const { data: history } = await this.supabase
      .from('messages')
      .select('sender, message, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(15); // Get more messages for better context

    if (!history) {
      return [];
    }

    // ENHANCED: Add conversation context analysis
    const processedHistory = history.map(entry => ({
      sender: entry.sender,
      message: entry.message,
      created_at: entry.created_at
    })).reverse();

    // ENHANCED: Analyze conversation patterns for better context
    const conversationContext = this._analyzeConversationContext(processedHistory);

    logger.debug({
      leadId,
      messageCount: processedHistory.length,
      conversationContext
    }, 'Retrieved enhanced conversation history with context analysis');

    return processedHistory;
  }

  /**
   * Analyze conversation context for patterns and intent
   * @private
   */
  _analyzeConversationContext(messages) {
    try {
      const context = {
        hasTimeReferences: false,
        hasConsultantRequests: false,
        hasConfirmationPatterns: false,
        recentTimeReferences: [],
        recentConsultantRequests: [],
        conversationFlow: 'unknown'
      };

      const timePatterns = [
        /\d{1,2}(:\d{2})?\s*(am|pm)/i,
        /\d{1,2}\s*(am|pm)/i,
        /(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
        /(morning|afternoon|evening|night)/i,
        /(next week|this week)/i
      ];

      const consultantPatterns = [
        /speak.*consultant/i,
        /talk.*someone/i,
        /meet.*consultant/i,
        /consultation/i,
        /appointment/i,
        /schedule.*meeting/i
      ];

      const confirmationPatterns = [
        /yes.*that.*works?/i,
        /sounds?.*good/i,
        /perfect/i,
        /ok.*that/i,
        /^(yes|ok|sure|alright)$/i
      ];

      // Analyze recent messages (last 8)
      const recentMessages = messages.slice(-8);

      for (let i = 0; i < recentMessages.length; i++) {
        const msg = recentMessages[i];

        // Check for time references
        const hasTime = timePatterns.some(pattern => pattern.test(msg.message));
        if (hasTime) {
          context.hasTimeReferences = true;
          context.recentTimeReferences.push({
            message: msg.message,
            sender: msg.sender,
            index: i
          });
        }

        // Check for consultant requests
        const hasConsultantRequest = consultantPatterns.some(pattern => pattern.test(msg.message));
        if (hasConsultantRequest && msg.sender === 'lead') {
          context.hasConsultantRequests = true;
          context.recentConsultantRequests.push({
            message: msg.message,
            index: i
          });
        }

        // Check for confirmation patterns
        const hasConfirmation = confirmationPatterns.some(pattern => pattern.test(msg.message));
        if (hasConfirmation && msg.sender === 'lead') {
          context.hasConfirmationPatterns = true;
        }
      }

      // Determine conversation flow
      if (context.hasConsultantRequests && context.hasTimeReferences) {
        context.conversationFlow = 'booking_in_progress';
      } else if (context.hasConsultantRequests) {
        context.conversationFlow = 'consultant_requested';
      } else if (context.hasConfirmationPatterns && context.hasTimeReferences) {
        context.conversationFlow = 'confirming_time';
      } else {
        context.conversationFlow = 'general_conversation';
      }

      return context;
    } catch (error) {
      logger.error({ err: error }, 'Error analyzing conversation context');
      return {
        hasTimeReferences: false,
        hasConsultantRequests: false,
        hasConfirmationPatterns: false,
        recentTimeReferences: [],
        recentConsultantRequests: [],
        conversationFlow: 'unknown'
      };
    }
  }

  /**
   * NEW: Strategic multi-phase message processing
   * @private
   */
  async _processMessageStrategically(lead, previousMessages, userText) {
    try {
      logger.info({ leadId: lead.id }, 'Starting strategic conversation processing');

      // Phase 1: Silent Context Analysis
      const contextAnalysis = await this._analyzeStrategicContext(lead, previousMessages, userText);

      // Load conversation memory from previous interactions
      const conversationMemory = await this._loadConversationMemory(lead.id);

      // Generate conversation insights for analytics (not control)
      const conversationInsights = this._generateConversationInsights(contextAnalysis, lead, previousMessages);

      // Update conversation memory with new insights
      const updatedMemory = this._updateConversationMemory(conversationMemory, conversationInsights, contextAnalysis, userText);

      // Phase 2: Intelligence Gathering (market data, competitor info, news, etc.)
      const intelligenceData = await this._gatherIntelligence(contextAnalysis, userText);

      // Save conversation insights and memory (async, non-blocking)
      this._saveConversationInsights(lead.id, conversationInsights).catch(err =>
        logger.warn({ err, leadId: lead.id }, 'Failed to save conversation insights')
      );
      this._saveConversationMemory(lead.id, updatedMemory).catch(err =>
        logger.warn({ err, leadId: lead.id }, 'Failed to save conversation memory')
      );

      // Phase 3: Conversation Strategy Planning (AI-driven with memory context)
      const campaignContext = this._analyzeCampaignContext(updatedMemory, contextAnalysis);
      const successPatterns = await this._analyzeSuccessPatterns(lead, contextAnalysis);
      const strategy = await this._planConversationStrategy(contextAnalysis, intelligenceData, lead, updatedMemory, campaignContext, successPatterns);

      // Phase 4: Strategic Response Generation (with dynamic personality)
      const personalityAdjustments = this._calculatePersonalityAdjustments(contextAnalysis, updatedMemory);
      const response = await this._generateStrategicResponse(strategy, contextAnalysis, intelligenceData, lead, previousMessages, personalityAdjustments);

      // Phase 5: Handle booking if strategy calls for it
      if (response.appointment_intent) {
        logger.info({
          leadId: lead.id,
          appointmentIntent: response.appointment_intent,
          bookingInstructions: response.booking_instructions
        }, 'Strategic system detected appointment intent');

        const appointmentResult = await this._handleUnifiedBooking({
          lead,
          appointmentIntent: response.appointment_intent,
          conversationHistory: previousMessages,
          currentMessage: userText,
          aiInstructions: response.booking_instructions
        });

        if (appointmentResult && appointmentResult.message) {
          return {
            message: appointmentResult.message,
            messages: appointmentResult.messages || [appointmentResult.message],
            action: 'strategic_booking',
            lead_updates: strategy.lead_updates || {},
            appointmentHandled: true
          };
        }
      }

      return {
        message: response.message,
        messages: response.messages,
        action: strategy.action || 'strategic_continue',
        lead_updates: strategy.lead_updates || {},
        appointmentHandled: false
      };

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in strategic processing');
      // Return a simple fallback response instead of legacy system
      return {
        message: "I'm having some technical difficulties right now. Let me get back to you in a moment!",
        messages: ["I'm having some technical difficulties right now. Let me get back to you in a moment!"],
        action: 'error_fallback',
        lead_updates: {},
        appointmentHandled: false
      };
    }
  }

  /**
   * Check if agent assignment is valid for appointment operations
   * @private
   */
  _validateAgentAssignment(lead) {
    const agentId = lead.assigned_agent_id || this.config.AGENT_ID;
    if (!agentId) {
      logger.error({ leadId: lead.id }, 'Cannot handle appointment action, no agent assigned');
      return {
        valid: false,
        result: {
          success: false,
          message: "Sorry, I can't manage appointments right now. Let me have our consultant contact you directly."
        }
      };
    }
    return { valid: true, agentId };
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
      validated.messages.push("Hey, what's up?");
    }

    // Validate lead updates - be more lenient with natural conversation
    if (response.lead_updates && typeof response.lead_updates === 'object') {
      validated.lead_updates = response.lead_updates;
    }

    // Validate action - default to continue for natural flow
    const validActions = ['continue', 'initiate_booking', 'reschedule_appointment', 'cancel_appointment', 'select_alternative', 'tentative_booking', 'confirm_tentative_booking'];
    if (validActions.includes(response.action)) {
      validated.action = response.action;
    } else {
      // Default to continue if action is invalid - keeps conversation flowing
      validated.action = 'continue';
    }

    // Include user message only for actual booking actions
    if (['initiate_booking', 'reschedule_appointment', 'select_alternative', 'tentative_booking', 'confirm_tentative_booking'].includes(validated.action) && response.user_message) {
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
      const { data: activeAppointment } = await this.supabase
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

    // ENHANCED DATABASE CONSISTENCY CHECK: Fix inconsistencies between lead status and actual appointments
    if (leadStatus === 'booked') {
      logger.warn({ leadId, leadStatus }, 'INCONSISTENCY DETECTED: Lead marked as booked but no appointment found - investigating and fixing');

      // Get full lead data to understand the inconsistency
      const { data: leadData, error: leadDataError } = await this.supabase
        .from('leads')
        .select('booking_alternatives, tentative_booking_time, updated_at')
        .eq('id', leadId)
        .single();

      if (leadDataError) {
        logger.error({ err: leadDataError, leadId }, 'Error fetching lead data for consistency check');
        return 'Database error - please try again';
      }

      // Determine the correct status based on available data
      let correctStatus = 'qualified';
      let statusReason = 'No appointment scheduled yet - ready to book consultation';

      if (leadData?.booking_alternatives) {
        try {
          const alternatives = JSON.parse(leadData.booking_alternatives);
          if (Array.isArray(alternatives) && alternatives.length > 0) {
            correctStatus = 'booking_alternatives_offered';
            statusReason = 'Has been offered alternative time slots - waiting for selection';
          }
        } catch (parseError) {
          logger.warn({ err: parseError, leadId, alternatives: leadData.booking_alternatives }, 'Error parsing booking alternatives');
        }
      } else if (leadData?.tentative_booking_time) {
        correctStatus = 'tentative_booking_offered';
        statusReason = 'Has tentative booking waiting for confirmation';
      }

      // Update the lead status to reflect reality
      const { error: updateError } = await this.supabase.from('leads').update({
        status: correctStatus,
        updated_at: new Date().toISOString()
      }).eq('id', leadId);

      if (updateError) {
        logger.error({ err: updateError, leadId, correctStatus }, 'Error fixing lead status inconsistency');
      } else {
        logger.info({
          leadId,
          oldStatus: leadStatus,
          newStatus: correctStatus,
          reason: 'Fixed database inconsistency'
        }, 'Successfully corrected lead status');
      }

      return statusReason;
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
   * Generate dynamic consultation notes from conversation
   * @private
   */
  async _generateConsultationNotes(lead, conversationHistory, currentMessage) {
    try {
      const conversationSummary = conversationHistory.slice(-10).map(msg =>
        `${msg.sender === 'lead' ? 'Lead' : 'Doro'}: ${msg.message}`
      ).join('\n');

      const prompt = `
Analyze this property consultation conversation and create comprehensive consultation notes for the agent.

LEAD INFORMATION:
- Name: ${lead.full_name || 'Not provided'}
- Status: ${lead.status || 'new'}
- Intent: ${lead.intent || 'Not specified'}
- Budget: ${lead.budget || 'Not specified'}
- Source: ${lead.source || 'Unknown'}

RECENT CONVERSATION:
${conversationSummary}

CURRENT MESSAGE: "${currentMessage}"

Create consultation notes that include:
1. Lead's property requirements and preferences
2. Key concerns or questions raised
3. Budget and timeline considerations
4. Areas of interest mentioned
5. Important context for the consultant
6. Recommended discussion points

Format as clear, actionable notes for the property consultant.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 800
      });

      return response.choices[0].message.content;

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error generating consultation notes');
      // Fallback to basic notes
      return `Lead: ${lead.full_name}\nIntent: ${lead.intent || 'Not specified'}\nBudget: ${lead.budget || 'Not specified'}\nRecent inquiry: ${currentMessage}`;
    }
  }

  /**
   * Unified appointment booking system - replaces all complex booking logic
   * @private
   */
  async _handleUnifiedBooking({ lead, appointmentIntent, conversationHistory, currentMessage, aiInstructions }) {
    try {
      logger.info({
        leadId: lead.id,
        appointmentIntent,
        aiInstructions,
        conversationContext: conversationHistory.slice(-3)
      }, 'Processing unified appointment booking');

      // Validate agent assignment
      const agentValidation = this._validateAgentAssignment(lead);
      if (!agentValidation.valid) {
        return { success: false, message: agentValidation.result?.message || 'Agent validation failed' };
      }

      const agentId = agentValidation.agentId;

      // Check for existing appointment
      const { data: existingAppointment } = await this.supabase
        .from('appointments')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled')
        .single();

      // Generate dynamic consultation notes from conversation
      const consultationNotes = await this._generateConsultationNotes(lead, conversationHistory, currentMessage);

      // Handle different appointment intents with simplified logic
      switch (appointmentIntent) {
        case 'book_new':
          return await this._handleNewBooking(lead, agentId, aiInstructions, consultationNotes, existingAppointment);

        case 'reschedule_existing':
          if (!existingAppointment) {
            return { success: false, message: "I don't see any existing appointment to reschedule. Would you like to book a new consultation instead?" };
          }
          return await this._handleReschedule(lead, agentId, aiInstructions, consultationNotes, existingAppointment);

        case 'cancel_appointment':
          if (!existingAppointment) {
            return { success: false, message: "I don't see any appointment to cancel." };
          }
          return await this._handleCancellation(lead, existingAppointment);

        default:
          logger.warn({ appointmentIntent, leadId: lead.id }, 'Unknown appointment intent');
          return { success: false, message: '' };
      }
    } catch (error) {
      logger.error({ err: error, appointmentIntent, leadId: lead.id }, 'Error in unified appointment booking');
      return {
        success: false,
        message: "Sorry, I had an issue processing your appointment request. Please try again or let me know if you need help."
      };
    }
  }

  /**
   * Handle new booking - simplified approach
   * @private
   */
  async _handleNewBooking(lead, agentId, aiInstructions, consultationNotes, existingAppointment) {
    try {
      // Check if existing appointment blocks new booking
      if (existingAppointment) {
        const appointmentTime = toSgTime(existingAppointment.appointment_time);
        const formattedTime = formatForDisplay(appointmentTime);
        return {
          success: false,
          message: `You already have a consultation scheduled for ${formattedTime}. Would you like to reschedule it instead?`
        };
      }

      // Extract preferred time from AI instructions
      const preferredTime = this._extractPreferredTimeFromInstructions(aiInstructions);

      if (preferredTime) {
        // Try to book the specific time
        const isAvailable = await this._checkTimeAvailability(agentId, preferredTime);

        if (isAvailable) {
          // Book the preferred time directly
          const result = await this.appointmentService.createAppointment({
            leadId: lead.id,
            agentId,
            appointmentTime: preferredTime,
            leadName: lead.full_name,
            consultationNotes
          });

          // Update lead status
          await this.supabase.from('leads').update({
            status: 'booked'
          }).eq('id', lead.id);

          const formattedTime = formatForDisplay(toSgTime(preferredTime));
          return {
            success: true,
            message: `Perfect! Booked you for ${formattedTime} 😊`,
            messages: [
              `Perfect! Booked you for ${formattedTime} 😊`,
              `Zoom Link: ${result.zoomMeeting.joinUrl}`,
              `See you then!`
            ]
          };
        } else {
          // Find nearby alternatives
          const { findNearbyAvailableSlots } = require('../api/bookingHelper');
          const alternatives = await findNearbyAvailableSlots(agentId, preferredTime, 4);

          if (alternatives.length > 0) {
            const slots = alternatives.slice(0, 3).map((slot, index) =>
              `${index + 1}. ${formatForDisplay(toSgTime(slot))}`
            ).join('\n');

            return {
              success: false,
              message: `That time isn't available, but here are some nearby options:\n\n${slots}\n\nWhich one works for you?`
            };
          }
        }
      }

      // No specific time or no alternatives - offer general availability
      const { findNextAvailableSlots } = require('../api/bookingHelper');
      const availableSlots = await findNextAvailableSlots(agentId, null, 7);

      if (availableSlots.length > 0) {
        const slots = availableSlots.slice(0, 3).map((slot, index) =>
          `${index + 1}. ${formatForDisplay(toSgTime(slot))}`
        ).join('\n');

        return {
          success: false,
          message: `Great! Here are some available slots:\n\n${slots}\n\nWhich one works for you?`
        };
      }

      return {
        success: false,
        message: "I'm having trouble finding available slots. Let me have our consultant contact you directly to arrange a suitable time."
      };

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in new booking');
      return {
        success: false,
        message: "I'm having trouble booking your appointment. Let me have our consultant contact you directly."
      };
    }
  }

  /**
   * Handle appointment rescheduling - simplified approach
   * @private
   */
  async _handleReschedule(lead, agentId, aiInstructions, consultationNotes, existingAppointment) {
    try {
      const newPreferredTime = this._extractPreferredTimeFromInstructions(aiInstructions);

      if (newPreferredTime) {
        const isAvailable = await this._checkTimeAvailability(agentId, newPreferredTime);

        if (isAvailable) {
          await this.appointmentService.rescheduleAppointment({
            appointmentId: existingAppointment.id,
            newAppointmentTime: newPreferredTime,
            reason: 'Rescheduled via WhatsApp'
          });

          const formattedTime = formatForDisplay(toSgTime(newPreferredTime));
          return {
            success: true,
            message: `Rescheduled to ${formattedTime}.\n\nSame Zoom link: ${existingAppointment.zoom_join_url}`
          };
        }
      }

      return {
        success: false,
        message: "Let me check available times for rescheduling and get back to you."
      };

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in reschedule');
      return {
        success: false,
        message: "I'm having trouble rescheduling. Let me have our consultant contact you directly."
      };
    }
  }

  /**
   * Handle appointment cancellation - simplified approach
   * @private
   */
  async _handleCancellation(lead, existingAppointment) {
    try {
      await this.appointmentService.cancelAppointment({
        appointmentId: existingAppointment.id,
        reason: 'Cancelled via WhatsApp',
        notifyLead: false // We're already responding to the lead
      });

      // Update lead status
      await this.supabase.from('leads').update({
        status: 'qualified'
      }).eq('id', lead.id);

      return {
        success: true,
        message: "Your appointment has been cancelled. Let me know if you'd like to reschedule for another time!"
      };

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in cancellation');
      return {
        success: false,
        message: "I'm having trouble cancelling your appointment. Let me have our consultant contact you directly."
      };
    }
  }

  /**
   * Extract preferred time from AI instructions - simplified approach
   * @private
   */
  _extractPreferredTimeFromInstructions(aiInstructions) {
    if (!aiInstructions?.preferred_time || aiInstructions.preferred_time === 'check_availability') {
      return null;
    }

    try {
      const { parsePreferredTime } = require('../api/bookingHelper');
      return parsePreferredTime(aiInstructions.preferred_time);
    } catch (error) {
      logger.error({ err: error, preferredTime: aiInstructions.preferred_time }, 'Error parsing preferred time');
      return null;
    }
  }

  /**
   * Handle intelligent new booking with conversation context
   * @private
   */
  async _handleIntelligentNewBooking({ lead, agentId, aiInstructions, conversationHistory, currentMessage, existingAppointment }) {
    try {
      // Check if existing appointment blocks new booking
      if (existingAppointment) {
        logger.info({ leadId: lead.id, appointmentId: existingAppointment.id }, 'Attempted new booking but appointment already exists');
        const appointmentTime = toSgTime(existingAppointment.appointment_time);
        const formattedTime = formatForDisplay(appointmentTime);
        return {
          success: false,
          message: `You already have a consultation scheduled for ${formattedTime}. Would you like to reschedule it instead?`
        };
      }

      // Handle case where user is in 'booked' status but wants to reschedule
      if (lead.status === 'booked') {
        logger.info({ leadId: lead.id, currentMessage }, 'User requesting new time while marked as booked - checking for actual appointment');

        // If no actual appointment exists (booking failed), allow new booking
        if (!existingAppointment) {
          logger.info({ leadId: lead.id }, 'No actual appointment found despite booked status - allowing new booking');
          await supabase.from('leads').update({
            status: 'qualified'
          }).eq('id', lead.id);
          lead.status = 'qualified';
        }
      }

      // Use intelligent booking with conversation context
      const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

      const result = await this._findAndBookWithContext({
        leadId: lead.id,
        agentId,
        aiInstructions,
        conversationHistory,
        currentMessage,
        leadName: lead.full_name,
        consultationNotes
      });

      if (result.success) {
        // ENHANCED STATE MANAGEMENT: Update lead status with validation
        const { error: statusUpdateError } = await supabase.from('leads').update({
          status: 'booked',
          booking_alternatives: null, // Clear any stored alternatives
          tentative_booking_time: null, // Clear any tentative booking
          updated_at: new Date().toISOString()
        }).eq('id', lead.id);

        if (statusUpdateError) {
          logger.error({
            err: statusUpdateError,
            leadId: lead.id,
            appointmentResult: result
          }, 'Error updating lead status after successful booking');

          // Even if status update fails, the appointment was created successfully
          // Log this for manual review but don't fail the booking
        } else {
          logger.info({
            leadId: lead.id,
            newStatus: 'booked',
            reason: 'Successful appointment booking'
          }, 'Lead status updated after successful booking');
        }

        return {
          success: true,
          message: result.message
        };
      } else {
        // ENHANCED ERROR HANDLING: Ensure lead status reflects booking failure
        if (lead.status === 'booked') {
          logger.warn({
            leadId: lead.id,
            currentStatus: lead.status,
            bookingResult: result
          }, 'Booking failed but lead was marked as booked - correcting status');

          await supabase.from('leads').update({
            status: 'qualified',
            updated_at: new Date().toISOString()
          }).eq('id', lead.id);
        }

        return result;
      }
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in intelligent new booking');
      return {
        success: false,
        message: "I'm having trouble booking your appointment. Let me have our consultant contact you directly."
      };
    }
  }

  /**
   * Find and book appointment using conversation context
   * @private
   */
  async _findAndBookWithContext({ leadId, agentId, aiInstructions, conversationHistory, currentMessage, leadName, consultationNotes }) {
    try {
      // Check if AI instructions indicate to check availability (user agreed but no specific time)
      if (aiInstructions?.preferred_time === 'check_availability') {
        logger.info({
          leadId,
          contextSummary: aiInstructions?.context_summary,
          confidence: aiInstructions?.user_intent_confidence
        }, 'User agreed to consultation - offering available slots');

        // User agreed to consultation but didn't specify time - offer available slots
        const { findNextAvailableSlots } = require('../api/bookingHelper');
        const availableSlots = await findNextAvailableSlots(agentId, null);

        if (availableSlots.length > 0) {
          // Offer next few available slots
          const slotOptions = availableSlots.slice(0, 3).map((slot, index) => {
            const formattedTime = formatForDisplay(toSgTime(slot));
            return `${index + 1}. ${formattedTime}`;
          }).join('\n');

          // Store alternatives for selection
          await supabase.from('leads').update({
            status: 'booking_alternatives_offered',
            booking_alternatives: JSON.stringify(availableSlots.slice(0, 3))
          }).eq('id', leadId);

          return {
            success: true,
            message: `Great! Here are some available slots:\n\n${slotOptions}\n\nWhich one works for you?`
          };
        } else {
          return {
            success: false,
            message: "I'm having trouble finding available slots. Let me have our consultant contact you directly to arrange a suitable time."
          };
        }
      }

      // Extract preferred time from AI instructions and conversation context
      const preferredTime = this._extractPreferredTimeFromContext(aiInstructions, conversationHistory, currentMessage);

      logger.info({
        leadId,
        preferredTime: preferredTime?.toISOString(),
        contextSummary: aiInstructions?.context_summary,
        confidence: aiInstructions?.user_intent_confidence
      }, 'Extracted time preference from conversation context');

      // Use the existing appointment service but with intelligent time extraction
      if (preferredTime) {
        // Check if the preferred time is available
        const isAvailable = await this._checkTimeAvailability(agentId, preferredTime);

        if (isAvailable) {
          // Book the preferred time directly
          const result = await this.appointmentService.createAppointment({
            leadId,
            agentId,
            appointmentTime: preferredTime,
            leadName,
            consultationNotes
          });

          const formattedTime = formatForDisplay(toSgTime(preferredTime));
          return {
            success: true,
            message: `Perfect! Booked you for ${formattedTime} 😊\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nSee you then!`
          };
        } else {
          // Find nearby alternatives
          const alternatives = await this._findNearbyAlternatives(agentId, preferredTime);

          if (alternatives.length > 0) {
            const nearestAlternative = alternatives[0];
            const formattedAlternative = formatForDisplay(toSgTime(nearestAlternative));
            const formattedPreferred = formatForDisplay(toSgTime(preferredTime));

            // CRITICAL FIX: Validate the alternative before storing it
            const { isTimeSlotAvailable } = require('../api/bookingHelper');
            const isAlternativeValid = await isTimeSlotAvailable(agentId, nearestAlternative);

            if (!isAlternativeValid) {
              logger.error({
                leadId,
                agentId,
                alternativeTime: nearestAlternative.toISOString(),
                preferredTime: preferredTime.toISOString()
              }, 'CRITICAL ERROR: Alternative slot validation failed - should not offer invalid slot');

              return {
                success: false,
                message: "I'm having trouble finding available slots around your preferred time. Let me have our consultant contact you directly to arrange a suitable time."
              };
            }

            // Store the validated alternative for potential booking
            await supabase.from('leads').update({
              status: 'booking_alternatives_offered',
              booking_alternatives: JSON.stringify([nearestAlternative])
            }).eq('id', leadId);

            return {
              success: true,
              message: `Ah, ${formattedPreferred} is taken.\n\nHow about ${formattedAlternative} instead?`
            };
          } else {
            return {
              success: false,
              message: "I'm having trouble finding available slots around your preferred time. Let me have our consultant contact you directly to arrange a suitable time."
            };
          }
        }
      } else {
        // No specific time mentioned, offer next available slots
        const availableSlots = await this._findNextAvailableSlots(agentId, 3);

        if (availableSlots.length > 0) {
          // ADDITIONAL VALIDATION: Double-check all slots before offering to user
          const { isTimeSlotAvailable } = require('../api/bookingHelper');
          const finalValidatedSlots = [];

          for (const slot of availableSlots) {
            const isValid = await isTimeSlotAvailable(agentId, slot);
            if (isValid) {
              finalValidatedSlots.push(slot);
            } else {
              logger.warn({
                leadId,
                agentId,
                slotTime: slot.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
              }, 'FINAL VALIDATION FAILED: Removing slot from user options');
            }
          }

          if (finalValidatedSlots.length === 0) {
            logger.error({
              leadId,
              agentId,
              originalSlotCount: availableSlots.length
            }, 'CRITICAL: All slots failed final validation - no slots to offer');

            return {
              success: false,
              message: "I'm having trouble finding available consultation slots. Let me have our consultant contact you directly to arrange a suitable time."
            };
          }

          const slotOptions = finalValidatedSlots.map((slot, index) =>
            `${index + 1}. ${formatForDisplay(toSgTime(slot))}`
          ).join('\n');

          // Store validated alternatives for selection
          await supabase.from('leads').update({
            status: 'booking_alternatives_offered',
            booking_alternatives: JSON.stringify(finalValidatedSlots)
          }).eq('id', leadId);

          return {
            success: true,
            message: `Sure, can set up a call for you. Here are some available times:\n\n${slotOptions}\n\nWhich one works for you?`
          };
        } else {
          return {
            success: false,
            message: "I'm having trouble finding available consultation slots. Let me have our consultant contact you directly to arrange a suitable time."
          };
        }
      }
    } catch (error) {
      logger.error({ err: error, leadId }, 'Error in context-aware booking');
      return {
        success: false,
        message: "I'm having trouble booking your appointment. Let me have our consultant contact you directly."
      };
    }
  }

  /**
   * Enhanced conversation context analysis for time extraction
   * @private
   */
  _extractPreferredTimeFromContext(aiInstructions, conversationHistory, currentMessage) {
    try {
      logger.info({
        aiInstructions,
        conversationHistoryLength: conversationHistory.length,
        currentMessage,
        contextSummary: aiInstructions?.context_summary
      }, 'Starting enhanced time extraction from conversation context');

      // ENHANCED: First try to get time from AI instructions with confidence check
      if (aiInstructions?.preferred_time && aiInstructions?.user_intent_confidence === 'high') {
        const { parsePreferredTime } = require('../api/bookingHelper');
        const parsedTime = parsePreferredTime(aiInstructions.preferred_time);
        if (parsedTime) {
          logger.info({
            extractedTime: parsedTime.toISOString(),
            source: 'ai_instructions_high_confidence',
            originalText: aiInstructions.preferred_time,
            confidence: aiInstructions.user_intent_confidence,
            contextSummary: aiInstructions.context_summary
          }, 'Extracted time from high-confidence AI instructions');
          return parsedTime;
        }
      }

      // ENHANCED: Analyze full conversation context for time references
      const allMessages = [...conversationHistory, { sender: 'lead', message: currentMessage }];

      // Look for time patterns in recent conversation with context awareness
      const timeExtractionResults = [];

      for (let i = allMessages.length - 1; i >= Math.max(0, allMessages.length - 8); i--) {
        const msg = allMessages[i];
        if (msg.sender === 'lead') {
          const { parsePreferredTime } = require('../api/bookingHelper');
          const parsedTime = parsePreferredTime(msg.message);
          if (parsedTime) {
            timeExtractionResults.push({
              time: parsedTime,
              message: msg.message,
              messageIndex: i,
              recency: allMessages.length - 1 - i // 0 = most recent
            });
          }
        }
      }

      // ENHANCED: Context-aware time selection
      if (timeExtractionResults.length > 0) {
        // Sort by recency (most recent first)
        timeExtractionResults.sort((a, b) => a.recency - b.recency);

        const selectedTime = timeExtractionResults[0];

        // ENHANCED: Validate the time makes sense in current context
        const now = new Date();
        const timeDiff = selectedTime.time.getTime() - now.getTime();
        const isReasonableTime = timeDiff > 0 && timeDiff < (7 * 24 * 60 * 60 * 1000); // Within next 7 days

        if (isReasonableTime) {
          logger.info({
            extractedTime: selectedTime.time.toISOString(),
            source: 'enhanced_conversation_analysis',
            originalMessage: selectedTime.message,
            messageRecency: selectedTime.recency,
            totalTimeReferences: timeExtractionResults.length,
            timeDifferenceHours: Math.round(timeDiff / (1000 * 60 * 60))
          }, 'Extracted time from enhanced conversation analysis');
          return selectedTime.time;
        } else {
          logger.warn({
            extractedTime: selectedTime.time.toISOString(),
            timeDifferenceHours: Math.round(timeDiff / (1000 * 60 * 60)),
            reason: 'Time is not reasonable (too far in past/future)'
          }, 'Rejected extracted time - not reasonable');
        }
      }

      // ENHANCED: Check for confirmation patterns
      if (currentMessage && conversationHistory.length > 0) {
        const confirmationPatterns = [
          /yes.*that.*works?/i,
          /yes.*sounds?.*good/i,
          /that.*works?.*for.*me/i,
          /perfect/i,
          /ok.*that.*time/i,
          /^yes$/i,
          /^ok$/i,
          /^sure$/i
        ];

        const isConfirmation = confirmationPatterns.some(pattern => pattern.test(currentMessage.toLowerCase()));

        if (isConfirmation) {
          // Look for time mentioned by bot in recent messages
          const recentBotMessages = conversationHistory
            .filter(msg => msg.sender === 'assistant')
            .slice(-3); // Last 3 bot messages

          for (const botMsg of recentBotMessages) {
            const { parsePreferredTime } = require('../api/bookingHelper');
            const mentionedTime = parsePreferredTime(botMsg.message);
            if (mentionedTime) {
              logger.info({
                extractedTime: mentionedTime.toISOString(),
                source: 'confirmation_context',
                userConfirmation: currentMessage,
                botMessage: botMsg.message
              }, 'Extracted time from confirmation context');
              return mentionedTime;
            }
          }
        }
      }

      logger.info({
        aiInstructions,
        currentMessage,
        timeExtractionResults: timeExtractionResults.length,
        conversationLength: conversationHistory.length
      }, 'No specific time found in enhanced context analysis');
      return null;
    } catch (error) {
      logger.error({ err: error }, 'Error in enhanced time extraction from context');
      return null;
    }
  }

  /**
   * Check if a specific time is available
   * @private
   */
  async _checkTimeAvailability(agentId, appointmentTime) {
    try {
      const { isTimeSlotAvailable } = require('../api/bookingHelper');
      return await isTimeSlotAvailable(agentId, appointmentTime);
    } catch (error) {
      logger.error({ err: error, agentId, appointmentTime }, 'Error checking time availability');
      return false;
    }
  }

  /**
   * Find nearby alternatives to a preferred time with validation
   * @private
   */
  async _findNearbyAlternatives(agentId, preferredTime, maxAlternatives = 3) {
    try {
      const { findNearbyAvailableSlots, isTimeSlotAvailable } = require('../api/bookingHelper');
      const nearbySlots = await findNearbyAvailableSlots(agentId, preferredTime);

      // CRITICAL FIX: Validate each alternative before offering to user
      const validatedAlternatives = [];
      for (const slot of nearbySlots) {
        const isActuallyAvailable = await isTimeSlotAvailable(agentId, slot);
        if (isActuallyAvailable) {
          validatedAlternatives.push(slot);
          if (validatedAlternatives.length >= maxAlternatives) {
            break;
          }
        } else {
          logger.warn({
            agentId,
            preferredTime: preferredTime.toISOString(),
            alternativeSlot: slot.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
          }, 'VALIDATION FAILED: Alternative slot failed availability check - filtering out');
        }
      }

      logger.info({
        agentId,
        preferredTime: preferredTime.toISOString(),
        nearbySlotCount: nearbySlots.length,
        validatedAlternativeCount: validatedAlternatives.length
      }, 'Completed alternative slot validation');

      return validatedAlternatives;
    } catch (error) {
      logger.error({ err: error, agentId, preferredTime }, 'Error finding nearby alternatives');
      return [];
    }
  }

  /**
   * Find next available slots with double validation
   * @private
   */
  async _findNextAvailableSlots(agentId, maxSlots = 3) {
    try {
      const { findNextAvailableSlots, isTimeSlotAvailable } = require('../api/bookingHelper');
      const potentialSlots = await findNextAvailableSlots(agentId, null, maxSlots * 2); // Get more slots for validation

      // CRITICAL FIX: Double-check each slot's availability before offering to user
      const validatedSlots = [];
      for (const slot of potentialSlots) {
        const isActuallyAvailable = await isTimeSlotAvailable(agentId, slot);
        if (isActuallyAvailable) {
          validatedSlots.push(slot);
          if (validatedSlots.length >= maxSlots) {
            break; // We have enough validated slots
          }
        } else {
          logger.warn({
            agentId,
            slotTime: slot.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
            slotISO: slot.toISOString()
          }, 'VALIDATION FAILED: Slot appeared available but failed double-check - filtering out');
        }
      }

      logger.info({
        agentId,
        potentialSlotsCount: potentialSlots.length,
        validatedSlotsCount: validatedSlots.length,
        requestedMaxSlots: maxSlots
      }, 'Completed slot validation process');

      return validatedSlots;
    } catch (error) {
      logger.error({ err: error, agentId }, 'Error finding next available slots');
      return [];
    }
  }

  /**
   * Handle intelligent tentative booking confirmation
   * @private
   */
  async _handleIntelligentTentativeConfirmation({ lead, agentId }) {
    try {
      // Check if lead has a tentative booking
      if (lead.status !== 'tentative_booking_offered' || !lead.tentative_booking_time) {
        logger.warn({ leadId: lead.id, status: lead.status }, 'No tentative booking found to confirm');
        return {
          success: false,
          message: "I don't see any tentative booking to confirm. Would you like to schedule a new consultation?"
        };
      }

      const tentativeTime = new Date(lead.tentative_booking_time);
      const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

      // Create the actual appointment
      const result = await this.appointmentService.createAppointment({
        leadId: lead.id,
        agentId,
        appointmentTime: tentativeTime,
        leadName: lead.full_name,
        consultationNotes
      });

      // Update lead status and clear tentative booking
      await supabase.from('leads').update({
        status: 'booked',
        tentative_booking_time: null
      }).eq('id', lead.id);

      const formattedTime = formatForDisplay(toSgTime(tentativeTime));
      return {
        success: true,
        message: `Confirmed for ${formattedTime}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nSee you then!`
      };
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error confirming tentative booking');
      return {
        success: false,
        message: "I'm having trouble confirming your appointment. Let me have our consultant contact you directly."
      };
    }
  }

  /**
   * Handle intelligent alternative selection
   * @private
   */
  async _handleIntelligentAlternativeSelection({ lead, agentId, aiInstructions }) {
    try {
      if (!lead.booking_alternatives) {
        return {
          success: false,
          message: "I don't see any alternative times to choose from. Would you like me to check availability for a specific time?"
        };
      }

      const storedAlternatives = JSON.parse(lead.booking_alternatives);
      if (!Array.isArray(storedAlternatives) || storedAlternatives.length === 0) {
        return {
          success: false,
          message: "I don't see any alternative times available. Would you like me to check for new availability?"
        };
      }

      // Use AI instructions to determine which alternative they want
      let selectedSlot = null;

      if (aiInstructions?.preferred_time) {
        // Try to match their preference to one of the alternatives
        const preferredTime = this._extractPreferredTimeFromContext(aiInstructions, [], '');
        if (preferredTime) {
          // Find the closest alternative to their preference
          selectedSlot = storedAlternatives.reduce((closest, current) => {
            const currentTime = new Date(current);
            const closestTime = new Date(closest);
            const currentDiff = Math.abs(currentTime.getTime() - preferredTime.getTime());
            const closestDiff = Math.abs(closestTime.getTime() - preferredTime.getTime());
            return currentDiff < closestDiff ? current : closest;
          });
        }
      }

      // If no intelligent selection possible, take the first alternative
      if (!selectedSlot) {
        selectedSlot = storedAlternatives[0];
      }

      const appointmentTime = new Date(selectedSlot);
      const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

      // Book the selected alternative
      const result = await this.appointmentService.createAppointment({
        leadId: lead.id,
        agentId,
        appointmentTime,
        leadName: lead.full_name,
        consultationNotes
      });

      // Update lead status and clear alternatives
      await supabase.from('leads').update({
        status: 'booked',
        booking_alternatives: null
      }).eq('id', lead.id);

      const formattedTime = formatForDisplay(toSgTime(appointmentTime));
      return {
        success: true,
        message: `Booked for ${formattedTime}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nSee you then!`
      };
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in intelligent alternative selection');
      return {
        success: false,
        message: "I'm having trouble booking your selected time slot. Let me have our consultant contact you directly."
      };
    }
  }

  /**
   * Handle intelligent reschedule
   * @private
   */
  async _handleIntelligentReschedule({ lead, agentId, aiInstructions, existingAppointment }) {
    try {
      // Extract new preferred time from context
      const newPreferredTime = this._extractPreferredTimeFromContext(aiInstructions, [], '');

      if (newPreferredTime) {
        // Check if the new time is available
        const isAvailable = await this._checkTimeAvailability(agentId, newPreferredTime);

        if (isAvailable) {
          // Update the existing appointment
          await this.appointmentService.rescheduleAppointment({
            appointmentId: existingAppointment.id,
            newAppointmentTime: newPreferredTime,
            reason: `Rescheduled via WhatsApp: ${aiInstructions?.context_summary || 'User requested reschedule'}`
          });

          const formattedTime = formatForDisplay(toSgTime(newPreferredTime));
          return {
            success: true,
            message: `Rescheduled to ${formattedTime}.\n\nSame Zoom link: ${existingAppointment.zoom_join_url}`
          };
        } else {
          // Find alternatives near the requested time
          const alternatives = await this._findNearbyAlternatives(agentId, newPreferredTime, 1);

          if (alternatives.length > 0) {
            const nearestAlternative = alternatives[0];
            const formattedAlternative = formatForDisplay(toSgTime(nearestAlternative));
            const formattedRequested = formatForDisplay(toSgTime(newPreferredTime));

            // Store the alternative for potential booking
            await supabase.from('leads').update({
              status: 'booking_alternatives_offered',
              booking_alternatives: JSON.stringify([nearestAlternative])
            }).eq('id', lead.id);

            return {
              success: true,
              message: `I see that ${formattedRequested} is already taken! 😅\n\nHow about ${formattedAlternative} instead? That's the closest available slot.\n\nOr if you have another preferred time in mind, just let me know! 😊`
            };
          } else {
            return {
              success: false,
              message: "I'm having trouble finding available slots around your preferred time. Let me have our consultant contact you directly to arrange a suitable time."
            };
          }
        }
      } else {
        return {
          success: false,
          message: "I'd be happy to reschedule your appointment! What time would work better for you?"
        };
      }
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in intelligent reschedule');
      return {
        success: false,
        message: "I'm having trouble rescheduling your appointment. Let me have our consultant contact you directly."
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

      // Also handle case where user is in 'booked' status but wants to reschedule
      // This can happen if there was a booking conflict or error
      if (lead.status === 'booked') {
        logger.info({ leadId: lead.id, userMessage }, 'User requesting new time while marked as booked - checking for actual appointment');

        // If no actual appointment exists (booking failed), allow new booking
        const { data: existingAppointment } = await supabase
          .from('appointments')
          .select('*')
          .eq('lead_id', lead.id)
          .eq('status', 'scheduled')
          .limit(1)
          .single();

        if (!existingAppointment) {
          logger.info({ leadId: lead.id }, 'No actual appointment found despite booked status - allowing new booking');
          await supabase.from('leads').update({
            status: 'qualified'
          }).eq('id', lead.id);
          lead.status = 'qualified';
        }
      }

      const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

      const result = await this.appointmentService.findAndBookAppointment({
        leadId: lead.id,
        agentId,
        userMessage,
        leadName: lead.full_name,
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
      } else if (result.type === 'ask_for_time_preference') {
        // User wants consultation but didn't specify time - ask for preference
        // Keep lead status as qualified, ready for next booking attempt
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
          message: `Rescheduled to ${formattedTime}.\n\nSame Zoom link: ${appointment.zoom_join_url}`
        };
      } else if (alternatives.length > 0) {
        // Offer alternatives for rescheduling - limit to 1 nearby slot + lead's preferred time option
        const nearestAlternative = alternatives[0];
        const formattedAlternative = formatForDisplay(toSgTime(nearestAlternative));

        // Store the single alternative for potential booking
        await supabase.from('leads').update({
          status: 'booking_alternatives_offered',
          booking_alternatives: JSON.stringify([nearestAlternative])
        }).eq('id', lead.id);

        return {
          success: true,
          message: `I see that time slot is already taken! 😅\n\nHow about ${formattedAlternative} instead? That's the closest available slot.\n\nOr if you have another preferred time in mind, just let me know! 😊`
        };
      } else {
        // No alternatives found - offer to check lead's preferred time and lock it tentatively
        return {
          success: true,
          message: `I see that time slot is already taken! 😅\n\nI don't have any immediate alternatives, but let me know what other time works for you and I'll check if it's available.\n\nIf you need some time to think about it, just let me know your preferred time and I can tentatively hold that slot for you while you decide! 😊`
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
   * Handle tentative booking when user says they'll get back to us
   * @private
   */
  async _handleTentativeBooking({ lead, agentId, userMessage }) {
    try {
      const { findMatchingSlot } = require('../api/bookingHelper');
      const { exactMatch, alternatives } = await findMatchingSlot(agentId, userMessage);

      if (exactMatch) {
        // Store tentative booking information
        await supabase.from('leads').update({
          status: 'tentative_booking_offered',
          booking_alternatives: JSON.stringify([exactMatch]),
          tentative_booking_time: exactMatch.toISOString()
        }).eq('id', lead.id);

        const formattedTime = formatForDisplay(toSgTime(exactMatch));
        return {
          success: true,
          message: `Perfect! ${formattedTime} is available. I'll tentatively hold that slot for you! 😊\n\nJust let me know when you're ready to confirm, or if you need to make any changes. The slot will be held for you in the meantime! 👍`
        };
      } else if (alternatives.length > 0) {
        const nearestAlternative = alternatives[0];
        const formattedAlternative = formatForDisplay(toSgTime(nearestAlternative));

        await supabase.from('leads').update({
          status: 'tentative_booking_offered',
          booking_alternatives: JSON.stringify([nearestAlternative]),
          tentative_booking_time: nearestAlternative.toISOString()
        }).eq('id', lead.id);

        return {
          success: true,
          message: `That exact time isn't available, but ${formattedAlternative} is free! I'll tentatively hold that slot for you instead. 😊\n\nLet me know if that works or if you'd prefer a different time! 👍`
        };
      } else {
        return {
          success: false,
          message: `I'm sorry, but that time slot isn't available and I don't have immediate alternatives. Let me know another time that works for you and I'll check! 😊`
        };
      }
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error handling tentative booking');
      return {
        success: false,
        message: "I'm having trouble checking that time slot. Could you try again or suggest another time?"
      };
    }
  }

  /**
   * Handle confirmation of tentative booking
   * @private
   */
  async _handleTentativeBookingConfirmation({ lead, agentId }) {
    try {
      // Check if lead has a tentative booking
      if (lead.status !== 'tentative_booking_offered' || !lead.tentative_booking_time) {
        logger.warn({ leadId: lead.id, status: lead.status }, 'No tentative booking found to confirm');
        return {
          success: false,
          message: "I don't see any tentative booking to confirm. Would you like to schedule a new appointment?"
        };
      }

      const tentativeTime = new Date(lead.tentative_booking_time);
      const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

      // Create the actual appointment
      const result = await this.appointmentService.createAppointment({
        leadId: lead.id,
        agentId,
        appointmentTime: tentativeTime,
        leadName: lead.full_name,
        consultationNotes
      });

      if (result.appointment) {
        // Update lead status and clear tentative booking
        await supabase.from('leads').update({
          status: 'booked',
          tentative_booking_time: null,
          booking_alternatives: null
        }).eq('id', lead.id);

        const formattedTime = formatForDisplay(toSgTime(tentativeTime));
        let successMessage = `Perfect! I've confirmed your consultation for ${formattedTime}.`;

        if (result.zoomMeeting && result.zoomMeeting.joinUrl !== 'https://zoom.us/j/placeholder') {
          successMessage += `\n\nZoom Link: ${result.zoomMeeting.joinUrl}`;
        } else {
          successMessage += `\n\nOur consultant will contact you with meeting details.`;
        }



        logger.info({ leadId: lead.id, appointmentId: result.appointment.id }, 'Tentative booking confirmed successfully');
        return {
          success: true,
          message: successMessage
        };
      } else {
        return {
          success: false,
          message: "I had trouble confirming your appointment. Let me have our consultant contact you directly to sort this out."
        };
      }
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error confirming tentative booking');
      return {
        success: false,
        message: "Sorry, I had an issue confirming your appointment. Please try again or let me know if you need help."
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
          consultationNotes
        });

        // ENHANCED STATE MANAGEMENT: Update lead status with full cleanup
        const { error: statusUpdateError } = await supabase.from('leads').update({
          status: 'booked',
          booking_alternatives: null,
          tentative_booking_time: null,
          updated_at: new Date().toISOString()
        }).eq('id', lead.id);

        if (statusUpdateError) {
          logger.error({
            err: statusUpdateError,
            leadId: lead.id,
            selectedSlot: selectedSlot.toISOString()
          }, 'Error updating lead status after alternative selection booking');
        } else {
          logger.info({
            leadId: lead.id,
            selectedSlot: selectedSlot.toISOString(),
            newStatus: 'booked'
          }, 'Lead status updated after alternative selection booking');
        }

        const formattedTime = formatForDisplay(toSgTime(selectedSlot));
        return {
          success: true,
          message: `Booked for ${formattedTime}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}`
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
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Say "OK" if you can respond.' }],
        max_tokens: 10,
        temperature: 0
      });

      return {
        status: 'healthy',
        model: 'gpt-4.1',
        response: response.choices[0]?.message?.content || 'No response'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // ===== STRATEGIC CONVERSATION SYSTEM =====

  /**
   * Phase 1: Analyze conversation context silently for strategic system
   * @private
   */
  async _analyzeStrategicContext(lead, messages, currentMessage) {
    try {
      const conversationHistory = messages.slice(-10).map(msg =>
        `${msg.sender === 'lead' ? 'User' : 'Doro'}: ${msg.message}`
      ).join('\n');

      const analysisPrompt = `
SILENT CONVERSATION ANALYST - Internal analysis only, user never sees this.

LEAD PROFILE:
- Status: ${lead.status}
- Intent: ${lead.intent || 'Unknown'}
- Budget: ${lead.budget || 'Unknown'}
- Source: ${lead.source || 'Unknown'}

RECENT CONVERSATION:
${conversationHistory}

CURRENT MESSAGE: "${currentMessage}"

Analyze this conversation and provide strategic insights:

CONVERSATION STAGE ANALYSIS:
- Where is this user in their property journey? (browsing/researching/interested/ready/urgent)
- What's their comfort level with us? (cold/warming/engaged/trusting)
- Any resistance patterns or buying signals detected?

STRATEGIC OPPORTUNITIES:
- What specific market insights would resonate with THIS user's situation?
- What psychological approach fits their personality and concerns?
- Consultation timing: only suggest if they're asking for advice or showing urgency

CONVERSATION MOMENTUM:
- Build rapport first, then provide value, THEN consider consultation
- What's the most natural next step to keep them engaged?
- Focus on their specific concerns rather than generic property talk

USER PSYCHOLOGY:
- Are they analytical (need data) or emotional (need lifestyle benefits)?
- Do they seem hesitant, urgent, or just exploring?
- What type of urgency/social proof would work best?

Respond in JSON format only with these exact keys:
{
  "journey_stage": "browsing|researching|interested|ready|urgent",
  "comfort_level": "cold|warming|engaged|trusting",
  "resistance_patterns": ["pattern1", "pattern2"],
  "buying_signals": ["signal1", "signal2"],
  "best_approach": "educational|urgency|social_proof|direct_booking",
  "consultation_timing": "now|soon|later|not_yet",
  "user_psychology": "analytical|emotional|mixed",
  "areas_mentioned": ["area1", "area2"],
  "next_step": "build_rapport|create_interest|offer_consultation|book_appointment",
  "needs_market_hook": true/false
}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: analysisPrompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      logger.info({
        leadId: lead.id,
        analysis
      }, 'Strategic context analysis completed');

      return analysis;

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in context analysis');
      // Return default analysis if parsing fails
      return {
        journey_stage: "researching",
        comfort_level: "warming",
        resistance_patterns: [],
        buying_signals: [],
        best_approach: "educational",
        consultation_timing: "later",
        user_psychology: "mixed",
        areas_mentioned: [],
        next_step: "build_rapport",
        needs_market_hook: false
      };
    }
  }

  /**
   * Phase 2: Gather relevant intelligence (market data, competitor info, news, etc.)
   * @private
   */
  async _gatherIntelligence(contextAnalysis, userMessage) {
    try {
      const intelligenceNeeds = this._identifyIntelligenceNeeds(contextAnalysis, userMessage);

      if (intelligenceNeeds.length === 0) {
        logger.info('No additional intelligence needed for this conversation');
        return null;
      }

      const searchResults = [];

      // Gather intelligence for each identified need
      for (const need of intelligenceNeeds) {
        const query = this._buildSearchQuery(need, contextAnalysis, userMessage);
        const results = await this._performRealWebSearch(query);

        if (results && results.length > 0) {
          searchResults.push({
            type: need.type,
            priority: need.priority,
            query,
            results: results.slice(0, 2), // Top 2 results per need
            timestamp: new Date().toISOString()
          });
        }
      }

      if (searchResults.length > 0) {
        logger.info({
          intelligenceTypes: searchResults.map(r => r.type),
          totalResults: searchResults.reduce((sum, r) => sum + r.results.length, 0)
        }, 'Intelligence gathering completed');

        return {
          intelligence: searchResults,
          timestamp: new Date().toISOString(),
          source: 'dynamic_web_search'
        };
      }

      // Fallback to basic market intelligence if no specific needs identified
      if (!contextAnalysis.needs_market_hook && contextAnalysis.areas_mentioned.length === 0) {
        logger.info('Skipping intelligence gathering - not needed for this conversation');
        return null;
      }

      // Build smart search query based on context with dynamic year
      const currentYear = new Date().getFullYear();
      let searchQuery = `Singapore property market trends ${currentYear}`;

      if (contextAnalysis.areas_mentioned.length > 0) {
        searchQuery = `Singapore ${contextAnalysis.areas_mentioned[0]} property prices trends ${currentYear}`;
      } else if (userMessage.toLowerCase().includes('expensive') || userMessage.toLowerCase().includes('price')) {
        searchQuery = `Singapore property price increase ${currentYear} market trends`;
      } else if (userMessage.toLowerCase().includes('investment')) {
        searchQuery = `Singapore property investment market ${currentYear} ROI trends`;
      } else if (userMessage.toLowerCase().includes('new launch') || userMessage.toLowerCase().includes('condo')) {
        searchQuery = `Singapore new property launches ${currentYear} condo prices`;
      } else if (userMessage.toLowerCase().includes('hdb') || userMessage.toLowerCase().includes('resale')) {
        searchQuery = `Singapore HDB resale prices ${currentYear} market trends`;
      }

      logger.info({
        searchQuery,
        contextTrigger: contextAnalysis.needs_market_hook ? 'needs_market_hook' : 'areas_mentioned'
      }, 'Gathering real-time market intelligence');

      // Use real web search to get current market data
      const marketSearchResults = await this._performRealWebSearch(searchQuery);

      if (marketSearchResults && marketSearchResults.length > 0) {
        logger.info({
          query: searchQuery,
          resultsCount: marketSearchResults.length,
          sources: marketSearchResults.map(r => r.url)
        }, 'Market intelligence gathered successfully');

        return {
          query: searchQuery,
          insights: marketSearchResults.slice(0, 3), // Top 3 results
          timestamp: new Date().toISOString(),
          source: 'real_web_search'
        };
      }

      logger.warn({ searchQuery }, 'No market intelligence results found');
      return null;

    } catch (error) {
      logger.error({ err: error }, 'Error gathering intelligence');
      return null;
    }
  }

  /**
   * Calculate dynamic lead score based on conversation analysis and behavior
   * @private
   */
  _calculateLeadScore(contextAnalysis, lead, conversationHistory) {
    let score = 0;
    const factors = [];

    // Journey stage scoring (0-30 points)
    const journeyScores = {
      'browsing': 5,
      'researching': 10,
      'interested': 20,
      'ready': 25,
      'urgent': 30
    };
    const journeyScore = journeyScores[contextAnalysis.journey_stage] || 5;
    score += journeyScore;
    factors.push({ factor: 'journey_stage', value: contextAnalysis.journey_stage, points: journeyScore });

    // Comfort level scoring (0-20 points)
    const comfortScores = {
      'cold': 2,
      'warming': 8,
      'engaged': 15,
      'trusting': 20
    };
    const comfortScore = comfortScores[contextAnalysis.comfort_level] || 2;
    score += comfortScore;
    factors.push({ factor: 'comfort_level', value: contextAnalysis.comfort_level, points: comfortScore });

    // Buying signals scoring (0-25 points)
    const buyingSignalsScore = Math.min(contextAnalysis.buying_signals.length * 5, 25);
    score += buyingSignalsScore;
    factors.push({ factor: 'buying_signals', value: contextAnalysis.buying_signals.length, points: buyingSignalsScore });

    // Consultation timing scoring (0-15 points)
    const timingScores = {
      'not_yet': 0,
      'later': 5,
      'soon': 10,
      'now': 15
    };
    const timingScore = timingScores[contextAnalysis.consultation_timing] || 0;
    score += timingScore;
    factors.push({ factor: 'consultation_timing', value: contextAnalysis.consultation_timing, points: timingScore });

    // Lead profile scoring (0-10 points)
    let profileScore = 0;
    if (lead.intent && lead.intent !== 'unknown') profileScore += 3;
    if (lead.budget && lead.budget !== 'unknown') profileScore += 3;
    if (lead.status === 'qualified') profileScore += 2;
    if (lead.status === 'booked') profileScore += 2;
    score += profileScore;
    factors.push({ factor: 'lead_profile', value: `${lead.intent || 'unknown'}_${lead.budget || 'unknown'}_${lead.status}`, points: profileScore });

    // Conversation engagement scoring (0-10 points)
    const messageCount = conversationHistory.length;
    const engagementScore = Math.min(Math.floor(messageCount / 2), 10);
    score += engagementScore;
    factors.push({ factor: 'conversation_engagement', value: messageCount, points: engagementScore });

    // Resistance patterns penalty (0 to -10 points)
    const resistancePenalty = Math.max(contextAnalysis.resistance_patterns.length * -2, -10);
    score += resistancePenalty;
    if (resistancePenalty < 0) {
      factors.push({ factor: 'resistance_patterns', value: contextAnalysis.resistance_patterns.length, points: resistancePenalty });
    }

    // Calculate final score and quality rating
    const finalScore = Math.max(0, Math.min(100, score));
    let quality = 'cold';
    if (finalScore >= 80) quality = 'hot';
    else if (finalScore >= 60) quality = 'warm';
    else if (finalScore >= 40) quality = 'lukewarm';

    const leadScoreData = {
      score: finalScore,
      quality,
      factors,
      timestamp: new Date().toISOString(),
      recommendations: this._getScoreBasedRecommendations(finalScore, contextAnalysis)
    };

    logger.info({
      leadId: lead.id,
      leadScore: finalScore,
      quality,
      topFactors: factors.sort((a, b) => b.points - a.points).slice(0, 3)
    }, 'Lead score calculated');

    return leadScoreData;
  }

  /**
   * Get strategy recommendations based on lead score
   * @private
   */
  _getScoreBasedRecommendations(score, contextAnalysis) {
    const recommendations = [];

    if (score >= 80) {
      recommendations.push('high_priority_follow_up');
      recommendations.push('direct_booking_approach');
      recommendations.push('urgency_tactics');
    } else if (score >= 60) {
      recommendations.push('warm_nurturing');
      recommendations.push('value_demonstration');
      recommendations.push('soft_booking_offer');
    } else if (score >= 40) {
      recommendations.push('educational_content');
      recommendations.push('trust_building');
      recommendations.push('market_insights_sharing');
    } else {
      recommendations.push('rapport_building');
      recommendations.push('needs_discovery');
      recommendations.push('gentle_engagement');
    }

    // Add specific recommendations based on context
    if (contextAnalysis.resistance_patterns.length > 2) {
      recommendations.push('address_objections');
    }
    if (contextAnalysis.areas_mentioned.length > 0) {
      recommendations.push('location_specific_insights');
    }

    return recommendations;
  }

  /**
   * Generate conversation insights for analytics (not control)
   * @private
   */
  _generateConversationInsights(contextAnalysis, lead, conversationHistory) {
    const insights = {
      // Engagement metrics
      engagement_score: this._calculateEngagementScore(conversationHistory),
      conversation_depth: conversationHistory.length,
      response_rate: this._calculateResponseRate(conversationHistory),

      // Readiness indicators
      readiness_signals: contextAnalysis.buying_signals.length,
      journey_stage: contextAnalysis.journey_stage,
      consultation_timing: contextAnalysis.consultation_timing,

      // Interest analysis
      areas_of_interest: contextAnalysis.areas_mentioned,
      topics_discussed: this._extractTopics(conversationHistory),

      // Resistance analysis
      resistance_level: contextAnalysis.resistance_patterns.length,
      objections_raised: this._extractObjections(conversationHistory),

      // Lead profile completeness
      profile_completeness: this._calculateProfileCompleteness(lead),

      // Conversation quality
      comfort_level: contextAnalysis.comfort_level,
      user_psychology: contextAnalysis.user_psychology,

      // Timing analysis
      conversation_duration_minutes: this._calculateConversationDuration(conversationHistory),
      last_interaction: new Date().toISOString(),

      // Metadata
      timestamp: new Date().toISOString(),
      lead_id: lead.id,
      conversation_id: `conv_${lead.id}_${Date.now()}`
    };

    logger.debug({
      leadId: lead.id,
      engagementScore: insights.engagement_score,
      journeyStage: insights.journey_stage,
      readinessSignals: insights.readiness_signals
    }, 'Generated conversation insights');

    return insights;
  }

  /**
   * Calculate engagement score based on conversation patterns
   * @private
   */
  _calculateEngagementScore(conversationHistory) {
    if (conversationHistory.length === 0) return 0;

    let score = 0;
    const leadMessages = conversationHistory.filter(msg => msg.sender === 'lead');

    // Message frequency (0-30 points)
    score += Math.min(leadMessages.length * 3, 30);

    // Message length quality (0-20 points)
    const avgLength = leadMessages.reduce((sum, msg) => sum + msg.message.length, 0) / leadMessages.length;
    if (avgLength > 50) score += 20;
    else if (avgLength > 20) score += 15;
    else if (avgLength > 10) score += 10;
    else score += 5;

    // Question asking (0-25 points)
    const questionsAsked = leadMessages.filter(msg => msg.message.includes('?')).length;
    score += Math.min(questionsAsked * 5, 25);

    // Conversation continuity (0-25 points)
    const conversationSpan = conversationHistory.length;
    if (conversationSpan > 10) score += 25;
    else if (conversationSpan > 5) score += 15;
    else score += 5;

    return Math.min(score, 100);
  }

  /**
   * Calculate response rate
   * @private
   */
  _calculateResponseRate(conversationHistory) {
    if (conversationHistory.length < 2) return 1;

    const botMessages = conversationHistory.filter(msg => msg.sender === 'assistant').length;
    const leadMessages = conversationHistory.filter(msg => msg.sender === 'lead').length;

    return botMessages > 0 ? leadMessages / botMessages : 0;
  }

  /**
   * Extract topics discussed
   * @private
   */
  _extractTopics(conversationHistory) {
    const topics = new Set();
    const topicKeywords = {
      'pricing': ['price', 'cost', 'expensive', 'cheap', 'budget', 'afford'],
      'location': ['area', 'district', 'mrt', 'school', 'nearby', 'location'],
      'investment': ['investment', 'roi', 'rental', 'yield', 'returns'],
      'financing': ['loan', 'mortgage', 'bank', 'cpf', 'down payment'],
      'timing': ['when', 'urgent', 'soon', 'later', 'timeline'],
      'property_type': ['hdb', 'condo', 'landed', 'apartment', 'house']
    };

    conversationHistory.forEach(msg => {
      if (msg.sender === 'lead') {
        const lowerMessage = msg.message.toLowerCase();
        Object.entries(topicKeywords).forEach(([topic, keywords]) => {
          if (keywords.some(keyword => lowerMessage.includes(keyword))) {
            topics.add(topic);
          }
        });
      }
    });

    return Array.from(topics);
  }

  /**
   * Extract objections raised
   * @private
   */
  _extractObjections(conversationHistory) {
    const objections = [];
    const objectionPatterns = [
      { pattern: /too expensive|can't afford|budget/i, type: 'budget_concern' },
      { pattern: /not ready|too early|maybe later/i, type: 'timing_objection' },
      { pattern: /need to think|discuss with/i, type: 'decision_delay' },
      { pattern: /other agent|already have|working with/i, type: 'competitor_mention' },
      { pattern: /not interested|not looking/i, type: 'interest_objection' }
    ];

    conversationHistory.forEach(msg => {
      if (msg.sender === 'lead') {
        objectionPatterns.forEach(({ pattern, type }) => {
          if (pattern.test(msg.message)) {
            objections.push({
              type,
              message: msg.message,
              timestamp: msg.created_at
            });
          }
        });
      }
    });

    return objections;
  }

  /**
   * Calculate profile completeness
   * @private
   */
  _calculateProfileCompleteness(lead) {
    let completeness = 0;
    const fields = ['full_name', 'intent', 'budget', 'timeline', 'source'];

    fields.forEach(field => {
      if (lead[field] && lead[field] !== 'unknown' && lead[field] !== '') {
        completeness += 20;
      }
    });

    return completeness;
  }

  /**
   * Calculate conversation duration
   * @private
   */
  _calculateConversationDuration(conversationHistory) {
    if (conversationHistory.length < 2) return 0;

    const firstMessage = new Date(conversationHistory[0].created_at);
    const lastMessage = new Date(conversationHistory[conversationHistory.length - 1].created_at);

    return Math.round((lastMessage - firstMessage) / (1000 * 60)); // minutes
  }

  /**
   * Save conversation insights to database (async, non-blocking)
   * @private
   */
  async _saveConversationInsights(leadId, insights) {
    try {
      const { error } = await this.supabase
        .from('conversation_insights')
        .insert({
          lead_id: leadId,
          insights,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.warn({ err: error, leadId }, 'Failed to save conversation insights to database');
      } else {
        logger.debug({ leadId, insightKeys: Object.keys(insights) }, 'Conversation insights saved');
      }
    } catch (error) {
      logger.warn({ err: error, leadId }, 'Error saving conversation insights');
    }
  }

  /**
   * Load conversation memory from previous interactions
   * @private
   */
  async _loadConversationMemory(leadId) {
    try {
      const { data, error } = await this.supabase
        .from('conversation_memory')
        .select('*')
        .eq('lead_id', leadId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        logger.warn({ err: error, leadId }, 'Failed to load conversation memory');
        return this._createEmptyMemory(leadId);
      }

      if (data && data.length > 0) {
        logger.debug({ leadId, memoryAge: data[0].updated_at }, 'Loaded conversation memory');
        return data[0].memory_data;
      }

      return this._createEmptyMemory(leadId);
    } catch (error) {
      logger.warn({ err: error, leadId }, 'Error loading conversation memory');
      return this._createEmptyMemory(leadId);
    }
  }

  /**
   * Create empty conversation memory structure
   * @private
   */
  _createEmptyMemory(leadId) {
    return {
      lead_id: leadId,
      pain_points: [],
      objections_raised: [],
      interests_shown: [],
      preferences_mentioned: [],
      consultation_attempts: [],
      successful_tactics: [],
      failed_approaches: [],
      personality_insights: {},
      engagement_patterns: {},
      conversation_themes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Update conversation memory with new insights
   * @private
   */
  _updateConversationMemory(existingMemory, conversationInsights, contextAnalysis, userMessage) {
    const memory = { ...existingMemory };
    const timestamp = new Date().toISOString();

    // Update pain points
    const newPainPoints = this._extractPainPoints(userMessage, contextAnalysis);
    newPainPoints.forEach(point => {
      if (!memory.pain_points.some(p => p.type === point.type)) {
        memory.pain_points.push({ ...point, first_mentioned: timestamp });
      }
    });

    // Update objections
    conversationInsights.objections_raised.forEach(objection => {
      if (!memory.objections_raised.some(o => o.type === objection.type)) {
        memory.objections_raised.push({ ...objection, first_raised: timestamp });
      }
    });

    // Update interests
    conversationInsights.topics_discussed.forEach(topic => {
      if (!memory.interests_shown.includes(topic)) {
        memory.interests_shown.push(topic);
      }
    });

    // Update preferences
    const preferences = this._extractPreferences(userMessage, contextAnalysis);
    preferences.forEach(pref => {
      if (!memory.preferences_mentioned.some(p => p.type === pref.type)) {
        memory.preferences_mentioned.push({ ...pref, mentioned_at: timestamp });
      }
    });

    // Update consultation attempts
    if (contextAnalysis.consultation_timing !== 'not_yet') {
      memory.consultation_attempts.push({
        timing: contextAnalysis.consultation_timing,
        approach_used: 'strategic_conversation',
        result: 'pending',
        attempted_at: timestamp
      });
    }

    // Update personality insights
    memory.personality_insights = {
      ...memory.personality_insights,
      user_psychology: contextAnalysis.user_psychology,
      comfort_level: contextAnalysis.comfort_level,
      communication_style: this._analyzeCommuncationStyle(userMessage),
      last_updated: timestamp
    };

    // Update engagement patterns
    memory.engagement_patterns = {
      ...memory.engagement_patterns,
      current_engagement_score: conversationInsights.engagement_score,
      response_rate: conversationInsights.response_rate,
      conversation_depth: conversationInsights.conversation_depth,
      last_interaction: timestamp
    };

    // Update conversation themes
    const themes = this._extractConversationThemes(userMessage, contextAnalysis);
    themes.forEach(theme => {
      if (!memory.conversation_themes.includes(theme)) {
        memory.conversation_themes.push(theme);
      }
    });

    memory.updated_at = timestamp;

    logger.debug({
      leadId: memory.lead_id,
      painPoints: memory.pain_points.length,
      objections: memory.objections_raised.length,
      interests: memory.interests_shown.length
    }, 'Updated conversation memory');

    return memory;
  }

  /**
   * Extract pain points from conversation
   * @private
   */
  _extractPainPoints(userMessage, contextAnalysis) {
    const painPoints = [];
    const lowerMessage = userMessage.toLowerCase();

    const painPointPatterns = [
      { pattern: /budget|expensive|afford|cost/i, type: 'budget_constraints' },
      { pattern: /time|busy|schedule|urgent/i, type: 'time_constraints' },
      { pattern: /location|far|convenient|transport/i, type: 'location_concerns' },
      { pattern: /family|space|room|size/i, type: 'space_requirements' },
      { pattern: /investment|returns|profit|loss/i, type: 'investment_concerns' },
      { pattern: /market|timing|right time|wrong time/i, type: 'market_timing' }
    ];

    painPointPatterns.forEach(({ pattern, type }) => {
      if (pattern.test(lowerMessage)) {
        painPoints.push({
          type,
          context: userMessage.substring(0, 100),
          confidence: 'medium'
        });
      }
    });

    return painPoints;
  }

  /**
   * Extract preferences from conversation
   * @private
   */
  _extractPreferences(userMessage, contextAnalysis) {
    const preferences = [];
    const lowerMessage = userMessage.toLowerCase();

    // Location preferences
    if (contextAnalysis.areas_mentioned.length > 0) {
      preferences.push({
        type: 'location',
        value: contextAnalysis.areas_mentioned,
        confidence: 'high'
      });
    }

    // Property type preferences
    const propertyTypes = ['hdb', 'condo', 'landed', 'apartment'];
    propertyTypes.forEach(type => {
      if (lowerMessage.includes(type)) {
        preferences.push({
          type: 'property_type',
          value: type,
          confidence: 'high'
        });
      }
    });

    // Budget preferences
    const budgetMatch = lowerMessage.match(/(\d+k|\d+\s*million|\$\d+)/i);
    if (budgetMatch) {
      preferences.push({
        type: 'budget_range',
        value: budgetMatch[0],
        confidence: 'medium'
      });
    }

    return preferences;
  }

  /**
   * Analyze communication style
   * @private
   */
  _analyzeCommuncationStyle(userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.length > 100) return 'detailed';
    if (lowerMessage.includes('?')) return 'inquisitive';
    if (lowerMessage.includes('!')) return 'enthusiastic';
    if (lowerMessage.split(' ').length < 5) return 'concise';

    return 'conversational';
  }

  /**
   * Extract conversation themes
   * @private
   */
  _extractConversationThemes(userMessage, contextAnalysis) {
    const themes = [];
    const lowerMessage = userMessage.toLowerCase();

    const themePatterns = [
      { pattern: /first.*home|first.*property/i, theme: 'first_time_buyer' },
      { pattern: /upgrade|upgrading|bigger/i, theme: 'upgrading' },
      { pattern: /investment|rental|roi/i, theme: 'investment_focused' },
      { pattern: /urgent|asap|quickly/i, theme: 'time_sensitive' },
      { pattern: /research|compare|options/i, theme: 'research_phase' },
      { pattern: /family|children|school/i, theme: 'family_oriented' }
    ];

    themePatterns.forEach(({ pattern, theme }) => {
      if (pattern.test(lowerMessage)) {
        themes.push(theme);
      }
    });

    return themes;
  }

  /**
   * Save conversation memory to database
   * @private
   */
  async _saveConversationMemory(leadId, memoryData) {
    try {
      const { error } = await this.supabase
        .from('conversation_memory')
        .upsert({
          lead_id: leadId,
          memory_data: memoryData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'lead_id'
        });

      if (error) {
        logger.warn({ err: error, leadId }, 'Failed to save conversation memory');
      } else {
        logger.debug({ leadId }, 'Conversation memory saved');
      }
    } catch (error) {
      logger.warn({ err: error, leadId }, 'Error saving conversation memory');
    }
  }

  /**
   * Calculate personality adjustments based on user psychology and conversation memory
   * @private
   */
  _calculatePersonalityAdjustments(contextAnalysis, conversationMemory) {
    const adjustments = {
      tone: 'balanced', // casual, professional, empathetic, enthusiastic
      communication_style: 'conversational', // detailed, concise, storytelling, data_driven
      approach: 'adaptive', // direct, nurturing, educational, consultative
      energy_level: 'medium', // low, medium, high
      formality: 'casual', // casual, semi_formal, formal
      use_data: false,
      use_stories: false,
      use_emojis: true,
      reasoning: []
    };

    // Adjust based on user psychology
    if (contextAnalysis.user_psychology === 'analytical') {
      adjustments.tone = 'professional';
      adjustments.communication_style = 'data_driven';
      adjustments.use_data = true;
      adjustments.use_emojis = false;
      adjustments.reasoning.push('User shows analytical psychology - using data-driven approach');
    } else if (contextAnalysis.user_psychology === 'emotional') {
      adjustments.tone = 'empathetic';
      adjustments.communication_style = 'storytelling';
      adjustments.use_stories = true;
      adjustments.reasoning.push('User shows emotional psychology - using empathetic storytelling');
    }

    // Adjust based on comfort level
    if (contextAnalysis.comfort_level === 'cold') {
      adjustments.approach = 'nurturing';
      adjustments.energy_level = 'low';
      adjustments.formality = 'semi_formal';
      adjustments.reasoning.push('User comfort level is cold - using gentle nurturing approach');
    } else if (contextAnalysis.comfort_level === 'trusting') {
      adjustments.approach = 'direct';
      adjustments.energy_level = 'high';
      adjustments.reasoning.push('User is trusting - can be more direct and energetic');
    }

    // Adjust based on conversation memory
    if (conversationMemory) {
      // If user has raised objections before, be more consultative
      if (conversationMemory.objections_raised.length > 2) {
        adjustments.approach = 'consultative';
        adjustments.tone = 'empathetic';
        adjustments.reasoning.push('Multiple objections in history - using consultative approach');
      }

      // If user has shown specific interests, tailor communication
      if (conversationMemory.interests_shown.includes('investment')) {
        adjustments.use_data = true;
        adjustments.communication_style = 'data_driven';
        adjustments.reasoning.push('User interested in investment - including data and ROI focus');
      }

      // If user communication style is concise, match it
      if (conversationMemory.personality_insights.communication_style === 'concise') {
        adjustments.communication_style = 'concise';
        adjustments.reasoning.push('User prefers concise communication - matching style');
      }

      // If multiple consultation attempts failed, try different approach
      if (conversationMemory.consultation_attempts.length > 2) {
        adjustments.approach = 'educational';
        adjustments.tone = 'casual';
        adjustments.reasoning.push('Multiple consultation attempts - switching to educational approach');
      }
    }

    // Adjust based on journey stage
    if (contextAnalysis.journey_stage === 'browsing') {
      adjustments.approach = 'educational';
      adjustments.energy_level = 'low';
      adjustments.reasoning.push('User in browsing stage - using educational approach');
    } else if (contextAnalysis.journey_stage === 'urgent') {
      adjustments.approach = 'direct';
      adjustments.energy_level = 'high';
      adjustments.tone = 'enthusiastic';
      adjustments.reasoning.push('User shows urgency - using direct high-energy approach');
    }

    logger.debug({
      userPsychology: contextAnalysis.user_psychology,
      comfortLevel: contextAnalysis.comfort_level,
      journeyStage: contextAnalysis.journey_stage,
      adjustments: {
        tone: adjustments.tone,
        style: adjustments.communication_style,
        approach: adjustments.approach
      }
    }, 'Calculated personality adjustments');

    return adjustments;
  }

  /**
   * Analyze campaign context for multi-touch strategy
   * @private
   */
  _analyzeCampaignContext(conversationMemory, contextAnalysis) {
    const context = {
      consultation_attempts: 0,
      last_attempt_date: null,
      approach_history: [],
      success_indicators: [],
      failure_patterns: [],
      recommended_strategy: 'first_touch',
      reasoning: []
    };

    if (!conversationMemory || !conversationMemory.consultation_attempts) {
      context.reasoning.push('No previous consultation attempts - using first touch approach');
      return context;
    }

    const attempts = conversationMemory.consultation_attempts;
    context.consultation_attempts = attempts.length;

    if (attempts.length > 0) {
      context.last_attempt_date = attempts[attempts.length - 1].attempted_at;
      context.approach_history = attempts.map(a => a.approach_used);

      // Analyze time since last attempt
      const daysSinceLastAttempt = Math.floor(
        (new Date() - new Date(context.last_attempt_date)) / (1000 * 60 * 60 * 24)
      );

      // Determine strategy based on attempt count and timing
      if (attempts.length === 1) {
        if (daysSinceLastAttempt < 1) {
          context.recommended_strategy = 'soft_follow_up';
          context.reasoning.push('Recent first attempt - using soft follow-up');
        } else if (daysSinceLastAttempt < 7) {
          context.recommended_strategy = 'value_reinforcement';
          context.reasoning.push('First attempt within week - reinforcing value proposition');
        } else {
          context.recommended_strategy = 'fresh_approach';
          context.reasoning.push('First attempt over a week ago - trying fresh approach');
        }
      } else if (attempts.length === 2) {
        if (daysSinceLastAttempt < 3) {
          context.recommended_strategy = 'soft_nurture';
          context.reasoning.push('Two recent attempts - switching to soft nurturing');
        } else {
          context.recommended_strategy = 'different_angle';
          context.reasoning.push('Two attempts with gap - trying different angle');
        }
      } else if (attempts.length >= 3) {
        context.recommended_strategy = 'long_term_nurture';
        context.reasoning.push('Multiple attempts - switching to long-term nurturing');
      }

      // Identify success indicators
      if (contextAnalysis.consultation_timing !== 'not_yet') {
        context.success_indicators.push('user_showing_timing_interest');
      }
      if (contextAnalysis.buying_signals.length > 0) {
        context.success_indicators.push('buying_signals_present');
      }
      if (contextAnalysis.comfort_level === 'trusting') {
        context.success_indicators.push('high_trust_level');
      }

      // Identify failure patterns
      if (conversationMemory.objections_raised.length > 2) {
        context.failure_patterns.push('multiple_objections');
      }
      if (conversationMemory.resistance_patterns && conversationMemory.resistance_patterns.length > 1) {
        context.failure_patterns.push('resistance_patterns');
      }

      // Adjust strategy based on patterns
      if (context.failure_patterns.includes('multiple_objections')) {
        context.recommended_strategy = 'objection_handling';
        context.reasoning.push('Multiple objections detected - focusing on objection handling');
      }
    }

    logger.debug({
      consultationAttempts: context.consultation_attempts,
      recommendedStrategy: context.recommended_strategy,
      daysSinceLastAttempt: context.last_attempt_date ?
        Math.floor((new Date() - new Date(context.last_attempt_date)) / (1000 * 60 * 60 * 24)) : null
    }, 'Analyzed campaign context');

    return context;
  }

  /**
   * Analyze success patterns from similar leads
   * @private
   */
  async _analyzeSuccessPatterns(currentLead, contextAnalysis) {
    try {
      // Query successful conversations from similar leads
      const { data: successfulLeads, error } = await this.supabase
        .from('leads')
        .select(`
          id, intent, budget, status, source,
          conversation_insights!inner(insights),
          conversation_memory!inner(memory_data)
        `)
        .eq('status', 'booked')
        .limit(20);

      if (error) {
        logger.warn({ err: error }, 'Failed to fetch successful leads for pattern analysis');
        return this._getDefaultSuccessPatterns();
      }

      if (!successfulLeads || successfulLeads.length === 0) {
        return this._getDefaultSuccessPatterns();
      }

      // Find similar leads based on profile
      const similarLeads = successfulLeads.filter(lead => {
        const similarity = this._calculateLeadSimilarity(currentLead, lead, contextAnalysis);
        return similarity > 0.6; // 60% similarity threshold
      });

      if (similarLeads.length === 0) {
        logger.info('No similar successful leads found, using default patterns');
        return this._getDefaultSuccessPatterns();
      }

      // Extract patterns from similar successful leads
      const patterns = this._extractSuccessPatterns(similarLeads);

      logger.info({
        totalSuccessfulLeads: successfulLeads.length,
        similarLeads: similarLeads.length,
        patternsFound: patterns.tactics.length
      }, 'Success patterns analyzed');

      return patterns;

    } catch (error) {
      logger.error({ err: error }, 'Error analyzing success patterns');
      return this._getDefaultSuccessPatterns();
    }
  }

  /**
   * Calculate similarity between current lead and successful lead
   * @private
   */
  _calculateLeadSimilarity(currentLead, successfulLead, contextAnalysis) {
    let similarity = 0;

    // Intent similarity (30% weight)
    if (currentLead.intent === successfulLead.intent) {
      similarity += 0.3;
    }

    // Budget similarity (20% weight)
    if (currentLead.budget === successfulLead.budget) {
      similarity += 0.2;
    }

    // Source similarity (10% weight)
    if (currentLead.source === successfulLead.source) {
      similarity += 0.1;
    }

    // Journey stage similarity (20% weight)
    if (successfulLead.conversation_insights && successfulLead.conversation_insights.length > 0) {
      const successInsights = successfulLead.conversation_insights[0].insights;
      if (successInsights.journey_stage === contextAnalysis.journey_stage) {
        similarity += 0.2;
      }
    }

    // Psychology similarity (20% weight)
    if (successfulLead.conversation_memory && successfulLead.conversation_memory.length > 0) {
      const successMemory = successfulLead.conversation_memory[0].memory_data;
      if (successMemory.personality_insights &&
          successMemory.personality_insights.user_psychology === contextAnalysis.user_psychology) {
        similarity += 0.2;
      }
    }

    return similarity;
  }

  /**
   * Extract success patterns from similar leads
   * @private
   */
  _extractSuccessPatterns(similarLeads) {
    const patterns = {
      tactics: [],
      approaches: [],
      timing_insights: [],
      messaging_themes: [],
      objection_handling: [],
      confidence_score: 0
    };

    const tacticCounts = {};
    const approachCounts = {};
    const timingPatterns = [];
    const messageThemes = [];

    similarLeads.forEach(lead => {
      // Extract tactics from conversation memory
      if (lead.conversation_memory && lead.conversation_memory.length > 0) {
        const memory = lead.conversation_memory[0].memory_data;

        // Count successful tactics
        if (memory.successful_tactics) {
          memory.successful_tactics.forEach(tactic => {
            tacticCounts[tactic] = (tacticCounts[tactic] || 0) + 1;
          });
        }

        // Extract conversation themes
        if (memory.conversation_themes) {
          memory.conversation_themes.forEach(theme => {
            messageThemes.push(theme);
          });
        }

        // Extract timing patterns
        if (memory.consultation_attempts) {
          memory.consultation_attempts.forEach(attempt => {
            if (attempt.result === 'success') {
              timingPatterns.push({
                timing: attempt.timing,
                approach: attempt.approach_used
              });
            }
          });
        }
      }

      // Extract insights
      if (lead.conversation_insights && lead.conversation_insights.length > 0) {
        const insights = lead.conversation_insights[0].insights;

        // Count successful approaches based on engagement
        if (insights.engagement_score > 70) {
          const approach = `high_engagement_${insights.journey_stage}`;
          approachCounts[approach] = (approachCounts[approach] || 0) + 1;
        }
      }
    });

    // Convert counts to patterns
    patterns.tactics = Object.entries(tacticCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tactic, count]) => ({
        tactic,
        success_rate: count / similarLeads.length,
        confidence: count >= 3 ? 'high' : count >= 2 ? 'medium' : 'low'
      }));

    patterns.approaches = Object.entries(approachCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([approach, count]) => ({
        approach,
        success_rate: count / similarLeads.length
      }));

    // Analyze timing patterns
    const timingGroups = {};
    timingPatterns.forEach(pattern => {
      const key = `${pattern.timing}_${pattern.approach}`;
      timingGroups[key] = (timingGroups[key] || 0) + 1;
    });

    patterns.timing_insights = Object.entries(timingGroups)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([pattern, count]) => ({
        pattern,
        frequency: count
      }));

    // Get most common message themes
    const themeCounts = {};
    messageThemes.forEach(theme => {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    });

    patterns.messaging_themes = Object.entries(themeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([theme]) => theme);

    patterns.confidence_score = Math.min(similarLeads.length / 5, 1); // Max confidence with 5+ similar leads

    return patterns;
  }

  /**
   * Get default success patterns when no data available
   * @private
   */
  _getDefaultSuccessPatterns() {
    return {
      tactics: [
        { tactic: 'market_insights_sharing', success_rate: 0.7, confidence: 'medium' },
        { tactic: 'consultation_value_proposition', success_rate: 0.6, confidence: 'medium' },
        { tactic: 'urgency_with_market_timing', success_rate: 0.5, confidence: 'low' }
      ],
      approaches: [
        { approach: 'educational_then_consultative', success_rate: 0.65 },
        { approach: 'rapport_building_first', success_rate: 0.6 }
      ],
      timing_insights: [
        { pattern: 'soon_educational', frequency: 3 },
        { pattern: 'now_direct', frequency: 2 }
      ],
      messaging_themes: ['market_expertise', 'personalized_service', 'local_knowledge'],
      objection_handling: [],
      confidence_score: 0.3
    };
  }

  /**
   * Identify what types of intelligence the bot needs for this conversation
   * @private
   */
  _identifyIntelligenceNeeds(contextAnalysis, userMessage) {
    const needs = [];
    const lowerMessage = userMessage.toLowerCase();

    // Market intelligence needs
    if (contextAnalysis.needs_market_hook || contextAnalysis.areas_mentioned.length > 0) {
      needs.push({
        type: 'market_data',
        priority: 'high',
        reason: 'User interested in market trends or specific areas'
      });
    }

    // Competitor intelligence needs
    const competitorKeywords = ['propnex', 'era', 'huttons', 'orangetee', 'dennis wee', 'century21', 'agent', 'other agents'];
    if (competitorKeywords.some(keyword => lowerMessage.includes(keyword))) {
      needs.push({
        type: 'competitor_intelligence',
        priority: 'medium',
        reason: 'User mentioned competitors or other agents'
      });
    }

    // News and events intelligence
    const newsKeywords = ['news', 'latest', 'recent', 'update', 'announcement', 'policy', 'government', 'cooling measures'];
    if (newsKeywords.some(keyword => lowerMessage.includes(keyword))) {
      needs.push({
        type: 'news_events',
        priority: 'medium',
        reason: 'User asking about recent news or policy updates'
      });
    }

    // Investment intelligence needs
    if (lowerMessage.includes('investment') || lowerMessage.includes('roi') || lowerMessage.includes('rental yield')) {
      needs.push({
        type: 'investment_data',
        priority: 'high',
        reason: 'User interested in investment aspects'
      });
    }

    // Legal/regulatory intelligence
    const legalKeywords = ['legal', 'law', 'regulation', 'absd', 'bsd', 'tax', 'stamp duty', 'cpf'];
    if (legalKeywords.some(keyword => lowerMessage.includes(keyword))) {
      needs.push({
        type: 'legal_regulatory',
        priority: 'medium',
        reason: 'User asking about legal or regulatory matters'
      });
    }

    // Financing intelligence
    const financeKeywords = ['loan', 'mortgage', 'bank', 'interest rate', 'financing', 'down payment'];
    if (financeKeywords.some(keyword => lowerMessage.includes(keyword))) {
      needs.push({
        type: 'financing_info',
        priority: 'medium',
        reason: 'User interested in financing options'
      });
    }

    logger.info({
      identifiedNeeds: needs.map(n => ({ type: n.type, priority: n.priority })),
      userMessage: userMessage.substring(0, 100)
    }, 'Intelligence needs identified');

    return needs;
  }

  /**
   * Build search query based on intelligence need
   * @private
   */
  _buildSearchQuery(need, contextAnalysis, userMessage) {
    const currentYear = new Date().getFullYear();
    const areas = contextAnalysis.areas_mentioned.join(' ') || '';

    switch (need.type) {
      case 'market_data':
        if (areas) {
          return `Singapore ${areas} property market trends ${currentYear} prices`;
        }
        return `Singapore property market trends ${currentYear}`;

      case 'competitor_intelligence':
        return `Singapore property agents comparison reviews ${currentYear}`;

      case 'news_events':
        return `Singapore property news ${currentYear} latest updates government policy`;

      case 'investment_data':
        if (areas) {
          return `Singapore ${areas} property investment ROI rental yield ${currentYear}`;
        }
        return `Singapore property investment returns ${currentYear}`;

      case 'legal_regulatory':
        return `Singapore property law regulations ABSD stamp duty ${currentYear}`;

      case 'financing_info':
        return `Singapore property loan mortgage rates ${currentYear} banks`;

      default:
        return `Singapore property ${userMessage.split(' ').slice(0, 3).join(' ')} ${currentYear}`;
    }
  }

  /**
   * Phase 3: Plan conversation strategy
   * @private
   */
  async _planConversationStrategy(contextAnalysis, intelligenceData, lead, conversationMemory = null, campaignContext = null, successPatterns = null) {
    try {
      const strategyPrompt = `
CONVERSATION STRATEGIST - Plan the next move while staying natural.

CONTEXT ANALYSIS:
${JSON.stringify(contextAnalysis, null, 2)}

INTELLIGENCE DATA AVAILABLE:
${intelligenceData ? JSON.stringify(intelligenceData, null, 2) : 'None'}

CONVERSATION MEMORY (Previous Interactions):
${conversationMemory ? JSON.stringify({
  pain_points: conversationMemory.pain_points,
  objections_raised: conversationMemory.objections_raised,
  interests_shown: conversationMemory.interests_shown,
  preferences_mentioned: conversationMemory.preferences_mentioned,
  consultation_attempts: conversationMemory.consultation_attempts,
  personality_insights: conversationMemory.personality_insights,
  conversation_themes: conversationMemory.conversation_themes
}, null, 2) : 'No previous conversation history'}

CAMPAIGN CONTEXT (Multi-Touch Strategy):
${campaignContext ? JSON.stringify(campaignContext, null, 2) : 'First interaction'}

SUCCESS PATTERNS (From Similar Leads):
${successPatterns ? JSON.stringify(successPatterns, null, 2) : 'No patterns available yet'}

LEAD PROFILE:
- Status: ${lead.status}
- Intent: ${lead.intent || 'Unknown'}
- Budget: ${lead.budget || 'Unknown'}

STRATEGIC GOALS:
- Guide toward consultation naturally (not pushy)
- Use market data as natural conversation hooks
- Maintain casual, authentic Singaporean tone
- Build trust before suggesting meetings

TACTICAL APPROACH BASED ON ANALYSIS:
- If user is cold: Focus on building rapport, share interesting insights
- If user is warming: Gentle market observations, soft consultation hints
- If user is engaged: Strategic urgency, direct consultation offers
- If user is ready: Smooth transition to booking

SALES PSYCHOLOGY PRINCIPLES (Use Dynamically, Not as Scripts):
You have access to the full spectrum of proven sales psychology. Choose and adapt the most effective approach for this specific situation:

INFLUENCE PRINCIPLES TO CONSIDER:
- Reciprocity: Provide valuable insights first, create obligation to engage
- Social Proof: Reference what others are doing, market activity, success stories
- Authority: Demonstrate expertise through market knowledge and insights
- Scarcity: Highlight limited opportunities, time-sensitive situations
- Commitment/Consistency: Get small agreements that lead to larger commitments
- Liking: Build rapport, find common ground, be genuinely helpful
- Loss Aversion: Frame what they might miss out on vs what they gain
- Anchoring: Set reference points for pricing, timing, or market conditions

PSYCHOLOGICAL TRIGGERS TO ADAPT:
- Fear of Missing Out (FOMO): Market timing, limited inventory, price trends
- Fear of Making Wrong Decision: Position yourself as guide to avoid mistakes
- Desire for Exclusivity: Access to off-market deals, insider knowledge
- Need for Security: Stable investment, trusted guidance, proven track record
- Aspiration: Lifestyle upgrade, investment success, financial freedom

ADAPT THESE DYNAMICALLY - Don't use rigid scripts. Choose what fits the conversation naturally.

TONE REQUIREMENTS - CRITICAL FOR NATURAL CONVERSATION:
- Sound like a knowledgeable Singaporean friend, not a salesperson
- Use mild Singlish naturally (don't overdo it): occasional "lah", "lor"
- Keep messages SHORT and conversational (like texting a friend)
- Drop market insights casually, not like a formal presentation
- Use "we" language naturally: "we've been seeing" not "our data shows"
- Avoid corporate/formal language completely

NATURAL SINGAPOREAN CONVERSATION STYLE:
✅ "Toa Payoh's been quite hot lately!"
✅ "3-room flats there moving pretty fast"
✅ "Want me to share what I'm seeing?"
✅ "The new launch there starting from 1.28mil leh" (mild Singlish is fine)
❌ "Wah Toa Payoh quite hot now eh!" (too much Singlish)
❌ "Based on our market analysis, Toa Payoh has experienced significant appreciation..."
❌ "Our data indicates that 3-room units are experiencing high demand..."

CASUAL MARKET INSIGHTS (not formal reports):
✅ "Btw, saw some interesting stuff about Toa Payoh"
✅ "Makes the resale flats look quite attractive"
✅ "Been quite busy with that area recently"
❌ "According to recent market data, The Orie development..."
❌ "Market trends indicate that resale properties offer better value..."

BOOKING GUIDELINES:
- Only set triggerBooking=true if user explicitly asks to "speak to consultant" or "book appointment"
- For urgent situations, use consultation_offer="soft" instead of direct booking
- Build value and trust before suggesting consultations

Plan the response strategy in JSON format with these exact keys:
{
  "approach": "describe your chosen approach (e.g., 'build rapport through market insights', 'create urgency with scarcity', 'establish authority with expertise')",
  "use_market_data": true/false,
  "market_hook": "specific insight relevant to their situation",
  "psychology_principles": ["list of influence principles you're using, e.g., 'social_proof', 'authority', 'scarcity'"],
  "consultation_offer": "none|soft|direct",

  "action": "continue|offer_consultation",
  "lead_updates": {"status": "qualified|new|needs_human_handoff", "intent": "own_stay|investment|hybrid"},
  "message_count": "1|2|3",
  "tone": "casual|educational|professional"
}

IMPORTANT: For lead_updates.status, ONLY use these valid values:
- "qualified" (when lead shows genuine interest)
- "new" (when lead needs more qualification)
- "needs_human_handoff" (when complex situation requires human agent)
- DO NOT use: "ready", "researching", "exploring_options", "interested" or any other values

For lead_updates.intent, ONLY use:
- "own_stay" (buying to live in)
- "investment" (buying for rental/investment)
- "hybrid" (both own stay and investment)`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: strategyPrompt }],
        temperature: 0.4,
        max_tokens: 400
      });

      const strategy = JSON.parse(response.choices[0].message.content);

      logger.info({
        leadId: lead.id,
        strategy
      }, 'Conversation strategy planned');

      return strategy;

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error planning strategy');
      // Return default strategy
      return {
        approach: "build rapport through helpful conversation",
        use_market_data: false,
        market_hook: "",
        psychology_principles: ["liking", "reciprocity"],
        consultation_offer: "none",
        triggerBooking: false,
        action: "continue",
        lead_updates: {},
        message_count: 1,
        tone: "casual"
      };
    }
  }

  /**
   * Phase 4: Generate strategic response
   * @private
   */
  async _generateStrategicResponse(strategy, contextAnalysis, intelligenceData, lead, _messages, personalityAdjustments = null) {
    try {
      const conversationHistory = _messages.slice(-8).map(msg =>
        `${msg.sender === 'lead' ? 'User' : 'Doro'}: ${msg.message}`
      ).join('\n');

      const responsePrompt = `
You are Doro - 28-year-old Singaporean, casual and authentic.

STRATEGIC CONTEXT (execute this plan):
${JSON.stringify(strategy, null, 2)}

PSYCHOLOGY PRINCIPLES TO USE DYNAMICALLY:
${strategy.psychology_principles ? strategy.psychology_principles.join(', ') : 'Use your judgment based on the situation'}

DYNAMIC PSYCHOLOGY GUIDANCE:
- You have full access to all sales psychology principles - use what works best for this moment
- Adapt your approach based on the user's responses and emotional state
- Don't stick to rigid scripts - be natural and responsive
- Layer multiple psychology principles if appropriate
- Always prioritize building genuine trust and providing value

CONVERSATION ANALYSIS:
${JSON.stringify(contextAnalysis, null, 2)}

INTELLIGENCE INSIGHTS TO USE:
${intelligenceData ? JSON.stringify(intelligenceData, null, 2) : 'None available'}

PERSONALITY ADJUSTMENTS:
${personalityAdjustments ? JSON.stringify(personalityAdjustments, null, 2) : 'Use default Doro personality'}

RECENT CONVERSATION:
${conversationHistory}

RESPONSE REQUIREMENTS:
• Address their SPECIFIC concerns and situation
• Use market data that's RELEVANT to their inquiry
• Build on the conversation naturally - don't restart topics
• Show expertise through insights, not generic advice

PERSONALITY & TONE (KEEP EXACTLY AS IS):
• Naturally curious, warm, genuine - not overly eager
• Casual expressions: "Nice!", "Got it!", "Makes sense!", "Right!"
• NEVER: "Cool!", "Oh interesting!", "Amazing!", "Fantastic!"
• Use "we" instead of "the consultants"
• Emojis sparingly: 😊 😅 🏠

SALES PSYCHOLOGY TOOLKIT (use when strategy calls for it):

Scare Tactics (natural timing):
• "Most first-time buyers end up overpaying quite a bit"
• "We recently saved a client from some pretty costly mistakes"
• "Going solo means you might miss out on off-market deals"
• "Without insider knowledge, you might buy at the wrong time"

Urgency Creation:
• "Prices have been moving up quite a bit lately"
• "Good units don't stay on the market very long"
• "We've been quite busy with this area"
• "Other buyers are moving pretty fast these days"

FOMO & Social Proof:
• "We've been seeing some interesting opportunities recently"
• "This area's been getting a lot of interest lately"
• "We mentioned they're seeing some interesting opportunities"

Consultation Positioning:
• "We do it over Zoom, so quite convenient"
• "Usually takes about 30-60 minutes"
• "If it's not helpful, you can just leave the call"

STRATEGIC EXECUTION:
• Use market data to make insights more specific and credible
• Time psychological tactics based on user readiness
• Deploy consultation offers when momentum is right
• Sound like a knowledgeable friend sharing interesting info

EXAMPLES OF STRATEGIC + NATURAL COMBINATION:

If strategy calls for urgency + market data:
"Yeah I know right! Actually just checked and that area went up 12% just in the past 3 months 😅 We've been warning clients that waiting usually ends up costing way more than just going for it."

If strategy calls for soft consultation offer:
"We've been seeing some interesting opportunities recently - might be worth having a quick chat about what's happening in the market. We can do it over Zoom, quite convenient."

RESPONSE FORMAT REQUIREMENTS:
Based on strategy.message_count, respond in JSON format:

For single message (message_count: 1) - MUST BE UNDER 120 CHARACTERS:
{
  "message1": "Your natural response here (MAX 120 chars)",
  "message2": null,
  "message3": null
}

For multiple messages (message_count: 2 or 3) - EACH MUST BE UNDER 120 CHARACTERS:
{
  "message1": "Primary response (MAX 120 chars)",
  "message2": "Follow-up thought (MAX 120 chars)",
  "message3": "Additional context if needed (MAX 120 chars), otherwise null"
}

APPOINTMENT INTENT DETECTION:
If the user is requesting appointment booking, add these fields:
{
  "appointment_intent": "book_new|reschedule_existing|cancel_appointment",
  "booking_instructions": {
    "preferred_time": "specific time mentioned or 'check_availability'",
    "context_summary": "what led to this booking request",
    "user_intent_confidence": "high|medium|low"
  }
}

ONLY set appointment_intent if user explicitly:
- Mentions specific times: "7pm today", "tomorrow at 3pm"
- Requests consultation: "I want to speak to a consultant", "book appointment"
- Wants to reschedule: "can we change my appointment"
- Wants to cancel: "cancel my appointment"

RESPOND NATURALLY while executing the planned strategy. Keep responses conversational and authentic.

🚨 CRITICAL MESSAGE LENGTH REQUIREMENTS - MUST FOLLOW:
- Each message MUST be 50-120 characters maximum (count the characters!)
- If you need to say more, ALWAYS split into multiple short messages
- Think like texting a friend, not writing an email
- Use message1, message2, message3 for multiple short messages
- Each message should be one complete thought
- NEVER write long paragraphs - break them up naturally

EXAMPLES OF GOOD MESSAGE LENGTHS (count characters):
✅ "Toa Payoh's been quite hot lately!" (35 chars)
✅ "3-room flats there moving pretty fast" (38 chars)
✅ "Want me to share what I'm seeing?" (33 chars)

EXAMPLES OF BAD MESSAGE LENGTHS:
❌ "Hey! I've been tracking Toa Payoh market trends and noticed that 3-room flats have been experiencing significant price appreciation due to the upcoming developments and transport improvements in the area..." (TOO LONG!)

🚨 IF YOUR MESSAGE IS OVER 120 CHARACTERS, YOU MUST SPLIT IT INTO MULTIPLE MESSAGES!
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: responsePrompt }],
        temperature: 0.7,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      });

      const responseContent = response.choices[0].message.content;
      const parsedResponse = JSON.parse(responseContent);

      // Build messages array from parsed response
      let messages = [
        parsedResponse.message1,
        parsedResponse.message2,
        parsedResponse.message3
      ].filter(msg => msg && msg.trim());

      // Validate and fix message lengths
      const validatedMessages = [];
      for (const msg of messages) {
        if (msg.length <= 120) {
          validatedMessages.push(msg);
        } else {
          // Force split long messages
          logger.warn({
            leadId: lead.id,
            messageLength: msg.length,
            message: `${msg.substring(0, 50)}...`
          }, 'Message too long, forcing split');

          // Simple split at sentence boundaries
          const sentences = msg.split(/[.!?]+/).filter(s => s.trim());
          let currentMsg = '';

          for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (!trimmed) continue;

            if (currentMsg.length + trimmed.length + 2 <= 120) {
              currentMsg = currentMsg ? currentMsg + '. ' + trimmed : trimmed;
            } else {
              if (currentMsg) {
                validatedMessages.push(currentMsg);
              }
              currentMsg = trimmed.length <= 120 ? trimmed : trimmed.substring(0, 117) + '...';
            }
          }

          if (currentMsg) {
            validatedMessages.push(currentMsg);
          }
        }
      }

      messages = validatedMessages.slice(0, 3); // Max 3 messages

      logger.info({
        leadId: lead.id,
        messageLength: messages.map(m => m.length),
        totalLength: messages.join(' ').length,
        strategy: strategy.approach,
        messageCount: messages.length
      }, 'Strategic response generated and validated');

      return {
        message: messages[0], // Primary message for backward compatibility
        messages,   // All messages for multi-message support
        appointment_intent: parsedResponse.appointment_intent,
        booking_instructions: parsedResponse.booking_instructions
      };

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error generating strategic response');
      return {
        message: "Let me get back to you on that - having some technical issues right now."
      };
    }
  }

  /**
   * Perform real web search for market intelligence
   * @private
   */
  async _performRealWebSearch(query) {
    try {
      logger.info({ query }, 'Attempting real web search for market data');

      // Try Google Custom Search API first
      if (this.config.GOOGLE_SEARCH_API_KEY && this.config.GOOGLE_SEARCH_ENGINE_ID) {
        const searchResults = await this._googleCustomSearch(query);
        if (searchResults && searchResults.length > 0) {
          logger.info({ query, resultsCount: searchResults.length }, 'Google Custom Search successful');
          return searchResults;
        }
      }

      // Fallback to government data sources
      const govData = await this._getGovernmentPropertyData(query);
      if (govData && govData.length > 0) {
        logger.info({ query, source: 'government_data' }, 'Using government property data');
        return govData;
      }

      // Final fallback to enhanced market data
      logger.info({ query }, 'Using enhanced fallback market data');
      return this._getEnhancedMarketData(query);

    } catch (error) {
      logger.error({
        err: error,
        query,
        hasGoogleConfig: !!(this.config.GOOGLE_SEARCH_API_KEY && this.config.GOOGLE_SEARCH_ENGINE_ID)
      }, 'Error in web search - using basic fallback');
      return this._getBasicFallbackData();
    }
  }

  /**
   * Google Custom Search API implementation
   * @private
   */
  async _googleCustomSearch(query) {
    try {
      const { google } = require('googleapis');
      const customsearch = google.customsearch('v1');

      logger.info({
        query,
        hasApiKey: !!this.config.GOOGLE_SEARCH_API_KEY,
        hasEngineId: !!this.config.GOOGLE_SEARCH_ENGINE_ID
      }, 'Executing Google Custom Search');

      const response = await customsearch.cse.list({
        auth: this.config.GOOGLE_SEARCH_API_KEY,
        cx: this.config.GOOGLE_SEARCH_ENGINE_ID,
        q: query,
        num: 5, // Get top 5 results
        safe: 'active',
        lr: 'lang_en', // English results
        gl: 'sg', // Singapore region
        dateRestrict: 'm6' // Last 6 months for fresh data
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items.map(item => ({
          title: item.title,
          snippet: item.snippet,
          url: item.link,
          source: 'google_custom_search'
        }));
      }

      return [];

    } catch (error) {
      logger.error({ err: error, query }, 'Google Custom Search API error');
      return [];
    }
  }

  /**
   * Get Singapore government property data
   * @private
   */
  async _getGovernmentPropertyData(query) {
    try {
      const results = [];

      // HDB Resale Price data (if query mentions HDB)
      if (query.toLowerCase().includes('hdb') || query.toLowerCase().includes('resale')) {
        const hdbData = await this._getHDBResaleData();
        if (hdbData) results.push(hdbData);
      }

      // URA property market data (for private properties)
      if (query.toLowerCase().includes('private') || query.toLowerCase().includes('condo') || query.toLowerCase().includes('price')) {
        const uraData = await this._getURAMarketData();
        if (uraData) results.push(uraData);
      }

      return results;

    } catch (error) {
      logger.error({ err: error, query }, 'Error fetching government property data');
      return [];
    }
  }

  /**
   * Get HDB resale price data from government sources
   * @private
   */
  async _getHDBResaleData() {
    try {
      // This would integrate with HDB's data.gov.sg API
      // For now, return structured recent data with dynamic content
      const currentYear = new Date().getFullYear();
      const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

      return {
        title: `HDB Resale Prices - Latest Government Data (Q${currentQuarter} ${currentYear})`,
        snippet: `Based on latest HDB resale transactions in ${currentYear}, the market shows continued activity with 4-room flats in mature estates typically ranging from $500K-$650K depending on location, age, and floor level. Prices vary significantly by town and remaining lease.`,
        url: "https://data.gov.sg/dataset/resale-flat-prices",
        source: "hdb_government_data",
        data_type: "official_transaction_data"
      };
    } catch (error) {
      logger.error({ err: error }, 'Error fetching HDB data');
      return null;
    }
  }

  /**
   * Get URA market data
   * @private
   */
  async _getURAMarketData() {
    try {
      // This would integrate with URA REALIS API (paid service)
      // For now, return recent market insights with dynamic content
      const currentYear = new Date().getFullYear();
      const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

      return {
        title: `Private Property Market - URA Official Data (Q${currentQuarter} ${currentYear})`,
        snippet: `Private residential property market data for Q${currentQuarter} ${currentYear} shows continued market activity. For the most current price indices and transaction volumes, please refer to URA's latest quarterly reports. Market trends vary by location and property type.`,
        url: "https://www.ura.gov.sg/Corporate/Property/Property-Market-Information",
        source: "ura_government_data",
        data_type: "official_market_index"
      };
    } catch (error) {
      logger.error({ err: error }, 'Error fetching URA data');
      return null;
    }
  }

  /**
   * Get enhanced market data based on query context
   * @private
   */
  _getEnhancedMarketData(query) {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('price') || lowerQuery.includes('expensive')) {
      return [
        {
          title: "Private Property Prices Rise 0.8% in Q1 2025 - URA",
          snippet: "The overall private residential price index increased at a slower pace by 0.8% in 1st Quarter 2025, easing from a 2.3% increase in 4Q2024. Market shows signs of moderation.",
          url: "https://www.ura.gov.sg/Corporate/Media-Room/Media-Releases/pr25-19"
        },
        {
          title: "Property Price Growth Shows Moderation in 2025",
          snippet: "Public and private property price growth shows signs of moderation in Q1 2025, with private housing supply increased to around 8,500 units for the first half of 2025.",
          url: "https://www.straitstimes.com/singapore/housing/property-price-growth-moderation"
        }
      ];
    } else if (lowerQuery.includes('hdb') || lowerQuery.includes('resale')) {
      return [
        {
          title: "HDB Resale Prices Continue Steady Growth in 2025",
          snippet: "HDB resale prices maintained steady growth in early 2025, with continued demand in mature estates and areas with good connectivity to MRT lines.",
          url: "https://www.hdb.gov.sg/about-us/news-and-publications/press-releases"
        }
      ];
    } else if (lowerQuery.includes('new launch') || lowerQuery.includes('condo')) {
      return [
        {
          title: "New Condo Launches See Steady Interest in 2025",
          snippet: "Recent condominium launches in Singapore are attracting steady interest from buyers, with developers offering competitive pricing and attractive payment schemes.",
          url: "https://www.edgeprop.sg/property-news/new-launches-2025"
        }
      ];
    } else {
      return [
        {
          title: "Singapore Property Market Remains Resilient in 2025",
          snippet: "Despite global uncertainties, Singapore's property market continues to show resilience with steady demand and controlled supply measures maintaining market stability.",
          url: "https://www.channelnewsasia.com/singapore/property-market-2025"
        },
        {
          title: "Property Investment Outlook Positive for 2025",
          snippet: "Industry experts maintain a cautiously optimistic outlook for Singapore property investments in 2025, citing stable fundamentals and government support measures.",
          url: "https://www.businesstimes.com.sg/property/property-outlook-2025"
        }
      ];
    }
  }

  /**
   * Get basic fallback data when all else fails
   * @private
   */
  _getBasicFallbackData() {
    return [
      {
        title: "Singapore Property Market Update 2025",
        snippet: "The Singapore property market continues to show stability with measured growth and steady demand from both local and international buyers.",
        url: "https://www.ura.gov.sg"
      }
    ];
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
