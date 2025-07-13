const logger = require('../logger');
const supabase = require('../supabaseClient');
const { OpenAI } = require('openai');
const config = require('../config');

/**
 * AI LEAD STATE DETECTION SERVICE
 * 
 * Analyzes conversation outcomes using multi-layer AI to determine lead states
 * for intelligent follow-up sequences. Integrates with existing multiLayerAI system.
 * 
 * Lead States:
 * - need_family_discussion: Lead needs to discuss with family/spouse
 * - still_looking: Lead is actively searching but not ready to commit
 * - budget_concerns: Lead has budget/financing concerns
 * - timing_not_right: Lead interested but timing is not right
 * - interested_hesitant: Lead is interested but hesitant/unsure
 * - ready_to_book: Lead is ready to book appointment/consultation
 * - default: Fallback state when specific state cannot be determined
 */
class LeadStateDetectionService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });
    
    // State detection confidence thresholds
    this.confidenceThresholds = {
      high: 0.85,
      medium: 0.70,
      low: 0.55
    };
    
    // Keywords and patterns for each lead state
    this.statePatterns = {
      need_family_discussion: [
        'discuss with family', 'talk to spouse', 'check with wife', 'check with husband',
        'family decision', 'need to discuss', 'speak to family', 'family meeting',
        'consult family', 'family approval', 'wife needs to see', 'husband needs to see'
      ],
      still_looking: [
        'still looking', 'comparing options', 'checking other properties', 'exploring options',
        'looking around', 'seeing what else', 'other developments', 'more choices',
        'want to see more', 'compare prices', 'market research'
      ],
      budget_concerns: [
        'budget', 'expensive', 'cost', 'price', 'afford', 'financing', 'loan',
        'down payment', 'monthly payment', 'too much', 'cheaper options',
        'financial', 'money', 'payment plan', 'installment'
      ],
      timing_not_right: [
        'not ready', 'maybe later', 'future', 'next year', 'few months',
        'timing', 'not now', 'wait', 'delay', 'postpone', 'later',
        'not urgent', 'no rush', 'take time'
      ],
      interested_hesitant: [
        'thinking about it', 'considering', 'unsure', 'not sure', 'maybe',
        'hesitant', 'concerned', 'worried', 'doubt', 'uncertain',
        'need more info', 'more details', 'clarification'
      ],
      ready_to_book: [
        'book appointment', 'schedule meeting', 'want to meet', 'consultation',
        'viewing', 'visit', 'see the place', 'ready to proceed',
        'interested to book', 'when can we meet', 'available time'
      ]
    };
  }

  /**
   * Analyze conversation and detect lead state
   * @param {string} leadId - Lead UUID
   * @param {Array} conversationHistory - Full conversation history
   * @param {Object} conversationContext - Context from multiLayerAI
   * @param {string} conversationId - For multi-tenant support
   * @returns {Promise<Object>} Lead state analysis
   */
  async detectLeadState(leadId, conversationHistory, conversationContext, conversationId = null) {
    try {
      logger.info({ leadId, conversationId }, 'Starting lead state detection');

      // Get recent conversation messages (last 10 messages)
      const recentMessages = conversationHistory.slice(-10);
      const lastUserMessage = recentMessages
        .filter(msg => msg.sender === 'lead')
        .pop();

      if (!lastUserMessage) {
        logger.warn({ leadId }, 'No user messages found for state detection');
        return this._createDefaultState(leadId, conversationId);
      }

      // Run parallel analysis
      const [aiAnalysis, patternAnalysis] = await Promise.all([
        this._performAIStateAnalysis(recentMessages, conversationContext),
        this._performPatternAnalysis(lastUserMessage.message, recentMessages)
      ]);

      // Combine analyses to determine final state
      const finalState = this._combineAnalyses(aiAnalysis, patternAnalysis);

      // Store lead state in database
      const leadState = await this._storeLeadState(
        leadId, 
        conversationId,
        finalState, 
        conversationContext,
        lastUserMessage.message
      );

      logger.info({ 
        leadId, 
        detectedState: finalState.state,
        confidence: finalState.confidence 
      }, 'Lead state detected successfully');

      return leadState;

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error detecting lead state');
      return this._createDefaultState(leadId, conversationId);
    }
  }

  /**
   * Perform AI-based state analysis using OpenAI
   * @private
   */
  async _performAIStateAnalysis(recentMessages, conversationContext) {
    try {
      const prompt = this._buildStateDetectionPrompt(recentMessages, conversationContext);
      
      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are an expert real estate lead psychologist specializing in conversation outcome analysis. 
            
            Analyze the conversation and determine the lead's current state for follow-up purposes.
            
            Available states:
            - need_family_discussion: Lead needs to discuss with family/spouse
            - still_looking: Lead is actively searching but not ready to commit  
            - budget_concerns: Lead has budget/financing concerns
            - timing_not_right: Lead interested but timing is not right
            - interested_hesitant: Lead is interested but hesitant/unsure
            - ready_to_book: Lead is ready to book appointment/consultation
            - default: Cannot determine specific state
            
            Return JSON with: state, confidence (0.0-1.0), reasoning, objections, interests`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2, // Low temperature for consistent analysis
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(completion.choices[0].message.content);
      
      // Validate and normalize response
      return this._validateAIAnalysis(analysis);

    } catch (error) {
      logger.error({ err: error }, 'Error in AI state analysis');
      return {
        state: 'default',
        confidence: 0.3,
        reasoning: 'AI analysis failed',
        objections: [],
        interests: []
      };
    }
  }

  /**
   * Perform pattern-based analysis using keyword matching
   * @private
   */
  _performPatternAnalysis(lastMessage, recentMessages) {
    const messageText = lastMessage.toLowerCase();
    const conversationText = recentMessages
      .map(msg => msg.message.toLowerCase())
      .join(' ');

    const stateScores = {};
    
    // Score each state based on keyword matches
    for (const [state, patterns] of Object.entries(this.statePatterns)) {
      let score = 0;
      
      for (const pattern of patterns) {
        // Higher weight for matches in last message
        if (messageText.includes(pattern)) {
          score += 2;
        }
        // Lower weight for matches in conversation history
        if (conversationText.includes(pattern)) {
          score += 1;
        }
      }
      
      stateScores[state] = score;
    }

    // Find highest scoring state
    const maxScore = Math.max(...Object.values(stateScores));
    const detectedState = Object.keys(stateScores).find(
      state => stateScores[state] === maxScore
    );

    // Calculate confidence based on score
    const confidence = maxScore > 0 ? Math.min(maxScore / 10, 0.9) : 0.2;

    return {
      state: detectedState || 'default',
      confidence,
      reasoning: `Pattern analysis: ${maxScore} keyword matches`,
      scores: stateScores
    };
  }

  /**
   * Combine AI and pattern analyses to determine final state
   * @private
   */
  _combineAnalyses(aiAnalysis, patternAnalysis) {
    // If AI analysis has high confidence, use it
    if (aiAnalysis.confidence >= this.confidenceThresholds.high) {
      return {
        state: aiAnalysis.state,
        confidence: aiAnalysis.confidence,
        reasoning: `AI analysis (high confidence): ${aiAnalysis.reasoning}`,
        method: 'ai_primary',
        objections: aiAnalysis.objections || [],
        interests: aiAnalysis.interests || []
      };
    }

    // If pattern analysis has higher confidence, use it
    if (patternAnalysis.confidence > aiAnalysis.confidence) {
      return {
        state: patternAnalysis.state,
        confidence: patternAnalysis.confidence,
        reasoning: `Pattern analysis: ${patternAnalysis.reasoning}`,
        method: 'pattern_primary',
        objections: aiAnalysis.objections || [],
        interests: aiAnalysis.interests || []
      };
    }

    // Use AI analysis as default
    return {
      state: aiAnalysis.state,
      confidence: aiAnalysis.confidence,
      reasoning: `Combined analysis: ${aiAnalysis.reasoning}`,
      method: 'ai_default',
      objections: aiAnalysis.objections || [],
      interests: aiAnalysis.interests || []
    };
  }

  /**
   * Build prompt for AI state detection
   * @private
   */
  _buildStateDetectionPrompt(recentMessages, conversationContext) {
    const messageHistory = recentMessages
      .map(msg => `${msg.sender}: ${msg.message}`)
      .join('\n');

    return `Analyze this real estate lead conversation to determine the lead's current state:

CONVERSATION HISTORY:
${messageHistory}

CONVERSATION CONTEXT:
${JSON.stringify(conversationContext, null, 2)}

Based on the conversation, determine:
1. The lead's current state (from the available states)
2. Confidence level (0.0 to 1.0)
3. Brief reasoning for the state determination
4. Any objections mentioned by the lead
5. Any interests or preferences expressed

Focus on the lead's most recent messages and overall conversation tone.`;
  }

  /**
   * Validate AI analysis response
   * @private
   */
  _validateAIAnalysis(analysis) {
    const validStates = [
      'need_family_discussion', 'still_looking', 'budget_concerns',
      'timing_not_right', 'interested_hesitant', 'ready_to_book', 'default'
    ];

    return {
      state: validStates.includes(analysis.state) ? analysis.state : 'default',
      confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
      reasoning: analysis.reasoning || 'No reasoning provided',
      objections: Array.isArray(analysis.objections) ? analysis.objections : [],
      interests: Array.isArray(analysis.interests) ? analysis.interests : []
    };
  }

  /**
   * Store lead state in database
   * @private
   */
  async _storeLeadState(leadId, conversationId, stateAnalysis, conversationContext, lastMessage) {
    try {
      // Check if lead state already exists
      const { data: existingState } = await supabase
        .from('lead_states')
        .select('*')
        .eq('lead_id', leadId)
        .eq('conversation_id', conversationId || null)
        .single();

      const stateData = {
        lead_id: leadId,
        conversation_id: conversationId,
        current_state: stateAnalysis.state,
        confidence_score: stateAnalysis.confidence,
        detection_method: stateAnalysis.method || 'multilayer_ai',
        ai_analysis_data: {
          reasoning: stateAnalysis.reasoning,
          method: stateAnalysis.method,
          timestamp: new Date().toISOString()
        },
        conversation_context: conversationContext || {},
        last_message_content: lastMessage,
        objections_mentioned: stateAnalysis.objections,
        interests_expressed: stateAnalysis.interests,
        previous_state: existingState?.current_state || null,
        state_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (existingState) {
        // Update existing state
        const { data, error } = await supabase
          .from('lead_states')
          .update(stateData)
          .eq('id', existingState.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new state
        const { data, error } = await supabase
          .from('lead_states')
          .insert(stateData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error storing lead state');
      throw error;
    }
  }

  /**
   * Create default state when detection fails
   * @private
   */
  _createDefaultState(leadId, conversationId) {
    return {
      lead_id: leadId,
      conversation_id: conversationId,
      current_state: 'default',
      confidence_score: 0.3,
      detection_method: 'fallback',
      ai_analysis_data: { reasoning: 'Detection failed, using default state' },
      conversation_context: {},
      objections_mentioned: [],
      interests_expressed: [],
      is_follow_up_eligible: true
    };
  }

  /**
   * Get current lead state
   * @param {string} leadId - Lead UUID
   * @param {string} conversationId - Conversation UUID (optional)
   * @returns {Promise<Object>} Current lead state
   */
  async getCurrentLeadState(leadId, conversationId = null) {
    try {
      const { data, error } = await supabase
        .from('lead_states')
        .select('*')
        .eq('lead_id', leadId)
        .eq('conversation_id', conversationId || null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data || null;

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error getting current lead state');
      return null;
    }
  }

  /**
   * Update lead state eligibility for follow-ups
   * @param {string} leadId - Lead UUID
   * @param {boolean} isEligible - Whether lead is eligible for follow-ups
   * @param {string} reason - Reason for blocking (if not eligible)
   * @returns {Promise<void>}
   */
  async updateFollowUpEligibility(leadId, isEligible, reason = null) {
    try {
      const { error } = await supabase
        .from('lead_states')
        .update({
          is_follow_up_eligible: isEligible,
          follow_up_blocked_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId);

      if (error) throw error;

      logger.info({ leadId, isEligible, reason }, 'Updated follow-up eligibility');

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error updating follow-up eligibility');
      throw error;
    }
  }
}

module.exports = new LeadStateDetectionService();
