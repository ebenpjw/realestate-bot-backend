const logger = require('../logger');
const supabase = require('../supabaseClient');
const multiTenantConfigService = require('./multiTenantConfigService');

/**
 * MULTI-WABA TEMPLATE MANAGEMENT SERVICE
 * 
 * Manages agent-specific templates with dynamic selection based on lead states.
 * Supports template variations to avoid robotic appearance and multi-tenant WABA configuration.
 * 
 * Features:
 * - Agent-specific template management
 * - Lead state-based template selection
 * - Template variations for natural messaging
 * - Weighted random selection
 * - Performance tracking and optimization
 * - WABA compliance management
 */
class MultiWABATemplateService {
  constructor() {
    // Template selection strategies
    this.selectionStrategies = {
      weighted_random: 'weighted_random',
      performance_based: 'performance_based',
      round_robin: 'round_robin',
      least_used: 'least_used'
    };

    // Default template selection strategy
    this.defaultStrategy = this.selectionStrategies.weighted_random;
  }

  /**
   * Get appropriate template for lead state and agent
   * @param {string} agentId - Agent UUID
   * @param {string} leadState - Current lead state
   * @param {number} sequenceStage - Follow-up sequence stage (1-4)
   * @param {Object} options - Selection options
   * @returns {Promise<Object>} Selected template with parameters
   */
  async getTemplateForLeadState(agentId, leadState, sequenceStage = 1, options = {}) {
    try {
      logger.debug({ 
        agentId, 
        leadState, 
        sequenceStage 
      }, 'Getting template for lead state');

      // Determine template category based on sequence stage
      const templateCategory = this._getTemplateCategoryForStage(sequenceStage);

      // Get available templates for this agent and lead state
      const availableTemplates = await this._getAvailableTemplates(
        agentId, 
        leadState, 
        templateCategory
      );

      if (!availableTemplates || availableTemplates.length === 0) {
        // Record missing template scenario for AI analysis
        await this.handleMissingTemplate(agentId, leadState, templateCategory);

        // Fallback to generic templates
        logger.warn({ agentId, leadState }, 'No specific templates found, using generic');
        return await this._getGenericTemplate(agentId, templateCategory);
      }

      // Select template using specified strategy
      const strategy = options.strategy || this.defaultStrategy;
      const selectedTemplate = await this._selectTemplate(availableTemplates, strategy);

      // Update usage statistics
      await this._updateTemplateUsage(selectedTemplate.id);

      logger.info({ 
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.template_name,
        variation: selectedTemplate.variation_number,
        strategy 
      }, 'Template selected successfully');

      return selectedTemplate;

    } catch (error) {
      logger.error({ err: error, agentId, leadState }, 'Error getting template for lead state');
      throw error;
    }
  }

  /**
   * Create new template for agent
   * @param {string} agentId - Agent UUID
   * @param {Object} templateData - Template configuration
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(agentId, templateData) {
    try {
      // Validate template data
      this._validateTemplateData(templateData);

      // Check if variation group exists and get next variation number
      const variationNumber = await this._getNextVariationNumber(
        agentId, 
        templateData.variation_group
      );

      const template = {
        agent_id: agentId,
        template_name: templateData.template_name,
        template_category: templateData.template_category,
        lead_state: templateData.lead_state,
        template_content: templateData.template_content,
        template_params: templateData.template_params || [],
        is_waba_template: templateData.is_waba_template || false,
        waba_template_id: templateData.waba_template_id || null,
        waba_template_name: templateData.waba_template_name || null,
        language_code: templateData.language_code || 'en',
        variation_group: templateData.variation_group,
        variation_number: variationNumber,
        usage_weight: templateData.usage_weight || 1.00,
        business_hours_only: templateData.business_hours_only !== false,
        timezone: templateData.timezone || 'Asia/Singapore',
        is_active: true,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('agent_follow_up_templates')
        .insert(template)
        .select()
        .single();

      if (error) throw error;

      logger.info({ 
        templateId: data.id,
        agentId,
        templateName: template.template_name 
      }, 'Template created successfully');

      return data;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error creating template');
      throw error;
    }
  }

  /**
   * Update template performance metrics
   * @param {string} templateId - Template UUID
   * @param {Object} metrics - Performance metrics
   * @returns {Promise<void>}
   */
  async updateTemplatePerformance(templateId, metrics) {
    try {
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (metrics.response_rate !== undefined) {
        updateData.response_rate = metrics.response_rate;
      }

      if (metrics.conversion_rate !== undefined) {
        updateData.conversion_rate = metrics.conversion_rate;
      }

      const { error } = await supabase
        .from('agent_follow_up_templates')
        .update(updateData)
        .eq('id', templateId);

      if (error) throw error;

      logger.debug({ templateId, metrics }, 'Template performance updated');

    } catch (error) {
      logger.error({ err: error, templateId }, 'Error updating template performance');
      throw error;
    }
  }

