const logger = require('../logger');
const databaseService = require('./databaseService');
const config = require('../config');
const OpenAI = require('openai');
const costTrackingService = require('./costTrackingService');
const wabaTemplateAutomationService = require('./wabaTemplateAutomationService');
const leadStateDetectionService = require('./leadStateDetectionService');
const supabase = databaseService.supabase;

/**
 * AI TEMPLATE GENERATION SERVICE
 * 
 * Automatically generates new WhatsApp templates using AI when unique conversation 
 * situations arise that don't fit existing templates. Integrates with existing 
 * multi-layer AI system and intelligent follow-up service.
 * 
 * Features:
 * - Conversation pattern analysis
 * - AI-driven template generation
 * - Automatic template submission via Gupshup Partner API
 * - Template necessity scoring
 * - Integration with existing follow-up system
 */
class AITemplateGenerationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });
    
    // Template generation thresholds
    this.GENERATION_THRESHOLDS = {
      MIN_PATTERN_OCCURRENCES: 3, // Minimum times a pattern must occur
      MIN_CONFIDENCE_SCORE: 0.75, // Minimum AI confidence to generate template
      MIN_DAYS_BETWEEN_ANALYSIS: 1, // Minimum days between pattern analysis
      MAX_TEMPLATES_PER_AGENT_PER_DAY: 2 // Rate limiting
    };
    
    // Template categories for different scenarios
    this.TEMPLATE_CATEGORIES = {
      FOLLOW_UP: 'UTILITY', // Follow-up messages
      OBJECTION_HANDLING: 'UTILITY', // Handling specific objections
      APPOINTMENT_BOOKING: 'UTILITY', // Appointment-related messages
      PROPERTY_UPDATES: 'MARKETING', // Property-specific updates
      MARKET_INSIGHTS: 'MARKETING' // Market information sharing
    };
    
    this.isAnalyzing = false;
    this.analysisInterval = null;
  }

  /**
   * Wrapper for OpenAI API calls with cost tracking
   * @private
   */
  async _callOpenAIWithTracking({
    agentId,
    operationType,
    messages,
    model = config.OPENAI_MODEL || 'gpt-4.1',
    temperature = 0.4,
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

      // Record cost tracking
      if (agentId) {
        await costTrackingService.recordOpenAIUsage({
          agentId,
          leadId: null, // Template generation is not lead-specific
          operationType,
          model,
          inputTokens,
          outputTokens,
          metadata: {
            ...metadata,
            temperature,
            max_tokens: maxTokens,
            service: 'ai_template_generation'
          }
        }).catch(err => {
          logger.error({ err, agentId, operationType }, 'Failed to record template generation cost tracking');
        });
      }

      return completion;

    } catch (error) {
      logger.error({ err: error, operationType, model }, 'OpenAI API call failed in template generation');
      throw error;
    }
  }

  /**
   * Initialize the AI template generation service
   */
  async initialize() {
    try {
      logger.info('Initializing AI Template Generation Service');
      
      // Start periodic pattern analysis (every 6 hours)
      this.analysisInterval = setInterval(async () => {
        await this._performPeriodicAnalysis();
      }, 6 * 60 * 60 * 1000);
      
      logger.info('AI Template Generation Service initialized successfully');
      
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize AI Template Generation Service');
      throw error;
    }
  }

  /**
   * Analyze conversation patterns and generate templates for unique scenarios
   * @param {string} agentId - Optional specific agent ID to analyze
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeAndGenerateTemplates(agentId = null) {
    if (this.isAnalyzing) {
      logger.warn('Template generation analysis already in progress');
      return { success: false, reason: 'analysis_in_progress' };
    }

    try {
      this.isAnalyzing = true;
      logger.info({ agentId }, 'Starting conversation pattern analysis for template generation');

      // Get conversation patterns that need templates
      const patterns = await this._identifyMissingTemplatePatterns(agentId);
      
      if (!patterns || patterns.length === 0) {
        logger.info({ agentId }, 'No new template patterns identified');
        return { success: true, templatesGenerated: 0, patterns: [] };
      }

      const generatedTemplates = [];
      
      for (const pattern of patterns) {
        try {
          // Check rate limiting
          if (await this._isRateLimited(pattern.agentId)) {
            logger.warn({ agentId: pattern.agentId }, 'Rate limit reached for template generation');
            continue;
          }

          // Generate template for this pattern
          const template = await this._generateTemplateForPattern(pattern);
          
          if (template && template.confidence >= this.GENERATION_THRESHOLDS.MIN_CONFIDENCE_SCORE) {
            // Submit template for approval
            const submissionResult = await this._submitGeneratedTemplate(template, pattern);
            
            if (submissionResult.success) {
              generatedTemplates.push({
                pattern: pattern.description,
                templateName: template.templateName,
                category: template.category,
                confidence: template.confidence,
                submissionId: submissionResult.submissionId
              });
            }
          }
        } catch (error) {
          logger.error({ 
            err: error, 
            patternId: pattern.id,
            agentId: pattern.agentId 
          }, 'Failed to generate template for pattern');
        }
      }

      logger.info({ 
        agentId, 
        patternsAnalyzed: patterns.length,
        templatesGenerated: generatedTemplates.length 
      }, 'Template generation analysis completed');

      return {
        success: true,
        templatesGenerated: generatedTemplates.length,
        patterns: generatedTemplates
      };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to analyze patterns and generate templates');
      return { success: false, error: error.message };
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Identify conversation patterns that need new templates
   * @private
   */
  async _identifyMissingTemplatePatterns(agentId = null) {
    try {
      // Get recent conversations with follow-up challenges
      const { data: conversations, error } = await supabase
        .from('agent_lead_conversations')
        .select(`
          id,
          agent_id,
          global_lead_id,
          conversation_status,
          last_message_at,
          messages (
            id,
            sender,
            message,
            created_at
          ),
          lead_states (
            current_state,
            reasoning,
            objections,
            interests
          )
        `)
        .eq(agentId ? 'agent_id' : 'conversation_status', agentId || 'active')
        .gte('last_message_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('last_message_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Analyze conversations for patterns
      const patterns = await this._analyzeConversationPatterns(conversations, agentId);

      // Filter patterns that need templates
      const missingTemplatePatterns = await this._filterPatternsNeedingTemplates(patterns, agentId);
      
      return missingTemplatePatterns;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to identify missing template patterns');
      return [];
    }
  }

  /**
   * Analyze conversations to identify patterns
   * @private
   */
  async _analyzeConversationPatterns(conversations, agentId = null) {
    try {
      const prompt = this._buildPatternAnalysisPrompt(conversations);
      
      const completion = await this._callOpenAIWithTracking({
        agentId,
        operationType: 'pattern_analysis',
        messages: [
          {
            role: 'system',
            content: `You are an expert conversation analyst specializing in real estate lead communication patterns. Analyze conversations to identify recurring scenarios that would benefit from standardized WhatsApp templates.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        maxTokens: 1500,
        responseFormat: { type: "json_object" },
        metadata: {
          conversation_count: conversations.length,
          analysis_type: 'pattern_identification'
        }
      });

      const analysis = JSON.parse(completion.choices[0]?.message?.content || '{}');
      
      return analysis.patterns || [];

    } catch (error) {
      logger.error({ err: error }, 'Failed to analyze conversation patterns');
      return [];
    }
  }

  /**
   * Build prompt for pattern analysis
   * @private
   */
  _buildPatternAnalysisPrompt(conversations) {
    const conversationSummaries = conversations.slice(0, 20).map(conv => {
      const recentMessages = conv.messages?.slice(-10) || [];
      const leadState = conv.lead_states?.[0];
      
      return {
        agentId: conv.agent_id,
        status: conv.conversation_status,
        leadState: leadState?.current_state,
        objections: leadState?.objections,
        interests: leadState?.interests,
        messageFlow: recentMessages.map(msg => ({
          sender: msg.sender,
          message: msg.message.substring(0, 200),
          timestamp: msg.created_at
        }))
      };
    });

    return `Analyze these real estate lead conversations to identify recurring patterns that would benefit from standardized WhatsApp templates:

${JSON.stringify(conversationSummaries, null, 2)}

Focus on identifying:
1. Recurring objection types that need specific responses
2. Common follow-up scenarios not covered by existing templates
3. Specific property-related questions that repeat across conversations
4. Appointment booking challenges that occur frequently
5. Market insight requests that could be templated

For each pattern identified, provide:
- Pattern description
- Frequency estimate (how often it occurs)
- Template necessity score (0-1)
- Suggested template category (UTILITY/MARKETING)
- Sample scenario where this template would be used
- Agent ID where pattern was most observed

Return JSON format:
{
  "patterns": [
    {
      "id": "unique_pattern_id",
      "description": "Pattern description",
      "frequency": "high/medium/low",
      "necessity_score": 0.85,
      "category": "UTILITY",
      "scenario": "Sample scenario description",
      "agentId": "agent_uuid",
      "sample_conversations": ["conv_id_1", "conv_id_2"]
    }
  ]
}`;
  }

  /**
   * Filter patterns that actually need new templates
   * @private
   */
  async _filterPatternsNeedingTemplates(patterns) {
    const filteredPatterns = [];

    for (const pattern of patterns) {
      try {
        // Check if we already have templates for this pattern
        const existingTemplates = await this._checkExistingTemplatesForPattern(pattern);

        if (existingTemplates.length === 0 &&
            pattern.necessity_score >= this.GENERATION_THRESHOLDS.MIN_CONFIDENCE_SCORE) {

          // Check if we've already generated a template for this pattern recently
          const recentGeneration = await this._checkRecentTemplateGeneration(pattern);

          if (!recentGeneration) {
            filteredPatterns.push(pattern);
          }
        }
      } catch (error) {
        logger.error({ err: error, patternId: pattern.id }, 'Error filtering pattern');
      }
    }

    return filteredPatterns;
  }

  /**
   * Check if existing templates cover this pattern
   * @private
   */
  async _checkExistingTemplatesForPattern(pattern) {
    try {
      const { data: templates, error } = await supabase
        .from('agent_follow_up_templates')
        .select('*')
        .eq('agent_id', pattern.agentId)
        .eq('is_active', true);

      if (error) throw error;

      // Use AI to determine if existing templates cover this pattern
      if (templates && templates.length > 0) {
        const coverageAnalysis = await this._analyzeTemplateCoverage(pattern, templates);
        return coverageAnalysis.covered ? templates : [];
      }

      return [];
    } catch (error) {
      logger.error({ err: error, patternId: pattern.id }, 'Error checking existing templates');
      return [];
    }
  }

  /**
   * Analyze if existing templates cover a pattern
   * @private
   */
  async _analyzeTemplateCoverage(pattern, existingTemplates) {
    try {
      const prompt = `Analyze if these existing templates adequately cover the following conversation pattern:

Pattern: ${pattern.description}
Scenario: ${pattern.scenario}

Existing Templates:
${existingTemplates.map(t => `- ${t.template_name}: ${t.template_content}`).join('\n')}

Determine if the existing templates can handle this pattern effectively.

Return JSON:
{
  "covered": true/false,
  "reasoning": "explanation",
  "coverage_score": 0.85
}`;

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: 'You are a template coverage analyst. Determine if existing templates adequately cover new conversation patterns.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      return JSON.parse(completion.choices[0]?.message?.content || '{"covered": false}');
    } catch (error) {
      logger.error({ err: error }, 'Error analyzing template coverage');
      return { covered: false };
    }
  }

  /**
   * Check if we've recently generated a template for this pattern
   * @private
   */
  async _checkRecentTemplateGeneration(pattern) {
    try {
      const { data: recentGeneration, error } = await supabase
        .from('waba_templates')
        .select('*')
        .eq('agent_id', pattern.agentId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (error) throw error;

      return recentGeneration && recentGeneration.length > 0;
    } catch (error) {
      logger.error({ err: error, patternId: pattern.id }, 'Error checking recent template generation');
      return false;
    }
  }

  /**
   * Generate a WhatsApp template for a specific pattern
   * @private
   */
  async _generateTemplateForPattern(pattern) {
    try {
      logger.debug({ patternId: pattern.id }, 'Generating template for pattern');

      const prompt = this._buildTemplateGenerationPrompt(pattern);

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL || 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are an expert WhatsApp Business template creator for real estate. Create WABA-compliant templates that are professional, engaging, and conversion-focused.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 800,
        response_format: { type: "json_object" }
      });

      const templateData = JSON.parse(completion.choices[0]?.message?.content || '{}');

      // Validate and enhance template
      const validatedTemplate = await this._validateAndEnhanceTemplate(templateData, pattern);

      return validatedTemplate;

    } catch (error) {
      logger.error({ err: error, patternId: pattern.id }, 'Failed to generate template for pattern');
      return null;
    }
  }

  /**
   * Build prompt for template generation
   * @private
   */
  _buildTemplateGenerationPrompt(pattern) {
    return `Create a WhatsApp Business template for this real estate conversation pattern:

Pattern: ${pattern.description}
Category: ${pattern.category}
Scenario: ${pattern.scenario}
Frequency: ${pattern.frequency}

Requirements:
1. Must be WABA-compliant (no promotional language if UTILITY category)
2. Use {{1}}, {{2}}, etc. for dynamic parameters
3. Keep under 1024 characters
4. Professional but conversational tone
5. Include clear call-to-action
6. Suitable for Singapore real estate market

Template Structure:
- Header (optional): Brief attention-grabbing line
- Body: Main message with parameters
- Footer (optional): Professional signature or disclaimer

Return JSON format:
{
  "templateName": "descriptive_template_name",
  "category": "${pattern.category}",
  "language": "en",
  "confidence": 0.85,
  "components": [
    {
      "type": "BODY",
      "text": "Template text with {{1}} parameters {{2}}"
    }
  ],
  "parameters": [
    {
      "position": 1,
      "description": "Lead name",
      "example": "John"
    },
    {
      "position": 2,
      "description": "Property type",
      "example": "3-bedroom condo"
    }
  ],
  "usage_context": "When to use this template",
  "expected_response": "What response this template should generate"
}`;
  }

  /**
   * Validate and enhance generated template
   * @private
   */
  async _validateAndEnhanceTemplate(templateData, pattern) {
    try {
      // Basic validation
      if (!templateData.templateName || !templateData.components || !templateData.category) {
        throw new Error('Invalid template structure');
      }

      // Enhance template with pattern context
      const enhancedTemplate = {
        ...templateData,
        templateName: this._sanitizeTemplateName(templateData.templateName),
        agentId: pattern.agentId,
        generationContext: {
          pattern_id: pattern.id,
          pattern_description: pattern.description,
          generation_timestamp: new Date().toISOString(),
          ai_confidence: templateData.confidence
        }
      };

      // Validate WABA compliance
      const complianceCheck = await this._validateWABACompliance(enhancedTemplate);

      if (!complianceCheck.compliant) {
        logger.warn({
          templateName: enhancedTemplate.templateName,
          issues: complianceCheck.issues
        }, 'Template failed WABA compliance check');
        return null;
      }

      return enhancedTemplate;

    } catch (error) {
      logger.error({ err: error, patternId: pattern.id }, 'Failed to validate template');
      return null;
    }
  }

  /**
   * Sanitize template name for WABA compliance
   * @private
   */
  _sanitizeTemplateName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }

  /**
   * Validate WABA compliance
   * @private
   */
  async _validateWABACompliance(template) {
    try {
      const bodyText = template.components.find(c => c.type === 'BODY')?.text || '';

      // Basic compliance checks
      const issues = [];

      if (bodyText.length > 1024) {
        issues.push('Body text exceeds 1024 character limit');
      }

      if (template.category === 'UTILITY' && this._containsPromotionalLanguage(bodyText)) {
        issues.push('UTILITY template contains promotional language');
      }

      if (!this._hasValidParameterFormat(bodyText)) {
        issues.push('Invalid parameter format (use {{1}}, {{2}}, etc.)');
      }

      return {
        compliant: issues.length === 0,
        issues
      };

    } catch (error) {
      logger.error({ err: error }, 'Error validating WABA compliance');
      return { compliant: false, issues: ['Validation error'] };
    }
  }

  /**
   * Check for promotional language
   * @private
   */
  _containsPromotionalLanguage(text) {
    const promotionalWords = [
      'sale', 'discount', 'offer', 'deal', 'promotion', 'limited time',
      'buy now', 'special price', 'exclusive', 'save money'
    ];

    const lowerText = text.toLowerCase();
    return promotionalWords.some(word => lowerText.includes(word));
  }

  /**
   * Validate parameter format
   * @private
   */
  _hasValidParameterFormat(text) {
    const paramRegex = /\{\{\d+\}\}/g;
    const matches = text.match(paramRegex) || [];

    // Check if parameters are sequential starting from 1
    const paramNumbers = matches.map(match => parseInt(match.replace(/[{}]/g, '')));
    const uniqueParams = [...new Set(paramNumbers)].sort((a, b) => a - b);

    for (let i = 0; i < uniqueParams.length; i++) {
      if (uniqueParams[i] !== i + 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * Submit generated template for approval
   * @private
   */
  async _submitGeneratedTemplate(template, pattern) {
    try {
      logger.info({
        templateName: template.templateName,
        agentId: template.agentId
      }, 'Submitting AI-generated template for approval');

      // Submit via WABA Template Automation Service
      const submissionResult = await wabaTemplateAutomationService.submitTemplateForApproval({
        templateName: template.templateName,
        category: template.category,
        language: template.language || 'en',
        components: template.components,
        agentId: template.agentId
      });

      if (submissionResult.success) {
        // Store additional context in database
        await this._storeGenerationContext(submissionResult.templateId, template, pattern);
      }

      return {
        success: submissionResult.success,
        submissionId: submissionResult.templateId,
        error: submissionResult.error
      };

    } catch (error) {
      logger.error({
        err: error,
        templateName: template.templateName
      }, 'Failed to submit generated template');

      return { success: false, error: error.message };
    }
  }

  /**
   * Store generation context for tracking
   * @private
   */
  async _storeGenerationContext(templateId, template, pattern) {
    try {
      // Note: waba_templates table doesn't have generation_context columns
      // This functionality would need to be added to the table schema
      // For now, we'll skip storing the generation context
      logger.info({ templateId, templateName: template.templateName }, 'Generation context stored (placeholder)');

      if (error) throw error;

    } catch (error) {
      logger.error({ err: error, templateId }, 'Failed to store generation context');
    }
  }

  /**
   * Check if agent is rate limited for template generation
   * @private
   */
  async _isRateLimited(agentId) {
    // Rate limiting disabled for scalability
    return false;
  }

  /**
   * Perform periodic pattern analysis
   * @private
   */
  async _performPeriodicAnalysis() {
    try {
      logger.info('Starting periodic template generation analysis');

      // Get all active agents
      const { data: agents, error } = await supabase
        .from('agents')
        .select('id')
        .eq('status', 'active');

      if (error) throw error;

      let totalGenerated = 0;

      for (const agent of agents) {
        try {
          const result = await this.analyzeAndGenerateTemplates(agent.id);
          if (result.success) {
            totalGenerated += result.templatesGenerated;
          }
        } catch (error) {
          logger.error({ err: error, agentId: agent.id }, 'Error in periodic analysis for agent');
        }
      }

      logger.info({ totalGenerated }, 'Periodic template generation analysis completed');

    } catch (error) {
      logger.error({ err: error }, 'Error in periodic template generation analysis');
    }
  }

  /**
   * Get generation statistics
   * @param {string} agentId - Optional agent ID filter
   * @returns {Promise<Object>} Generation statistics
   */
  async getGenerationStatistics(agentId = null) {
    try {
      let query = supabase
        .from('waba_templates')
        .select('*');

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data: generatedTemplates, error } = await query;

      if (error) throw error;

      const stats = {
        totalGenerated: generatedTemplates.length,
        byStatus: {},
        byCategory: {},
        byAgent: {},
        averageConfidence: 0,
        recentGenerations: 0
      };

      const recentThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      let totalConfidence = 0;

      generatedTemplates.forEach(template => {
        // By status
        stats.byStatus[template.status] = (stats.byStatus[template.status] || 0) + 1;

        // By category
        stats.byCategory[template.template_category] = (stats.byCategory[template.template_category] || 0) + 1;

        // By agent
        if (template.agent_id) {
          stats.byAgent[template.agent_id] = (stats.byAgent[template.agent_id] || 0) + 1;
        }

        // Confidence tracking
        if (template.ai_confidence_score) {
          totalConfidence += template.ai_confidence_score;
        }

        // Recent generations
        if (new Date(template.created_at) > recentThreshold) {
          stats.recentGenerations++;
        }
      });

      stats.averageConfidence = generatedTemplates.length > 0 ?
        totalConfidence / generatedTemplates.length : 0;

      return stats;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get generation statistics');
      return null;
    }
  }

  /**
   * Stop the service
   */
  stop() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    logger.info('AI Template Generation Service stopped');
  }
}

module.exports = new AITemplateGenerationService();
