const logger = require('../logger');
const botService = require('./botService');
const responseSynthesizer = require('./responseSynthesizer');
const conversationPacingService = require('./conversationPacingService');

/**
 * Unified Processing Pipeline
 * 
 * Integrates all bot functions into a single comprehensive analysis pipeline:
 * 1. Conversational responses
 * 2. Appointment booking logic
 * 3. Property information requests
 * 4. Objection handling
 * 5. Enhanced synthesis and coordination
 * 
 * Processes batched messages as unified conversation context
 * Generates single optimized response addressing all messages
 */
class UnifiedProcessor {
  constructor() {
    // Processing configuration
    this.config = {
      maxProcessingTime: 25000, // 25 seconds max processing time
      enableSynthesis: true,
      enableCoordination: true,
      preserveStrategicThinking: true
    };
    
    // Performance metrics
    this.metrics = {
      batchesProcessed: 0,
      averageProcessingTime: 0,
      synthesisUsageRate: 0,
      coordinationSuccessRate: 0,
      appointmentBookingRate: 0,
      conversationProgressionRate: 0
    };
    
    logger.info('Unified Processing Pipeline initialized');
  }

  /**
   * Main processing entry point for batched messages
   * Replaces individual message processing with unified analysis
   */
  async processBatchedMessages({
    leadId,
    senderWaId,
    batchedMessages,
    leadData,
    conversationHistory
  }) {
    const operationId = `unified-${leadId}-${Date.now()}`;
    const startTime = Date.now();
    
    try {
      logger.info({
        operationId,
        leadId,
        batchSize: batchedMessages.length,
        leadStatus: leadData?.status,
        conversationLength: conversationHistory?.length
      }, '[UNIFIED] Starting unified batch processing');

      // Phase 1: Enhanced Context Analysis for Batch
      const batchContext = await this._analyzeBatchContext({
        batchedMessages,
        leadData,
        conversationHistory,
        operationId
      });

      // Phase 2: Unified Intelligence Gathering
      const intelligenceData = await this._gatherUnifiedIntelligence({
        batchContext,
        leadData,
        operationId
      });

      // Phase 3: Comprehensive Strategy Planning
      const unifiedStrategy = await this._planUnifiedStrategy({
        batchContext,
        intelligenceData,
        leadData,
        operationId
      });

      // Phase 4: Coordinated Response Generation
      const coordinatedResponse = await this._generateCoordinatedResponse({
        unifiedStrategy,
        batchContext,
        leadData,
        operationId
      });

      // Phase 5: Enhanced Synthesis
      const finalResponse = await this._synthesizeResponse({
        coordinatedResponse,
        batchContext,
        unifiedStrategy,
        leadData,
        batchedMessages,
        operationId
      });

      // Phase 6: Execute Coordinated Actions
      const executionResult = await this._executeCoordinatedActions({
        finalResponse,
        unifiedStrategy,
        leadData,
        senderWaId,
        operationId
      });

      // Update metrics
      this._updateMetrics(batchedMessages.length, Date.now() - startTime, executionResult);

      logger.info({
        operationId,
        processingTime: Date.now() - startTime,
        responseLength: finalResponse.response?.length,
        synthesized: finalResponse.synthesized,
        actionsExecuted: executionResult.actionsExecuted?.length || 0
      }, '[UNIFIED] Unified batch processing completed');

      return {
        success: true,
        response: finalResponse.response,
        synthesized: finalResponse.synthesized,
        actions: executionResult.actionsExecuted,
        metrics: {
          processingTime: Date.now() - startTime,
          batchSize: batchedMessages.length,
          ...finalResponse.metrics
        }
      };

    } catch (error) {
      logger.error({
        err: error,
        operationId,
        processingTime: Date.now() - startTime,
        batchSize: batchedMessages.length
      }, '[UNIFIED] Error in unified batch processing');

      // Fallback to individual message processing
      return this._fallbackProcessing({
        leadId,
        senderWaId,
        batchedMessages,
        leadData,
        operationId
      });
    }
  }

