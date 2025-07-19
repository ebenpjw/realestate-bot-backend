const logger = require('../logger');
const multiWABATemplateService = require('./multiWABATemplateService');
const aiTemplateGenerationService = require('./aiTemplateGenerationService');
const dynamicIntelligenceFollowUpService = require('./dynamicIntelligenceFollowUpService');
const newsIntelligenceService = require('./newsIntelligenceService');
const multiLayerAI = require('./multiLayerAI');
const databaseService = require('./databaseService');
const templateLimitManager = require('./templateLimitManager');

/**
 * Hybrid Template Strategy
 * Intelligently chooses between existing templates and AI-generated templates
 * based on lead value, insights availability, and performance data
 */
class HybridTemplateStrategy {
  constructor() {
    this.templateTypes = {
      EXISTING: 'existing',
      AI_GENERATED: 'ai_generated',
      FREE_FORM: 'free_form'
    };

    // AI-First Strategy: Use AI templates by default, existing only as fallbacks
    this.aiGenerationThresholds = {
      INSIGHT_CONFIDENCE_MIN: 0.5,      // Lower threshold - AI is usually better
      MAX_GENERATION_RETRIES: 2,        // Retry AI generation before fallback
      GENERATION_TIMEOUT_MS: 10000,     // 10 second timeout for AI generation
      EMERGENCY_FALLBACK_ONLY: true     // Only use existing templates for emergencies
    };
  }

  /**
   * Determine the best template strategy for a follow-up (AI-First Approach)
   * @param {Object} followUpData - Follow-up information
   * @param {Object} leadData - Lead information
   * @param {Array} conversationHistory - Conversation context
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Template strategy decision
   */
  async determineTemplateStrategy(followUpData, leadData, conversationHistory, agentId) {
    try {
      logger.debug({
        leadId: leadData.id,
        agentId
      }, 'Determining optimal template strategy (AI-First)');

      // Step 1: Check if we can send free-form (within 24-hour window)
      const canSendFreeForm = await this._canSendFreeForm(leadData.id);

      if (canSendFreeForm) {
        // Check if we have insights for free-form (lower threshold)
        const hasInsights = await this._hasHighValueInsights(
          leadData,
          conversationHistory,
          agentId
        );

        if (hasInsights.hasInsights) {
          return {
            strategy: this.templateTypes.FREE_FORM,
            reasoning: 'Within 24-hour window with insights - maximum intelligence',
            insights: hasInsights.insights,
            estimatedValue: hasInsights.estimatedValue
          };
        }
      }

      // Step 2: AI-First Strategy - Always try AI generation first
      logger.info({ leadId: leadData.id }, 'Using AI-first template strategy');

      return {
        strategy: this.templateTypes.AI_GENERATED,
        reasoning: 'AI-first strategy - AI templates are superior to static templates',
        confidence: 0.9,
        fallbackAvailable: true
      };

    } catch (error) {
      logger.error({ err: error, leadId: leadData.id }, 'Error determining template strategy');

      // Emergency fallback to existing templates
      return {
        strategy: this.templateTypes.EXISTING,
        reasoning: 'Emergency fallback due to strategy determination error',
        fallback: true,
        emergency: true
      };
    }
  }

  /**
   * Execute the chosen template strategy
   * @param {Object} strategyDecision - Strategy decision from determineTemplateStrategy
   * @param {Object} followUpData - Follow-up information
   * @param {Object} leadData - Lead information
   * @param {Array} conversationHistory - Conversation context
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Template and message content
   */
  async executeStrategy(strategyDecision, followUpData, leadData, conversationHistory, agentId) {
    try {
      switch (strategyDecision.strategy) {
        case this.templateTypes.FREE_FORM:
          return await this._executeFreeFormStrategy(
            strategyDecision, 
            leadData, 
            conversationHistory, 
            agentId
          );

        case this.templateTypes.AI_GENERATED:
          return await this._executeAIGeneratedStrategy(
            strategyDecision, 
            followUpData, 
            leadData, 
            conversationHistory, 
            agentId
          );

        case this.templateTypes.EXISTING:
        default:
          return await this._executeExistingTemplateStrategy(
            followUpData, 
            leadData, 
            agentId
          );
      }

    } catch (error) {
      logger.error({ err: error, strategy: strategyDecision.strategy }, 'Error executing template strategy');
      
      // Fallback to existing templates
      return await this._executeExistingTemplateStrategy(followUpData, leadData, agentId);
    }
  }

