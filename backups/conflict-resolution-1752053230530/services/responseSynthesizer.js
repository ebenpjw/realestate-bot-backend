const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');
const { DORO_PERSONALITY } = require('../config/personality');

/**
 * Enhanced Response Synthesis Layer
 * 
 * Optimizes AI-generated responses to address critical issues:
 * 1. Response length optimization (400-600 characters)
 * 2. Conversation progression enforcement (rapport → qualification → booking)
 * 3. Doro's personality preservation
 * 4. Response type coordination (conversation + booking + information)
 * 5. Fallback to original response if synthesis fails
 */
class ResponseSynthesizer {
  constructor() {
    this.openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    
    // Synthesis configuration
    this.config = {
      targetLength: {
        min: 400,
        max: 600,
        optimal: 500
      },
      maxSynthesisAttempts: 2,
      fallbackThreshold: 0.7, // Quality threshold for using synthesized response
      preservePersonality: true,
      enforceProgression: true
    };
    
    // Performance metrics
    this.metrics = {
      synthesisAttempts: 0,
      successfulSynthesis: 0,
      fallbacksUsed: 0,
      averageOriginalLength: 0,
      averageSynthesizedLength: 0,
      personalityPreservationScore: 0,
      progressionEnforcementScore: 0
    };
    
    logger.info('Enhanced Response Synthesizer initialized');
  }

  /**
   * Main synthesis entry point
   * Optimizes response while preserving strategic thinking and personality
   */
  async synthesizeResponse({
    originalResponse,
    contextAnalysis,
    conversationStage,
    leadData,
    appointmentIntent,
    batchedMessages = [],
    strategicPriority = 'medium'
  }) {
    const operationId = `synthesis-${Date.now()}`;
    
    try {
      logger.info({
        operationId,
        originalLength: originalResponse.length,
        conversationStage,
        appointmentIntent: !!appointmentIntent,
        batchSize: batchedMessages.length,
        strategicPriority
      }, '[SYNTHESIZER] Starting response synthesis');

      // Check if synthesis is needed
      if (!this._needsSynthesis(originalResponse)) {
        logger.info({
          operationId,
          originalLength: originalResponse.length,
          reason: 'Within optimal range'
        }, '[SYNTHESIZER] Synthesis not needed - using original response');
        
        return {
          success: true,
          response: originalResponse,
          synthesized: false,
          metrics: this._calculateResponseMetrics(originalResponse, originalResponse)
        };
      }

      // Perform synthesis
      const synthesisResult = await this._performSynthesis({
        originalResponse,
        contextAnalysis,
        conversationStage,
        leadData,
        appointmentIntent,
        batchedMessages,
        strategicPriority,
        operationId
      });

      // Update metrics
      this._updateMetrics(originalResponse, synthesisResult);

      return synthesisResult;

    } catch (error) {
      logger.error({
        err: error,
        operationId,
        originalLength: originalResponse.length
      }, '[SYNTHESIZER] Error in response synthesis');

      // Fallback to original response
      this.metrics.fallbacksUsed++;
      
      return {
        success: false,
        response: originalResponse,
        synthesized: false,
        error: error.message,
        metrics: this._calculateResponseMetrics(originalResponse, originalResponse)
      };
    }
  }

  /**
   * Check if response needs synthesis
   * @private
   */
  _needsSynthesis(response) {
    const length = response.length;
    
    // Synthesis needed if outside optimal range
    return length < this.config.targetLength.min || length > this.config.targetLength.max;
  }