  /**
   * Analyze batch context - understand all messages as unified conversation
   * @private
   */
  async _analyzeBatchContext({ batchedMessages, leadData, conversationHistory, operationId }) {
    try {
      // Validate input parameters
      if (!batchedMessages || !Array.isArray(batchedMessages) || batchedMessages.length === 0) {
        throw new Error('Invalid batchedMessages provided');
      }

      // Combine all messages into unified text for analysis
      const combinedText = batchedMessages.map(msg => msg.userText || '').join(' ');
      const latestMessage = batchedMessages[batchedMessages.length - 1];

      logger.debug({
        operationId,
        combinedLength: combinedText.length,
        messageCount: batchedMessages.length
      }, '[UNIFIED] Analyzing batch context');

      // Safe lead data
      const safeLeadData = leadData || {
        id: 'temp-lead',
        phone_number: 'unknown',
        status: 'new'
      };

      // Safe conversation history
      const safeConversationHistory = conversationHistory || [];

      let contextAnalysis;
      try {
        // Use existing context analysis but with combined text
        contextAnalysis = await botService._analyzeStrategicContext(
          safeLeadData,
          safeConversationHistory,
          combinedText
        );
      } catch (contextError) {
        logger.warn({
          err: contextError,
          operationId
        }, '[UNIFIED] Context analysis failed, using fallback');

        // Fallback context analysis
        contextAnalysis = {
          journey_stage: "browsing",
          comfort_level: "cold",
          resistance_patterns: [],
          buying_signals: [],
          best_approach: "natural_conversation",
          consultation_timing: "not_yet",
          user_psychology: "mixed",
          areas_mentioned: [],
          next_step: "build_rapport"
        };
      }

      // Enhanced batch-specific analysis
      const batchAnalysis = {
        ...contextAnalysis,
        batchSize: batchedMessages.length,
        messageTypes: this._classifyMessageTypes(batchedMessages),
        topicChanges: this._detectTopicChanges(batchedMessages),
        urgencyLevel: this._assessUrgencyLevel(batchedMessages),
        interruptionPatterns: this._detectInterruptions(batchedMessages),
        combinedIntent: this._analyzeCombinedIntent(batchedMessages),
        latestMessage: latestMessage.userText || '',
        timeSpan: batchedMessages.length > 1 ?
          (batchedMessages[batchedMessages.length - 1].timestamp || Date.now()) -
          (batchedMessages[0].timestamp || Date.now()) : 0
      };

      return batchAnalysis;

    } catch (error) {
      logger.error({
        err: error,
        operationId
      }, '[UNIFIED] Error in batch context analysis');

      // Fallback to simple analysis
      const fallbackMessage = batchedMessages && batchedMessages.length > 0 ?
        batchedMessages[batchedMessages.length - 1].userText || 'No message' : 'No message';

      return {
        batchSize: batchedMessages ? batchedMessages.length : 0,
        latestMessage: fallbackMessage,
        messageTypes: ['conversational'],
        topicChanges: [],
        urgencyLevel: 'normal',
        combinedIntent: 'general_inquiry',
        journey_stage: "browsing",
        comfort_level: "cold",
        resistance_patterns: [],
        buying_signals: [],
        best_approach: "natural_conversation",
        consultation_timing: "not_yet",
        user_psychology: "mixed",
        areas_mentioned: [],
        next_step: "build_rapport"
      };
    }
  }