  /**
   * Check if we can send free-form messages
   * @private
   */
  async _canSendFreeForm(leadId) {
    try {
      // This would integrate with your existing templateService
      const templateService = require('./templateService');
      return await templateService.canSendFreeFormMessage(leadId);
    } catch (error) {
      logger.error({ err: error, leadId }, 'Error checking free-form capability');
      return false;
    }
  }

  /**
   * Check for high-value insights
   * @private
   */
  async _hasHighValueInsights(leadData, conversationHistory, agentId) {
    try {
      // Check dynamic intelligence
      const dynamicInsights = await dynamicIntelligenceFollowUpService.generateIntelligentFollowUp(
        leadData,
        conversationHistory,
        agentId
      );

      if (dynamicInsights.success && dynamicInsights.confidence > this.aiGenerationThresholds.INSIGHT_CONFIDENCE_MIN) {
        return {
          hasInsights: true,
          insights: dynamicInsights,
          estimatedValue: this._calculateInsightValue(dynamicInsights, leadData),
          type: 'dynamic_intelligence'
        };
      }

      // Check news insights
      const newsInsights = await newsIntelligenceService.getRelevantNewsInsights(leadData, agentId);
      
      if (newsInsights.success && newsInsights.leadRelevance > this.aiGenerationThresholds.INSIGHT_CONFIDENCE_MIN) {
        return {
          hasInsights: true,
          insights: newsInsights,
          estimatedValue: this._calculateInsightValue(newsInsights, leadData),
          type: 'news_intelligence'
        };
      }

      return { hasInsights: false };

    } catch (error) {
      logger.error({ err: error }, 'Error checking for high-value insights');
      return { hasInsights: false };
    }
  }

  /**
   * Analyze lead value and context
   * @private
   */
  async _analyzeLead(leadData, conversationHistory) {
    // Calculate lead score based on engagement, timeline, budget
    let leadScore = 50; // Base score

    // Timeline urgency
    if (leadData.timeline) {
      const timeline = leadData.timeline.toLowerCase();
      if (timeline.includes('asap') || timeline.includes('urgent')) leadScore += 30;
      else if (timeline.includes('1 month') || timeline.includes('soon')) leadScore += 20;
      else if (timeline.includes('3 month')) leadScore += 10;
    }

    // Budget clarity
    if (leadData.budget && leadData.budget !== 'Not specified') leadScore += 15;

    // Engagement level
    const recentMessages = conversationHistory.slice(-10);
    const userMessages = recentMessages.filter(m => m.sender === 'user').length;
    const botMessages = recentMessages.filter(m => m.sender === 'bot').length;
    const responseRate = botMessages > 0 ? userMessages / botMessages : 0;
    
    leadScore += responseRate * 20;

    return {
      leadScore,
      isHighValue: leadScore >= this.aiGenerationThresholds.HIGH_VALUE_LEAD_SCORE,
      engagementLevel: responseRate > 0.7 ? 'high' : responseRate > 0.3 ? 'medium' : 'low',
      timeline: leadData.timeline,
      budget: leadData.budget
    };
  }

  /**
   * Get existing template performance
   * @private
   */
  async _getExistingTemplatePerformance(agentId, leadState) {
    try {
      const templates = await multiWABATemplateService.getTemplatesForState(agentId, leadState);
      
      if (!templates || templates.length === 0) {
        return { hasTemplates: false, avgPerformance: 0 };
      }

      const avgResponseRate = templates.reduce((sum, t) => sum + (t.response_rate || 0), 0) / templates.length;
      const avgConversionRate = templates.reduce((sum, t) => sum + (t.conversion_rate || 0), 0) / templates.length;

      return {
        hasTemplates: true,
        avgPerformance: (avgResponseRate + avgConversionRate) / 2,
        templateCount: templates.length,
        bestTemplate: templates.sort((a, b) => (b.response_rate || 0) - (a.response_rate || 0))[0]
      };

    } catch (error) {
      logger.error({ err: error, agentId, leadState }, 'Error getting existing template performance');
      return { hasTemplates: false, avgPerformance: 0 };
    }
  }