  /**
   * Get template variations for a specific group
   * @param {string} agentId - Agent UUID
   * @param {string} variationGroup - Variation group name
   * @returns {Promise<Array>} Template variations
   */
  async getTemplateVariations(agentId, variationGroup) {
    try {
      const { data, error } = await supabase
        .from('agent_follow_up_templates')
        .select('*')
        .eq('agent_id', agentId)
        .eq('variation_group', variationGroup)
        .eq('is_active', true)
        .order('variation_number');

      if (error) throw error;

      return data || [];

    } catch (error) {
      logger.error({ err: error, agentId, variationGroup }, 'Error getting template variations');
      return [];
    }
  }

  /**
   * Personalize template content with lead data
   * @param {Object} template - Template object
   * @param {Object} leadData - Lead information
   * @param {Object} contextData - Additional context
   * @returns {string} Personalized message content
   */
  personalizeTemplate(template, leadData, contextData = {}) {
    try {
      let content = template.template_content;

      // Basic personalization parameters
      const params = {
        name: leadData.full_name || 'there',
        first_name: this._getFirstName(leadData.full_name),
        budget: leadData.budget || 'your budget',
        location: leadData.location_preference || 'your preferred area',
        property_type: leadData.property_type || 'property',
        timeline: leadData.timeline || 'your timeline',
        ...contextData
      };

      // Replace template parameters
      for (const [key, value] of Object.entries(params)) {
        const regex = new RegExp(`{{${key}}}`, 'gi');
        content = content.replace(regex, value);
      }

      // Clean up any remaining unreplaced parameters
      content = content.replace(/{{[^}]+}}/g, '');

      return content.trim();

    } catch (error) {
      logger.error({ err: error, templateId: template.id }, 'Error personalizing template');
      return template.template_content;
    }
  }

  /**
   * Get available templates for agent and lead state
   * @private
   */
  async _getAvailableTemplates(agentId, leadState, templateCategory) {
    try {
      const { data, error } = await supabase
        .from('agent_follow_up_templates')
        .select('*')
        .eq('agent_id', agentId)
        .eq('lead_state', leadState)
        .eq('template_category', templateCategory)
        .eq('is_active', true)
        .order('usage_weight', { ascending: false });

      if (error) throw error;

      return data || [];

    } catch (error) {
      logger.error({ err: error, agentId, leadState }, 'Error getting available templates');
      return [];
    }
  }

  /**
   * Get generic template as fallback
   * @private
   */
  async _getGenericTemplate(agentId, templateCategory) {
    try {
      const { data, error } = await supabase
        .from('agent_follow_up_templates')
        .select('*')
        .eq('agent_id', agentId)
        .eq('lead_state', 'default')
        .eq('template_category', templateCategory)
        .eq('is_active', true)
        .order('usage_weight', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || this._getSystemDefaultTemplate(templateCategory);

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error getting generic template');
      return this._getSystemDefaultTemplate(templateCategory);
    }
  }

  /**
   * Select template using specified strategy
   * @private
   */
  async _selectTemplate(templates, strategy) {
    switch (strategy) {
      case this.selectionStrategies.weighted_random:
        return this._selectWeightedRandom(templates);
      
      case this.selectionStrategies.performance_based:
        return this._selectPerformanceBased(templates);
      
      case this.selectionStrategies.round_robin:
        return this._selectRoundRobin(templates);
      
      case this.selectionStrategies.least_used:
        return this._selectLeastUsed(templates);
      
      default:
        return this._selectWeightedRandom(templates);
    }
  }

  /**
   * Weighted random template selection
   * @private
   */
  _selectWeightedRandom(templates) {
    const totalWeight = templates.reduce((sum, template) => sum + template.usage_weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const template of templates) {
      currentWeight += template.usage_weight;
      if (random <= currentWeight) {
        return template;
      }
    }
    
    // Fallback to first template
    return templates[0];
  }

  /**
   * Performance-based template selection
   * @private
   */
  _selectPerformanceBased(templates) {
    // Sort by response rate, then conversion rate
    const sortedTemplates = templates.sort((a, b) => {
      const aScore = (a.response_rate || 0) * 0.6 + (a.conversion_rate || 0) * 0.4;
      const bScore = (b.response_rate || 0) * 0.6 + (b.conversion_rate || 0) * 0.4;
      return bScore - aScore;
    });

    return sortedTemplates[0];
  }

  /**
   * Round robin template selection
   * @private
   */
  _selectRoundRobin(templates) {
    // Select template with lowest usage count
    return templates.reduce((min, template) => 
      template.usage_count < min.usage_count ? template : min
    );
  }

  /**
   * Least used template selection
   * @private
   */
  _selectLeastUsed(templates) {
    return templates.reduce((min, template) => 
      template.usage_count < min.usage_count ? template : min
    );
  }

  /**
   * Get template category for sequence stage
   * @private
   */
  _getTemplateCategoryForStage(sequenceStage) {
    switch (sequenceStage) {
      case 1:
        return 'state_based'; // First follow-up uses state-specific templates
      case 2:
      case 3:
        return 'generic'; // Middle follow-ups use generic templates
      case 4:
        return 'final'; // Final follow-up uses final attempt templates
      default:
        return 'generic';
    }
  }

  /**
   * Update template usage statistics
   * @private
   */
  async _updateTemplateUsage(templateId) {
    try {
      const { error } = await supabase
        .from('agent_follow_up_templates')
        .update({
          usage_count: supabase.raw('usage_count + 1'),
          last_used_at: new Date().toISOString()
        })
        .eq('id', templateId);

      if (error) throw error;

    } catch (error) {
      logger.error({ err: error, templateId }, 'Error updating template usage');
    }
  }

  /**
   * Get next variation number for template group
   * @private
   */
  async _getNextVariationNumber(agentId, variationGroup) {
    try {
      const { data, error } = await supabase
        .from('agent_follow_up_templates')
        .select('variation_number')
        .eq('agent_id', agentId)
        .eq('variation_group', variationGroup)
        .order('variation_number', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ? data.variation_number + 1 : 1;

    } catch (error) {
      logger.error({ err: error, agentId, variationGroup }, 'Error getting next variation number');
      return 1;
    }
  }

  /**
   * Validate template data
   * @private
   */
  _validateTemplateData(templateData) {
    const required = ['template_name', 'template_category', 'lead_state', 'template_content'];
    
    for (const field of required) {
      if (!templateData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const validCategories = ['state_based', 'generic', 'final'];
    if (!validCategories.includes(templateData.template_category)) {
      throw new Error(`Invalid template category: ${templateData.template_category}`);
    }

    const validStates = [
      'need_family_discussion', 'still_looking', 'budget_concerns',
      'timing_not_right', 'interested_hesitant', 'ready_to_book', 'default'
    ];
    if (!validStates.includes(templateData.lead_state)) {
      throw new Error(`Invalid lead state: ${templateData.lead_state}`);
    }
  }

  /**
   * Get first name from full name
   * @private
   */
  _getFirstName(fullName) {
    if (!fullName) return 'there';
    return fullName.split(' ')[0];
  }

  /**
   * Get system default template
   * @private
   */
  _getSystemDefaultTemplate(templateCategory) {
    const defaultTemplates = {
      state_based: {
        id: 'system-default-state',
        template_content: 'Hey {{name}}, how are you doing? Just checking in regarding your property search.',
        template_category: 'state_based',
        lead_state: 'default'
      },
      generic: {
        id: 'system-default-generic',
        template_content: 'Hi {{name}}! Hope you\'re well. Just wanted to see how things are going with your property plans.',
        template_category: 'generic',
        lead_state: 'default'
      },
      final: {
        id: 'system-default-final',
        template_content: 'Hey {{name}}, this will be my last check-in regarding your property search. If you need any help in the future, feel free to reach out!',
        template_category: 'final',
        lead_state: 'default'
      }
    };

    return defaultTemplates[templateCategory] || defaultTemplates.generic;
  }

  /**
   * Handle missing templates by triggering AI generation
   * @param {string} agentId - Agent UUID
   * @param {string} leadState - Lead state that needs templates
   * @param {string} templateCategory - Template category needed
   * @returns {Promise<void>}
   */
  async handleMissingTemplate(agentId, leadState, templateCategory) {
    try {
      logger.info({
        agentId,
        leadState,
        templateCategory
      }, 'Handling missing template - triggering AI generation');

      // Record the missing template scenario for AI analysis
      await this._recordMissingTemplateScenario(agentId, leadState, templateCategory);

      // Note: AI template generation will pick this up in its periodic analysis
      // We don't trigger it immediately to avoid blocking the follow-up flow

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        leadState,
        templateCategory
      }, 'Error handling missing template');
    }
  }

  /**
   * Record missing template scenario for AI analysis
   * @private
   */
  async _recordMissingTemplateScenario(agentId, leadState, templateCategory) {
    try {
      const { error } = await supabase
        .from('missing_template_scenarios')
        .insert({
          agent_id: agentId,
          lead_state: leadState,
          template_category: templateCategory,
          occurrence_count: 1,
          last_occurrence: new Date().toISOString()
        })
        .onConflict('agent_id,lead_state,template_category')
        .merge({
          occurrence_count: supabase.raw('occurrence_count + 1'),
          last_occurrence: new Date().toISOString()
        });

      if (error && error.code !== '42P01') { // Ignore if table doesn't exist
        throw error;
      }
    } catch (error) {
      logger.error({ err: error }, 'Error recording missing template scenario');
    }
  }

  /**
   * Check if agent has required templates approved
   * @param {string} agentId - Agent UUID
   * @returns {Promise<Object>} Template coverage status
   */
  async checkTemplateCoverage(agentId) {
    try {
      // Get agent's approved templates
      const { data: approvedTemplates, error } = await supabase
        .from('waba_template_status')
        .select('template_name, template_category, status')
        .eq('agent_id', agentId)
        .eq('status', 'approved');

      if (error) throw error;

      // Define required template categories
      const requiredCategories = ['state_based', 'generic', 'final'];
      const coverage = {};

      requiredCategories.forEach(category => {
        const categoryTemplates = (approvedTemplates || []).filter(t =>
          t.template_category === category
        );

        coverage[category] = {
          count: categoryTemplates.length,
          hasTemplates: categoryTemplates.length > 0,
          templates: categoryTemplates.map(t => t.template_name)
        };
      });

      const overallCoverage = Object.values(coverage).every(c => c.hasTemplates);

      return {
        agentId,
        overallCoverage,
        categoryBreakdown: coverage,
        totalApprovedTemplates: (approvedTemplates || []).length,
        missingCategories: requiredCategories.filter(cat => !coverage[cat].hasTemplates)
      };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error checking template coverage');
      return {
        agentId,
        overallCoverage: false,
        error: error.message
      };
    }
  }
}

module.exports = new MultiWABATemplateService();