  /**
   * Gather intelligence for unified strategy
   * @private
   */
  async _gatherUnifiedIntelligence({ batchContext, leadData, operationId }) {
    try {
      logger.debug({
        operationId,
        combinedIntent: batchContext.combinedIntent,
        messageTypes: batchContext.messageTypes
      }, '[UNIFIED] Gathering unified intelligence');

      // Use existing intelligence gathering but enhanced for batch
      let intelligenceData;

      try {
        intelligenceData = await botService._gatherIntelligence(
          batchContext,
          batchContext.latestMessage,
          {} // conversation memory - will be enhanced
        );
      } catch (intelligenceError) {
        logger.warn({
          err: intelligenceError,
          operationId
        }, '[UNIFIED] Intelligence gathering failed, using fallback');

        // Fallback intelligence data
        intelligenceData = {
          market_data: null,
          property_insights: null,
          lead_psychology: {
            personality_type: 'unknown',
            communication_style: 'neutral',
            decision_making: 'analytical'
          }
        };
      }

      // Ensure intelligenceData is not null
      if (!intelligenceData) {
        intelligenceData = {};
      }

      // Add batch-specific intelligence safely
      intelligenceData.batchInsights = {
        rapidMessaging: batchContext.batchSize > 1,
        topicShifts: batchContext.topicChanges ? batchContext.topicChanges.length > 0 : false,
        urgencyIndicators: batchContext.urgencyLevel === 'high',
        interruptionHandling: batchContext.interruptionPatterns ? batchContext.interruptionPatterns.length > 0 : false
      };

      return intelligenceData;

    } catch (error) {
      logger.error({
        err: error,
        operationId
      }, '[UNIFIED] Error in unified intelligence gathering');

      // Return safe fallback data
      return {
        batchInsights: {
          rapidMessaging: false,
          topicShifts: false,
          urgencyIndicators: false,
          interruptionHandling: false
        },
        market_data: null,
        property_insights: null,
        lead_psychology: {
          personality_type: 'unknown',
          communication_style: 'neutral',
          decision_making: 'analytical'
        }
      };
    }
  }

  /**
   * Plan unified strategy addressing all message types and intents
   * @private
   */
  async _planUnifiedStrategy({ batchContext, intelligenceData, leadData, operationId }) {
    try {
      logger.debug({
        operationId,
        messageTypes: batchContext.messageTypes,
        combinedIntent: batchContext.combinedIntent
      }, '[UNIFIED] Planning unified strategy');

      // Generate strategy for each message type
      const strategies = {
        conversational: null,
        appointmentBooking: null,
        propertyInquiry: null,
        objectionHandling: null,
        urgentResponse: null
      };

      // Conversational strategy (always present)
      strategies.conversational = await this._planConversationalStrategy({
        batchContext,
        intelligenceData,
        leadData
      });

      // Appointment booking strategy (if booking intent detected)
      if (this._hasAppointmentIntent(batchContext)) {
        strategies.appointmentBooking = await this._planAppointmentStrategy({
          batchContext,
          leadData
        });
      }

      // Property inquiry strategy (if property questions detected)
      if (this._hasPropertyInquiry(batchContext)) {
        strategies.propertyInquiry = await this._planPropertyStrategy({
          batchContext,
          intelligenceData
        });
      }

      // Objection handling strategy (if objections detected)
      if (this._hasObjections(batchContext)) {
        strategies.objectionHandling = await this._planObjectionStrategy({
          batchContext,
          leadData
        });
      }

      // Unified coordination strategy
      const coordinationStrategy = this._planCoordinationStrategy(strategies, batchContext);

      return {
        ...strategies,
        coordination: coordinationStrategy,
        priority: this._determinePriority(strategies),
        responseType: this._determineResponseType(strategies)
      };

    } catch (error) {
      logger.error({
        err: error,
        operationId
      }, '[UNIFIED] Error in unified strategy planning');
      
      // Fallback to conversational strategy only
      return {
        conversational: { approach: 'natural_conversation' },
        coordination: { primaryFocus: 'conversation' },
        priority: 'conversation',
        responseType: 'conversational'
      };
    }
  }

