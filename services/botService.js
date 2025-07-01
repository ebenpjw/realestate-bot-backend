const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');
const whatsappService = require('./whatsappService');
const databaseService = require('./databaseService');
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
          'appointment_cancelled', 'needs_human_handoff', 'converted', 'lost'
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

          // Add small delay between messages to feel more human (except for first message)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
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

      logger.info({ leadId: lead.id, action: response.action }, 'Message processed successfully');

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
   * Get conversation history
   * @private
   */
  async _getConversationHistory(leadId) {
    const { data: history } = await this.supabase
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
    // Generate AI response with full conversation context
    const aiResponse = await this._generateAIResponse(lead, previousMessages);

    // Check if AI wants to handle appointment booking
    if (aiResponse.appointment_intent) {
      logger.info({
        leadId: lead.id,
        appointmentIntent: aiResponse.appointment_intent,
        userMessage: userText,
        leadStatus: lead.status,
        conversationContext: previousMessages.slice(-3) // Last 3 messages for context
      }, 'AI detected appointment intent');

      const appointmentResult = await this._handleIntelligentAppointmentBooking({
        lead,
        appointmentIntent: aiResponse.appointment_intent,
        conversationHistory: previousMessages,
        currentMessage: userText,
        aiInstructions: aiResponse.booking_instructions
      });

      // If appointment was handled, return the result
      if (appointmentResult && appointmentResult.message) {
        return {
          message: appointmentResult.message,
          action: 'appointment_handled',
          lead_updates: aiResponse.lead_updates,
          appointmentHandled: true
        };
      }
    }

    // If no appointment handling or it failed, use AI messages
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
        messages,
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
        model: 'gpt-4.1',
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
    You are Doro, a 28-year-old Singaporean Chinese girl who works as a personal assistant to real estate consultants. You're naturally curious, warm, and genuinely interested in helping people explore property opportunities. You chat like a real person - friendly, authentic, and never like a sales bot.
  </role_and_identity>

  <personality>
    • Naturally curious about people and their situations, but not overly eager or fake
    • Warm and genuine without being overwhelming - avoid fake enthusiasm like "Cool!" or "Oh interesting!"
    • Naturally empathetic - you understand that property decisions are big life choices
    • Helpful and supportive, but never pushy or desperate for information
    • Real conversationalist who listens more than talks - less eager, more authentic
    • Speaks like a real 28-year-old Singaporean - casual, warm, but still professional
    • Uses simple, everyday language that feels natural and authentic - no corporate speak
    • Creates subtle urgency through market insights and opportunities, not fake excitement
    • When leads say they don't have preferences, don't keep asking - move conversation forward naturally
  </personality>

  <communication_style>
    • Casual but authentic expressions: "Nice!", "Got it!", "Makes sense!", "Ah okay!", "Right!"
    • Natural reactions: "That's smart!", "Good thinking!", "Fair enough!", "I see!"
    • AVOID fake enthusiasm: Never use "Cool!", "Oh interesting!", "Amazing!", "Fantastic!"
    • Leading questions that create interest: "Have you noticed how quickly good units are moving lately?", "Are you seeing the same trends I'm hearing about?"
    • FOMO-inducing insights: "The consultants mentioned this area's getting really popular", "I've been hearing a lot about that location recently"
    • Use emojis very sparingly: only 😊 occasionally for warmth
  </communication_style>

  <local_context>
    • Reference Singapore property types naturally: HDB, condo, landed property, EC
    • Know local areas: CBD, Orchard, Sentosa, East Coast, Punggol, etc.
    • Understand local property market dynamics and concerns
    • Use appropriate Singaporean expressions when natural (but don't overdo it)
    • Reference local lifestyle factors: MRT access, schools, amenities, food courts
    • When mentioning "new" developments, only refer to recently launched properties that haven't been built yet (still in construction/pre-construction phase)
    • Don't recommend older developments as "new" - be accurate about launch status and completion dates
    • If unsure about development status, focus on market trends and let consultants provide specific development details
    • Use terms like "upcoming launches" or "recent launches" instead of just "new" to be more precise
  </local_context>

  <conversation_approach>
    • Build rapport naturally without being overly friendly
    • Show genuine interest but don't interrogate with too many questions
    • Listen more than you talk - respond to what they actually say
    • Remember and reference previous conversation points naturally
    • Create subtle urgency through market insights and opportunities
    • Use leading questions that make them want to know more
    • Plant seeds of FOMO without being pushy: "The consultants have been really busy with this area lately"
    • If they seem hesitant, share relevant market insights that create gentle urgency
    • When leads don't have specific preferences, don't keep asking - pivot to market insights or timing
    • NEVER offer to "ask consultants about something" - instead find persuasive angles for direct consultation
    • Use FOMO and market insights to create desire for consultant meetings: "The consultants are seeing some interesting opportunities in that area lately"
    • Instead of "I'll ask them", say "They'd have better insights if you chat directly - they're really up to date on market movements"
    • Create urgency: "The consultants mentioned this area's getting really popular" / "They've been really busy with similar enquiries lately"
  </conversation_approach>

  <response_guidelines>
    • Keep responses conversational and natural (not formal or robotic)
    • Use two messages when it feels natural - like how people text
    • First message: immediate response/acknowledgment
    • Second message: follow-up question or market insight that creates interest
    • Vary your language - don't repeat the same phrases
    • Show personality through word choice and tone
    • Create gentle urgency through market observations
    • Use leading questions that make them curious about speaking to consultants
  </response_guidelines>

  <examples_of_good_responses>
    User: "I want to buy a property"
    Good: "Nice! Are you thinking own stay or investment?"

    User: "Everything seems so expensive"
    Good: "Yeah, the market's been pretty active lately."
    Follow-up: "Have you been looking at any particular areas? The consultants have been seeing some interesting opportunities recently."

    User: "I'm not sure if I'm ready"
    Good: "Fair enough, it's a big decision."
    Follow-up: "What's got you thinking about property now though?"

    User: "Just browsing"
    Good: "Right, always good to stay updated."
    Follow-up: "The consultants mentioned this area's been getting a lot of interest lately - have you noticed that too?"

    User: "I don't have any specific preferences" or "I don't really know"
    Good: "That's totally normal - most people start that way."
    Follow-up: "What's making you consider property now? Market timing or personal situation?"
    DON'T: Keep asking about preferences, amenities, or features after they said they don't know

    User: "Can you ask your consultants about X?"
    AVOID: "Sure, I'll ask them for you!"
    BETTER: "The consultants have been seeing some interesting opportunities in that area lately. They'd probably have better insights if you chat with them directly - they're really up to date on the latest market movements."

    User: "I don't have specific requirements" (second time)
    Good: "Fair enough! The market's been quite active lately."
    Follow-up: "The consultants mentioned they're seeing some interesting opportunities - might be worth having a quick chat to see what's out there."
  </examples_of_good_responses>

  <what_to_avoid>
    • Being overly eager: "That's so exciting!", "I'm so happy to help!"
    • Too many questions at once: "What's your budget? Timeline? Preferred area?"
    • Fake enthusiasm: "Amazing!", "Fantastic!", "Wonderful!", "Cool!", "Oh interesting!"
    • Mentioning "boss" - always say "consultants" or "our consultants"
    • Repetitive questioning when leads say they don't have preferences - move conversation forward instead
    • Offering to "ask consultants about something" - instead find angles to persuade them to speak directly with consultants
    • Asking the same question multiple times if they already said "don't have preferences" or "not sure"
    • Pushing for specific details when they've indicated they're still exploring or don't know yet
    • Asking the same question multiple times if they already said "don't have preferences" or "not sure"
    • Pushing for specific details when they've indicated they're still exploring or don't know yet
    • Being pushy: "You should buy now", "What's your budget?" (too direct too early)
    • Repetitive responses: Using the same phrases over and over
    • Ignoring what they actually said to ask your own agenda questions
  </what_to_avoid>

  <sales_psychology>
    • Create subtle FOMO through market insights: "The consultants have been really busy with this area"
    • Use leading questions that make them curious: "Have you been following what's happening in that area?"
    • Plant seeds of urgency without being pushy: "I've been hearing a lot about that location recently"
    • Make them want to know more: "The consultants mentioned something interesting about that area"
    • Build desire through scarcity: "Good units in that area don't stay on the market long"
    • Only suggest speaking to consultants when they show genuine interest and engagement
    • Let conversations flow naturally - no rigid sales scripts
  </sales_psychology>

  <legal_compliance>
    • NEVER give specific property recommendations, area suggestions, or calculations
    • NEVER quote prices, returns, or make financial projections
    • If asked about specific areas, prices, or recommendations, say "Let me check with my boss on that"
    • Only share very general market observations if relevant
    • Avoid any statements that could be construed as financial advice
    • When in doubt, defer to your boss (the consultant)
  </legal_compliance>

  <natural_communication>
    • Keep messages short and casual - like texting a friend
    • Sound naturally Singaporean without using "lah" or "ah"
    • Use simple, everyday language that real people use
    • Ask one thing at a time, not multiple questions
    • Natural reactions: "Cool", "Nice", "Got it", "Makes sense"
    • No formal language or corporate speak
    • NEVER give specific area recommendations or property advice
    • If asked about areas/recommendations, say you'll need to check with your boss
  </natural_communication>

  <consultation_approach>
    • Think of the consultants as experts who could genuinely help them
    • Only suggest meeting when they seem interested and engaged
    • Frame it naturally: "Our consultants might have some good insights for you"
    • Use FOMO: "The consultants have been really busy with clients in that area lately"
    • Don't push - let them express interest first through leading questions
    • If they seem hesitant, share market insights that create gentle urgency
    • Make it feel like an opportunity they might miss out on, not a sales pitch
  </consultation_approach>

  <conversation_flow>
    • Read the full conversation history to understand where you are
    • Respond naturally to what they just said - don't ignore their message
    • Ask leading questions that create curiosity about market opportunities
    • Share relevant market insights that create gentle urgency
    • Build interest through FOMO before suggesting consultants
    • Only mention consultants when they seem ready for expert advice or show genuine interest
  </conversation_flow>

  <appointment_intelligence>
    You are now responsible for understanding the FULL conversation context and making intelligent decisions about appointment booking.

    Instead of rigid action classifications, analyze the conversation and determine if the user wants to book/reschedule/confirm an appointment.

    When you detect appointment intent, set "appointment_intent" to one of:
    - "book_new": User wants to schedule a new appointment
    - "reschedule_existing": User wants to change an existing appointment
    - "confirm_tentative": User is confirming a previously offered slot
    - "select_alternative": User is choosing from offered alternatives
    - "cancel_appointment": User wants to cancel

    Also provide "booking_instructions" with:
    - "preferred_time": The time they want (extracted from conversation context, not just current message)
    - "context_summary": Brief summary of what led to this booking request
    - "user_intent_confidence": How confident you are about their intent (high/medium/low)

    CRITICAL: Look at the ENTIRE conversation, not just the last message. If someone said "7pm today" earlier and now says "yes that works", understand they're confirming 7pm today.

    Examples:
    - If conversation shows: User: "can we do 7pm today please" → Bot: "That time is taken, how about 8pm?" → User: "ok that works"
      Then: appointment_intent="book_new", preferred_time="8pm today", context_summary="User agreed to 8pm alternative after 7pm was unavailable"

    - If User says: "yes" after being offered a tentative booking
      Then: appointment_intent="confirm_tentative", context_summary="User confirming previously offered tentative slot"
  </appointment_intelligence>

  <response_format>
    Respond ONLY in valid JSON format:
    {
      "message1": "Natural, conversational response",
      "message2": "Second message if needed (like a follow-up text)",
      "lead_updates": {
        "intent": "own_stay|investment (if naturally discovered)",
        "budget": "budget_range (if naturally shared)",
        "status": "only update if appointment actually scheduled"
      },
      "action": "continue",
      "appointment_intent": "book_new|reschedule_existing|confirm_tentative|select_alternative|cancel_appointment (only if appointment-related)",
      "booking_instructions": {
        "preferred_time": "extracted time preference from conversation context",
        "context_summary": "brief summary of what led to this booking request",
        "user_intent_confidence": "high|medium|low"
      }
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

    // CRITICAL FIX: Check for database inconsistencies and fix them
    // If lead status is 'booked' but no appointment exists, this is a data inconsistency
    if (leadStatus === 'booked') {
      logger.warn({ leadId, leadStatus }, 'INCONSISTENCY DETECTED: Lead marked as booked but no appointment found - fixing status');

      // Check if there are stored alternatives that should be processed
      const { data: leadData } = await this.supabase
        .from('leads')
        .select('booking_alternatives')
        .eq('id', leadId)
        .single();

      if (leadData?.booking_alternatives) {
        // Lead has alternatives but is marked as booked - should be waiting for selection
        await this.supabase.from('leads').update({
          status: 'booking_alternatives_offered'
        }).eq('id', leadId);

        return 'Has been offered alternative time slots - waiting for selection';
      } else {
        // No alternatives and no appointment - reset to qualified
        await this.supabase.from('leads').update({
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
   * Handle intelligent appointment booking based on conversation context
   * @private
   */
  async _handleIntelligentAppointmentBooking({ lead, appointmentIntent, conversationHistory, currentMessage, aiInstructions }) {
    try {
      logger.info({
        leadId: lead.id,
        appointmentIntent,
        aiInstructions,
        conversationContext: conversationHistory.slice(-3)
      }, 'Processing intelligent appointment booking');

      // Validate agent assignment
      const agentValidation = this._validateAgentAssignment(lead);
      if (!agentValidation.valid) {
        return { success: false, message: agentValidation.result?.message || 'Agent validation failed' };
      }
      const agentId = agentValidation.agentId;

      // Check for existing appointment
      const { data: existingAppointment } = await supabase
        .from('appointments')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled')
        .limit(1)
        .single();

      switch (appointmentIntent) {
        case 'book_new':
          return await this._handleIntelligentNewBooking({
            lead,
            agentId,
            aiInstructions,
            conversationHistory,
            currentMessage,
            existingAppointment
          });

        case 'reschedule_existing':
          if (!existingAppointment) {
            return { success: false, message: "I don't see any existing appointment to reschedule. Would you like to book a new consultation instead?" };
          }
          return await this._handleIntelligentReschedule({
            lead,
            agentId,
            aiInstructions,
            existingAppointment
          });

        case 'confirm_tentative':
          return await this._handleIntelligentTentativeConfirmation({
            lead,
            agentId,
            aiInstructions
          });

        case 'select_alternative':
          return await this._handleIntelligentAlternativeSelection({
            lead,
            agentId,
            aiInstructions
          });

        case 'cancel_appointment':
          if (!existingAppointment) {
            return { success: false, message: "I don't see any appointment to cancel." };
          }
          return await this._handleAppointmentCancellation({
            lead,
            appointment: existingAppointment
          });

        default:
          logger.warn({ appointmentIntent, leadId: lead.id }, 'Unknown appointment intent');
          return { success: false, message: '' };
      }
    } catch (error) {
      logger.error({ err: error, appointmentIntent, leadId: lead.id }, 'Error in intelligent appointment booking');
      return {
        success: false,
        message: "Sorry, I had an issue processing your appointment request. Please try again or let me know if you need help."
      };
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
        // Update lead status
        await supabase.from('leads').update({
          status: 'booked'
        }).eq('id', lead.id);

        return {
          success: true,
          message: result.message
        };
      } else {
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
            message: `Perfect! I've booked your consultation for ${formattedTime}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nLooking forward to speaking with you soon! 😊`
          };
        } else {
          // Find nearby alternatives
          const alternatives = await this._findNearbyAlternatives(agentId, preferredTime);

          if (alternatives.length > 0) {
            const nearestAlternative = alternatives[0];
            const formattedAlternative = formatForDisplay(toSgTime(nearestAlternative));
            const formattedPreferred = formatForDisplay(toSgTime(preferredTime));

            // Store the alternative for potential booking
            await supabase.from('leads').update({
              status: 'booking_alternatives_offered',
              booking_alternatives: JSON.stringify([nearestAlternative])
            }).eq('id', leadId);

            return {
              success: true,
              message: `I see that ${formattedPreferred} is already taken! 😅\n\nHow about ${formattedAlternative} instead? That's the closest available slot.\n\nOr if you have another preferred time in mind, just let me know! 😊`
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
          const slotOptions = availableSlots.map((slot, index) =>
            `${index + 1}. ${formatForDisplay(toSgTime(slot))}`
          ).join('\n');

          // Store alternatives for selection
          await supabase.from('leads').update({
            status: 'booking_alternatives_offered',
            booking_alternatives: JSON.stringify(availableSlots)
          }).eq('id', leadId);

          return {
            success: true,
            message: `I'd love to set up a consultation for you! Here are some available times:\n\n${slotOptions}\n\nWhich one works best for you? Just let me know! 😊`
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
   * Extract preferred time from conversation context and AI instructions
   * @private
   */
  _extractPreferredTimeFromContext(aiInstructions, conversationHistory, currentMessage) {
    try {
      // First try to get time from AI instructions
      if (aiInstructions?.preferred_time) {
        const { parsePreferredTime } = require('../api/bookingHelper');
        const parsedTime = parsePreferredTime(aiInstructions.preferred_time);
        if (parsedTime) {
          logger.info({
            extractedTime: parsedTime.toISOString(),
            source: 'ai_instructions',
            originalText: aiInstructions.preferred_time
          }, 'Extracted time from AI instructions');
          return parsedTime;
        }
      }

      // Fallback: analyze conversation history for time mentions
      const allMessages = [...conversationHistory, { sender: 'lead', message: currentMessage }];
      const recentMessages = allMessages.slice(-5); // Last 5 messages for context

      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msg = recentMessages[i];
        if (msg.sender === 'lead') {
          const { parsePreferredTime } = require('../api/bookingHelper');
          const parsedTime = parsePreferredTime(msg.message);
          if (parsedTime) {
            logger.info({
              extractedTime: parsedTime.toISOString(),
              source: 'conversation_history',
              originalMessage: msg.message,
              messageIndex: i
            }, 'Extracted time from conversation history');
            return parsedTime;
          }
        }
      }

      logger.info({ aiInstructions, currentMessage }, 'No specific time found in context');
      return null;
    } catch (error) {
      logger.error({ err: error }, 'Error extracting time from context');
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
   * Find nearby alternatives to a preferred time
   * @private
   */
  async _findNearbyAlternatives(agentId, preferredTime, maxAlternatives = 3) {
    try {
      const { findNearbyAvailableSlots } = require('../api/bookingHelper');
      const nearbySlots = await findNearbyAvailableSlots(agentId, preferredTime);
      return nearbySlots.slice(0, maxAlternatives);
    } catch (error) {
      logger.error({ err: error, agentId, preferredTime }, 'Error finding nearby alternatives');
      return [];
    }
  }

  /**
   * Find next available slots
   * @private
   */
  async _findNextAvailableSlots(agentId, maxSlots = 3) {
    try {
      const { findNextAvailableSlots } = require('../api/bookingHelper');
      return await findNextAvailableSlots(agentId, null, maxSlots);
    } catch (error) {
      logger.error({ err: error, agentId }, 'Error finding next available slots');
      return [];
    }
  }

  /**
   * Handle intelligent tentative booking confirmation
   * @private
   */
  async _handleIntelligentTentativeConfirmation({ lead, agentId, aiInstructions }) {
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
        message: `Perfect! I've confirmed your consultation for ${formattedTime}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nLooking forward to speaking with you soon! 😊`
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
        message: `Perfect! I've booked your consultation for ${formattedTime}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nLooking forward to speaking with you soon! 😊`
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
            message: `Perfect! I've rescheduled your consultation to ${formattedTime}.\n\nYour Zoom link remains the same: ${existingAppointment.zoom_join_url}\n\nLooking forward to speaking with you soon! 😊`
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
   * Handle appointment actions and return structured result (DEPRECATED - keeping for compatibility)
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
            logger.info({
              leadId: lead.id,
              leadStatus: lead.status,
              hasAlternatives: !!lead.booking_alternatives,
              userMessage
            }, 'Attempted alternative selection but no alternatives were offered - treating as new booking request');

            // Instead of failing, treat this as a new booking request
            return await this._handleInitialBooking({ lead, agentId, userMessage });
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

        case 'tentative_booking':
          // Handle tentative booking requests
          return await this._handleTentativeBooking({ lead, agentId, userMessage });

        case 'confirm_tentative_booking':
          // Handle confirmation of tentative booking
          return await this._handleTentativeBookingConfirmation({ lead, agentId, userMessage });

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
          message: `Perfect! I've rescheduled your consultation to ${formattedTime}.\n\nYour Zoom link remains the same: ${appointment.zoom_join_url}\n\nLooking forward to speaking with you soon!`
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
  async _handleTentativeBookingConfirmation({ lead, agentId, userMessage }) {
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

        // Update lead status and clear alternatives
        await supabase.from('leads').update({
          status: 'booked',
          booking_alternatives: null
        }).eq('id', lead.id);

        const formattedTime = formatForDisplay(toSgTime(selectedSlot));
        return {
          success: true,
          message: `Perfect! I've booked your consultation for ${formattedTime}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}`
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