  /**
   * Evaluate AI template potential
   * @private
   */
  async _evaluateAITemplatePotential(leadData, conversationHistory, agentId) {
    // Calculate potential value of AI-generated template
    const leadAnalysis = await this._analyzeLead(leadData, conversationHistory);
    
    // Estimate cost vs benefit
    const estimatedCost = 0.50; // Estimated cost for AI template generation
    const estimatedValue = leadAnalysis.leadScore * 0.5; // Lead score * conversion multiplier
    const costBenefitRatio = estimatedValue / estimatedCost;

    return {
      worthGenerating: costBenefitRatio >= this.aiGenerationThresholds.COST_BENEFIT_RATIO,
      estimatedCost,
      estimatedValue,
      costBenefitRatio,
      leadScore: leadAnalysis.leadScore
    };
  }

  /**
   * Make strategic decision
   * @private
   */
  _makeStrategyDecision(leadAnalysis, existingPerformance, aiPotential, canSendFreeForm) {
    // Decision matrix
    
    // High-value lead with poor existing template performance
    if (leadAnalysis.isHighValue && 
        existingPerformance.avgPerformance < this.aiGenerationThresholds.EXISTING_TEMPLATE_PERFORMANCE &&
        aiPotential.worthGenerating) {
      return {
        strategy: this.templateTypes.AI_GENERATED,
        reasoning: 'High-value lead with poor existing template performance',
        confidence: 0.8,
        expectedImprovement: aiPotential.costBenefitRatio
      };
    }

    // Good existing templates available
    if (existingPerformance.hasTemplates && 
        existingPerformance.avgPerformance >= this.aiGenerationThresholds.EXISTING_TEMPLATE_PERFORMANCE) {
      return {
        strategy: this.templateTypes.EXISTING,
        reasoning: 'Existing templates performing well',
        confidence: 0.9,
        templatePerformance: existingPerformance.avgPerformance
      };
    }

    // No good templates, but AI generation not cost-effective
    if (!existingPerformance.hasTemplates && !aiPotential.worthGenerating) {
      return {
        strategy: this.templateTypes.EXISTING,
        reasoning: 'Fallback to generic templates - AI generation not cost-effective',
        confidence: 0.6,
        fallback: true
      };
    }

    // Default to existing templates
    return {
      strategy: this.templateTypes.EXISTING,
      reasoning: 'Default strategy - existing templates',
      confidence: 0.7
    };
  }

  /**
   * Execute free-form strategy
   * @private
   */
  async _executeFreeFormStrategy(strategyDecision, leadData, conversationHistory, agentId) {
    const insights = strategyDecision.insights;
    
    if (insights.type === 'dynamic_intelligence') {
      return {
        messageType: 'free_form',
        content: insights.message,
        template: null,
        strategy: strategyDecision
      };
    } else {
      // Format news insights for free-form
      const mobileMessageFormatter = require('../utils/mobileMessageFormatter');
      const formattedMessage = mobileMessageFormatter.formatNewsInsight(
        insights.insights[0], 
        leadData
      );
      
      return {
        messageType: 'free_form',
        content: formattedMessage,
        template: null,
        strategy: strategyDecision
      };
    }
  }