  /**
   * Generate coordinated response addressing all strategies
   * @private
   */
  async _generateCoordinatedResponse({ unifiedStrategy, batchContext, leadData, operationId }) {
    try {
      logger.debug({
        operationId,
        responseType: unifiedStrategy.responseType,
        priority: unifiedStrategy.priority
      }, '[UNIFIED] Generating coordinated response');

      // Prepare safe parameters for response generation
      const safeStrategy = unifiedStrategy.conversational || {
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

      const safeContextAnalysis = batchContext || {
        journey_stage: "browsing",
        comfort_level: "cold",
        resistance_patterns: [],
        buying_signals: [],
        best_approach: "natural_conversation",
        consultation_timing: "not_yet",
        user_psychology: "mixed",
        areas_mentioned: [],
        next_step: "build_rapport"
      };

      const safeIntelligenceData = {
        market_data: null,
        property_insights: null,
        lead_psychology: {
          personality_type: 'unknown',
          communication_style: 'neutral',
          decision_making: 'analytical'
        }
      };

      const safeLeadData = leadData || {
        id: 'temp-lead',
        phone_number: 'unknown',
        status: 'new'
      };

      // Safe conversation history - empty array if not available
      const safeConversationHistory = [];

      // Use existing response generation but with safe parameters
      const response = await botService._generateStrategicResponse(
        safeStrategy,
        safeContextAnalysis,
        safeIntelligenceData,
        safeLeadData,
        safeConversationHistory
      );

      // Enhance response with coordination elements
      const coordinatedResponse = await this._coordinateResponseElements({
        baseResponse: response,
        unifiedStrategy,
        batchContext,
        leadData
      });

      return coordinatedResponse;

    } catch (error) {
      logger.error({
        err: error,
        operationId
      }, '[UNIFIED] Error in coordinated response generation');

      // Fallback response
      return {
        message: "Thanks for your messages! Let me help you with your property needs. What specific information are you looking for?",
        appointment_intent: false
      };
    }
  }

  /**
   * Synthesize response using enhanced synthesis layer
   * @private
   */
  async _synthesizeResponse({
    coordinatedResponse,
    batchContext,
    unifiedStrategy,
    leadData,
    batchedMessages,
    operationId
  }) {
    try {
      if (!this.config.enableSynthesis) {
        return {
          response: coordinatedResponse.message,
          synthesized: false,
          metrics: {}
        };
      }

      logger.debug({
        operationId,
        originalLength: coordinatedResponse.message?.length,
        enableSynthesis: this.config.enableSynthesis
      }, '[UNIFIED] Starting response synthesis');

      const synthesisResult = await responseSynthesizer.synthesizeResponse({
        originalResponse: coordinatedResponse.message,
        contextAnalysis: batchContext,
        conversationStage: batchContext.conversation_stage,
        leadData,
        appointmentIntent: coordinatedResponse.appointment_intent,
        batchedMessages,
        strategicPriority: unifiedStrategy.priority
      });

      return synthesisResult;

    } catch (error) {
      logger.error({
        err: error,
        operationId
      }, '[UNIFIED] Error in response synthesis');
      
      return {
        response: coordinatedResponse.message,
        synthesized: false,
        error: error.message,
        metrics: {}
      };
    }
  }

  /**
   * Execute coordinated actions (appointments, follow-ups, etc.)
   * @private
   */
  async _executeCoordinatedActions({
    finalResponse,
    unifiedStrategy,
    leadData,
    senderWaId,
    operationId
  }) {
    try {
      const actionsExecuted = [];

      // Execute appointment booking if needed
      if (unifiedStrategy.appointmentBooking) {
        const bookingResult = await this._executeAppointmentBooking({
          strategy: unifiedStrategy.appointmentBooking,
          leadData,
          operationId
        });
        
        if (bookingResult.success) {
          actionsExecuted.push('appointment_booking');
        }
      }

      // Send the final response
      await this._sendResponse({
        senderWaId,
        response: finalResponse.response,
        operationId,
        leadData
      });
      
      actionsExecuted.push('response_sent');

      return {
        success: true,
        actionsExecuted
      };

    } catch (error) {
      logger.error({
        err: error,
        operationId
      }, '[UNIFIED] Error in coordinated action execution');
      
      return {
        success: false,
        actionsExecuted: [],
        error: error.message
      };
    }
  }

  /**
   * Fallback to individual message processing
   * @private
   */
  async _fallbackProcessing({ leadId, senderWaId, batchedMessages, leadData, operationId }) {
    logger.warn({
      operationId,
      batchSize: batchedMessages.length
    }, '[UNIFIED] Falling back to individual message processing');

    try {
      // Process the latest message only
      const latestMessage = batchedMessages[batchedMessages.length - 1];
      
      await botService.processMessage({
        senderWaId,
        userText: latestMessage.userText,
        senderName: latestMessage.senderName
      });

      return {
        success: true,
        response: 'Processed via fallback',
        synthesized: false,
        actions: ['fallback_processing'],
        metrics: {
          processingTime: 0,
          batchSize: batchedMessages.length,
          fallback: true
        }
      };

    } catch (error) {
      logger.error({
        err: error,
        operationId
      }, '[UNIFIED] Error in fallback processing');
      
      return {
        success: false,
        error: error.message,
        metrics: { fallback: true }
      };
    }
  }

  // Helper methods for message analysis
  _classifyMessageTypes(messages) {
    // Classify each message type
    return messages.map(msg => {
      const text = msg.userText.toLowerCase();
      
      if (/\b(book|schedule|appointment|meet|consultation)\b/.test(text)) {
        return 'appointment_booking';
      } else if (/\b(property|unit|floor plan|price|available)\b/.test(text)) {
        return 'property_inquiry';
      } else if (/\b(but|however|not sure|concerned|worried)\b/.test(text)) {
        return 'objection';
      } else if (/\b(urgent|asap|quickly|soon|now)\b/.test(text)) {
        return 'urgent';
      } else {
        return 'conversational';
      }
    });
  }

  _detectTopicChanges(messages) {
    // Simple topic change detection
    const topics = [];
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1].userText.toLowerCase();
      const curr = messages[i].userText.toLowerCase();
      
      // Basic keyword-based topic detection
      if (this._getTopicKeywords(prev) !== this._getTopicKeywords(curr)) {
        topics.push({
          from: this._getTopicKeywords(prev),
          to: this._getTopicKeywords(curr),
          messageIndex: i
        });
      }
    }
    return topics;
  }

  _getTopicKeywords(text) {
    if (/\b(book|schedule|appointment)\b/.test(text)) return 'booking';
    if (/\b(property|unit|floor)\b/.test(text)) return 'property';
    if (/\b(price|cost|budget)\b/.test(text)) return 'pricing';
    if (/\b(location|area|district)\b/.test(text)) return 'location';
    return 'general';
  }

  _assessUrgencyLevel(messages) {
    const urgentKeywords = ['urgent', 'asap', 'quickly', 'soon', 'now', 'immediately'];
    const urgentCount = messages.reduce((count, msg) => {
      return count + urgentKeywords.filter(keyword => 
        msg.userText.toLowerCase().includes(keyword)
      ).length;
    }, 0);
    
    return urgentCount > 0 ? 'high' : 'normal';
  }

  _detectInterruptions(messages) {
    // Detect if user interrupted themselves with new messages
    return messages.length > 1 ? ['rapid_messaging'] : [];
  }

  _analyzeCombinedIntent(messages) {
    const combinedText = messages.map(msg => msg.userText).join(' ').toLowerCase();
    
    if (/\b(book|schedule|appointment)\b/.test(combinedText)) {
      return 'appointment_booking';
    } else if (/\b(property|unit|available|price)\b/.test(combinedText)) {
      return 'property_inquiry';
    } else {
      return 'general_inquiry';
    }
  }

  _hasAppointmentIntent(batchContext) {
    return batchContext.combinedIntent === 'appointment_booking' ||
           batchContext.messageTypes.includes('appointment_booking');
  }

  _hasPropertyInquiry(batchContext) {
    return batchContext.combinedIntent === 'property_inquiry' ||
           batchContext.messageTypes.includes('property_inquiry');
  }

  _hasObjections(batchContext) {
    return batchContext.messageTypes.includes('objection');
  }

  // Strategy planning methods (simplified for now)
  async _planConversationalStrategy({ batchContext, intelligenceData, leadData }) {
    return {
      approach: 'natural_conversation',
      tone: 'warm_professional',
      focus: 'rapport_building'
    };
  }

  async _planAppointmentStrategy({ batchContext, leadData }) {
    return {
      action: 'schedule_consultation',
      priority: 'high'
    };
  }

  async _planPropertyStrategy({ batchContext, intelligenceData }) {
    return {
      action: 'provide_property_info',
      priority: 'medium'
    };
  }

  async _planObjectionStrategy({ batchContext, leadData }) {
    return {
      action: 'address_concerns',
      priority: 'high'
    };
  }

  _planCoordinationStrategy(strategies, batchContext) {
    return {
      primaryFocus: this._determinePrimaryFocus(strategies),
      responseStructure: 'unified',
      actionSequence: this._determineActionSequence(strategies)
    };
  }

  _determinePriority(strategies) {
    if (strategies.appointmentBooking) return 'appointment';
    if (strategies.objectionHandling) return 'objection';
    if (strategies.propertyInquiry) return 'property';
    return 'conversation';
  }

  _determineResponseType(strategies) {
    if (strategies.appointmentBooking) return 'booking_focused';
    if (strategies.propertyInquiry) return 'information_focused';
    return 'conversational';
  }

  _determinePrimaryFocus(strategies) {
    if (strategies.appointmentBooking) return 'booking';
    if (strategies.objectionHandling) return 'objection';
    if (strategies.propertyInquiry) return 'property';
    return 'conversation';
  }

  _determineActionSequence(strategies) {
    const sequence = [];
    if (strategies.objectionHandling) sequence.push('address_objections');
    if (strategies.propertyInquiry) sequence.push('provide_information');
    if (strategies.conversational) sequence.push('continue_conversation');
    if (strategies.appointmentBooking) sequence.push('schedule_appointment');
    return sequence;
  }

  async _coordinateResponseElements({ baseResponse, unifiedStrategy, batchContext, leadData }) {
    // For now, return the base response
    // This will be enhanced with actual coordination logic
    return baseResponse;
  }

  async _executeAppointmentBooking({ strategy, leadData, operationId }) {
    // Placeholder for appointment booking execution
    return { success: false };
  }

  async _sendResponse({ senderWaId, response, operationId, leadData }) {
    const whatsappService = require('./whatsappService');
    const supabase = require('../supabaseClient');

    try {
      // Send WhatsApp message
      await whatsappService.sendMessage({ to: senderWaId, message: response });

      // Store assistant response in database
      if (leadData?.id) {
        const { error: messageError } = await supabase.from('messages').insert({
          lead_id: leadData.id,
          sender: 'assistant',
          message: response
        });

        if (messageError) {
          logger.error({
            err: messageError,
            operationId,
            leadId: leadData.id,
            responseLength: response?.length
          }, '[UNIFIED] Failed to save assistant response to database');
        } else {
          logger.debug({
            operationId,
            leadId: leadData.id,
            responseLength: response?.length
          }, '[UNIFIED] Assistant response saved to database successfully');
        }
      }

    } catch (error) {
      logger.error({
        err: error,
        operationId,
        senderWaId,
        responseLength: response?.length
      }, '[UNIFIED] Error sending response or saving to database');
      throw error;
    }
  }

  _updateMetrics(batchSize, processingTime, executionResult) {
    this.metrics.batchesProcessed++;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.batchesProcessed - 1) + processingTime) / 
      this.metrics.batchesProcessed;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

// Create singleton instance
const unifiedProcessor = new UnifiedProcessor();

module.exports = unifiedProcessor;
