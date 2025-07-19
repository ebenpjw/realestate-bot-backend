const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');
const databaseService = require('./databaseService');
const { web_search } = require('./webSearchService');
const multiLayerMonitoring = require('./multiLayerMonitoring');
const { DORO_PERSONALITY } = require('../config/personality');
const costTrackingService = require('./costTrackingService');

/**
 * Multi-Layered AI Thinking Architecture for Real Estate Bot
 * 
 * Implements sophisticated 5-layer AI processing system optimized for appointment conversion:
 * 1. Lead Psychology & Context Analysis
 * 2. Intelligence Gathering & Data Retrieval with Web Search Fact-Checking
 * 3. Strategic Response Planning
 * 4. Content Generation & Personalization
 * 5. Synthesis & Quality Validation
 * 
 * Primary Objective: Convert WhatsApp leads into booked Zoom consultations
 * Success Metric: Appointment booking conversion rate
 */
class MultiLayerAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      timeout: 8000, // Reduced from 30s to 8s for real-time chat
      maxRetries: 1 // Reduced retries for speed
    });
    
    // Processing configuration - OPTIMIZED FOR SPEED
    this.config = {
      maxProcessingTime: 12000, // 12 seconds target (reduced from 30s)
      enableFactChecking: true,
      enableFloorPlanDelivery: true,
      enableAppointmentBooking: true,
      qualityThreshold: 0.7, // Slightly lower for speed
      enableParallelProcessing: true // NEW: Enable parallel layer processing
    };
    
    // Performance metrics
    this.metrics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      layerSuccessRates: {
        psychology: 0,
        intelligence: 0,
        strategy: 0,
        content: 0,
        synthesis: 0
      },
      appointmentConversions: 0,
      factCheckAccuracy: 0
    };
    
    logger.info('Multi-Layer AI Architecture initialized');
  }

  /**
   * Wrapper for OpenAI API calls with cost tracking
   * @private
   */
  async _callOpenAIWithTracking({
    agentId,
    leadId,
    operationType,
    messages,
    model = config.OPENAI_MODEL || 'gpt-4.1',
    temperature = 0.7,
    maxTokens = 1000,
    responseFormat = null,
    metadata = {}
  }) {
    try {
      const requestParams = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      };

      if (responseFormat) {
        requestParams.response_format = responseFormat;
      }

      const completion = await this.openai.chat.completions.create(requestParams);

      // Extract token usage
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const totalTokens = completion.usage?.total_tokens || 0;

      // Record cost tracking
      if (agentId) {
        await costTrackingService.recordOpenAIUsage({
          agentId,
          leadId,
          operationType,
          model,
          inputTokens,
          outputTokens,
          metadata: {
            ...metadata,
            temperature,
            max_tokens: maxTokens,
            total_tokens: totalTokens
          }
        }).catch(err => {
          logger.error({ err, agentId, operationType }, 'Failed to record OpenAI cost tracking');
        });
      }

      logger.debug({
        operationType,
        model,
        inputTokens,
        outputTokens,
        totalTokens
      }, 'OpenAI API call completed with cost tracking');

      return completion;

    } catch (error) {
      logger.error({ err: error, operationType, model }, 'OpenAI API call failed');
      throw error;
    }
  }

  /**
   * Main processing entry point - replaces current message processing
   * Processes message through all 5 AI layers sequentially
   * Enhanced with agent context support for multi-tenant operations
   */
  async processMessage({
    leadId,
    senderWaId,
    userText,
    senderName,
    conversationHistory,
    leadData,
    agentId = null
  }) {
    const operationId = `multilayer-${leadId}-${Date.now()}`;
    const startTime = Date.now();
    
    try {
      logger.info({
        operationId,
        leadId,
        agentId,
        messageLength: userText?.length,
        historyLength: conversationHistory?.length
      }, '[MULTILAYER] Starting 5-layer AI processing with agent context');

      // PARALLEL PROCESSING: Run Layer 1 & 2 simultaneously for 50% speed improvement
      const [psychologyAnalysis, intelligenceData] = await Promise.all([
        // LAYER 1: Lead Psychology & Context Analysis
        this._layer1_psychologyAnalysis({
          leadId,
          userText,
          conversationHistory,
          leadData,
          operationId,
          agentId
        }),
        // LAYER 2: Intelligence Gathering & Data Retrieval with Fact-Checking
        this._layer2_intelligenceGathering({
          userText,
          leadData,
          operationId,
          agentId
        })
      ]);

      // LAYER 3: Strategic Response Planning
      const responseStrategy = await this._layer3_strategicPlanning({
        psychologyAnalysis,
        intelligenceData,
        leadData,
        operationId,
        agentId
      });

      // LAYER 4: Content Generation & Personalization
      const contentGeneration = await this._layer4_contentGeneration({
        psychologyAnalysis,
        intelligenceData,
        responseStrategy,
        leadData,
        operationId,
        agentId
      });

      // LAYER 5: Synthesis & Quality Validation
      const finalResponse = await this._layer5_synthesisValidation({
        psychologyAnalysis,
        intelligenceData,
        responseStrategy,
        contentGeneration,
        leadData,
        operationId,
        agentId
      });

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Update metrics
      this._updateMetrics(processingTime, finalResponse);

      // Record monitoring data
      multiLayerMonitoring.recordProcessingResult({
        success: true,
        processingTime,
        appointmentBooked: !!finalResponse.appointmentIntent,
        factChecked: !!finalResponse.factChecked,
        factCheckAccuracy: intelligenceData.dataConfidence || 0,
        floorPlansDelivered: finalResponse.floorPlanImages?.length || 0,
        leadQualified: finalResponse.qualityScore > 0.7,
        fallbackUsed: false
      });

      // Extract and store lead interests for contextual follow-ups
      await this._extractAndStoreLeadInterests(leadId, {
        psychologyAnalysis,
        intelligenceData,
        userText,
        leadData
      });
      
      logger.info({
        operationId,
        processingTime,
        qualityScore: finalResponse.qualityScore,
        appointmentIntent: finalResponse.appointmentIntent,
        factChecked: finalResponse.factChecked
      }, '[MULTILAYER] 5-layer processing completed successfully');

      return {
        success: true,
        response: finalResponse.message,
        appointmentIntent: finalResponse.appointmentIntent,
        floorPlanImages: finalResponse.floorPlanImages,
        leadUpdates: finalResponse.leadUpdates,
        consultantBriefing: finalResponse.consultantBriefing,
        processingTime,
        qualityScore: finalResponse.qualityScore,
        layerResults: {
          psychology: psychologyAnalysis,
          intelligence: intelligenceData,
          strategy: responseStrategy,
          content: contentGeneration,
          synthesis: finalResponse
        }
      };

    } catch (error) {
      logger.error({
        err: error,
        operationId,
        processingTime: Date.now() - startTime
      }, '[MULTILAYER] Error in multi-layer processing');

      // Fallback to simplified response
      return this._generateFallbackResponse(userText, leadData);
    }
  }

  /**
   * LAYER 1: Lead Psychology & Context Analysis
   * Analyzes lead's communication style, resistance patterns, urgency indicators
   */
  async _layer1_psychologyAnalysis({
    leadId,
    userText,
    conversationHistory,
    leadData,
    operationId,
    agentId
  }) {
    const startTime = Date.now();

    try {
      logger.debug({ operationId }, '[LAYER1] Starting psychology analysis');

      const prompt = this._buildPsychologyPrompt(userText, conversationHistory, leadData);

      const completion = await this._callOpenAIWithTracking({
        agentId,
        leadId,
        operationType: 'psychology_analysis',
        messages: [
          {
            role: 'system',
            content: `You are an expert real estate lead psychologist. Analyze the lead's communication patterns, psychological state, and buying readiness to optimize conversion strategies.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        maxTokens: 600,
        responseFormat: { type: "json_object" },
        metadata: {
          layer: 1,
          operation_id: operationId,
          user_text_length: userText?.length || 0,
          conversation_history_length: conversationHistory?.length || 0
        }
      });

      const analysis = JSON.parse(completion.choices[0]?.message?.content || '{}');
      
      // Enhance with conversation stage detection
      analysis.conversationStage = this._detectConversationStage(conversationHistory, userText);
      analysis.processingTime = Date.now() - startTime;

      // Record monitoring data
      multiLayerMonitoring.recordLayerAttempt('psychology', analysis.processingTime, true);

      logger.debug({
        operationId,
        stage: analysis.conversationStage,
        resistanceLevel: analysis.resistanceLevel,
        urgencyScore: analysis.urgencyScore
      }, '[LAYER1] Psychology analysis completed');

      return analysis;

    } catch (error) {
      // Record monitoring data for failure
      multiLayerMonitoring.recordLayerAttempt('psychology', Date.now() - startTime, false, error);

      logger.error({ err: error, operationId }, '[LAYER1] Psychology analysis failed');
      return this._getFallbackPsychologyAnalysis(userText, leadData);
    }
  }

  /**
   * LAYER 2: Intelligence Gathering & Data Retrieval with Web Search Fact-Checking
   * Queries property database AND fact-checks information through Google Custom Search API
   * OPTIMIZED: Runs in parallel with Layer 1 for speed
   */
  async _layer2_intelligenceGathering({
    userText,
    leadData,
    operationId,
    agentId
  }) {
    const startTime = Date.now();
    
    try {
      logger.debug({ operationId }, '[LAYER2] Starting intelligence gathering with fact-checking');

      // Step 1: Query internal property database
      const propertyData = await this._queryPropertyDatabase(userText, leadData);
      
      // Step 2: Fact-check property information through web search
      const factCheckedData = await this._factCheckPropertyData(propertyData, userText);
      
      // Step 3: Gather market intelligence
      const marketIntelligence = await this._gatherMarketIntelligence(userText, leadData);
      
      // Step 4: Get floor plan data if requested
      const floorPlanData = await this._getFloorPlanData(userText, propertyData);

      const intelligencePackage = {
        propertyData: factCheckedData.properties || propertyData,
        marketIntelligence,
        floorPlanData,
        factCheckResults: factCheckedData.factCheckResults,
        dataConfidence: factCheckedData.confidence,
        processingTime: Date.now() - startTime
      };

      // Record monitoring data
      multiLayerMonitoring.recordLayerAttempt('intelligence', intelligencePackage.processingTime, true);

      logger.debug({
        operationId,
        propertiesFound: intelligencePackage.propertyData?.length || 0,
        factChecked: !!factCheckedData.factCheckResults,
        confidence: intelligencePackage.dataConfidence
      }, '[LAYER2] Intelligence gathering completed');

      return intelligencePackage;

    } catch (error) {
      // Record monitoring data for failure
      multiLayerMonitoring.recordLayerAttempt('intelligence', Date.now() - startTime, false, error);

      logger.error({ err: error, operationId }, '[LAYER2] Intelligence gathering failed');
      return this._getFallbackIntelligence(userText, leadData);
    }
  }

  /**
   * Analyze conversation context to prevent repetition and ensure continuity
   * @private
   */
  _analyzeConversationContext(conversationHistory, userText) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return {
        previousTopicsDiscussed: [],
        informationAlreadyShared: [],
        questionsAlreadyAsked: [],
        conversationProgression: 'initial',
        repetitionRisk: 'low',
        contextAwareness: 'First interaction'
      };
    }

    const recentMessages = conversationHistory.slice(-10);
    const botMessages = recentMessages.filter(msg => msg.sender === 'bot');
    const userMessages = recentMessages.filter(msg => msg.sender === 'lead');

    // Extract topics from recent conversation
    const previousTopics = this._extractTopicsFromMessages(recentMessages);

    // Extract information already shared by bot
    const informationShared = this._extractInformationShared(botMessages);

    // Extract questions already asked by bot
    const questionsAsked = this._extractQuestionsAsked(botMessages);

    // Analyze conversation progression
    const progression = this._analyzeConversationProgression(recentMessages);

    // Assess repetition risk
    const repetitionRisk = this._assessRepetitionRisk(botMessages, userText);

    // Determine what the user is responding to
    const contextAwareness = this._determineUserContext(userText, recentMessages);

    return {
      previousTopicsDiscussed: previousTopics,
      informationAlreadyShared: informationShared,
      questionsAlreadyAsked: questionsAsked,
      conversationProgression: progression,
      repetitionRisk: repetitionRisk,
      contextAwareness: contextAwareness
    };
  }

  /**
   * Extract topics from conversation messages
   * @private
   */
  _extractTopicsFromMessages(messages) {
    const topics = new Set();
    const topicKeywords = {
      'property_search': ['property', 'condo', 'hdb', 'landed', 'apartment'],
      'budget_discussion': ['budget', 'price', 'afford', 'cost', 'expensive'],
      'location_preferences': ['area', 'district', 'location', 'mrt', 'school'],
      'timeline_discussion': ['when', 'timeline', 'urgent', 'soon', 'ready'],
      'appointment_booking': ['appointment', 'consultation', 'meet', 'call', 'zoom'],
      'market_insights': ['market', 'trend', 'price', 'investment', 'growth']
    };

    messages.forEach(msg => {
      const messageText = msg.message.toLowerCase();
      Object.entries(topicKeywords).forEach(([topic, keywords]) => {
        if (keywords.some(keyword => messageText.includes(keyword))) {
          topics.add(topic);
        }
      });
    });

    return Array.from(topics);
  }

  /**
   * Extract information already shared by bot
   * @private
   */
  _extractInformationShared(botMessages) {
    const informationTypes = [];

    botMessages.forEach(msg => {
      const messageText = msg.message.toLowerCase();

      if (messageText.includes('propnex') || messageText.includes('era') || messageText.includes('orangetee')) {
        informationTypes.push('company_network');
      }
      if (messageText.includes('$') || messageText.includes('price') || messageText.includes('million')) {
        informationTypes.push('pricing_information');
      }
      if (messageText.includes('district') || messageText.includes('area') || messageText.includes('location')) {
        informationTypes.push('location_information');
      }
      if (messageText.includes('consultation') || messageText.includes('appointment') || messageText.includes('zoom')) {
        informationTypes.push('consultation_offer');
      }
    });

    return [...new Set(informationTypes)];
  }

  /**
   * Extract questions already asked by bot
   * @private
   */
  _extractQuestionsAsked(botMessages) {
    const questionsAsked = [];

    botMessages.forEach(msg => {
      const messageText = msg.message.toLowerCase();

      if (messageText.includes('what\'s your budget') || messageText.includes('budget')) {
        questionsAsked.push('budget_question');
      }
      if (messageText.includes('which area') || messageText.includes('where are you looking')) {
        questionsAsked.push('location_question');
      }
      if (messageText.includes('timeline') || messageText.includes('when are you')) {
        questionsAsked.push('timeline_question');
      }
      if (messageText.includes('would you like') && messageText.includes('consultation')) {
        questionsAsked.push('consultation_question');
      }
    });

    return [...new Set(questionsAsked)];
  }

  /**
   * Analyze conversation progression
   * @private
   */
  _analyzeConversationProgression(messages) {
    if (messages.length <= 2) return 'initial';

    const recentMessages = messages.slice(-6);
    const userEngagement = recentMessages.filter(msg => msg.sender === 'lead').length;
    const botResponses = recentMessages.filter(msg => msg.sender === 'bot').length;

    if (userEngagement >= botResponses && userEngagement > 2) {
      return 'advancing';
    } else if (userEngagement < botResponses) {
      return 'stalling';
    } else {
      return 'steady';
    }
  }

  /**
   * Assess repetition risk based on recent bot messages
   * @private
   */
  _assessRepetitionRisk(botMessages, userText) {
    if (botMessages.length < 2) return 'low';

    const recentBotMessages = botMessages.slice(-3);
    const messageSimilarity = this._calculateMessageSimilarity(recentBotMessages);

    if (messageSimilarity > 0.7) return 'high';
    if (messageSimilarity > 0.4) return 'medium';
    return 'low';
  }

  /**
   * Calculate similarity between recent bot messages
   * @private
   */
  _calculateMessageSimilarity(messages) {
    if (messages.length < 2) return 0;

    const message1 = messages[messages.length - 1].message.toLowerCase();
    const message2 = messages[messages.length - 2].message.toLowerCase();

    // Simple similarity check based on common words
    const words1 = message1.split(' ').filter(word => word.length > 3);
    const words2 = message2.split(' ').filter(word => word.length > 3);

    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = Math.max(words1.length, words2.length);

    return totalWords > 0 ? commonWords.length / totalWords : 0;
  }

  /**
   * Determine what the user is responding to
   * @private
   */
  _determineUserContext(userText, recentMessages) {
    if (recentMessages.length === 0) return 'Initial contact';

    const lastBotMessage = recentMessages.filter(msg => msg.sender === 'bot').slice(-1)[0];
    if (!lastBotMessage) return 'Continuing conversation';

    const userTextLower = userText.toLowerCase();
    const lastBotMessageLower = lastBotMessage.message.toLowerCase();

    // Check if user is responding to specific questions or topics
    if (lastBotMessageLower.includes('budget') && (userTextLower.includes('$') || userTextLower.includes('million'))) {
      return 'Responding to budget question';
    }
    if (lastBotMessageLower.includes('area') && userTextLower.includes('district')) {
      return 'Responding to location question';
    }
    if (lastBotMessageLower.includes('consultation') && (userTextLower.includes('yes') || userTextLower.includes('sure'))) {
      return 'Responding to consultation offer';
    }

    return `Responding to: ${lastBotMessage.message.substring(0, 50)}...`;
  }

  /**
   * Build psychology analysis prompt
   * @private
   */
  _buildPsychologyPrompt(userText, conversationHistory, leadData) {
    const historyContext = conversationHistory?.slice(-8).map(msg =>
      `${msg.sender}: ${msg.message}`
    ).join('\n') || 'No previous conversation';

    // Analyze conversation context for continuity
    const conversationContext = this._analyzeConversationContext(conversationHistory, userText);

    // Analyze recent bot responses to prevent repetition
    const recentBotResponses = conversationHistory?.filter(msg => msg.sender === 'bot')
      .slice(-3)
      .map(msg => msg.message) || [];

    const botResponseContext = recentBotResponses.length > 0
      ? `\nRECENT BOT RESPONSES (AVOID REPEATING THESE PATTERNS):\n${recentBotResponses.map((msg, i) => `${i+1}. ${msg}`).join('\n')}`
      : '';

    return `Analyze this Singapore property lead's psychology and communication patterns with CRITICAL focus on conversation continuity:

CURRENT MESSAGE: "${userText}"

CONVERSATION HISTORY (Last 8 messages):
${historyContext}${botResponseContext}

LEAD DATA:
- Source: ${leadData?.source || 'Unknown'}
- Status: ${leadData?.status || 'New'}
- Budget: ${leadData?.budget || 'Not specified'}
- Intent: ${leadData?.intent || 'Unknown'}

CRITICAL ANALYSIS REQUIREMENTS:
1. CONVERSATION CONTINUITY: Analyze how this message relates to previous exchanges
2. REPETITION DETECTION: Identify if the lead is repeating questions or if bot responses have been repetitive
3. CONTEXT AWARENESS: Understand what information has already been shared or discussed
4. PROGRESSION TRACKING: Determine if conversation is advancing or stalling
5. CONVERSION PSYCHOLOGY: Identify optimal psychological triggers for consultation booking
6. OBJECTION PREDICTION: Anticipate likely objections and resistance patterns
7. URGENCY ASSESSMENT: Evaluate lead's time sensitivity and decision-making urgency

Provide detailed psychological analysis in JSON format:
{
  "communicationStyle": "direct|polite|hesitant|aggressive|casual",
  "resistancePatterns": ["pattern1", "pattern2"],
  "urgencyIndicators": ["indicator1", "indicator2"],
  "urgencyScore": 0.0-1.0,
  "resistanceLevel": "low|medium|high",
  "buyingSignals": ["signal1", "signal2"],
  "painPoints": ["pain1", "pain2"],
  "motivationTriggers": ["trigger1", "trigger2"],
  "conversationStage": "initial|browsing|interested|qualified|objecting",
  "psychologicalProfile": "analytical|emotional|practical|status_conscious",
  "recommendedApproach": "educational|consultative|direct|nurturing",
  "appointmentReadiness": "not_ready|warming_up|ready|very_ready",
  "culturalConsiderations": ["consideration1", "consideration2"],
  "nextBestAction": "build_rapport|provide_info|address_objection|book_appointment",
  "conversionTriggers": {
    "scarcityResponse": "high|medium|low",
    "socialProofSensitivity": "high|medium|low",
    "authorityInfluence": "high|medium|low",
    "urgencyMotivation": "high|medium|low",
    "optimalConversionTactic": "scarcity|social_proof|authority|urgency|reciprocity"
  },
  "objectionPrediction": {
    "likelyObjections": ["budget", "timing", "comparison_shopping", "decision_making"],
    "objectionStrength": "weak|moderate|strong",
    "preEmptionStrategy": "address_upfront|wait_for_objection|ignore"
  },
  "consultationReadiness": {
    "readinessScore": 0.0-1.0,
    "optimalApproach": "immediate_booking|soft_suggestion|value_building_first",
    "bestTimeFrame": "today|this_week|next_week|longer_term"
  },
  "conversationContinuity": {
    "previousTopicsDiscussed": ${JSON.stringify(conversationContext.previousTopicsDiscussed)},
    "informationAlreadyShared": ${JSON.stringify(conversationContext.informationAlreadyShared)},
    "questionsAlreadyAsked": ${JSON.stringify(conversationContext.questionsAlreadyAsked)},
    "conversationProgression": "${conversationContext.conversationProgression}",
    "repetitionRisk": "${conversationContext.repetitionRisk}",
    "contextAwareness": "${conversationContext.contextAwareness}"
  },
  "responseGuidance": {
    "avoidRepeating": ${JSON.stringify(conversationContext.informationAlreadyShared.concat(conversationContext.questionsAlreadyAsked))},
    "buildUpon": "${conversationContext.contextAwareness}",
    "newInformationNeeded": ${conversationContext.repetitionRisk === 'high' ? 'true' : 'false'},
    "conversationDirection": "${conversationContext.conversationProgression === 'stalling' ? 'advance_to_next_stage' : 'continue_current_thread'}"
  }
}`;
  }

  /**
   * Query internal property database for relevant properties
   * @private
   */
  async _queryPropertyDatabase(userText, leadData) {
    try {
      // Extract property search criteria from message
      const searchCriteria = this._extractPropertyCriteria(userText, leadData);

      let query = databaseService.supabase
        .from('property_projects')
        .select(`
          *,
          property_unit_mix(*),
          visual_assets(id, asset_type, public_url, ai_visual_analysis(*))
        `)
        .eq('sales_status', 'Available')
        .limit(5);

      // Apply search filters
      if (searchCriteria.district) {
        query = query.eq('district', searchCriteria.district);
      }

      if (searchCriteria.propertyType) {
        query = query.eq('property_type', searchCriteria.propertyType);
      }

      if (searchCriteria.priceRange) {
        query = query
          .gte('price_range_min', searchCriteria.priceRange.min)
          .lte('price_range_max', searchCriteria.priceRange.max);
      }

      const { data: properties, error } = await query;

      if (error) {
        logger.error({ err: error }, 'Error querying property database');
        return [];
      }

      return properties || [];

    } catch (error) {
      logger.error({ err: error }, 'Error in property database query');
      return [];
    }
  }

  /**
   * Fact-check property data through Google Custom Search API
   * @private
   */
  async _factCheckPropertyData(propertyData, userText) {
    if (!this.config.enableFactChecking || !propertyData?.length) {
      return { properties: propertyData, factCheckResults: null, confidence: 0.5 };
    }

    try {
      const factCheckResults = [];
      let totalConfidence = 0;

      for (const property of propertyData.slice(0, 3)) { // Limit to top 3 for performance
        const factCheck = await this._verifyPropertyInfo(property);
        factCheckResults.push(factCheck);
        totalConfidence += factCheck.confidence;
      }

      const averageConfidence = totalConfidence / factCheckResults.length;

      // Update property data with fact-checked information
      const verifiedProperties = propertyData.map((property, index) => {
        const factCheck = factCheckResults[index];
        if (factCheck && factCheck.confidence > 0.7) {
          return {
            ...property,
            verified: true,
            factCheckData: factCheck.verifiedData,
            confidence: factCheck.confidence
          };
        }
        return { ...property, verified: false, confidence: 0.5 };
      });

      return {
        properties: verifiedProperties,
        factCheckResults,
        confidence: averageConfidence
      };

    } catch (error) {
      logger.error({ err: error }, 'Error in fact-checking property data');
      return { properties: propertyData, factCheckResults: null, confidence: 0.5 };
    }
  }

  /**
   * Verify individual property information through web search
   * @private
   */
  async _verifyPropertyInfo(property) {
    try {
      // Add current date context for 2025 information
      const currentDate = new Date().toLocaleDateString('en-SG', {
        year: 'numeric',
        month: 'long'
      });
      const searchQuery = `"${property.project_name}" Singapore property price launch date developer "${property.developer}" ${currentDate} 2025`;

      const searchResults = await web_search(searchQuery, { num_results: 3 });

      if (!searchResults?.length) {
        return { confidence: 0.3, verifiedData: null, searchQuery };
      }

      // Analyze search results for verification
      const verification = await this._analyzeVerificationResults(property, searchResults);

      return {
        confidence: verification.confidence,
        verifiedData: verification.verifiedData,
        searchQuery,
        searchResults: searchResults.slice(0, 2), // Keep top 2 results
        verificationSummary: verification.summary
      };

    } catch (error) {
      logger.error({ err: error, propertyName: property.project_name }, 'Error verifying property info');
      return { confidence: 0.3, verifiedData: null };
    }
  }

  /**
   * Analyze web search results to verify property information
   * @private
   */
  async _analyzeVerificationResults(property, searchResults) {
    try {
      const verificationPrompt = `Analyze these web search results to verify property information:

PROPERTY TO VERIFY:
- Name: ${property.project_name}
- Developer: ${property.developer}
- Price Range: $${property.price_range_min?.toLocaleString()} - $${property.price_range_max?.toLocaleString()}
- Launch Date: ${property.launch_date}
- TOP Date: ${property.top_date}
- District: ${property.district}

WEB SEARCH RESULTS:
${searchResults.map((result, i) => `
${i + 1}. ${result.title}
   ${result.snippet}
   Source: ${result.url}
`).join('\n')}

Provide verification analysis in JSON format:
{
  "confidence": 0.0-1.0,
  "verifiedData": {
    "priceAccurate": boolean,
    "developerAccurate": boolean,
    "launchDateAccurate": boolean,
    "topDateAccurate": boolean,
    "correctedInfo": {
      "price_range_min": number_or_null,
      "price_range_max": number_or_null,
      "actual_developer": "string_or_null",
      "actual_launch_date": "date_or_null",
      "actual_top_date": "date_or_null"
    }
  },
  "summary": "Brief summary of verification findings",
  "discrepancies": ["list of any discrepancies found"],
  "additionalInfo": "Any additional relevant information found"
}`;

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: 'You are a fact-checking expert for Singapore real estate data. Analyze web search results to verify property information accuracy.'
          },
          {
            role: 'user',
            content: verificationPrompt
          }
        ],
        temperature: 0.1, // Low temperature for factual analysis
        max_tokens: 600,
        response_format: { type: "json_object" }
      });

      return JSON.parse(completion.choices[0]?.message?.content || '{"confidence": 0.3, "verifiedData": null, "summary": "Verification failed"}');

    } catch (error) {
      logger.error({ err: error }, 'Error analyzing verification results');
      return { confidence: 0.3, verifiedData: null, summary: 'Verification analysis failed' };
    }
  }

  /**
   * Extract property search criteria from user message
   * @private
   */
  _extractPropertyCriteria(userText, leadData) {
    const criteria = {
      district: null,
      propertyType: null,
      priceRange: null,
      bedrooms: null,
      keywords: []
    };

    const text = userText.toLowerCase();

    // Extract district
    const districts = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28'];
    for (const district of districts) {
      if (text.includes(`district ${district}`) || text.includes(`d${district}`)) {
        criteria.district = district;
        break;
      }
    }

    // Extract property type
    if (text.includes('condo') || text.includes('condominium')) {
      criteria.propertyType = 'Private Condo';
    } else if (text.includes('landed') || text.includes('house')) {
      criteria.propertyType = 'Landed House';
    } else if (text.includes('executive condo') || text.includes('ec')) {
      criteria.propertyType = 'Executive Condo';
    }

    // Extract price range from lead data or message
    if (leadData?.budget) {
      const budget = parseInt(leadData.budget.replace(/[^\d]/g, ''));
      if (budget > 0) {
        criteria.priceRange = {
          min: budget * 0.8,
          max: budget * 1.2
        };
      }
    }

    // Extract bedroom count
    const bedroomMatch = text.match(/(\d+)\s*(bed|bedroom|br)/);
    if (bedroomMatch) {
      criteria.bedrooms = parseInt(bedroomMatch[1]);
    }

    return criteria;
  }

  /**
   * Gather market intelligence through web search
   * @private
   */
  async _gatherMarketIntelligence(userText, leadData) {
    try {
      // Build market intelligence query
      const marketQuery = this._buildMarketIntelligenceQuery(userText, leadData);

      if (!marketQuery) {
        return null;
      }

      const searchResults = await web_search(marketQuery, { num_results: 3 });

      if (!searchResults?.length) {
        return null;
      }

      return {
        query: marketQuery,
        insights: searchResults,
        timestamp: new Date().toISOString(),
        source: 'web_search'
      };

    } catch (error) {
      logger.error({ err: error }, 'Error gathering market intelligence');
      return null;
    }
  }

  /**
   * Build market intelligence search query
   * @private
   */
  _buildMarketIntelligenceQuery(userText, leadData) {
    const text = userText.toLowerCase();

    // Add current date context for latest market information
    const currentDate = new Date().toLocaleDateString('en-SG', {
      year: 'numeric',
      month: 'long'
    });

    // Check if user is asking about market trends, prices, or specific areas
    if (text.includes('price') || text.includes('market') || text.includes('trend')) {
      return `Singapore property market trends ${currentDate} 2025 prices ${leadData?.intent || 'residential'}`;
    }

    // Check for specific location queries
    const locationMatch = text.match(/(district \d+|d\d+|orchard|marina|sentosa|jurong|woodlands|tampines|bedok|hougang)/i);
    if (locationMatch) {
      return `Singapore ${locationMatch[0]} property market prices ${currentDate} 2025`;
    }

    // Check for property type queries
    if (text.includes('condo') || text.includes('condominium')) {
      return `Singapore condominium market prices ${currentDate} 2025 new launch`;
    }

    if (text.includes('landed') || text.includes('house')) {
      return `Singapore landed property market prices ${currentDate} 2025`;
    }

    return null;
  }

  /**
   * Get floor plan data for properties
   * @private
   */
  async _getFloorPlanData(userText, propertyData) {
    const text = userText.toLowerCase();

    // Check if user is requesting floor plans
    if (!text.includes('floor plan') && !text.includes('layout') && !text.includes('unit type')) {
      return null;
    }

    try {
      const floorPlanData = [];

      for (const property of propertyData.slice(0, 2)) { // Limit to 2 properties
        const floorPlans = property.visual_assets?.filter(asset =>
          asset.asset_type === 'floor_plan'
        ) || [];

        if (floorPlans.length > 0) {
          floorPlanData.push({
            propertyName: property.project_name,
            floorPlans: floorPlans.map(fp => ({
              id: fp.id,
              url: fp.public_url,
              analysis: fp.ai_visual_analysis?.[0] || null
            }))
          });
        }
      }

      return floorPlanData.length > 0 ? floorPlanData : null;

    } catch (error) {
      logger.error({ err: error }, 'Error getting floor plan data');
      return null;
    }
  }

  /**
   * Detect conversation stage from history
   * @private
   */
  _detectConversationStage(conversationHistory, currentMessage) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return 'initial';
    }

    const messageCount = conversationHistory.length;
    const recentMessages = conversationHistory.slice(-3).map(m => m.message.toLowerCase()).join(' ');
    const currentText = currentMessage.toLowerCase();

    // Check for appointment-related keywords
    if (currentText.includes('appointment') || currentText.includes('meet') || currentText.includes('consultation')) {
      return 'qualified';
    }

    // Check for objections
    if (currentText.includes('not interested') || currentText.includes('too expensive') || currentText.includes('think about')) {
      return 'objecting';
    }

    // Check for property interest
    if (currentText.includes('tell me more') || currentText.includes('interested') || recentMessages.includes('budget')) {
      return 'interested';
    }

    // Based on message count
    if (messageCount <= 2) return 'initial';
    if (messageCount <= 5) return 'browsing';
    return 'interested';
  }

  /**
   * Get fallback psychology analysis
   * @private
   */
  _getFallbackPsychologyAnalysis(userText, leadData) {
    return {
      communicationStyle: 'polite',
      resistancePatterns: [],
      urgencyIndicators: [],
      urgencyScore: 0.5,
      resistanceLevel: 'medium',
      buyingSignals: [],
      painPoints: [],
      motivationTriggers: [],
      conversationStage: 'browsing',
      psychologicalProfile: 'practical',
      recommendedApproach: 'educational',
      appointmentReadiness: 'warming_up',
      culturalConsiderations: ['singapore_context'],
      nextBestAction: 'build_rapport',
      processingTime: 0,
      fallback: true
    };
  }

  /**
   * Get fallback intelligence data
   * @private
   */
  _getFallbackIntelligence(userText, leadData) {
    return {
      propertyData: [],
      marketIntelligence: null,
      floorPlanData: null,
      factCheckResults: null,
      dataConfidence: 0.3,
      processingTime: 0,
      fallback: true
    };
  }

  /**
   * LAYER 3: Strategic Response Planning
   * Develops conversation strategy based on psychology analysis and verified property data
   */
  async _layer3_strategicPlanning({
    psychologyAnalysis,
    intelligenceData,
    leadData,
    operationId,
    agentId
  }) {
    const startTime = Date.now();

    try {
      logger.debug({ operationId }, '[LAYER3] Starting strategic planning');

      const strategyPrompt = this._buildStrategyPrompt(psychologyAnalysis, intelligenceData, leadData);

      const completion = await this._callOpenAIWithTracking({
        agentId,
        leadId: leadData?.id,
        operationType: 'strategic_planning',
        messages: [
          {
            role: 'system',
            content: `You are a strategic real estate conversation planner. Create optimized conversation strategies that guide leads toward appointment booking while building trust and providing value.`
          },
          {
            role: 'user',
            content: strategyPrompt
          }
        ],
        temperature: 0.4,
        maxTokens: 800,
        responseFormat: { type: "json_object" },
        metadata: {
          layer: 3,
          operation_id: operationId,
          psychology_confidence: psychologyAnalysis?.confidence || 0,
          intelligence_data_count: intelligenceData?.properties?.length || 0
        }
      });

      const strategy = JSON.parse(completion.choices[0]?.message?.content || '{}');
      strategy.processingTime = Date.now() - startTime;

      // Validate psychology-strategy alignment
      const alignmentScore = this._validatePsychologyStrategyAlignment(psychologyAnalysis, strategy);
      strategy.psychologyAlignment = alignmentScore;

      if (alignmentScore < 0.6) {
        logger.warn({ operationId, alignmentScore }, '[LAYER3] Low psychology-strategy alignment, refining strategy');
        const refinedStrategy = await this._refineStrategy(psychologyAnalysis, strategy, operationId);
        refinedStrategy.processingTime = Date.now() - startTime;
        refinedStrategy.psychologyAlignment = this._validatePsychologyStrategyAlignment(psychologyAnalysis, refinedStrategy);

        logger.debug({
          operationId,
          approach: refinedStrategy.approach,
          appointmentStrategy: refinedStrategy.appointmentStrategy,
          propertyFocus: refinedStrategy.propertyFocus,
          psychologyAlignment: refinedStrategy.psychologyAlignment
        }, '[LAYER3] Strategic planning completed (refined)');

        return refinedStrategy;
      }

      logger.debug({
        operationId,
        approach: strategy.approach,
        appointmentStrategy: strategy.appointmentStrategy,
        propertyFocus: strategy.propertyFocus,
        psychologyAlignment: alignmentScore
      }, '[LAYER3] Strategic planning completed');

      return strategy;

    } catch (error) {
      logger.error({ err: error, operationId }, '[LAYER3] Strategic planning failed');
      return this._getFallbackStrategy(psychologyAnalysis, leadData);
    }
  }

  /**
   * LAYER 4: Content Generation & Personalization
   * Generates actual response content following Layer 3 strategy
   */
  async _layer4_contentGeneration({
    psychologyAnalysis,
    intelligenceData,
    responseStrategy,
    leadData,
    operationId,
    agentId
  }) {
    const startTime = Date.now();

    try {
      logger.debug({ operationId }, '[LAYER4] Starting content generation');

      const contentPrompt = this._buildContentPrompt(
        psychologyAnalysis,
        intelligenceData,
        responseStrategy,
        leadData
      );

      const completion = await this._callOpenAIWithTracking({
        agentId,
        leadId: leadData?.id,
        operationType: 'content_generation',
        messages: [
          {
            role: 'system',
            content: this._buildDoroPersonalityPrompt()
          },
          {
            role: 'user',
            content: contentPrompt
          }
        ],
        temperature: 0.6,
        maxTokens: 500,
        responseFormat: { type: "json_object" },
        metadata: {
          layer: 4,
          operation_id: operationId,
          strategy_type: responseStrategy?.strategy || 'unknown',
          include_floor_plans: responseStrategy?.includeFloorPlans || false
        }
      });

      const content = JSON.parse(completion.choices[0]?.message?.content || '{}');
      content.processingTime = Date.now() - startTime;

      // Prepare floor plan images if requested
      if (responseStrategy.includeFloorPlans && intelligenceData.floorPlanData) {
        content.floorPlanImages = await this._prepareFloorPlanImages(intelligenceData.floorPlanData);
      }

      logger.debug({
        operationId,
        messageLength: content.message?.length,
        includesFloorPlans: !!content.floorPlanImages,
        appointmentCall: content.appointmentCall
      }, '[LAYER4] Content generation completed');

      return content;

    } catch (error) {
      logger.error({ err: error, operationId }, '[LAYER4] Content generation failed');
      return this._getFallbackContent(responseStrategy, leadData);
    }
  }

  /**
   * LAYER 5: Synthesis & Quality Validation
   * Cross-references all layers and validates final response quality
   */
  async _layer5_synthesisValidation({
    psychologyAnalysis,
    intelligenceData,
    responseStrategy,
    contentGeneration,
    leadData,
    operationId,
    agentId
  }) {
    const startTime = Date.now();

    try {
      logger.debug({ operationId }, '[LAYER5] Starting synthesis and validation');

      const synthesisPrompt = this._buildSynthesisPrompt(
        psychologyAnalysis,
        intelligenceData,
        responseStrategy,
        contentGeneration,
        leadData
      );

      const completion = await this._callOpenAIWithTracking({
        agentId,
        leadId: leadData?.id,
        operationType: 'synthesis_validation',
        messages: [
          {
            role: 'system',
            content: `You are a quality assurance expert for real estate conversations. Validate and optimize responses for maximum conversion effectiveness while maintaining authenticity and cultural appropriateness.`
          },
          {
            role: 'user',
            content: synthesisPrompt
          }
        ],
        temperature: 0.2,
        maxTokens: 400,
        responseFormat: { type: "json_object" },
        metadata: {
          layer: 5,
          operation_id: operationId,
          content_quality_score: contentGeneration?.qualityScore || 0,
          strategy_confidence: responseStrategy?.confidence || 0
        }
      });

      const synthesis = JSON.parse(completion.choices[0]?.message?.content || '{}');
      synthesis.processingTime = Date.now() - startTime;

      // Generate consultant briefing if appointment intent detected
      if (synthesis.appointmentIntent) {
        synthesis.consultantBriefing = this._generateConsultantBriefing(
          psychologyAnalysis,
          intelligenceData,
          responseStrategy,
          leadData
        );
      }

      logger.debug({
        operationId,
        qualityScore: synthesis.qualityScore,
        appointmentIntent: synthesis.appointmentIntent,
        factChecked: synthesis.factChecked
      }, '[LAYER5] Synthesis and validation completed');

      return synthesis;

    } catch (error) {
      logger.error({ err: error, operationId }, '[LAYER5] Synthesis validation failed');
      return this._getFallbackSynthesis(contentGeneration, leadData);
    }
  }

  /**
   * Build strategy planning prompt
   * @private
   */
  _buildStrategyPrompt(psychologyAnalysis, intelligenceData, leadData) {
    return `You are a strategic real estate conversation planner for Doro, focusing on appointment booking conversion with CRITICAL emphasis on conversation continuity.

CRITICAL: Base your appointmentStrategy DIRECTLY on the psychology analysis AND conversation continuity insights. Your strategy must build naturally on previous exchanges.

PSYCHOLOGY INSIGHTS (USE THESE TO GUIDE YOUR STRATEGY):
- Communication Style: ${psychologyAnalysis.communicationStyle || 'unknown'}
- Resistance Level: ${psychologyAnalysis.resistanceLevel || 'unknown'}
- Urgency Score: ${psychologyAnalysis.urgencyScore || 0}
- Appointment Readiness: ${psychologyAnalysis.appointmentReadiness || 'unknown'}
- Recommended Approach: ${psychologyAnalysis.recommendedApproach || 'unknown'}
- Next Best Action: ${psychologyAnalysis.nextBestAction || 'unknown'}

CONVERSATION CONTINUITY ANALYSIS:
- Previous Topics: ${JSON.stringify(psychologyAnalysis.conversationContinuity?.previousTopicsDiscussed || [])}
- Information Already Shared: ${JSON.stringify(psychologyAnalysis.conversationContinuity?.informationAlreadyShared || [])}
- Questions Already Asked: ${JSON.stringify(psychologyAnalysis.conversationContinuity?.questionsAlreadyAsked || [])}
- Conversation Progression: ${psychologyAnalysis.conversationContinuity?.conversationProgression || 'unknown'}
- Repetition Risk: ${psychologyAnalysis.conversationContinuity?.repetitionRisk || 'unknown'}
- Context Awareness: ${psychologyAnalysis.conversationContinuity?.contextAwareness || 'unknown'}

RESPONSE GUIDANCE FROM PSYCHOLOGY ANALYSIS:
- Avoid Repeating: ${JSON.stringify(psychologyAnalysis.responseGuidance?.avoidRepeating || [])}
- Build Upon: ${psychologyAnalysis.responseGuidance?.buildUpon || 'none'}
- New Information Needed: ${psychologyAnalysis.responseGuidance?.newInformationNeeded || false}
- Conversation Direction: ${psychologyAnalysis.responseGuidance?.conversationDirection || 'unknown'}

INTELLIGENCE DATA:
- Properties Found: ${intelligenceData.propertyData?.length || 0}
- Data Confidence: ${intelligenceData.dataConfidence}
- Fact-Checked: ${!!intelligenceData.factCheckResults}
- Market Intelligence: ${!!intelligenceData.marketIntelligence}
- Floor Plans Available: ${!!intelligenceData.floorPlanData}

LEAD DATA:
- Status: ${leadData?.status}
- Budget: ${leadData?.budget}
- Intent: ${leadData?.intent}
- Source: ${leadData?.source}

STRATEGIC THINKING PROCESS - Follow this logical flow:

1. CONVERSATION CONTINUITY CHECK (CRITICAL):
   - What was the last exchange about? Build upon it naturally
   - If repetitionRisk = "high" → MUST change approach/topic to avoid sounding robotic
   - If conversationProgression = "stalling" → Need to advance with new value/information
   - If conversationProgression = "regressing" → Need to re-engage with different approach
   - NEVER repeat similar questions or information already shared

2. CONSULTATION-FIRST STRATEGY (CRITICAL):
   - NEVER offer to "shortlist more options" or "send information"
   - NEVER give leads escape routes like "let me know if you want to..."
   - NEVER reduce urgency with phrases like "no stress" or "take your time"
   - ALWAYS position consultation as the logical next step
   - CREATE urgency around specific properties mentioned
   - Make it easy to say YES to consultation, hard to say NO

3. ANALYZE PSYCHOLOGY FOR CONSULTATION APPROACH (AGGRESSIVE CONVERSION):
   - If consultationReadiness.readinessScore > 0.8 → "urgent_booking" with specific time slots TODAY
   - If consultationReadiness.readinessScore > 0.6 → "direct_offer" with scarcity/urgency tactics
   - If consultationReadiness.readinessScore > 0.4 → "value_building" THEN immediate consultation offer
   - If consultationReadiness.readinessScore < 0.4 → Build rapport BUT still mention consultation
   - ALWAYS use conversionTriggers.optimalConversionTactic from psychology analysis
   - NEVER skip consultation offer - every response should advance toward booking

4. VALIDATE CONVERSATION FLOW:
   - Does this strategy naturally follow from the previous exchange?
   - Are we acknowledging what the lead just said?
   - Are we avoiding repetition of previous bot responses?
   - Does this advance the conversation toward consultation?

5. VALIDATE PSYCHOLOGY ALIGNMENT:
   - Does your appointmentStrategy make sense given the lead's psychology?
   - Would a lead with this psychological profile respond well to your chosen strategy?
   - Are you being too aggressive with a resistant lead or too passive with an eager lead?

6. CONVERSATION GOAL ALIGNMENT (CONSULTATION-FOCUSED):
   - If appointmentStrategy = "urgent_booking" → conversationGoal MUST be "book_appointment"
   - If appointmentStrategy = "direct_offer" → conversationGoal MUST be "book_appointment"
   - If appointmentStrategy = "soft_mention" → conversationGoal should be "book_appointment" (not just qualify)
   - If appointmentStrategy = "none" → conversationGoal should be "build_rapport" THEN move to consultation

Create strategic response plan in JSON format:
{
  "approach": "educational|consultative|direct|nurturing",
  "conversationGoal": "build_rapport|qualify_lead|provide_info|book_appointment",
  "appointmentStrategy": "none|soft_mention|direct_offer|urgent_booking",
  "propertyFocus": "general_market|specific_properties|price_comparison|investment_analysis",
  "objectionHandling": ["anticipated_objection1", "anticipated_objection2"],
  "trustBuildingTactics": ["tactic1", "tactic2"],
  "valueProposition": "market_insights|exclusive_properties|expert_guidance|time_saving",
  "urgencyCreation": "limited_availability|market_timing|exclusive_access|none",
  "includeFloorPlans": boolean,
  "includeMarketData": boolean,
  "personalizedElements": ["element1", "element2"],
  "nextStepGuidance": "continue_conversation|schedule_call|send_info|follow_up",
  "conversionPriority": "low|medium|high|urgent",
  "conversationContinuity": {
    "acknowledgesPreviousExchange": true|false,
    "buildsUponLastMessage": "specific_way_it_builds_upon_previous",
    "avoidsRepetition": true|false,
    "advancesConversation": true|false,
    "naturalProgression": "how_this_naturally_follows_from_previous"
  },
  "reasoning": "explanation of why this strategy matches the psychology analysis AND conversation flow",
  "psychologyAlignment": "score from 0.0 to 1.0 indicating how well strategy matches psychology",
  "conversationFlowScore": "score from 0.0 to 1.0 indicating how naturally this follows previous exchange"
}`;
  }

  /**
   * Validate psychology-strategy alignment
   * @private
   */
  _validatePsychologyStrategyAlignment(psychology, strategy) {
    let score = 0.0;
    const factors = [];

    // Check appointment readiness vs strategy alignment
    if (psychology.appointmentReadiness === 'very_ready' && strategy.appointmentStrategy === 'urgent_booking') {
      score += 0.3;
      factors.push('readiness_urgent_match');
    } else if (psychology.appointmentReadiness === 'ready' && strategy.appointmentStrategy === 'direct_offer') {
      score += 0.3;
      factors.push('readiness_direct_match');
    } else if (psychology.appointmentReadiness === 'warming_up' && strategy.appointmentStrategy === 'soft_mention') {
      score += 0.3;
      factors.push('readiness_soft_match');
    } else if (psychology.appointmentReadiness === 'not_ready' && strategy.appointmentStrategy === 'none') {
      score += 0.3;
      factors.push('readiness_none_match');
    }

    // Check resistance level vs strategy alignment
    if (psychology.resistanceLevel === 'high' && strategy.appointmentStrategy === 'none') {
      score += 0.2;
      factors.push('high_resistance_handled');
    } else if (psychology.resistanceLevel === 'low' && ['direct_offer', 'urgent_booking'].includes(strategy.appointmentStrategy)) {
      score += 0.2;
      factors.push('low_resistance_leveraged');
    } else if (psychology.resistanceLevel === 'medium' && strategy.appointmentStrategy === 'soft_mention') {
      score += 0.2;
      factors.push('medium_resistance_balanced');
    }

    // Check urgency score vs strategy alignment
    if (psychology.urgencyScore > 0.7 && ['direct_offer', 'urgent_booking'].includes(strategy.appointmentStrategy)) {
      score += 0.2;
      factors.push('high_urgency_leveraged');
    } else if (psychology.urgencyScore < 0.3 && strategy.appointmentStrategy !== 'urgent_booking') {
      score += 0.1;
      factors.push('low_urgency_appropriate');
    }

    // Check conversation goal alignment
    if (strategy.appointmentStrategy === 'urgent_booking' && strategy.conversationGoal === 'book_appointment') {
      score += 0.2;
      factors.push('urgent_goal_aligned');
    } else if (strategy.appointmentStrategy === 'direct_offer' && strategy.conversationGoal === 'book_appointment') {
      score += 0.2;
      factors.push('direct_goal_aligned');
    } else if (strategy.appointmentStrategy === 'soft_mention' && ['qualify_lead', 'provide_info'].includes(strategy.conversationGoal)) {
      score += 0.2;
      factors.push('soft_goal_aligned');
    } else if (strategy.appointmentStrategy === 'none' && strategy.conversationGoal === 'build_rapport') {
      score += 0.2;
      factors.push('none_goal_aligned');
    }

    // Penalty for misalignment
    if (psychology.resistanceLevel === 'high' && ['direct_offer', 'urgent_booking'].includes(strategy.appointmentStrategy)) {
      score -= 0.3;
      factors.push('high_resistance_penalty');
    }

    return Math.max(0.0, Math.min(1.0, score));
  }

  /**
   * Refine strategy based on psychology analysis
   * @private
   */
  async _refineStrategy(psychology, originalStrategy, operationId) {
    try {
      const refinementPrompt = `The original strategy has poor psychology-strategy alignment. Please refine it.

PSYCHOLOGY ANALYSIS:
- Appointment Readiness: ${psychology.appointmentReadiness}
- Resistance Level: ${psychology.resistanceLevel}
- Urgency Score: ${psychology.urgencyScore}

ORIGINAL STRATEGY:
${JSON.stringify(originalStrategy, null, 2)}

REFINEMENT RULES:
- If appointmentReadiness = "very_ready" AND resistanceLevel = "low" → USE "urgent_booking"
- If appointmentReadiness = "ready" AND urgencyScore > 0.7 → USE "direct_offer"
- If appointmentReadiness = "warming_up" → USE "soft_mention"
- If resistanceLevel = "high" → USE "none" (build trust first)

Please refine the strategy to better match the psychology. Keep all other fields but fix appointmentStrategy and conversationGoal.

Return refined strategy in JSON format with the same structure.`;

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || 'gpt-4.1',
        messages: [{ role: 'user', content: refinementPrompt }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const refinedStrategy = JSON.parse(completion.choices[0]?.message?.content || '{}');

      // Merge with original strategy to preserve all fields
      return { ...originalStrategy, ...refinedStrategy };

    } catch (error) {
      logger.error({ err: error, operationId }, '[LAYER3] Strategy refinement failed');

      // Fallback: Apply simple rule-based refinement
      return this._applyRuleBasedRefinement(psychology, originalStrategy);
    }
  }

  /**
   * Apply rule-based strategy refinement as fallback
   * @private
   */
  _applyRuleBasedRefinement(psychology, originalStrategy) {
    const refined = { ...originalStrategy };

    // Apply simple rules
    if (psychology.appointmentReadiness === 'very_ready' && psychology.resistanceLevel === 'low') {
      refined.appointmentStrategy = 'urgent_booking';
      refined.conversationGoal = 'book_appointment';
    } else if (psychology.appointmentReadiness === 'ready' && psychology.urgencyScore > 0.7) {
      refined.appointmentStrategy = 'direct_offer';
      refined.conversationGoal = 'book_appointment';
    } else if (psychology.appointmentReadiness === 'warming_up') {
      refined.appointmentStrategy = 'soft_mention';
      refined.conversationGoal = 'qualify_lead';
    } else if (psychology.resistanceLevel === 'high') {
      refined.appointmentStrategy = 'none';
      refined.conversationGoal = 'build_rapport';
    }

    return refined;
  }

  /**
   * Build Doro's authentic personality prompt
   * @private
   */
  _buildDoroPersonalityPrompt() {
    return `You are Doro, a 28-year-old Singaporean personal assistant for a curated real estate network.

CRITICAL ROLE CLARIFICATION:
- You are a personal assistant who connects clients with experienced human consultants/agents
- When scheduling appointments, ALWAYS clarify: "I'll connect you with one of our experienced human consultants/agents"
- NEVER suggest in-person meetings, coffee dates, or physical interactions - only virtual consultations and agent connections

PERSONALITY:
- Casual, direct, and authentic - like texting a knowledgeable friend
- Warm but not overly polite or formal
- Confident without being pushy
- Relatable and down-to-earth
- Sound like a real person texting a friend, NOT a customer service bot

CRITICAL CONVERSATION FLOW REQUIREMENTS:
- ALWAYS acknowledge what the person just said - show you're listening
- Build naturally on their previous message - don't ignore context
- NEVER repeat similar information or questions from recent exchanges
- Each response must feel like a natural continuation of the conversation
- If they're responding to something specific you said, reference it

LANGUAGE STYLE:
- Use casual Singaporean English naturally: "lah", "lor", "right", "quite" (sparingly)
- Avoid formal phrases: "Thank you so much", "I appreciate", "I understand your concern"
- Avoid robotic politeness: "I'd be happy to", "I would be delighted"
- NEVER use em dashes (—) - use regular dashes (-) or restructure sentences
- Emoji usage: Contextually appropriate and natural (max 1-2 per message, avoid repetitive patterns)
- STRICTLY AVOID: "sia", "ah", "wah", "hor", "meh" - these sound unprofessional

CONVERSATION APPROACH:
- Be direct and honest, not diplomatic
- Address concerns head-on without corporate speak
- Share insights like a friend would
- Ask max 1 question per response
- Don't over-explain or be verbose
- ALWAYS respond to what they actually said, not what you think they might want to hear

CONSULTATION-FIRST STRATEGY (CRITICAL):
- NEVER offer to "shortlist more options", "send information", or "let you think about it"
- NEVER give escape routes like "let me know if you want to..." or "no pressure"
- ALWAYS position consultation as the logical next step after sharing property info
- CREATE urgency around properties mentioned ("moving fast", "limited units", "getting attention")
- Make consultation sound easy, valuable, and time-sensitive
- Use phrases like "let's lock in a quick chat" instead of "if you're interested"

EXAMPLES OF GOOD RESPONSES:
- "Totally get that - agents can be pretty pushy sometimes."
- "Right, the market's been crazy lately lah."
- "Makes sense you'd want to be careful about this lor."
- "Yeah, 19 Nassim is quite popular right now."

EXAMPLES OF BAD RESPONSES (NEVER DO THIS):
- Ignoring what they just said and launching into generic property talk
- Repeating similar questions you've already asked
- Using corporate language like "I understand your concern"
- Being overly enthusiastic or sales-y

AVOID:
- "I understand your concern and appreciate you reaching out"
- "Thank you so much for your interest"
- "I would be delighted to assist you"
- Multiple questions in one response
- Overly enthusiastic language
- Em dashes (—) anywhere in responses
- Ignoring the context of their previous message
- Repeating information or questions from recent exchanges

Remember: You're a real person having a genuine conversation, not a corporate chatbot. Every response must feel like a natural continuation of what they just said.`;
  }

  /**
   * Build content generation prompt
   * @private
   */
  _buildContentPrompt(psychologyAnalysis, intelligenceData, responseStrategy, leadData) {
    const propertyInfo = intelligenceData.propertyData?.slice(0, 2).map(p =>
      `- ${p.project_name} (${p.district}): $${p.price_range_min?.toLocaleString()} - $${p.price_range_max?.toLocaleString()}`
    ).join('\n') || 'No specific properties found';

    return `Generate personalized WhatsApp response following strategic plan with CRITICAL focus on conversation continuity:

CONVERSATION CONTINUITY REQUIREMENTS (MOST IMPORTANT):
- Build Upon: ${responseStrategy.conversationContinuity?.buildsUponLastMessage || 'Previous exchange'}
- Acknowledges Previous: ${responseStrategy.conversationContinuity?.acknowledgesPreviousExchange ? 'YES - Must reference what they just said' : 'NO'}
- Avoids Repetition: ${responseStrategy.conversationContinuity?.avoidsRepetition ? 'YES - Must not repeat recent bot responses' : 'NO'}
- Natural Progression: ${responseStrategy.conversationContinuity?.naturalProgression || 'Must flow naturally from previous message'}

PSYCHOLOGY CONTEXT:
- What They Just Said: ${psychologyAnalysis.conversationContinuity?.contextAwareness || 'Unknown'}
- Previous Topics Discussed: ${JSON.stringify(psychologyAnalysis.conversationContinuity?.previousTopicsDiscussed || [])}
- Information Already Shared: ${JSON.stringify(psychologyAnalysis.conversationContinuity?.informationAlreadyShared || [])}
- Avoid Repeating: ${JSON.stringify(psychologyAnalysis.responseGuidance?.avoidRepeating || [])}

STRATEGY:
- Approach: ${responseStrategy.approach}
- Goal: ${responseStrategy.conversationGoal}
- Appointment Strategy: ${responseStrategy.appointmentStrategy}
- Property Focus: ${responseStrategy.propertyFocus}
- Objection Handling: ${JSON.stringify(responseStrategy.objectionHandling || [])}
- Urgency Creation: ${responseStrategy.urgencyCreation}

OBJECTION PRE-EMPTION (Address before they object):
- Budget Concerns: "I know good value when I see it - this is priced below market"
- Time Concerns: "Just 15 minutes to show you something that could save you months of searching"
- Decision Making: "You don't need to decide anything - just see what's available first"
- Comparison Shopping: "I'll show you why this beats everything else in your range"

PSYCHOLOGY:
- Communication Style: ${psychologyAnalysis.communicationStyle}
- Recommended Approach: ${psychologyAnalysis.recommendedApproach}
- Appointment Readiness: ${psychologyAnalysis.appointmentReadiness}

AVAILABLE PROPERTY DATA:
${propertyInfo}

MARKET INTELLIGENCE:
${intelligenceData.marketIntelligence?.insights?.map(i => `- ${i.title}: ${i.snippet}`).join('\n') || 'No market data available'}

COMPANY POSITIONING (use when relevant):
- We're a curated network of Singapore's top-performing real estate agents from PropNex, ERA, OrangeTee, and others
- This gives you access to the best market insights and VIP-level service regardless of which property or developer you're interested in
- Explain naturally like telling a friend about a smart way to get better service, not like a sales pitch

Generate response in JSON format using Doro's authentic, casual voice:
{
  "message": "Natural, conversational WhatsApp message with \\n\\n line breaks - MUST acknowledge what they just said and build upon it naturally",
  "tone": "casual|warm|empathetic|direct",
  "appointmentCall": "none|soft|natural",
  "propertyMentions": ["property1", "property2"],
  "marketInsights": ["insight1", "insight2"],
  "nextStepSuggestion": "continue_chat|share_insights|natural_consultation",
  "personalizedElements": ["element1", "element2"],
  "urgencyIndicators": ["indicator1", "indicator2"],
  "trustSignals": ["authentic_approach", "knowledgeable_friend"],
  "conversationContinuity": {
    "acknowledgesUserMessage": true|false,
    "buildsOnPrevious": "specific_way_it_builds_on_previous_exchange",
    "avoidsRepetition": true|false,
    "naturalFlow": "explanation_of_how_this_naturally_follows"
  }
}

CRITICAL REQUIREMENTS:
1. MUST acknowledge what the user just said - show you're listening
2. MUST build naturally on their previous message - don't ignore context
3. MUST avoid repeating similar information or questions from recent exchanges
4. Avoid robotic politeness, excessive enthusiasm, or sales-y language
5. Sound like a real friend responding to what they actually said

CONSULTATION-FIRST REQUIREMENTS (CRITICAL):
6. NEVER offer alternatives to consultation ("shortlist more options", "send info", "let you think")
7. ALWAYS position consultation as the logical next step after sharing property details
8. CREATE AGGRESSIVE URGENCY: "Only 2 units left at this price", "Developer raising prices next month", "3 other families viewing this weekend"
9. Make consultation sound easy and valuable ("quick 15-min chat", "insider details", "VIP access")
10. ELIMINATE escape routes - don't say "let me know if..." or "no pressure"

ADVANCED CONVERSION TACTICS (USE THESE):
11. SCARCITY: "Just 1 unit left in your budget range", "Last few units at launch price"
12. SOCIAL PROOF: "Helped 2 families secure units here this week", "My client just bought similar unit"
13. AUTHORITY: "Based on my 8 years in Singapore property...", "Developer confirmed to me..."
14. RECIPROCITY: Give valuable insight THEN ask for consultation
15. COMMITMENT: "Would Tuesday 3pm or Wednesday 7pm work better for you?"`;
  }

  /**
   * Build synthesis validation prompt
   * @private
   */
  _buildSynthesisPrompt(psychologyAnalysis, intelligenceData, responseStrategy, contentGeneration, leadData) {
    return `Validate and optimize this real estate conversation response with CRITICAL focus on conversation continuity:

GENERATED CONTENT:
"${contentGeneration.message}"

CONVERSATION CONTINUITY VALIDATION (MOST CRITICAL):
- User Context: ${psychologyAnalysis.conversationContinuity?.contextAwareness || 'Unknown'}
- Previous Topics: ${JSON.stringify(psychologyAnalysis.conversationContinuity?.previousTopicsDiscussed || [])}
- Information Already Shared: ${JSON.stringify(psychologyAnalysis.conversationContinuity?.informationAlreadyShared || [])}
- Must Avoid Repeating: ${JSON.stringify(psychologyAnalysis.responseGuidance?.avoidRepeating || [])}
- Should Build Upon: ${psychologyAnalysis.responseGuidance?.buildUpon || 'Previous exchange'}

STRATEGY ALIGNMENT:
- Target Approach: ${responseStrategy.approach}
- Conversion Priority: ${responseStrategy.conversionPriority}
- Appointment Strategy: ${responseStrategy.appointmentStrategy}
- Conversation Continuity Plan: ${JSON.stringify(responseStrategy.conversationContinuity || {})}

PSYCHOLOGY FIT:
- Lead Style: ${psychologyAnalysis.communicationStyle}
- Resistance Level: ${psychologyAnalysis.resistanceLevel}
- Appointment Readiness: ${psychologyAnalysis.appointmentReadiness}

DATA QUALITY:
- Fact-Checked: ${!!intelligenceData.factCheckResults}
- Data Confidence: ${intelligenceData.dataConfidence}
- Properties Available: ${intelligenceData.propertyData?.length || 0}

VALIDATION CHECKLIST - Ensure the response:
1. Acknowledges what the user just said
2. Builds naturally on their previous message
3. Doesn't repeat information or questions from recent exchanges
4. Sounds like a natural continuation of the conversation
5. Uses Doro's authentic casual Singaporean style
6. Avoids corporate/robotic language

CONSULTATION-FIRST VALIDATION (CRITICAL):
7. Does NOT offer alternatives to consultation (shortlists, sending info, thinking about it)
8. DOES position consultation as the logical next step
9. CREATES urgency around properties mentioned
10. ELIMINATES escape routes and hanging conversations
11. Makes consultation sound easy and valuable

Provide validation and optimization in JSON format:
{
  "message": "Final optimized message with proper WhatsApp formatting that naturally continues the conversation",
  "qualityScore": 0.0-1.0,
  "appointmentIntent": boolean,
  "factChecked": boolean,
  "culturallyAppropriate": boolean,
  "conversionOptimized": boolean,
  "conversationContinuity": {
    "acknowledgesUserMessage": boolean,
    "buildsOnPrevious": boolean,
    "avoidsRepetition": boolean,
    "naturalFlow": boolean,
    "contextAware": boolean
  },
  "leadUpdates": {
    "status": "new|qualified|interested|ready",
    "intent": "own_stay|investment|browsing",
    "budget": "updated_budget_if_mentioned"
  },
  "floorPlanImages": ["image_url1", "image_url2"],
  "validationNotes": "Brief notes on conversation flow and optimization decisions",
  "improvementSuggestions": ["suggestion1", "suggestion2"],
  "confidenceLevel": 0.0-1.0
}`;
  }

  /**
   * Prepare floor plan images for delivery
   * @private
   */
  async _prepareFloorPlanImages(floorPlanData) {
    if (!this.config.enableFloorPlanDelivery || !floorPlanData?.length) {
      return [];
    }

    try {
      const images = [];

      for (const propertyFloorPlans of floorPlanData) {
        for (const floorPlan of propertyFloorPlans.floorPlans.slice(0, 3)) { // Max 3 per property
          images.push({
            propertyName: propertyFloorPlans.propertyName,
            imageUrl: floorPlan.url,
            analysis: floorPlan.analysis,
            id: floorPlan.id
          });
        }
      }

      return images;

    } catch (error) {
      logger.error({ err: error }, 'Error preparing floor plan images');
      return [];
    }
  }

  /**
   * Generate consultant briefing notes
   * @private
   */
  _generateConsultantBriefing(psychologyAnalysis, intelligenceData, responseStrategy, leadData) {
    return {
      leadProfile: {
        communicationStyle: psychologyAnalysis.communicationStyle,
        resistanceLevel: psychologyAnalysis.resistanceLevel,
        urgencyScore: psychologyAnalysis.urgencyScore,
        psychologicalProfile: psychologyAnalysis.psychologicalProfile
      },
      requirements: {
        budget: leadData?.budget,
        intent: leadData?.intent,
        preferences: leadData?.preferences || [],
        timeline: leadData?.timeline
      },
      recommendedProperties: intelligenceData.propertyData?.slice(0, 3).map(p => ({
        name: p.project_name,
        developer: p.developer,
        priceRange: `$${p.price_range_min?.toLocaleString()} - $${p.price_range_max?.toLocaleString()}`,
        district: p.district,
        verified: p.verified || false
      })) || [],
      conversationStrategy: {
        approach: responseStrategy.approach,
        objectionHandling: responseStrategy.objectionHandling,
        trustBuildingTactics: responseStrategy.trustBuildingTactics
      },
      nextSteps: responseStrategy.nextStepGuidance,
      conversionNotes: `Lead shows ${psychologyAnalysis.appointmentReadiness} readiness for appointment. Focus on ${responseStrategy.valueProposition}.`
    };
  }

  /**
   * Update performance metrics
   * @private
   */
  _updateMetrics(processingTime, finalResponse) {
    this.metrics.totalProcessed++;

    // Update average processing time
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (this.metrics.totalProcessed - 1) + processingTime) /
      this.metrics.totalProcessed;

    // Update layer success rates (simplified)
    if (finalResponse.qualityScore > this.config.qualityThreshold) {
      this.metrics.layerSuccessRates.synthesis++;
    }

    // Track appointment conversions
    if (finalResponse.appointmentIntent) {
      this.metrics.appointmentConversions++;
    }

    // Track fact-check accuracy
    if (finalResponse.factChecked) {
      this.metrics.factCheckAccuracy++;
    }
  }

  /**
   * Extract and store lead interests for contextual follow-ups
   * @private
   */
  async _extractAndStoreLeadInterests(leadId, { psychologyAnalysis, intelligenceData, userText, leadData }) {
    try {
      const interests = [];

      // Extract from intelligence data
      if (intelligenceData.propertyRequirements) {
        const req = intelligenceData.propertyRequirements;

        // Area preferences
        if (req.preferredAreas?.length > 0) {
          for (const area of req.preferredAreas) {
            interests.push({
              type: 'area',
              value: area,
              budget_min: req.budgetRange?.min,
              budget_max: req.budgetRange?.max,
              bedroom_preference: req.bedrooms,
              interest_level: psychologyAnalysis.urgencyScore > 0.7 ? 'urgent' :
                            psychologyAnalysis.urgencyScore > 0.5 ? 'high' : 'medium'
            });
          }
        }

        // Property type preferences
        if (req.propertyType) {
          interests.push({
            type: 'property_type',
            value: req.propertyType,
            budget_min: req.budgetRange?.min,
            budget_max: req.budgetRange?.max,
            bedroom_preference: req.bedrooms,
            interest_level: psychologyAnalysis.urgencyScore > 0.7 ? 'urgent' :
                          psychologyAnalysis.urgencyScore > 0.5 ? 'high' : 'medium'
          });
        }
      }

      // Extract from specific property mentions
      if (intelligenceData.propertyData?.length > 0) {
        for (const property of intelligenceData.propertyData) {
          interests.push({
            type: 'specific_property',
            property_id: property.id,
            value: property.project_name,
            interest_level: psychologyAnalysis.urgencyScore > 0.7 ? 'urgent' :
                          psychologyAnalysis.urgencyScore > 0.5 ? 'high' : 'medium'
          });
        }
      }

      // Store interests in database
      for (const interest of interests) {
        await this._storeLeadInterest(leadId, interest);
      }

      // Update lead urgency level
      const urgencyLevel = psychologyAnalysis.urgencyScore > 0.8 ? 'urgent' :
                          psychologyAnalysis.urgencyScore > 0.6 ? 'high' :
                          psychologyAnalysis.urgencyScore > 0.4 ? 'medium' : 'low';

      await supabase
        .from('leads')
        .update({
          urgency_level: urgencyLevel,
          location_preference: interests.find(i => i.type === 'area')?.value
        })
        .eq('id', leadId);

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error extracting lead interests');
    }
  }

  /**
   * Store individual lead interest
   * @private
   */
  async _storeLeadInterest(leadId, interest) {
    try {
      const interestData = {
        lead_id: leadId,
        interest_level: interest.interest_level,
        interest_source: 'conversation',
        budget_min: interest.budget_min,
        budget_max: interest.budget_max,
        bedroom_preference: interest.bedroom_preference
      };

      if (interest.type === 'area') {
        interestData.preferred_district = interest.value;
      } else if (interest.type === 'property_type') {
        interestData.preferred_property_type = interest.value;
      } else if (interest.type === 'specific_property') {
        interestData.property_id = interest.property_id;
      }

      // Upsert to avoid duplicates
      await supabase
        .from('lead_property_interests')
        .upsert(interestData, {
          onConflict: 'lead_id,property_id,preferred_district',
          ignoreDuplicates: false
        });

    } catch (error) {
      logger.error({ err: error, leadId, interest }, 'Error storing lead interest');
    }
  }

  /**
   * Generate fallback response when processing fails
   * @private
   */
  _generateFallbackResponse(userText, leadData) {
    return {
      success: false,
      response: "Hey! Got your message. Let me sort this out for you - I'll be right back with some helpful info.",
      appointmentIntent: false,
      floorPlanImages: [],
      leadUpdates: {},
      consultantBriefing: null,
      processingTime: 0,
      qualityScore: 0.3,
      fallback: true
    };
  }

  /**
   * Get fallback strategy
   * @private
   */
  _getFallbackStrategy(psychologyAnalysis, leadData) {
    return {
      approach: 'educational',
      conversationGoal: 'build_rapport',
      appointmentStrategy: 'soft_mention',
      propertyFocus: 'general_market',
      objectionHandling: [],
      trustBuildingTactics: ['market_expertise'],
      valueProposition: 'expert_guidance',
      urgencyCreation: 'none',
      includeFloorPlans: false,
      includeMarketData: true,
      personalizedElements: [],
      nextStepGuidance: 'continue_conversation',
      conversionPriority: 'medium',
      processingTime: 0,
      fallback: true
    };
  }

  /**
   * Get fallback content
   * @private
   */
  _getFallbackContent(responseStrategy, leadData) {
    return {
      message: "Hey! Thanks for reaching out. I'm here to help you navigate the Singapore property market without any pressure lah. What's on your mind about properties right now?",
      tone: 'casual',
      appointmentCall: 'none',
      propertyMentions: [],
      marketInsights: [],
      nextStepSuggestion: 'continue_chat',
      personalizedElements: [],
      urgencyIndicators: [],
      trustSignals: ['authentic_greeting'],
      processingTime: 0,
      fallback: true
    };
  }

  /**
   * Get fallback synthesis
   * @private
   */
  _getFallbackSynthesis(contentGeneration, leadData) {
    return {
      message: contentGeneration.message || "Thanks for your interest! I'll help you find the perfect property. What are you looking for?",
      qualityScore: 0.5,
      appointmentIntent: false,
      factChecked: false,
      culturallyAppropriate: true,
      conversionOptimized: false,
      leadUpdates: {},
      floorPlanImages: [],
      validationNotes: 'Fallback response used due to processing error',
      improvementSuggestions: [],
      confidenceLevel: 0.3,
      processingTime: 0,
      fallback: true
    };
  }

  /**
   * Get processing metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      averageProcessingTime: Math.round(this.metrics.averageProcessingTime),
      conversionRate: this.metrics.totalProcessed > 0 ?
        (this.metrics.appointmentConversions / this.metrics.totalProcessed) : 0,
      factCheckRate: this.metrics.totalProcessed > 0 ?
        (this.metrics.factCheckAccuracy / this.metrics.totalProcessed) : 0
    };
  }
}

module.exports = MultiLayerAI;