  /**
   * Execute AI-generated template strategy with fallback
   * @private
   */
  async _executeAIGeneratedStrategy(strategyDecision, followUpData, leadData, conversationHistory, agentId) {
    let retries = 0;
    const maxRetries = this.aiGenerationThresholds.MAX_GENERATION_RETRIES;

    while (retries <= maxRetries) {
      try {
        logger.info({
          leadId: leadData.id,
          attempt: retries + 1
        }, 'Attempting AI template generation');

        // Set timeout for AI generation
        const aiGenerationPromise = this._generateAITemplate(
          leadData,
          conversationHistory,
          followUpData.current_state,
          agentId
        );

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI generation timeout')),
          this.aiGenerationThresholds.GENERATION_TIMEOUT_MS)
        );

        const aiTemplate = await Promise.race([aiGenerationPromise, timeoutPromise]);

        if (aiTemplate && aiTemplate.success) {
          logger.info({ leadId: leadData.id }, 'AI template generated successfully');
          return {
            messageType: 'ai_template',
            template: aiTemplate,
            strategy: strategyDecision,
            generationAttempt: retries + 1
          };
        }

        // Check if failure was due to template limits
        if (aiTemplate && aiTemplate.fallbackToExisting) {
          logger.warn({
            leadId: leadData.id,
            limitStatus: aiTemplate.limitStatus
          }, 'AI template generation failed due to limits - falling back to existing templates');

          // Immediate fallback to existing templates
          return await this._executeExistingTemplateStrategy(followUpData, leadData, agentId);
        }

        throw new Error('AI template generation failed');

      } catch (error) {
        retries++;
        logger.warn({
          err: error,
          leadId: leadData.id,
          attempt: retries
        }, 'AI template generation attempt failed');

        if (retries > maxRetries) {
          logger.error({ leadId: leadData.id }, 'AI template generation failed after all retries - falling back to existing templates');

          // Fallback to existing templates
          return await this._executeExistingTemplateStrategy(followUpData, leadData, agentId);
        }

        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Execute existing template strategy
   * @private
   */
  async _executeExistingTemplateStrategy(followUpData, leadData, agentId) {
    const template = await multiWABATemplateService.getTemplateForLeadState(
      agentId,
      followUpData.current_state,
      followUpData.sequence_stage
    );

    return {
      messageType: 'existing_template',
      template,
      strategy: {
        strategy: this.templateTypes.EXISTING,
        reasoning: 'Using existing template system'
      }
    };
  }

  /**
   * Calculate insight value
   * @private
   */
  _calculateInsightValue(insights, leadData) {
    // Base value calculation
    let value = 10; // Base value

    // Confidence multiplier
    if (insights.confidence) {
      value *= insights.confidence;
    }

    // Lead value multiplier
    if (leadData.budget) {
      const budgetValue = parseFloat(leadData.budget.replace(/[^0-9.]/g, '')) || 0;
      if (budgetValue > 800000) value *= 1.5;
      else if (budgetValue > 500000) value *= 1.2;
    }

    return Math.round(value);
  }

  /**
   * Generate AI template for this specific scenario
   * @private
   */
  async _generateAITemplate(leadData, conversationHistory, leadState, agentId) {
    try {
      // Use the existing AI template generation service
      const result = await this._generateContextualTemplate(
        leadData,
        conversationHistory,
        leadState,
        agentId
      );

      return result;

    } catch (error) {
      logger.error({ err: error, leadId: leadData.id }, 'Error generating AI template');
      throw error;
    }
  }

  /**
   * Generate contextual template using AI (with limit management)
   * @private
   */
  async _generateContextualTemplate(leadData, conversationHistory, leadState, agentId) {
    try {
      // Check template limits before generating
      const limitCheck = await templateLimitManager.canCreateNewTemplate(agentId);

      if (!limitCheck.canCreate) {
        logger.warn({
          agentId,
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit
        }, 'Cannot create new template - limit reached');

        // Return fallback to existing templates
        return {
          success: false,
          error: 'Template limit reached',
          fallbackToExisting: true,
          limitStatus: limitCheck
        };
      }

      // Log if approaching limit
      if (limitCheck.remainingSlots <= 10) {
        logger.warn({
          agentId,
          remainingSlots: limitCheck.remainingSlots
        }, 'Approaching template limit');
      }

      // Analyze conversation context
      const context = await this._analyzeConversationForTemplate(leadData, conversationHistory);

      // Generate template structure
      const templateStructure = await this._generateTemplateStructure(
        leadData,
        context,
        leadState
      );

      // Create Gupshup-compatible template
      const gupshupTemplate = await this._createGupshupTemplate(
        templateStructure,
        agentId,
        leadState
      );

      return {
        success: true,
        template: gupshupTemplate,
        context,
        confidence: templateStructure.confidence || 0.8,
        limitStatus: limitCheck
      };

    } catch (error) {
      logger.error({ err: error }, 'Error generating contextual template');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze conversation for template generation
   * @private
   */
  async _analyzeConversationForTemplate(leadData, conversationHistory) {
    try {
      const recentMessages = conversationHistory.slice(-10);
      const userMessages = recentMessages.filter(m => m.sender === 'user');
      const botMessages = recentMessages.filter(m => m.sender === 'bot');

      const contextPrompt = `
Analyze this property lead conversation for follow-up template generation:

Lead Info:
- Name: ${leadData.full_name || 'Unknown'}
- Location: ${leadData.location_preference || 'Not specified'}
- Property Type: ${leadData.property_type || 'Not specified'}
- Budget: ${leadData.budget || 'Not specified'}
- Timeline: ${leadData.timeline || 'Not specified'}

Recent Messages:
${recentMessages.map(m => `${m.sender}: ${m.message}`).join('\n')}

Extract key context for personalized follow-up:
1. Main concerns or interests
2. Specific properties discussed
3. Decision-making factors
4. Communication style preference
5. Urgency level

Return JSON: {concerns, interests, style, urgency, lastTopic}
`;

      const completion = await multiLayerAI.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Extract conversation context for template generation. Return only valid JSON.'
          },
          {
            role: 'user',
            content: contextPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 400
      });

      const contextAnalysis = JSON.parse(completion.choices[0]?.message?.content || '{}');

      return {
        ...contextAnalysis,
        messageCount: recentMessages.length,
        responseRate: botMessages.length > 0 ? userMessages.length / botMessages.length : 0
      };

    } catch (error) {
      logger.error({ err: error }, 'Error analyzing conversation context');
      return {
        concerns: [],
        interests: [],
        style: 'casual',
        urgency: 'medium',
        lastTopic: 'general inquiry'
      };
    }
  }

  /**
   * Generate template structure with variables
   * @private
   */
  async _generateTemplateStructure(leadData, context, leadState) {
    try {
      const structurePrompt = `
Create a WhatsApp template for property follow-up:

CONTEXT:
- Lead State: ${leadState}
- Lead Name: ${leadData.full_name || 'Unknown'}
- Concerns: ${context.concerns?.join(', ') || 'None'}
- Last Topic: ${context.lastTopic || 'General inquiry'}
- Style: ${context.style || 'casual'}
- Urgency: ${context.urgency || 'medium'}

REQUIREMENTS:
1. Use variables {{1}}, {{2}}, {{3}}, etc.
2. Mobile-friendly with line breaks
3. Professional but ${context.style || 'casual'} tone
4. Include 1-2 relevant emojis
5. End with engaging question
6. Max 150 words
7. Structure: Greeting → Context → Value → Question

VARIABLES:
- {{1}} = Lead name
- {{2}} = Specific context
- {{3}} = Value/insight
- {{4}} = Call to action

Return JSON:
{
  "content": "template with variables",
  "variables": ["name", "context", "value", "question"],
  "example": "filled example",
  "category": "UTILITY",
  "confidence": 0.85
}
`;

      const completion = await multiLayerAI.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Create WhatsApp templates for property businesses. Return only valid JSON.'
          },
          {
            role: 'user',
            content: structurePrompt
          }
        ],
        temperature: 0.6,
        max_tokens: 600
      });

      const templateStructure = JSON.parse(completion.choices[0]?.message?.content || '{}');

      if (!templateStructure.content || !templateStructure.variables) {
        throw new Error('Invalid template structure generated');
      }

      return templateStructure;

    } catch (error) {
      logger.error({ err: error }, 'Error generating template structure');
      throw error;
    }
  }

  /**
   * Create Gupshup-compatible template
   * @private
   */
  async _createGupshupTemplate(templateStructure, agentId, leadState) {
    const timestamp = Date.now();
    const templateName = `ai_${leadState}_${timestamp}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    return {
      elementName: templateName,
      languageCode: 'en',
      category: templateStructure.category || 'UTILITY',
      templateType: 'TEXT',
      content: templateStructure.content,
      example: templateStructure.example,
      enableSample: true,
      vertical: 'REAL_ESTATE',
      variables: templateStructure.variables,
      agentId: agentId,
      leadState: leadState,
      generatedAt: new Date().toISOString(),
      confidence: templateStructure.confidence || 0.8
    };
  }
}

module.exports = new HybridTemplateStrategy();