  /**
   * Perform the actual synthesis using OpenAI
   * @private
   */
  async _performSynthesis({
    originalResponse,
    contextAnalysis,
    conversationStage,
    leadData,
    appointmentIntent,
    batchedMessages,
    strategicPriority,
    operationId
  }) {
    this.metrics.synthesisAttempts++;

    // Build synthesis prompt
    const synthesisPrompt = this._buildSynthesisPrompt({
      originalResponse,
      contextAnalysis,
      conversationStage,
      leadData,
      appointmentIntent,
      batchedMessages,
      strategicPriority
    });

    logger.debug({
      operationId,
      promptLength: synthesisPrompt.length,
      targetLength: this.config.targetLength
    }, '[SYNTHESIZER] Built synthesis prompt');

    // Call OpenAI for synthesis
    const completion = await this.openai.chat.completions.create({
      model: config.OPENAI_MODEL || 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: this._getSystemPrompt()
        },
        {
          role: 'user',
          content: synthesisPrompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent synthesis
      max_tokens: 300,  // Limit to ensure concise responses
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const synthesizedResponse = completion.choices[0]?.message?.content?.trim();

    if (!synthesizedResponse) {
      throw new Error('No synthesized response received from OpenAI');
    }

    // Validate synthesis quality
    const qualityScore = this._validateSynthesisQuality(
      originalResponse,
      synthesizedResponse,
      contextAnalysis,
      conversationStage
    );

    logger.info({
      operationId,
      originalLength: originalResponse.length,
      synthesizedLength: synthesizedResponse.length,
      qualityScore,
      threshold: this.config.fallbackThreshold
    }, '[SYNTHESIZER] Synthesis completed');

    // Decide whether to use synthesized response
    if (qualityScore >= this.config.fallbackThreshold) {
      this.metrics.successfulSynthesis++;
      
      return {
        success: true,
        response: synthesizedResponse,
        synthesized: true,
        qualityScore,
        metrics: this._calculateResponseMetrics(originalResponse, synthesizedResponse)
      };
    } else {
      // Quality too low, use original
      this.metrics.fallbacksUsed++;
      
      logger.warn({
        operationId,
        qualityScore,
        threshold: this.config.fallbackThreshold
      }, '[SYNTHESIZER] Synthesis quality below threshold - using original response');
      
      return {
        success: false,
        response: originalResponse,
        synthesized: false,
        qualityScore,
        reason: 'Quality below threshold',
        metrics: this._calculateResponseMetrics(originalResponse, originalResponse)
      };
    }
  }

  /**
   * Build synthesis prompt for OpenAI
   * @private
   */
  _buildSynthesisPrompt({
    originalResponse,
    contextAnalysis,
    conversationStage,
    leadData,
    appointmentIntent,
    batchedMessages,
    strategicPriority
  }) {
    const batchContext = batchedMessages.length > 1 ? 
      `\n\nBATCHED MESSAGES (${batchedMessages.length} messages):\n${batchedMessages.map((msg, i) => `${i + 1}. "${msg.userText}"`).join('\n')}` : '';

    const appointmentContext = appointmentIntent ? 
      `\n\nAPPOINTMENT INTENT: ${appointmentIntent}` : '';

    return `OPTIMIZE this real estate bot response for better user experience:

ORIGINAL RESPONSE (${originalResponse.length} characters):
"${originalResponse}"

CONVERSATION CONTEXT:
- Stage: ${conversationStage || 'rapport_building'}
- Lead comfort: ${contextAnalysis?.comfort_level || 'unknown'}
- Journey stage: ${contextAnalysis?.journey_stage || 'browsing'}
- Lead intent: ${leadData?.intent || 'not specified'}
- Lead budget: ${leadData?.budget || 'not specified'}${batchContext}${appointmentContext}

OPTIMIZATION REQUIREMENTS:
1. LENGTH: Optimize to 400-600 characters (current: ${originalResponse.length})
2. PERSONALITY: Maintain Doro's warm, trustworthy, professional tone
3. PROGRESSION: Ensure conversation moves toward qualification and booking
4. COHERENCE: Address all key points from original response
5. NATURAL: Keep conversational flow natural and engaging

DORO'S PERSONALITY TRAITS:
- Warm and approachable, never pushy
- Uses "lah", "sia" sparingly and naturally
- Professional yet friendly
- Builds trust through expertise
- Focuses on helping, not selling

CONVERSATION PROGRESSION:
- Rapport building → Needs discovery → Value demonstration → Consultation offer
- Always include 1 strategic question to advance qualification
- Maintain momentum toward booking consultation

RESPONSE:`;
  }

  /**
   * Get system prompt for synthesis
   * @private
   */
  _getSystemPrompt() {
    return `You are an expert response optimizer for Doro, a Singapore real estate AI assistant.

Your role is to take lengthy AI responses and optimize them to be:
1. 400-600 characters (optimal: ~500 characters)
2. Maintain Doro's warm, professional personality
3. Preserve all strategic intent and key information
4. Ensure conversation progression toward qualification and booking
5. Natural and engaging for Singapore property buyers

CRITICAL RULES:
- Never lose important information from the original response
- Maintain Doro's personality and tone
- Keep strategic questions that advance qualification
- Ensure response moves conversation forward
- Use natural Singapore English when appropriate
- Be concise but not robotic

Output ONLY the optimized response, no explanations or meta-commentary.`;
  }

  /**
   * Validate synthesis quality
   * @private
   */
  _validateSynthesisQuality(originalResponse, synthesizedResponse, contextAnalysis, conversationStage) {
    let score = 0;
    const maxScore = 100;

    // Length optimization score (30 points)
    const synthesizedLength = synthesizedResponse.length;
    if (synthesizedLength >= this.config.targetLength.min && synthesizedLength <= this.config.targetLength.max) {
      score += 30;
    } else if (synthesizedLength < originalResponse.length) {
      score += 15; // Partial credit for length reduction
    }

    // Personality preservation score (25 points)
    const personalityScore = this._checkPersonalityPreservation(synthesizedResponse);
    score += personalityScore * 0.25;

    // Content preservation score (25 points)
    const contentScore = this._checkContentPreservation(originalResponse, synthesizedResponse);
    score += contentScore * 0.25;

    // Conversation progression score (20 points)
    const progressionScore = this._checkConversationProgression(synthesizedResponse, conversationStage);
    score += progressionScore * 0.20;

    return Math.round(score);
  }

  /**
   * Check if Doro's personality is preserved
   * @private
   */
  _checkPersonalityPreservation(response) {
    let score = 100;
    
    // Check for key personality indicators
    const personalityIndicators = [
      /\b(help|assist|guide)\b/i,           // Helpful language
      /\b(understand|know|experience)\b/i,   // Expertise indicators
      /\b(property|market|area)\b/i,         // Domain knowledge
      /[.!?]$/                               // Proper sentence ending
    ];
    
    const indicatorCount = personalityIndicators.filter(pattern => pattern.test(response)).length;
    score = Math.min(100, (indicatorCount / personalityIndicators.length) * 100);
    
    return score;
  }

  /**
   * Check if key content is preserved
   * @private
   */
  _checkContentPreservation(original, synthesized) {
    // Simple keyword overlap check
    const originalWords = new Set(original.toLowerCase().match(/\b\w+\b/g) || []);
    const synthesizedWords = new Set(synthesized.toLowerCase().match(/\b\w+\b/g) || []);
    
    const intersection = new Set([...originalWords].filter(word => synthesizedWords.has(word)));
    const overlap = intersection.size / Math.max(originalWords.size, 1);
    
    return Math.round(overlap * 100);
  }

  /**
   * Check if conversation progression is maintained
   * @private
   */
  _checkConversationProgression(response, conversationStage) {
    let score = 50; // Base score
    
    // Check for question (progression indicator)
    if (/\?/.test(response)) {
      score += 25;
    }
    
    // Check for stage-appropriate language
    const stageKeywords = {
      'rapport_building': ['help', 'understand', 'looking', 'interested'],
      'needs_discovery': ['budget', 'timeline', 'area', 'preference'],
      'value_demonstration': ['market', 'opportunity', 'value', 'insight'],
      'consultation_offer': ['consultation', 'discuss', 'meet', 'schedule']
    };
    
    const keywords = stageKeywords[conversationStage] || [];
    const keywordMatches = keywords.filter(keyword => 
      new RegExp(`\\b${keyword}\\b`, 'i').test(response)
    ).length;
    
    score += (keywordMatches / Math.max(keywords.length, 1)) * 25;
    
    return Math.min(100, score);
  }

  /**
   * Calculate response metrics
   * @private
   */
  _calculateResponseMetrics(original, synthesized) {
    return {
      originalLength: original.length,
      synthesizedLength: synthesized.length,
      lengthReduction: original.length - synthesized.length,
      lengthReductionPercent: Math.round(((original.length - synthesized.length) / original.length) * 100),
      withinTargetRange: synthesized.length >= this.config.targetLength.min && 
                        synthesized.length <= this.config.targetLength.max
    };
  }

  /**
   * Update performance metrics
   * @private
   */
  _updateMetrics(originalResponse, synthesisResult) {
    const originalLength = originalResponse.length;
    const synthesizedLength = synthesisResult.response.length;
    
    // Update running averages
    this.metrics.averageOriginalLength = 
      (this.metrics.averageOriginalLength * (this.metrics.synthesisAttempts - 1) + originalLength) / 
      this.metrics.synthesisAttempts;
      
    this.metrics.averageSynthesizedLength = 
      (this.metrics.averageSynthesizedLength * (this.metrics.synthesisAttempts - 1) + synthesizedLength) / 
      this.metrics.synthesisAttempts;
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.synthesisAttempts > 0 ? 
        (this.metrics.successfulSynthesis / this.metrics.synthesisAttempts) * 100 : 0,
      fallbackRate: this.metrics.synthesisAttempts > 0 ? 
        (this.metrics.fallbacksUsed / this.metrics.synthesisAttempts) * 100 : 0
    };
  }
}

// Create singleton instance
const responseSynthesizer = new ResponseSynthesizer();

module.exports = responseSynthesizer;
