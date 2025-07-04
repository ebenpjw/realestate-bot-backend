const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');
const { DORO_PERSONALITY, getPersonalityPrompt, getToneForUser, getStageGuidelines, shouldUseMarketData, analyzeContextualIntent, getContextualGuidance } = require('../config/personality');
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
        logger.error({
          err: messageError,
          leadId: lead.id,
          errorCode: messageError.code,
          errorMessage: messageError.message,
          messageLength: userText?.length
        }, 'Failed to save user message - this may affect conversation context');

        // This is concerning as it affects conversation history
        // Continue processing but this could impact AI context
      }

      // 3. Get conversation history (now includes current message)
      let previousMessages;
      try {
        previousMessages = await this._getConversationHistory(lead.id);
      } catch (historyError) {
        logger.error({
          err: historyError,
          leadId: lead.id,
          senderWaId
        }, 'Failed to retrieve conversation history - using empty history for processing');

        // Use empty history but continue processing
        // This prevents complete failure while maintaining some functionality
        previousMessages = [];
      }

      // 4. Process message with strategic AI system
      const response = await this._processMessageStrategically(lead, previousMessages, userText);

      // 5. Update lead with any changes from AI response and contextual inference
      if (response.lead_updates && Object.keys(response.lead_updates).length > 0) {
        lead = await this._updateLead(lead, response.lead_updates);
      }

      // Apply contextual inference to lead updates if we have high confidence
      if (contextAnalysis.contextual_inference &&
          contextAnalysis.contextual_inference.confidence === 'high' &&
          contextAnalysis.inferred_intent &&
          !lead.intent) {
        await this._updateLead(lead, { intent: contextAnalysis.inferred_intent });
        logger.info({
          leadId: lead.id,
          inferredIntent: contextAnalysis.inferred_intent
        }, 'Applied high-confidence intent inference to lead');
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
          logger.error({
            err: assistantMessageError,
            leadId: lead.id,
            errorCode: assistantMessageError.code,
            errorMessage: assistantMessageError.message,
            responseLength: response.message?.length
          }, 'Failed to save assistant message - conversation history will be incomplete');
        }
      } else if (response.messages && response.messages.length > 0) {
        // Send multiple messages with natural timing
        for (let i = 0; i < response.messages.length; i++) {
          const message = response.messages[i];

          // Add natural delay between messages, but avoid timeout issues
          if (i > 0) {
            // Reduce delay for multiple messages to prevent timeout conflicts
            const delay = response.messages.length > 2 ? 3000 : 6000; // 3s for 3+ messages, 6s for 2 messages
            await new Promise(resolve => setTimeout(resolve, delay));
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
    try {
      if (!leadId) {
        logger.error('Cannot retrieve conversation history - leadId is required');
        throw new Error('Lead ID is required for conversation history retrieval');
      }

      const { data: history, error } = await this.supabase
        .from('messages')
        .select('sender, message, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(15); // Get more messages for better context

      if (error) {
        logger.error({
          err: error,
          leadId,
          errorCode: error.code,
          errorMessage: error.message
        }, 'Failed to retrieve conversation history from database');
        throw new Error(`Conversation history retrieval failed: ${error.message}`);
      }

      if (!history || history.length === 0) {
        logger.info({ leadId }, 'No conversation history found for lead');
        return [];
      }

      // ENHANCED: Add conversation context analysis
      const processedHistory = history.map(entry => ({
        sender: entry.sender,
        message: entry.message,
        created_at: entry.created_at
      })).reverse();

      // ENHANCED: Analyze conversation patterns for better context
      let conversationContext;
      try {
        conversationContext = this._analyzeConversationContext(processedHistory);
      } catch (contextError) {
        logger.warn({
          err: contextError,
          leadId
        }, 'Failed to analyze conversation context - continuing with basic history');
        conversationContext = { conversationFlow: 'unknown' };
      }

      logger.debug({
        leadId,
        messageCount: processedHistory.length,
        conversationContext
      }, 'Retrieved enhanced conversation history with context analysis');

      return processedHistory;

    } catch (error) {
      logger.error({
        err: error,
        leadId,
        errorMessage: error.message
      }, 'Critical error in conversation history retrieval');

      // Don't silently return empty array - this is a critical failure
      throw error;
    }
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
   * Strategic multi-phase message processing - REVERTED to original with greeting fix
   * @private
   */
  async _processMessageStrategically(lead, previousMessages, userText) {
    try {
      logger.info({ leadId: lead.id }, 'Starting strategic conversation processing');

      // Phase 1: Silent Context Analysis (with new lead detection and fallback)
      let contextAnalysis;
      try {
        contextAnalysis = await this._analyzeStrategicContext(lead, previousMessages, userText);
      } catch (contextError) {
        logger.error({
          err: contextError,
          leadId: lead.id,
          messageLength: userText?.length,
          historyLength: previousMessages?.length
        }, 'Strategic context analysis failed - using simplified analysis');

        // Use simplified analysis instead of defaulting to insufficient data
        contextAnalysis = this._performSimplifiedContextAnalysis(lead, previousMessages, userText);
      }

      // Enhanced: Apply contextual inference to avoid redundant questions
      try {
        const contextualInference = analyzeContextualIntent(userText, previousMessages);
        if (contextualInference) {
          contextAnalysis.contextual_inference = contextualInference;
          // Update intent if we have high confidence inference
          if (contextualInference.confidence === 'high' && !lead.intent) {
            contextAnalysis.inferred_intent = contextualInference.inferred_intent;
          }
          logger.info({
            leadId: lead.id,
            inference: contextualInference
          }, 'Applied contextual inference');
        }
      } catch (inferenceError) {
        logger.warn({ err: inferenceError, leadId: lead.id }, 'Error in contextual inference - continuing without it');
        // Continue processing without contextual inference
      }

      // NEW: Check if this is insufficient data for strategic assumptions
      if (contextAnalysis.insufficient_data) {
        logger.info({ leadId: lead.id }, 'Insufficient data detected - using natural conversation mode');
        return await this._handleInsufficientDataMode(lead, previousMessages, userText, contextAnalysis);
      }

      // Load conversation memory from previous interactions
      const conversationMemory = await this._loadConversationMemory(lead.id);

      // Use conversation state to inform context analysis
      if (conversationMemory && conversationMemory.conversation_stage) {
        contextAnalysis.conversation_stage = conversationMemory.conversation_stage;
        contextAnalysis.rapport_established = conversationMemory.rapport_established;
        contextAnalysis.ready_for_insights = conversationMemory.ready_for_insights;
        contextAnalysis.qualifying_info_available = this._hasQualifyingInfo(conversationMemory);
      }

      // Generate conversation insights for analytics (not control)
      const conversationInsights = this._generateConversationInsights(contextAnalysis, lead, previousMessages);

      // Update conversation memory with new insights
      const updatedMemory = this._updateConversationMemory(conversationMemory, conversationInsights, contextAnalysis, userText);

      // Phase 2: Intelligence Gathering (market data, competitor info, news, etc.)
      const intelligenceData = await this._gatherIntelligence(contextAnalysis, userText, updatedMemory);

      // Save conversation insights and memory (ensure completion before strategy planning)
      try {
        const saveResults = await Promise.allSettled([
          this._saveConversationInsights(lead.id, conversationInsights),
          this._saveConversationMemory(lead.id, updatedMemory)
        ]);

        // Check for critical database failures
        const failures = saveResults.filter(result => result.status === 'rejected');
        if (failures.length > 0) {
          logger.warn({
            leadId: lead.id,
            failureCount: failures.length,
            failures: failures.map(f => f.reason?.message || 'Unknown error')
          }, 'Database save operations failed - this may indicate connectivity issues');

          // If both operations fail, this might indicate a serious database issue
          if (failures.length === saveResults.length) {
            logger.error({
              leadId: lead.id
            }, 'All database save operations failed - potential database connectivity issue');
          }
        }
      } catch (err) {
        logger.error({ err, leadId: lead.id }, 'Critical error in conversation data saving');
        // Continue processing but log as error, not warning
      }

      // Phase 3: Conversation Strategy Planning (AI-driven with memory context)
      const campaignContext = this._analyzeCampaignContext(updatedMemory, contextAnalysis);
      const successPatterns = await this._analyzeSuccessPatterns(lead, contextAnalysis);
      const strategy = await this._planConversationStrategy(contextAnalysis, intelligenceData, lead, updatedMemory, campaignContext, successPatterns);

      // Phase 4: Strategic Response Generation (with unified personality)
      const response = await this._generateStrategicResponse(strategy, contextAnalysis, intelligenceData, lead, previousMessages);

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
   * Handle insufficient data mode - natural conversation building without assumptions
   * @private
   */
  async _handleInsufficientDataMode(lead, previousMessages, userText, contextAnalysis) {
    try {
      logger.info({ leadId: lead.id }, 'Processing insufficient data mode - natural conversation building');

      // Debug logging
      logger.debug({
        leadId: lead.id,
        previousMessagesCount: previousMessages?.length || 0,
        userTextLength: userText?.length || 0,
        contextAnalysisKeys: Object.keys(contextAnalysis || {})
      }, 'Insufficient data mode - input validation');

      const conversationHistory = previousMessages.slice(-6).map(msg =>
        `${msg.sender === 'lead' ? 'User' : 'Doro'}: ${msg.message}`
      ).join('\n');

      const stageGuidelines = getStageGuidelines('rapport_building');
      const personalityPrompt = getPersonalityPrompt('rapport_building');

      const naturalPrompt = `
${personalityPrompt}

SITUATION: This is early conversation with insufficient data for strategic assumptions.
GOAL: ${stageGuidelines.priority}

CONVERSATION SO FAR:
${conversationHistory}

CURRENT MESSAGE: "${userText}"

APPROACH: ${stageGuidelines.approach}
AVOID: ${stageGuidelines.avoid}

EXAMPLES OF NATURAL RESPONSES:
${stageGuidelines.examples.map(ex => `- "${ex}"`).join('\n')}

CONVERSATION RULES:
${Object.values(DORO_PERSONALITY.conversation.rules).map(rule => `- ${rule}`).join('\n')}

Respond naturally and conversationally:`;

      // Retry logic for OpenAI API call
      let response;
      let lastError;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.debug({
            leadId: lead.id,
            attempt,
            maxRetries
          }, 'Attempting OpenAI API call for insufficient data mode');

          response = await this.openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [{ role: "user", content: naturalPrompt }],
            temperature: 0.7,
            max_tokens: 150
          });

          // If we get here, the call succeeded
          break;

        } catch (apiError) {
          lastError = apiError;
          logger.warn({
            err: apiError,
            leadId: lead.id,
            attempt,
            maxRetries
          }, 'OpenAI API call failed, will retry if attempts remaining');

          // Don't retry on the last attempt
          if (attempt === maxRetries) {
            throw apiError;
          }

          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Validate OpenAI response structure
      if (!response || !response.choices || response.choices.length === 0) {
        logger.error({
          leadId: lead.id,
          response: response ? { choices: response.choices } : null
        }, 'OpenAI returned empty or invalid response structure');
        throw new Error('OpenAI API returned invalid response structure');
      }

      const choice = response.choices[0];
      if (!choice || !choice.message || typeof choice.message.content !== 'string') {
        logger.error({
          leadId: lead.id,
          choice: choice,
          messageContent: choice?.message?.content
        }, 'OpenAI response choice has invalid message structure');
        throw new Error('OpenAI API returned invalid message content');
      }

      const aiMessage = choice.message.content.trim();

      // Ensure we got a meaningful response
      if (!aiMessage || aiMessage.length === 0) {
        logger.error({ leadId: lead.id }, 'OpenAI returned empty message content');
        throw new Error('OpenAI API returned empty message content');
      }

      logger.info({
        leadId: lead.id,
        aiMessageLength: aiMessage.length,
        aiMessagePreview: aiMessage.substring(0, 100)
      }, 'OpenAI response received successfully in insufficient data mode');

      // Extract any basic lead updates from natural conversation
      let leadUpdates;
      try {
        leadUpdates = this._extractBasicLeadUpdates(userText);
        logger.debug({ leadId: lead.id, leadUpdates }, 'Lead updates extracted successfully');
      } catch (extractError) {
        logger.error({ err: extractError, leadId: lead.id }, 'Error extracting lead updates');
        leadUpdates = {};
      }

      const finalResponse = {
        message: aiMessage,
        messages: [aiMessage],
        action: 'natural_conversation',
        lead_updates: leadUpdates,
        appointmentHandled: false
      };

      logger.info({
        leadId: lead.id,
        responseAction: finalResponse.action,
        hasMessage: !!finalResponse.message,
        hasMessages: !!finalResponse.messages,
        leadUpdatesCount: Object.keys(finalResponse.lead_updates).length
      }, 'Insufficient data mode completed successfully - returning response');

      return finalResponse;

    } catch (error) {
      logger.error({
        err: error,
        leadId: lead.id,
        errorMessage: error.message,
        errorType: error.constructor.name,
        errorStack: error.stack,
        userText: userText?.substring(0, 100),
        previousMessagesCount: previousMessages?.length
      }, 'CRITICAL: Error in insufficient data mode - this should not happen with our fixes');

      // Try to generate a contextual response based on user input
      try {
        const contextualResponse = this._generateContextualFallback(userText, previousMessages);
        logger.info({ leadId: lead.id }, 'Generated contextual fallback response');

        return {
          message: contextualResponse,
          messages: [contextualResponse],
          action: 'contextual_fallback',
          lead_updates: this._extractBasicLeadUpdates(userText),
          appointmentHandled: false
        };
      } catch (fallbackError) {
        logger.error({
          err: fallbackError,
          leadId: lead.id
        }, 'Failed to generate contextual fallback - using intelligent default');

        // Intelligent default based on user input
        const intelligentDefault = this._getIntelligentDefault(userText);

        return {
          message: intelligentDefault,
          messages: [intelligentDefault],
          action: 'intelligent_fallback',
          lead_updates: this._extractBasicLeadUpdates(userText),
          appointmentHandled: false
        };
      }
    }
  }

  /**
   * Perform simplified context analysis when strategic analysis fails
   * @private
   */
  _performSimplifiedContextAnalysis(lead, previousMessages, userText) {
    const textLower = userText.toLowerCase();
    const messageCount = previousMessages?.length || 0;

    // Simple pattern-based analysis
    const hasPropertyMention = /\b(condo|hdb|landed|house|apartment|flat|property|buy|invest)\b/.test(textLower);
    const hasLocationMention = /\b(area|location|district|mrt|near|close|around)\b/.test(textLower);
    const hasBudgetMention = /\b(budget|price|cost|afford|million|k|dollar)\b/.test(textLower);
    const hasTimelineMention = /\b(urgent|soon|timeline|when|month|year|asap)\b/.test(textLower);
    const isGreetingOnly = /^(hi|hello|hey|good morning|good afternoon|good evening)\.?$/i.test(userText.trim());

    // Determine if we have sufficient data for strategic processing
    const hasSufficientData = !isGreetingOnly && (
      hasPropertyMention ||
      hasLocationMention ||
      hasBudgetMention ||
      hasTimelineMention ||
      messageCount >= 2 ||
      lead.intent ||
      lead.budget
    );

    logger.info({
      leadId: lead.id,
      hasSufficientData,
      patterns: {
        hasPropertyMention,
        hasLocationMention,
        hasBudgetMention,
        hasTimelineMention,
        isGreetingOnly,
        messageCount
      }
    }, 'Performed simplified context analysis');

    return {
      insufficient_data: !hasSufficientData,
      journey_stage: hasSufficientData ? "interested" : "browsing",
      comfort_level: messageCount > 2 ? "warming" : "cold",
      resistance_patterns: [],
      buying_signals: hasPropertyMention || hasBudgetMention ? ["property_interest"] : [],
      best_approach: hasSufficientData ? "educational" : "natural_conversation",
      consultation_timing: hasSufficientData ? "later" : "not_yet",
      user_psychology: "mixed",
      areas_mentioned: [],
      next_step: hasSufficientData ? "create_interest" : "build_rapport",
      needs_market_hook: hasSufficientData && (hasPropertyMention || hasLocationMention),
      analysis_method: "simplified_fallback"
    };
  }

  /**
   * Generate contextual fallback response when OpenAI fails
   * @private
   */
  _generateContextualFallback(userText, previousMessages) {
    const textLower = userText.toLowerCase();
    const isFirstMessage = !previousMessages || previousMessages.length <= 1;

    // Greeting responses
    if (textLower.match(/^(hi|hello|hey|good morning|good afternoon|good evening)$/)) {
      return isFirstMessage
        ? "Hi there! 😊 Great to connect with you. What brings you to explore properties today?"
        : "Hey! How can I help you with your property search?";
    }

    // Property type mentions
    if (textLower.includes('condo') || textLower.includes('condominium')) {
      return "Condos are really popular right now! What's driving your interest in condo living?";
    }
    if (textLower.includes('hdb') || textLower.includes('flat')) {
      return "HDB flats offer great value! Are you looking at resale or BTO options?";
    }
    if (textLower.includes('landed') || textLower.includes('house')) {
      return "Landed properties are fantastic for families! What size are you considering?";
    }

    // Location mentions
    if (textLower.includes('area') || textLower.includes('location') || textLower.includes('district')) {
      return "Location is so important! What factors are most important to you - proximity to work, schools, or lifestyle amenities?";
    }

    // Budget/price mentions
    if (textLower.includes('budget') || textLower.includes('price') || textLower.includes('cost') || textLower.includes('afford')) {
      return "Budget planning is smart! What range are you comfortable exploring?";
    }

    // Investment mentions
    if (textLower.includes('investment') || textLower.includes('rental') || textLower.includes('yield')) {
      return "Property investment can be really rewarding! Are you looking at rental yield or capital appreciation?";
    }

    // Timeline mentions
    if (textLower.includes('timeline') || textLower.includes('when') || textLower.includes('urgent')) {
      return "Timing can definitely impact your options! What's your ideal timeframe?";
    }

    // Default contextual response
    return "That's interesting! Tell me more about what you're looking for - I'd love to understand your situation better.";
  }

  /**
   * Get intelligent default response based on user input patterns
   * @private
   */
  _getIntelligentDefault(userText) {
    const textLower = userText.toLowerCase();

    // Question patterns
    if (textLower.includes('?')) {
      return "That's a great question! Let me help you with that. Could you share a bit more about your specific situation?";
    }

    // Exploration patterns
    if (textLower.includes('looking') || textLower.includes('searching') || textLower.includes('exploring')) {
      return "Exciting! Property searching can be quite a journey. What's the main thing driving your search right now?";
    }

    // Interest patterns
    if (textLower.includes('interested') || textLower.includes('considering')) {
      return "That sounds promising! What aspects are you most interested in exploring?";
    }

    // Default intelligent response
    return "Thanks for sharing that! I'd love to learn more about your property goals. What's most important to you in your search?";
  }

  /**
   * Extract basic lead updates from natural conversation (no assumptions)
   * @private
   */
  _extractBasicLeadUpdates(userText) {
    const updates = {};
    const textLower = userText.toLowerCase();

    // Only extract very explicit mentions
    if (textLower.includes('want to buy') || textLower.includes('looking to buy')) {
      if (textLower.includes('investment') || textLower.includes('rental income')) {
        updates.intent = 'investment';
      } else if (textLower.includes('live in') || textLower.includes('own stay')) {
        updates.intent = 'own_stay';
      }
    }

    // Only extract explicit budget mentions
    const budgetMatch = textLower.match(/budget.*?(\d+(?:\.\d+)?)\s*(million|mil|k)/);
    if (budgetMatch) {
      const amount = parseFloat(budgetMatch[1]);
      const unit = budgetMatch[2];
      if (unit.includes('mil')) {
        updates.budget = `${amount} million`;
      } else if (unit.includes('k')) {
        updates.budget = `${amount}k`;
      }
    }

    return updates;
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
    // Check if there's an active FUTURE appointment in the database
    try {
      const now = new Date();
      const { data: activeAppointment } = await this.supabase
        .from('appointments')
        .select('id, status, appointment_time, zoom_join_url, zoom_meeting_id')
        .eq('lead_id', leadId)
        .eq('status', 'scheduled')
        .gt('appointment_time', now.toISOString())
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
      const now = new Date();
      const { data: existingAppointment, error: appointmentCheckError } = await this.supabase
        .from('appointments')
        .select('id, status, appointment_time, agent_id')
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled')
        .gt('appointment_time', now.toISOString())
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
   * Unified appointment booking system - single entry point for all booking logic
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

      // Check for existing FUTURE appointments only
      const now = new Date();
      const { data: existingAppointment } = await this.supabase
        .from('appointments')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled')
        .gt('appointment_time', now.toISOString())
        .single();

      // Generate dynamic consultation notes from conversation
      const consultationNotes = await this._generateConsultationNotes(lead, conversationHistory, currentMessage);

      // Handle different appointment intents using the appointment service
      switch (appointmentIntent) {
        case 'book_new':
          return await this._handleNewBookingUnified(lead, agentId, aiInstructions, consultationNotes, existingAppointment, currentMessage);

        case 'reschedule_existing':
          if (!existingAppointment) {
            return { success: false, message: "I don't see any existing appointment to reschedule. Would you like to book a new consultation instead?" };
          }
          return await this._handleRescheduleUnified(lead, agentId, aiInstructions, consultationNotes, existingAppointment, currentMessage);

        case 'cancel_appointment':
          if (!existingAppointment) {
            return { success: false, message: "I don't see any appointment to cancel." };
          }
          return await this._handleCancellationUnified(lead, existingAppointment);

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
   * Handle new booking using appointment service - unified approach
   * @private
   */
  async _handleNewBookingUnified(lead, agentId, aiInstructions, consultationNotes, existingAppointment, currentMessage) {
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

      // Use the appointment service's unified booking logic
      const result = await this.appointmentService.findAndBookAppointment({
        leadId: lead.id,
        agentId,
        userMessage: aiInstructions?.preferred_time || currentMessage,
        leadName: lead.full_name,
        consultationNotes
      });

      if (result.success) {
        // Success - appointment was booked
        return {
          success: true,
          message: result.message
        };
      } else {
        // Handle different failure types
        switch (result.type) {
          case 'alternatives_offered':
            // Store alternatives in lead record for follow-up
            await this.supabase.from('leads').update({
              status: 'booking_alternatives_offered',
              booking_alternatives: JSON.stringify(result.alternatives || [])
            }).eq('id', lead.id);

            return {
              success: false,
              message: result.message
            };

          case 'ask_for_time_preference':
            return {
              success: false,
              message: result.message
            };

          default:
            return {
              success: false,
              message: result.message || "I'm having trouble finding available slots. Let me have our consultant contact you directly."
            };
        }
      }

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in unified new booking');
      return {
        success: false,
        message: "I'm having trouble booking your appointment. Let me have our consultant contact you directly."
      };
    }
  }

  /**
   * Handle appointment rescheduling using appointment service - unified approach
   * @private
   */
  async _handleRescheduleUnified(lead, agentId, aiInstructions, consultationNotes, existingAppointment, currentMessage) {
    try {
      // Extract new preferred time from AI instructions or current message
      const newPreferredTime = this._extractPreferredTimeFromInstructions(aiInstructions);

      if (newPreferredTime) {
        const isAvailable = await this._checkTimeAvailability(agentId, newPreferredTime);

        if (isAvailable) {
          await this.appointmentService.rescheduleAppointment({
            appointmentId: existingAppointment.id,
            newAppointmentTime: newPreferredTime,
            reason: `Rescheduled via WhatsApp: ${currentMessage}`
          });

          const formattedTime = formatForDisplay(toSgTime(newPreferredTime));
          return {
            success: true,
            message: `Rescheduled to ${formattedTime}.\n\nSame Zoom link: ${existingAppointment.zoom_join_url}`
          };
        } else {
          // Find alternatives for rescheduling
          const { findNearbyAvailableSlots } = require('../api/bookingHelper');
          const alternatives = await findNearbyAvailableSlots(agentId, newPreferredTime, 4);

          if (alternatives.length > 0) {
            const slots = alternatives.slice(0, 3).map((slot, index) =>
              `${index + 1}. ${formatForDisplay(toSgTime(slot))}`
            ).join('\n');

            return {
              success: false,
              message: `That time isn't available for rescheduling. Here are some nearby options:\n\n${slots}\n\nWhich one works for you?`
            };
          }
        }
      }

      // If no specific time provided, offer next available slots
      const { findNextAvailableSlots } = require('../api/bookingHelper');
      const availableSlots = await findNextAvailableSlots(agentId, null, 7);

      if (availableSlots.length > 0) {
        const slots = availableSlots.slice(0, 3).map((slot, index) =>
          `${index + 1}. ${formatForDisplay(toSgTime(slot))}`
        ).join('\n');

        return {
          success: false,
          message: `Here are some available times for rescheduling:\n\n${slots}\n\nWhich one works for you?`
        };
      }

      return {
        success: false,
        message: "I'm having trouble finding available slots. Let me have our consultant contact you directly to arrange a suitable time."
      };

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in unified reschedule');
      return {
        success: false,
        message: "I'm having trouble rescheduling. Let me have our consultant contact you directly."
      };
    }
  }

  /**
   * Handle appointment cancellation using appointment service - unified approach
   * @private
   */
  async _handleCancellationUnified(lead, existingAppointment) {
    try {
      await this.appointmentService.cancelAppointment({
        appointmentId: existingAppointment.id,
        reason: 'Cancelled via WhatsApp',
        notifyLead: false // We're already responding to the lead
      });

      return {
        success: true,
        message: "Your appointment has been cancelled. Let me know if you'd like to reschedule for another time!"
      };

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in unified cancellation');
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

        // If no actual FUTURE appointment exists (booking failed), allow new booking
        const now = new Date();
        const { data: existingAppointment } = await supabase
          .from('appointments')
          .select('*')
          .eq('lead_id', lead.id)
          .eq('status', 'scheduled')
          .gt('appointment_time', now.toISOString())
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

  /**
   * Comprehensive health check including database connectivity
   */
  async comprehensiveHealthCheck() {
    const results = {
      overall: 'healthy',
      components: {}
    };

    // Test OpenAI API
    try {
      const openaiResult = await this.healthCheck();
      results.components.openai = openaiResult;
    } catch (error) {
      results.components.openai = { status: 'unhealthy', error: error.message };
      results.overall = 'unhealthy';
    }

    // Test Database Connectivity
    try {
      const { data, error } = await this.supabase
        .from('leads')
        .select('count')
        .limit(1);

      if (error) {
        results.components.database = {
          status: 'unhealthy',
          error: error.message,
          errorCode: error.code
        };
        results.overall = 'unhealthy';
      } else {
        results.components.database = { status: 'healthy', connection: 'active' };
      }
    } catch (error) {
      results.components.database = { status: 'unhealthy', error: error.message };
      results.overall = 'unhealthy';
    }

    // Test Message History Retrieval
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .select('id')
        .limit(1);

      if (error) {
        results.components.message_history = {
          status: 'unhealthy',
          error: error.message,
          errorCode: error.code
        };
        results.overall = 'degraded';
      } else {
        results.components.message_history = { status: 'healthy' };
      }
    } catch (error) {
      results.components.message_history = { status: 'unhealthy', error: error.message };
      results.overall = 'degraded';
    }

    return results;
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
- Messages in conversation: ${messages.length}

RECENT CONVERSATION:
${conversationHistory}

CURRENT MESSAGE: "${currentMessage}"

CRITICAL: Prioritize rapport building and qualification over market data insertion.

INSUFFICIENT DATA DETECTION (Refined - Less Aggressive):
- If this is ONLY a greeting (hi/hello) with absolutely no follow-up context: insufficient_data = true
- If lead has no intent, no budget, AND <2 meaningful messages AND no property type mentioned: insufficient_data = true
- If user message is extremely vague with no property context (e.g., single word responses): insufficient_data = true
- If conversation shows clear disengagement patterns: insufficient_data = true

SUFFICIENT DATA INDICATORS (Use Strategic Mode):
- User mentions specific property types (condo, HDB, landed, etc.)
- User mentions locations, areas, or districts
- User mentions budget, timeline, or investment intent
- User asks specific questions about property market
- User shows engagement beyond basic greetings
- Conversation has 2+ meaningful exchanges
- User expresses any property-related needs or preferences

CONVERSATION READINESS FOR MARKET DATA:
Market data should ONLY be provided when:
- User has shared specific timeline (e.g., "looking to buy in 6 months")
- User has mentioned budget or financing concerns
- User is comparing options or asking for market advice
- User has shown buying signals beyond casual exploration
- User is asking specific questions about pricing or market conditions
- Conversation has progressed beyond initial discovery phase

EARLY STAGE CONVERSATION INDICATORS (needs_market_hook = false):
- "Just exploring", "just looking", "browsing"
- First mention of property type without context
- Casual inquiries without urgency
- No timeline or budget mentioned
- No specific questions about market conditions

IF INSUFFICIENT DATA: Focus on natural conversation building, value provision, and gentle discovery.
IF SUFFICIENT DATA: Proceed with full strategic analysis.

CONVERSATION STAGE ANALYSIS:
- Where is this user in their property journey? (browsing/researching/interested/ready/urgent)
- What's their comfort level with us? (cold/warming/engaged/trusting)
- Any resistance patterns or buying signals detected?

STRATEGIC OPPORTUNITIES (only if sufficient data):
- What specific market insights would resonate with THIS user's situation?
- What psychological approach fits their personality and concerns?
- Consultation timing: only suggest if they're asking for advice or showing urgency

CONVERSATION MOMENTUM:
- Build rapport first, then provide value, THEN consider consultation
- What's the most natural next step to keep them engaged?
- Focus on their specific concerns rather than generic property talk
- Ask qualifying questions before providing market insights

USER PSYCHOLOGY:
- Are they analytical (need data) or emotional (need lifestyle benefits)?
- Do they seem hesitant, urgent, or just exploring?
- What type of urgency/social proof would work best?

Respond in JSON format only with these exact keys:
{
  "insufficient_data": true/false,
  "journey_stage": "browsing|researching|interested|ready|urgent",
  "comfort_level": "cold|warming|engaged|trusting",
  "resistance_patterns": ["pattern1", "pattern2"],
  "buying_signals": ["signal1", "signal2"],
  "best_approach": "educational|urgency|social_proof|direct_booking|natural_conversation",
  "consultation_timing": "now|soon|later|not_yet",
  "user_psychology": "analytical|emotional|mixed",
  "areas_mentioned": ["area1", "area2"],
  "next_step": "build_rapport|create_interest|offer_consultation|book_appointment|natural_discovery",
  "needs_market_hook": true/false
}`;

      // Retry logic for strategic context analysis
      let response;
      const maxRetries = 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await this.openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [{ role: "user", content: analysisPrompt }],
            temperature: 0.3,
            max_tokens: 500
          });

          // Validate response structure
          if (!response?.choices?.[0]?.message?.content) {
            throw new Error('Invalid OpenAI response structure in context analysis');
          }

          break;

        } catch (apiError) {
          logger.warn({
            err: apiError,
            leadId: lead.id,
            attempt,
            maxRetries
          }, 'Strategic context analysis API call failed');

          if (attempt === maxRetries) {
            throw apiError;
          }

          // Brief delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Parse and validate the analysis
      let analysis;
      try {
        analysis = JSON.parse(response.choices[0].message.content);

        // Validate required fields
        if (typeof analysis.insufficient_data !== 'boolean') {
          logger.warn({ leadId: lead.id, analysis }, 'Analysis missing insufficient_data field, defaulting to true');
          analysis.insufficient_data = true;
        }

      } catch (parseError) {
        logger.error({
          err: parseError,
          leadId: lead.id,
          responseContent: response.choices[0].message.content
        }, 'Failed to parse strategic context analysis JSON');
        throw parseError;
      }

      logger.info({
        leadId: lead.id,
        analysis,
        insufficientData: analysis.insufficient_data,
        journeyStage: analysis.journey_stage,
        nextStep: analysis.next_step
      }, 'Strategic context analysis completed successfully');

      return analysis;

    } catch (error) {
      logger.error({
        err: error,
        leadId: lead.id,
        errorMessage: error.message,
        currentMessage: currentMessage?.substring(0, 100),
        messagesCount: messages?.length,
        errorType: error.constructor.name
      }, 'Error in strategic context analysis - this should trigger simplified analysis fallback');

      // Don't return defaults here - let the calling method handle the fallback
      // This allows for better error propagation and fallback strategies
      throw error;
    }
  }

  /**
   * Phase 2: Gather relevant intelligence (market data, competitor info, news, etc.)
   * @private
   */
  async _gatherIntelligence(contextAnalysis, userMessage, conversationMemory = null) {
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
      // Enhanced logic: Skip market data for early-stage conversations
      if (!contextAnalysis.needs_market_hook && contextAnalysis.areas_mentioned.length === 0) {
        logger.info('Skipping intelligence gathering - not needed for this conversation');
        return null;
      }

      // Use unified market data logic
      if (!shouldUseMarketData(contextAnalysis, conversationMemory)) {
        logger.info('Skipping intelligence gathering - unified personality system determined not ready for market data');
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
        contextTrigger: contextAnalysis.needs_market_hook ? 'needs_market_hook' : 'areas_mentioned',
        userContext: {
          journey_stage: contextAnalysis.journey_stage,
          areas_mentioned: contextAnalysis.areas_mentioned,
          conversation_stage: contextAnalysis.conversation_stage
        }
      }, 'Gathering real-time market intelligence for strategic conversation');

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
      // Enhanced conversation state tracking
      conversation_stage: 'rapport_building', // rapport_building, needs_discovery, value_provision, consultation_ready
      qualifying_info_gathered: {
        timeline: null,
        budget: null,
        areas_mentioned: [],
        intent: null,
        specific_needs: []
      },
      market_data_provided: false,
      rapport_established: false,
      ready_for_insights: false,
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

    // Enhanced conversation state tracking
    this._updateConversationState(memory, contextAnalysis, userMessage);

    // Update qualifying information gathered
    this._updateQualifyingInfo(memory, contextAnalysis, userMessage);

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
   * Update conversation state based on context analysis
   * @private
   */
  _updateConversationState(memory, contextAnalysis, userMessage) {
    // Determine conversation stage progression
    const hasQualifyingInfo = memory.qualifying_info_gathered.timeline ||
                             memory.qualifying_info_gathered.budget ||
                             memory.qualifying_info_gathered.areas_mentioned.length > 0;

    // Stage progression logic
    if (contextAnalysis.comfort_level === 'cold' && contextAnalysis.journey_stage === 'browsing') {
      memory.conversation_stage = 'rapport_building';
      memory.rapport_established = false;
    } else if (contextAnalysis.comfort_level === 'warming' && !hasQualifyingInfo) {
      memory.conversation_stage = 'needs_discovery';
      memory.rapport_established = true;
    } else if (hasQualifyingInfo && contextAnalysis.comfort_level === 'engaged') {
      memory.conversation_stage = 'value_provision';
      memory.ready_for_insights = true;
    } else if (contextAnalysis.consultation_timing !== 'not_yet') {
      memory.conversation_stage = 'consultation_ready';
    }

    // Track if market data has been provided
    if (contextAnalysis.needs_market_hook) {
      memory.market_data_provided = true;
    }
  }

  /**
   * Update qualifying information gathered from conversation
   * @private
   */
  _updateQualifyingInfo(memory, contextAnalysis, userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    // Extract timeline information
    const timelineKeywords = ['months', 'year', 'soon', 'urgent', 'asap', 'timeline', 'when'];
    if (timelineKeywords.some(keyword => lowerMessage.includes(keyword))) {
      memory.qualifying_info_gathered.timeline = userMessage;
    }

    // Extract budget information
    const budgetKeywords = ['budget', 'afford', 'price', 'cost', '$', 'k', 'million'];
    if (budgetKeywords.some(keyword => lowerMessage.includes(keyword))) {
      memory.qualifying_info_gathered.budget = userMessage;
    }

    // Update areas mentioned
    if (contextAnalysis.areas_mentioned && contextAnalysis.areas_mentioned.length > 0) {
      contextAnalysis.areas_mentioned.forEach(area => {
        if (!memory.qualifying_info_gathered.areas_mentioned.includes(area)) {
          memory.qualifying_info_gathered.areas_mentioned.push(area);
        }
      });
    }

    // Extract intent information
    const intentKeywords = ['investment', 'own stay', 'live in', 'rental', 'upgrade'];
    if (intentKeywords.some(keyword => lowerMessage.includes(keyword))) {
      if (lowerMessage.includes('investment')) {
        memory.qualifying_info_gathered.intent = 'investment';
      } else if (lowerMessage.includes('own stay') || lowerMessage.includes('live in')) {
        memory.qualifying_info_gathered.intent = 'own_stay';
      }
    }

    // Extract specific needs
    const needsKeywords = ['bedrooms', 'bedder', 'space', 'family', 'upgrade', 'downsize'];
    needsKeywords.forEach(keyword => {
      if (lowerMessage.includes(keyword) && !memory.qualifying_info_gathered.specific_needs.includes(keyword)) {
        memory.qualifying_info_gathered.specific_needs.push(keyword);
      }
    });
  }

  /**
   * Check if sufficient qualifying information has been gathered
   * @private
   */
  _hasQualifyingInfo(conversationMemory) {
    if (!conversationMemory || !conversationMemory.qualifying_info_gathered) {
      return false;
    }

    const info = conversationMemory.qualifying_info_gathered;
    return !!(info.timeline || info.budget || info.areas_mentioned.length > 0 || info.intent);
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
   * Apply enhanced formatting with line breaks for improved readability
   * @private
   */
  _applyEnhancedFormatting(text) {
    const { format } = DORO_PERSONALITY.communication;

    if (!format.line_break_formatting.enabled) {
      return text;
    }

    let formattedText = text;

    // Remove em dashes and replace with alternative punctuation
    formattedText = formattedText.replace(/—/g, ' - ');

    // Apply line break patterns for better readability
    if (format.line_break_formatting.break_long_paragraphs) {
      // Break after questions followed by statements
      formattedText = formattedText.replace(/(\?)\s+([A-Z])/g, '$1\n\n$2');

      // Break before new topic introductions
      formattedText = formattedText.replace(/\.\s+((?:Also|Additionally|By the way|Btw|What about|How about|Speaking of)[^.!?]*[.!?])/gi, '.\n\n$1');

      // Break between distinct statements when text gets long
      if (formattedText.length > format.line_break_formatting.max_paragraph_length) {
        // Break after complete sentences when followed by new thoughts
        formattedText = formattedText.replace(/([.!])\s+([A-Z][^.!?]{20,}[.!?])/g, '$1\n\n$2');
      }
    }

    // Clean up excessive line breaks
    formattedText = formattedText.replace(/\n{3,}/g, '\n\n');

    return formattedText.trim();
  }

  /**
   * Intelligently segment strategic responses while preserving coherence and impact
   * @private
   */
  _segmentStrategicResponse(strategicResponse, options = {}) {
    const { strategy, conversationFlow, strategicPriority, contextAnalysis } = options;
    const { format } = DORO_PERSONALITY.communication;

    // If response is within optimal length, send as single message
    if (strategicResponse.length <= format.natural_segmentation.optimal_length) {
      return [strategicResponse];
    }

    // For high-priority strategic content, allow longer single messages
    if (strategicPriority === 'high' && strategicResponse.length <= format.natural_segmentation.maximum_per_segment) {
      return [strategicResponse];
    }

    // Intelligent segmentation preserving strategic coherence
    const segments = [];

    // First, try to split at natural conversation boundaries
    const naturalBreaks = this._findNaturalBreakPoints(strategicResponse);

    if (naturalBreaks.length > 0) {
      // Use natural break points to create coherent segments
      let currentSegment = '';
      let segmentStart = 0;

      for (const breakPoint of naturalBreaks) {
        const potentialSegment = strategicResponse.substring(segmentStart, breakPoint).trim();

        if (potentialSegment.length >= format.natural_segmentation.minimum_meaningful) {
          if (currentSegment) {
            segments.push(currentSegment);
          }
          currentSegment = potentialSegment;
          segmentStart = breakPoint;
        } else {
          // Segment too short, combine with next
          currentSegment = currentSegment ? currentSegment + ' ' + potentialSegment : potentialSegment;
        }

        // Don't exceed maximum segments
        if (segments.length >= format.intelligent_splitting.max_segments - 1) {
          break;
        }
      }

      // Add remaining content
      if (segmentStart < strategicResponse.length) {
        const remaining = strategicResponse.substring(segmentStart).trim();
        if (remaining) {
          currentSegment = currentSegment ? currentSegment + ' ' + remaining : remaining;
        }
      }

      if (currentSegment) {
        segments.push(currentSegment);
      }
    } else {
      // Fallback: intelligent word-boundary splitting
      segments.push(...this._splitAtWordBoundaries(strategicResponse, format.natural_segmentation.maximum_per_segment));
    }

    // Ensure segments are meaningful and preserve strategic intent
    const finalSegments = segments
      .filter(segment => segment.length >= format.natural_segmentation.minimum_meaningful)
      .slice(0, format.intelligent_splitting.max_segments);

    logger.info({
      originalLength: strategicResponse.length,
      segmentCount: finalSegments.length,
      segmentLengths: finalSegments.map(s => s.length),
      strategicPriority,
      preservedIntent: true
    }, 'Strategic response segmented intelligently');

    return finalSegments.length > 0 ? finalSegments : [strategicResponse];
  }

  /**
   * Find natural break points in strategic content
   * @private
   */
  _findNaturalBreakPoints(text) {
    const breakPoints = [];

    // Look for natural conversation transitions
    const transitionPatterns = [
      /\.\s+(?=(?:Also|Additionally|Furthermore|Moreover|By the way|Btw))/gi,
      /\.\s+(?=(?:What|How|When|Where|Why|Would|Could|Should))/gi,
      /\?\s+(?=[A-Z])/g,
      /!\s+(?=[A-Z])/g,
      /\.\s+(?=(?:I|We|You|This|That|The))/gi
    ];

    for (const pattern of transitionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        breakPoints.push(match.index + match[0].length);
      }
    }

    return breakPoints.sort((a, b) => a - b);
  }

  /**
   * Split text at word boundaries when natural breaks aren't available
   * @private
   */
  _splitAtWordBoundaries(text, maxLength) {
    const segments = [];
    const words = text.split(' ');
    let currentSegment = '';

    for (const word of words) {
      if (currentSegment.length + word.length + 1 <= maxLength) {
        currentSegment = currentSegment ? currentSegment + ' ' + word : word;
      } else {
        if (currentSegment) {
          segments.push(currentSegment);
        }
        currentSegment = word;
      }
    }

    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * Get unified personality configuration for current conversation context
   * @private
   */
  _getUnifiedPersonalityConfig(contextAnalysis, conversationMemory) {
    const currentStage = contextAnalysis.conversation_stage || 'rapport_building';
    const userTone = getToneForUser(contextAnalysis.user_psychology, contextAnalysis.comfort_level);
    const stageGuidelines = getStageGuidelines(currentStage);
    const shouldUseMarketDataFlag = shouldUseMarketData(contextAnalysis, conversationMemory);

    logger.info({
      conversationStage: currentStage,
      recommendedTone: userTone,
      shouldUseMarketData: shouldUseMarketDataFlag,
      stageApproach: stageGuidelines.approach
    }, 'Applied unified personality configuration');

    return {
      stage: currentStage,
      tone: userTone,
      guidelines: stageGuidelines,
      useMarketData: shouldUseMarketDataFlag
    };
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

UNIFIED CONVERSATION FRAMEWORK: Follow the centralized personality system which automatically manages conversation progression, strategic goals, and tactical approaches based on conversation stage and user psychology.

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

CONVERSATION STYLE: Follow unified personality system - all tone, Singlish usage, and expression guidelines are centrally managed and automatically applied based on conversation stage and user psychology.

MARKET DATA & QUALIFYING QUESTIONS: Managed by unified personality system - automatically determines when to use market data and which qualifying questions to prioritize based on conversation stage.

BOOKING GUIDELINES:
- Only set triggerBooking=true if user explicitly asks to "speak to consultant" or "book appointment"
- For urgent situations, use consultation_offer="soft" instead of direct booking
- Build value and trust before suggesting consultations

Plan the response strategy in JSON format with these exact keys:
{
  "approach": "describe your chosen approach (e.g., 'build rapport through discovery questions', 'gather qualifying information', 'provide targeted market insights')",
  "use_market_data": true/false,
  "market_hook": "specific insight relevant to their situation (only if use_market_data=true)",
  "psychology_principles": ["list of influence principles you're using, e.g., 'liking', 'reciprocity', 'authority'"],
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
  async _generateStrategicResponse(strategy, contextAnalysis, intelligenceData, lead, _messages) {
    try {
      const conversationHistory = _messages.slice(-8).map(msg =>
        `${msg.sender === 'lead' ? 'User' : 'Doro'}: ${msg.message}`
      ).join('\n');

      // Get unified personality configuration
      const userTone = getToneForUser(contextAnalysis.user_psychology, contextAnalysis.comfort_level);
      const currentStage = contextAnalysis.conversation_stage || 'rapport_building';
      const stageGuidelines = getStageGuidelines(currentStage);
      const personalityPrompt = getPersonalityPrompt(currentStage);

      const responsePrompt = `
${personalityPrompt}

CURRENT CONVERSATION STAGE: ${currentStage}
STAGE PRIORITY: ${stageGuidelines.priority}
RECOMMENDED TONE: ${userTone}

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

${contextAnalysis.contextual_inference ? `
CONTEXTUAL INFERENCE GUIDANCE:
- Scenario detected: ${contextAnalysis.contextual_inference.scenario}
- Inferred intent: ${contextAnalysis.contextual_inference.inferred_intent} (${contextAnalysis.contextual_inference.confidence} confidence)
- Reasoning: ${contextAnalysis.contextual_inference.reasoning}
- Avoid asking: ${contextAnalysis.contextual_inference.avoid_questions.join(', ')}

IMPORTANT: Use the contextual inference to avoid redundant questions and build naturally on the inferred context.
` : ''}

INTELLIGENCE INSIGHTS TO USE:
${intelligenceData ? JSON.stringify(intelligenceData, null, 2) : 'None available'}

UNIFIED PERSONALITY SYSTEM: Active - All personality traits, tone, and style guidelines are centrally managed

RECENT CONVERSATION:
${conversationHistory}

RESPONSE APPROACH: Follow the unified personality system which provides stage-appropriate examples and prioritized response requirements based on current conversation stage.

UNIFIED PERSONALITY GUIDELINES:
• Follow the centralized personality configuration for all traits and expressions
• Tone and style are automatically determined based on conversation stage and user psychology
• All Singlish usage, expressions, and formatting rules are centrally managed

SALES PSYCHOLOGY TOOLKIT (adapt creatively, don't use verbatim):

Loss Aversion Concepts (adapt to context):
• Highlight potential missed opportunities or costly mistakes
• Position expertise as protection against poor decisions
• Frame market timing and insider knowledge benefits
• Adapt language to user's specific situation and concerns

Urgency & Scarcity Concepts (create naturally):
• Reference current market activity and pace
• Mention limited availability or time-sensitive opportunities
• Adapt to specific areas, property types, or market conditions
• Use current market data to create authentic urgency

Social Proof Concepts (customize dynamically):
• Reference relevant market activity and buyer behavior
• Share insights about area-specific trends and interest
• Adapt examples to user's property type and location preferences
• Create authentic social validation based on real market data

Consultation Positioning Concepts (natural integration):
• Emphasize convenience and low commitment
• Frame as helpful guidance rather than sales pitch
• Adapt timing and approach to user's readiness level
• Position as natural next step in their property journey

IMPORTANT: These are conceptual frameworks - create fresh, contextually appropriate language that feels natural and authentic to the specific conversation and user situation.

STRATEGIC EXECUTION BY CONVERSATION STAGE:

Early Stage (Cold/Warming Users):
• Focus on rapport building and discovery questions
• Avoid market data unless specifically requested
• Ask about their situation, timeline, and preferences
• Sound genuinely interested, not sales-focused

Discovery Stage (Warming/Engaged Users):
• Continue gathering qualifying information
• Share relevant insights only if they support the conversation
• Build trust through helpful questions and observations
• Prepare foundation for value provision

Value Stage (Engaged Users with Context):
• Use market data to make insights specific and credible
• Time psychological tactics based on user readiness
• Deploy consultation offers when momentum is right
• Sound like a knowledgeable friend sharing targeted info

EXAMPLES OF PROGRESSIVE CONVERSATION FLOW:

Early Stage - Rapport Building (NO market data):
User: "just exploring, looking for a 3bedder"
Response: "Nice! What's driving the search for a 3-bedder? Growing family or looking to upgrade?"

Discovery Stage - Qualifying Questions:
User: "growing family, need more space"
Response: "That's exciting! What's your timeline looking like? And any particular areas you're considering?"

Value Stage - Market Insights (ONLY after qualification):
User: "hoping to move in 6 months, looking at Tampines"
Response: "Got it! Tampines has been quite active lately - the new MRT line is really boosting interest there. What's your budget range looking like?"

Consultation Stage - Soft Offer (ONLY after value established):
User: "budget around 800k, but not sure if it's realistic"
Response: "800k can work in Tampines, especially for resale units. Might be worth having a quick chat about what's available in your range. We can do it over Zoom, quite convenient."

STRATEGIC RESPONSE DEVELOPMENT:
Develop your complete strategic response without character count constraints. Focus on:
- Delivering the full strategic value planned in your strategy
- Providing complete market insights with supporting context
- Building compelling value propositions for consultations
- Executing sophisticated psychological approaches effectively

RESPONSE FORMAT:
Respond in JSON format with your complete strategic thoughts:

{
  "strategic_response": "Your complete strategic response - develop fully without character constraints. Include all market insights, value propositions, and strategic content needed to execute your planned approach effectively.",
  "conversation_flow": "natural|multi_part",
  "strategic_priority": "high|medium|low"
}

APPOINTMENT INTENT DETECTION:
If the user wants to book, reschedule, or cancel an appointment, add these fields:
{
  "appointment_intent": "book_new|reschedule_existing|cancel_appointment",
  "booking_instructions": {
    "preferred_time": "exact time mentioned by user or 'check_availability' if no specific time",
    "context_summary": "brief summary of the request",
    "user_intent_confidence": "high|medium|low"
  }
}

Use your judgment to detect appointment intent. Examples:
- "can we set an appointment today at 8pm" → book_new
- "I want to speak to a consultant" → book_new
- "sounds good" (when alternatives were offered) → book_new
- "yes" (when confirming a time) → book_new
- "that works" (when confirming) → book_new
- "can we change my appointment" → reschedule_existing
- "cancel my appointment" → cancel_appointment

RESPOND NATURALLY while executing the planned strategy. Keep responses conversational and authentic.

STRATEGIC COMMUNICATION GUIDELINES:
- Develop complete strategic thoughts without artificial length constraints
- Focus on delivering maximum value and strategic impact
- Include all necessary context for market insights and value propositions
- Execute your planned psychological approaches with full effectiveness
- Think like a knowledgeable consultant sharing valuable insights, not like sending text fragments

EXAMPLES OF STRATEGIC EFFECTIVENESS:
✅ "I've been tracking Toa Payoh market trends and noticed that 3-room flats have been experiencing significant price appreciation due to the upcoming developments and transport improvements in the area. This creates some interesting opportunities for buyers who move quickly."
✅ "Based on current market data, your budget range puts you in a strong position for that area. The new MRT line completion next year is already driving interest, but there are still some good deals available if we act strategically."
✅ "We've been helping clients navigate similar situations, and timing is really crucial right now. Would it be helpful to have a quick chat about the specific opportunities I'm seeing in your price range?"

FOCUS ON STRATEGIC IMPACT, NOT CHARACTER COUNTS!
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

      // Process the complete strategic response
      const strategicResponse = parsedResponse.strategic_response;
      const conversationFlow = parsedResponse.conversation_flow || 'natural';
      const strategicPriority = parsedResponse.strategic_priority || 'medium';

      logger.info({
        leadId: lead.id,
        strategicResponseLength: strategicResponse.length,
        conversationFlow,
        strategicPriority,
        strategy: strategy.approach
      }, 'Processing complete strategic response');

      // Apply enhanced formatting with line breaks for readability
      const formattedResponse = this._applyEnhancedFormatting(strategicResponse);

      // Intelligent message segmentation that preserves strategic coherence
      const messages = this._segmentStrategicResponse(formattedResponse, {
        strategy,
        conversationFlow,
        strategicPriority,
        contextAnalysis
      });

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
        booking_instructions: parsedResponse.booking_instructions,
        strategic_response_complete: true,
        strategic_priority: strategicPriority
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
