/**
 * Psychology Intelligence Service - Advanced psychological analysis for lead conversion
 * Analyzes lead psychology, behavioral patterns, and provides conversion strategy insights
 */

const logger = require('../logger');
const supabase = require('../supabaseClient');
const OpenAI = require('openai');
const config = require('../config');

class PsychologyIntelligenceService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });
    this.psychologyCache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Analyze lead psychology from conversation history and behavior
   */
  async analyzeLeadPsychology(lead, conversationHistory, contextAnalysis) {
    try {
      logger.info({ leadId: lead.id }, 'Starting psychological analysis');

      // Check cache first
      const cacheKey = `${lead.id}_${conversationHistory.length}`;
      if (this.psychologyCache.has(cacheKey)) {
        const cached = this.psychologyCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          logger.info({ leadId: lead.id }, 'Using cached psychological analysis');
          return cached.data;
        }
      }

      // Gather psychological indicators
      const psychologyData = await this._gatherPsychologyIndicators(lead, conversationHistory, contextAnalysis);
      
      // Perform AI-powered psychological analysis
      const psychologyProfile = await this._performPsychologyAnalysis(psychologyData);
      
      // Generate conversion strategies based on psychology
      const conversionStrategies = await this._generatePsychologyBasedStrategies(psychologyProfile, contextAnalysis);
      
      // Store analysis in database
      await this._storePsychologyAnalysis(lead.id, psychologyProfile, conversionStrategies);

      const result = {
        psychology_profile: psychologyProfile,
        conversion_strategies: conversionStrategies,
        confidence_score: psychologyProfile.confidence_score,
        analysis_timestamp: new Date().toISOString()
      };

      // Cache the result
      this.psychologyCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      logger.info({
        leadId: lead.id,
        personalityType: psychologyProfile.personality_type,
        decisionStyle: psychologyProfile.decision_making_style,
        confidenceScore: psychologyProfile.confidence_score
      }, 'Psychological analysis completed');

      return result;

    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, 'Error in psychological analysis');
      return this._getFallbackPsychologyAnalysis();
    }
  }

  /**
   * Gather psychological indicators from conversation and behavior
   * @private
   */
  async _gatherPsychologyIndicators(lead, conversationHistory, contextAnalysis) {
    const indicators = {
      // Communication patterns
      communication_style: this._analyzeCommunicationStyle(conversationHistory),
      
      // Decision-making indicators
      decision_indicators: this._analyzeDecisionIndicators(conversationHistory, contextAnalysis),
      
      // Emotional patterns
      emotional_patterns: this._analyzeEmotionalPatterns(conversationHistory),
      
      // Trust and rapport indicators
      trust_indicators: this._analyzeTrustIndicators(conversationHistory),
      
      // Objection patterns
      objection_patterns: this._analyzeObjectionPatterns(conversationHistory),
      
      // Engagement patterns
      engagement_patterns: this._analyzeEngagementPatterns(conversationHistory),
      
      // Lead profile context
      profile_context: {
        intent: lead.intent,
        budget: lead.budget,
        source: lead.source,
        journey_stage: contextAnalysis.journey_stage,
        comfort_level: contextAnalysis.comfort_level
      }
    };

    return indicators;
  }

  /**
   * Analyze communication style from conversation history
   * @private
   */
  _analyzeCommunicationStyle(conversationHistory) {
    const userMessages = conversationHistory.filter(msg => msg.from_user);
    
    if (userMessages.length === 0) {
      return { style: 'unknown', confidence: 0 };
    }

    let totalLength = 0;
    let questionCount = 0;
    let exclamationCount = 0;
    let formalWords = 0;
    let casualWords = 0;
    let technicalWords = 0;

    const formalIndicators = ['please', 'thank you', 'appreciate', 'kindly', 'regards', 'sincerely'];
    const casualIndicators = ['yeah', 'ok', 'cool', 'awesome', 'great', 'nice', 'lol', 'haha'];
    const technicalIndicators = ['roi', 'yield', 'appreciation', 'market', 'investment', 'portfolio', 'analysis'];

    userMessages.forEach(msg => {
      const text = msg.message.toLowerCase();
      totalLength += text.length;
      
      questionCount += (text.match(/\?/g) || []).length;
      exclamationCount += (text.match(/!/g) || []).length;
      
      formalIndicators.forEach(word => {
        if (text.includes(word)) formalWords++;
      });
      
      casualIndicators.forEach(word => {
        if (text.includes(word)) casualWords++;
      });
      
      technicalIndicators.forEach(word => {
        if (text.includes(word)) technicalWords++;
      });
    });

    const avgMessageLength = totalLength / userMessages.length;
    const questionRatio = questionCount / userMessages.length;
    const exclamationRatio = exclamationCount / userMessages.length;

    // Determine communication style
    let style = 'balanced';
    let confidence = 0.5;

    if (formalWords > casualWords && avgMessageLength > 50) {
      style = 'formal';
      confidence = Math.min(0.9, 0.5 + (formalWords - casualWords) * 0.1);
    } else if (casualWords > formalWords && avgMessageLength < 30) {
      style = 'casual';
      confidence = Math.min(0.9, 0.5 + (casualWords - formalWords) * 0.1);
    } else if (technicalWords > 2) {
      style = 'analytical';
      confidence = Math.min(0.9, 0.5 + technicalWords * 0.1);
    }

    return {
      style,
      confidence,
      metrics: {
        avg_message_length: avgMessageLength,
        question_ratio: questionRatio,
        exclamation_ratio: exclamationRatio,
        formal_words: formalWords,
        casual_words: casualWords,
        technical_words: technicalWords
      }
    };
  }

  /**
   * Analyze decision-making indicators
   * @private
   */
  _analyzeDecisionIndicators(conversationHistory, contextAnalysis) {
    const userMessages = conversationHistory.filter(msg => msg.from_user);
    
    const quickDecisionWords = ['now', 'immediately', 'asap', 'urgent', 'quick', 'fast'];
    const cautiousWords = ['think', 'consider', 'maybe', 'perhaps', 'research', 'compare'];
    const analyticalWords = ['data', 'numbers', 'statistics', 'analysis', 'details', 'information'];
    const emotionalWords = ['feel', 'love', 'excited', 'worried', 'concerned', 'happy'];

    let quickCount = 0;
    let cautiousCount = 0;
    let analyticalCount = 0;
    let emotionalCount = 0;

    userMessages.forEach(msg => {
      const text = msg.message.toLowerCase();
      
      quickDecisionWords.forEach(word => {
        if (text.includes(word)) quickCount++;
      });
      
      cautiousWords.forEach(word => {
        if (text.includes(word)) cautiousCount++;
      });
      
      analyticalWords.forEach(word => {
        if (text.includes(word)) analyticalCount++;
      });
      
      emotionalWords.forEach(word => {
        if (text.includes(word)) emotionalCount++;
      });
    });

    // Determine decision style
    let style = 'balanced';
    let confidence = 0.5;

    const scores = {
      quick: quickCount,
      cautious: cautiousCount,
      analytical: analyticalCount,
      emotional: emotionalCount
    };

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      style = Object.keys(scores).find(key => scores[key] === maxScore);
      confidence = Math.min(0.9, 0.4 + maxScore * 0.1);
    }

    return {
      style,
      confidence,
      indicators: scores,
      timeline_preference: this._inferTimelinePreference(quickCount, cautiousCount)
    };
  }

  /**
   * Analyze emotional patterns in conversation
   * @private
   */
  _analyzeEmotionalPatterns(conversationHistory) {
    const userMessages = conversationHistory.filter(msg => msg.from_user);
    
    const positiveWords = ['great', 'excellent', 'perfect', 'amazing', 'wonderful', 'fantastic'];
    const negativeWords = ['worried', 'concerned', 'problem', 'issue', 'difficult', 'challenging'];
    const excitementWords = ['excited', 'thrilled', 'eager', 'can\'t wait', 'looking forward'];
    const anxietyWords = ['nervous', 'anxious', 'unsure', 'uncertain', 'hesitant'];

    let positiveCount = 0;
    let negativeCount = 0;
    let excitementCount = 0;
    let anxietyCount = 0;

    userMessages.forEach(msg => {
      const text = msg.message.toLowerCase();
      
      positiveWords.forEach(word => {
        if (text.includes(word)) positiveCount++;
      });
      
      negativeWords.forEach(word => {
        if (text.includes(word)) negativeCount++;
      });
      
      excitementWords.forEach(word => {
        if (text.includes(word)) excitementCount++;
      });
      
      anxietyWords.forEach(word => {
        if (text.includes(word)) anxietyCount++;
      });
    });

    const totalEmotionalWords = positiveCount + negativeCount + excitementCount + anxietyCount;
    
    return {
      emotional_tone: this._determineEmotionalTone(positiveCount, negativeCount, excitementCount, anxietyCount),
      emotional_intensity: totalEmotionalWords / Math.max(1, userMessages.length),
      patterns: {
        positive: positiveCount,
        negative: negativeCount,
        excitement: excitementCount,
        anxiety: anxietyCount
      }
    };
  }

  /**
   * Get fallback psychology analysis when main analysis fails
   * @private
   */
  _getFallbackPsychologyAnalysis() {
    return {
      psychology_profile: {
        personality_type: 'unknown',
        decision_making_style: 'balanced',
        communication_preference: 'standard',
        trust_level: 'medium',
        confidence_score: 0.3
      },
      conversion_strategies: {
        primary_approach: 'educational',
        secondary_approach: 'consultative',
        avoid_tactics: [],
        recommended_timing: 'medium'
      },
      confidence_score: 0.3,
      analysis_timestamp: new Date().toISOString()
    };
  }
}

module.exports = new PsychologyIntelligenceService();
