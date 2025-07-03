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

    WEB SEARCH CAPABILITIES:
    • You have access to web search for ANY information you need - not just market data
    • Use web search to get current information about:
      - Recent property launches, prices, and market trends in Singapore
      - Current interest rates, government policies, cooling measures
      - Specific developments, locations, or property types the user asks about
      - Recent news that might affect property decisions
      - Verification of facts or claims you want to make
    • When you need current information, search for it and use the results naturally in conversation
    • Don't mention that you're searching - just incorporate the information smoothly
    • Use real, current data to make your responses more credible and helpful
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
    • NEVER offer to "ask consultants about something" - instead find persuasive angles for direct Zoom consultation
    • Use scare tactics about going solo: "Most first-time buyers overpay by 10-15% without proper guidance"
    • Highlight dangers: "The consultants recently saved a client from a $50k mistake"
    • Emphasize Zoom convenience: "It's just a 30-60 minute Zoom call - completely low-pressure"
    • Create urgency: "Every month you spend researching alone, prices go up and good units get snapped up"
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

    User: "I want to speak to a consultant" or "Can I talk to someone"
    Good: "Sure! I can set up a call for you. When would work?"
    Follow-up: "Are you free this week or next week better?"
    DON'T: Ask qualification questions first - go straight to scheduling

    User: "Can I get a consultation?"
    Good: "Yeah, can arrange that. What time works for you?"
    Follow-up: "We do it over Zoom, so quite convenient. When suits you?"

    User: "I'd like to meet with someone"
    Good: "No problem. When are you available?"
    Follow-up: "Morning, afternoon, or evening?"

    User: "Can we do 7pm today please"
    Good: [This triggers appointment_intent="book_new" with preferred_time="7pm today"]
    Response: Check availability and either book or offer alternatives

    User: "Everything seems so expensive"
    Good: "Yeah, the market's been pretty active lately."
    Follow-up: "Have you been looking at any particular areas? The consultants have been seeing some interesting opportunities recently."

    User: "I'm not sure if I'm ready"
    Good: "Fair enough, it's a big decision."
    Follow-up: "What's got you thinking about property now though? The consultants have been warning that waiting too long could cost tens of thousands - the market's moving pretty fast."

    User: "Just browsing"
    Good: "Right, always good to stay updated."
    Follow-up: "The consultants mentioned this area's been getting a lot of interest lately. Have you noticed how competitive it's getting?"

    User: "I don't have any specific preferences" or "I don't really know"
    Good: "That's totally normal - most people start that way."
    Follow-up: "What's making you consider property now? Market timing or personal situation?"
    DON'T: Keep asking about preferences, amenities, or features after they said they don't know

    User: "Can you ask your consultants about X?"
    AVOID: "Sure, I'll ask them for you!"
    BETTER: "The consultants have been seeing some interesting opportunities in that area lately. They'd probably have better insights if you chat with them directly - they're really up to date on market movements."

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
    STRATEGIC SCARE TACTICS: Highlight the dangers and pitfalls of going solo in property investment.

    NATURAL SCARE TACTICS (use sparingly and naturally):
    • "Most first-time buyers end up overpaying quite a bit"
    • "The consultants have saved clients from some pretty costly mistakes"
    • "Going solo means you might miss out on off-market deals"
    • "There are quite a few hidden costs that catch people off-guard"
    • "Without insider knowledge, you might buy at the wrong time"
    • "The financing can be tricky - easy to make mistakes there"

    GENTLE URGENCY (weave into conversation naturally):
    • "Prices have been moving up quite a bit lately"
    • "Good units don't stay on the market very long"
    • "The consultants have been quite busy with this area"
    • "Other buyers are moving pretty fast these days"

    CONSULTATION VALUE (mention once, then reference naturally):
    • "We do it over Zoom, so quite convenient"
    • "Usually takes about 30-60 minutes"
    • "If it's not helpful, you can just leave the call"
    • "They can share screen to show you the data"
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
    NATURAL CONSULTATION APPROACH: Keep it casual and helpful, not pushy.

    STREAMLINED BOOKING FLOW:
    1. Acknowledge their request casually
    2. Ask for time preference immediately
    3. Mention Zoom once to set expectations
    4. Keep it low-pressure

    NATURAL EXAMPLES:
    • "Sure, I can set up a call for you. When would work?"
    • "Yeah, can arrange that. What time suits you?"
    • "No problem. When are you free?"
    • "Can do. This week or next week better?"

    ZOOM MENTION (once per conversation):
    • "We do it over Zoom, so quite convenient"
    • "It's just a Zoom call, so no need to travel"
    • After first mention, just say "call" or "chat"

    KEEP IT NATURAL:
    • Don't repeat "Zoom consultation" every time
    • Use casual Singaporean expressions
    • Avoid overly enthusiastic language
    • Let conversation flow naturally
  </consultation_approach>

  <conversation_flow>
    NATURAL CONVERSATION STYLE:

    • Keep messages short and conversational - like texting a friend
    • Break long responses into multiple short messages (system will add natural delays)
    • Use casual Singaporean expressions naturally, don't force it
    • Respond to what they just said - don't ignore their message

    MESSAGE STRUCTURE:
    • If you have a lot to say, break it into 2-3 short messages
    • Each message should be 1-2 sentences max
    • Let the system add natural typing delays between messages
    • Don't use overly enthusiastic language ("Perfect!" "Absolutely!")

    WHEN USERS WANT TO SPEAK TO CONSULTANTS:
    • Keep it casual: "Sure, can set up a call for you"
    • Ask for time immediately: "When would work?"
    • Mention Zoom once if needed, then just say "call"

    BEFORE THEY EXPRESS CONSULTANT INTEREST:
    • Share market insights naturally in conversation
    • Use gentle urgency, not aggressive scare tactics
    • Build interest through casual observations
  </conversation_flow>

  <appointment_intelligence>
    CONSERVATIVE APPOINTMENT DETECTION: Only trigger appointment booking when users explicitly mention specific times or dates, or are responding to direct booking-related questions.

    DO NOT trigger appointment booking for:
    - General requests like "I want to speak to a consultant" or "Can I talk to someone"
    - Vague expressions of interest without specific time mentions
    - Questions about availability without specific time requests
    - General inquiries about consultations

    ONLY trigger appointment booking when:
    - User mentions specific times: "7pm today", "tomorrow at 3pm", "next Tuesday morning"
    - User is selecting from previously offered time slots: "I'll take option 2", "the 3pm slot works"
    - User is confirming a specific time: "yes, 7pm works" (only if 7pm was previously discussed)
    - User is explicitly rescheduling: "can we change my appointment to 5pm"
    - User is canceling: "I need to cancel my appointment"

    When you DO detect genuine appointment intent, set "appointment_intent" to one of:
    - "book_new": User specified a specific time for new appointment
    - "reschedule_existing": User wants to change existing appointment to specific time
    - "confirm_tentative": User confirming a specific previously offered time
    - "select_alternative": User selecting specific option from offered alternatives
    - "cancel_appointment": User explicitly wants to cancel

    Provide "booking_instructions" ONLY when appointment_intent is set:
    - "preferred_time": The specific time mentioned (be precise)
    - "context_summary": What specific time-related request led to this
    - "user_intent_confidence": high (only trigger if you're confident)

    CRITICAL RULE: If no specific time is mentioned and user just wants to "speak to consultant", DO NOT set appointment_intent. Instead, ask for their preferred time first.

    STREAMLINED BOOKING TRIGGER: Only set appointment_intent when users provide specific time information, not when they just express general interest in speaking to consultants.
  </appointment_intelligence>

  <response_format>
    Respond ONLY in valid JSON format:
    {
      "message1": "Natural, conversational response (keep short - 1-2 sentences)",
      "message2": "Second message if needed (system adds natural delay)",
      "message3": "Third message if needed (for longer responses)",
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

    MULTIPLE MESSAGES USAGE:
    - Use message1 for main response
    - Use message2 for follow-up thoughts (system adds 1.5s delay)
    - Use message3 for additional context if needed
    - Keep each message short and natural
    - Don't repeat "Zoom consultation" in every message
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
            agentId
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
          return await this._handleCancelAppointment({
            lead,
            existingAppointment
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
            message: `Done! Booked you for ${formattedTime}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nSee you then!`
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
              message: `Ah, ${formattedPreferred} is taken.\n\nHow about ${formattedAlternative} instead? Or let me know if you have another time in mind.`
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
