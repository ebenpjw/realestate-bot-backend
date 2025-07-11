const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');
const { web_search } = require('./webSearchService');
const multiLayerMonitoring = require('./multiLayerMonitoring');

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
      timeout: config.OPENAI_TIMEOUT || 30000,
      maxRetries: 2
    });
    
    // Processing configuration
    this.config = {
      maxProcessingTime: 30000, // 30 seconds target
      enableFactChecking: true,
      enableFloorPlanDelivery: true,
      enableAppointmentBooking: true,
      qualityThreshold: 0.8
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
   * Main processing entry point - replaces current message processing
   * Processes message through all 5 AI layers sequentially
   */
  async processMessage({
    leadId,
    senderWaId,
    userText,
    senderName,
    conversationHistory,
    leadData
  }) {
    const operationId = `multilayer-${leadId}-${Date.now()}`;
    const startTime = Date.now();
    
    try {
      logger.info({
        operationId,
        leadId,
        messageLength: userText?.length,
        historyLength: conversationHistory?.length
      }, '[MULTILAYER] Starting 5-layer AI processing');

      // LAYER 1: Lead Psychology & Context Analysis
      const psychologyAnalysis = await this._layer1_psychologyAnalysis({
        leadId,
        userText,
        conversationHistory,
        leadData,
        operationId
      });

      // LAYER 2: Intelligence Gathering & Data Retrieval with Fact-Checking
      const intelligenceData = await this._layer2_intelligenceGathering({
        psychologyAnalysis,
        userText,
        leadData,
        operationId
      });

      // LAYER 3: Strategic Response Planning
      const responseStrategy = await this._layer3_strategicPlanning({
        psychologyAnalysis,
        intelligenceData,
        leadData,
        operationId
      });

      // LAYER 4: Content Generation & Personalization
      const contentGeneration = await this._layer4_contentGeneration({
        psychologyAnalysis,
        intelligenceData,
        responseStrategy,
        leadData,
        operationId
      });

      // LAYER 5: Synthesis & Quality Validation
      const finalResponse = await this._layer5_synthesisValidation({
        psychologyAnalysis,
        intelligenceData,
        responseStrategy,
        contentGeneration,
        leadData,
        operationId
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
    operationId
  }) {
    const startTime = Date.now();
    
    try {
      logger.debug({ operationId }, '[LAYER1] Starting psychology analysis');

      const prompt = this._buildPsychologyPrompt(userText, conversationHistory, leadData);
      
      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || 'gpt-4.1',
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
        max_tokens: 800,
        response_format: { type: "json_object" }
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
   */
  async _layer2_intelligenceGathering({
    psychologyAnalysis,
    userText,
    leadData,
    operationId
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
   * Build psychology analysis prompt
   * @private
   */
  _buildPsychologyPrompt(userText, conversationHistory, leadData) {
    const historyContext = conversationHistory?.slice(-5).map(msg => 
      `${msg.sender}: ${msg.message}`
    ).join('\n') || 'No previous conversation';

    return `Analyze this Singapore property lead's psychology and communication patterns:

CURRENT MESSAGE: "${userText}"

CONVERSATION HISTORY:
${historyContext}

LEAD DATA:
- Source: ${leadData?.source || 'Unknown'}
- Status: ${leadData?.status || 'New'}
- Budget: ${leadData?.budget || 'Not specified'}
- Intent: ${leadData?.intent || 'Unknown'}

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
  "nextBestAction": "build_rapport|provide_info|address_objection|book_appointment"
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

      let query = supabase
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
      const searchQuery = `"${property.project_name}" Singapore property price launch date developer "${property.developer}"`;

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

    // Check if user is asking about market trends, prices, or specific areas
    if (text.includes('price') || text.includes('market') || text.includes('trend')) {
      return `Singapore property market trends 2024 prices ${leadData?.intent || 'residential'}`;
    }

    // Check for specific location queries
    const locationMatch = text.match(/(district \d+|d\d+|orchard|marina|sentosa|jurong|woodlands|tampines|bedok|hougang)/i);
    if (locationMatch) {
      return `Singapore ${locationMatch[0]} property market prices 2024`;
    }

    // Check for property type queries
    if (text.includes('condo') || text.includes('condominium')) {
      return 'Singapore condominium market prices 2024 new launch';
    }

    if (text.includes('landed') || text.includes('house')) {
      return 'Singapore landed property market prices 2024';
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
    operationId
  }) {
    const startTime = Date.now();

    try {
      logger.debug({ operationId }, '[LAYER3] Starting strategic planning');

      const strategyPrompt = this._buildStrategyPrompt(psychologyAnalysis, intelligenceData, leadData);

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || 'gpt-4.1',
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
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const strategy = JSON.parse(completion.choices[0]?.message?.content || '{}');
      strategy.processingTime = Date.now() - startTime;

      logger.debug({
        operationId,
        approach: strategy.approach,
        appointmentStrategy: strategy.appointmentStrategy,
        propertyFocus: strategy.propertyFocus
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
    operationId
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

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are Doro, a warm and professional Singapore property consultant. Generate personalized WhatsApp responses that build rapport, provide value, and guide leads toward consultations. Use proper WhatsApp formatting with \\n\\n for line breaks.`
          },
          {
            role: 'user',
            content: contentPrompt
          }
        ],
        temperature: 0.6,
        max_tokens: 800,
        response_format: { type: "json_object" }
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
    operationId
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

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || 'gpt-4.1',
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
        max_tokens: 1000,
        response_format: { type: "json_object" }
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
    return `Create a strategic conversation plan based on comprehensive lead analysis:

PSYCHOLOGY ANALYSIS:
- Communication Style: ${psychologyAnalysis.communicationStyle}
- Resistance Level: ${psychologyAnalysis.resistanceLevel}
- Urgency Score: ${psychologyAnalysis.urgencyScore}
- Appointment Readiness: ${psychologyAnalysis.appointmentReadiness}
- Recommended Approach: ${psychologyAnalysis.recommendedApproach}
- Next Best Action: ${psychologyAnalysis.nextBestAction}

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
  "conversionPriority": "low|medium|high|urgent"
}`;
  }

  /**
   * Build content generation prompt
   * @private
   */
  _buildContentPrompt(psychologyAnalysis, intelligenceData, responseStrategy, leadData) {
    const propertyInfo = intelligenceData.propertyData?.slice(0, 2).map(p =>
      `- ${p.project_name} (${p.district}): $${p.price_range_min?.toLocaleString()} - $${p.price_range_max?.toLocaleString()}`
    ).join('\n') || 'No specific properties found';

    return `Generate personalized WhatsApp response following strategic plan:

STRATEGY:
- Approach: ${responseStrategy.approach}
- Goal: ${responseStrategy.conversationGoal}
- Appointment Strategy: ${responseStrategy.appointmentStrategy}
- Property Focus: ${responseStrategy.propertyFocus}

PSYCHOLOGY:
- Communication Style: ${psychologyAnalysis.communicationStyle}
- Recommended Approach: ${psychologyAnalysis.recommendedApproach}
- Appointment Readiness: ${psychologyAnalysis.appointmentReadiness}

AVAILABLE PROPERTY DATA:
${propertyInfo}

MARKET INTELLIGENCE:
${intelligenceData.marketIntelligence?.insights?.map(i => `- ${i.title}: ${i.snippet}`).join('\n') || 'No market data available'}

Generate response in JSON format:
{
  "message": "WhatsApp formatted message with \\n\\n line breaks",
  "tone": "warm|professional|casual|urgent",
  "appointmentCall": "none|soft|direct",
  "propertyMentions": ["property1", "property2"],
  "marketInsights": ["insight1", "insight2"],
  "nextStepSuggestion": "continue_chat|book_consultation|send_info",
  "personalizedElements": ["element1", "element2"],
  "urgencyIndicators": ["indicator1", "indicator2"],
  "trustSignals": ["signal1", "signal2"]
}`;
  }

  /**
   * Build synthesis validation prompt
   * @private
   */
  _buildSynthesisPrompt(psychologyAnalysis, intelligenceData, responseStrategy, contentGeneration, leadData) {
    return `Validate and optimize this real estate conversation response:

GENERATED CONTENT:
"${contentGeneration.message}"

STRATEGY ALIGNMENT:
- Target Approach: ${responseStrategy.approach}
- Conversion Priority: ${responseStrategy.conversionPriority}
- Appointment Strategy: ${responseStrategy.appointmentStrategy}

PSYCHOLOGY FIT:
- Lead Style: ${psychologyAnalysis.communicationStyle}
- Resistance Level: ${psychologyAnalysis.resistanceLevel}
- Appointment Readiness: ${psychologyAnalysis.appointmentReadiness}

DATA QUALITY:
- Fact-Checked: ${!!intelligenceData.factCheckResults}
- Data Confidence: ${intelligenceData.dataConfidence}
- Properties Available: ${intelligenceData.propertyData?.length || 0}

Provide validation and optimization in JSON format:
{
  "message": "Final optimized message with proper WhatsApp formatting",
  "qualityScore": 0.0-1.0,
  "appointmentIntent": boolean,
  "factChecked": boolean,
  "culturallyAppropriate": boolean,
  "conversionOptimized": boolean,
  "leadUpdates": {
    "status": "new|qualified|interested|ready",
    "intent": "own_stay|investment|browsing",
    "budget": "updated_budget_if_mentioned",
    "preferences": ["preference1", "preference2"]
  },
  "floorPlanImages": ["image_url1", "image_url2"],
  "validationNotes": "Brief notes on optimization decisions",
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
   * Generate fallback response when processing fails
   * @private
   */
  _generateFallbackResponse(userText, leadData) {
    return {
      success: false,
      response: "Thanks for your message! Let me connect you with the right information. I'll get back to you shortly with some great property options that might interest you.",
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
      message: "Hi there! Thanks for reaching out about Singapore properties. I'd love to help you find the perfect home or investment. What specific areas or property types are you most interested in?",
      tone: 'warm',
      appointmentCall: 'none',
      propertyMentions: [],
      marketInsights: [],
      nextStepSuggestion: 'continue_chat',
      personalizedElements: [],
      urgencyIndicators: [],
      trustSignals: ['professional_greeting'],
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
