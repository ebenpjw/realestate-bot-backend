const logger = require('../logger');
const databaseService = require('./databaseService');
const gupshupPartnerService = require('./gupshupPartnerService');

/**
 * Template Limit Manager
 * Manages the 250 template limit per WABA and implements intelligent cleanup strategies
 */
class TemplateLimitManager {
  constructor() {
    this.WABA_TEMPLATE_LIMIT = 250;
    this.WARNING_THRESHOLD = 200; // Warn when approaching limit
    this.CLEANUP_TARGET = 180; // Clean down to this number when limit hit
    
    this.cleanupStrategies = {
      UNUSED_TEMPLATES: 'unused_templates',
      LOW_PERFORMANCE: 'low_performance', 
      OLD_AI_GENERATED: 'old_ai_generated',
      DUPLICATE_VARIATIONS: 'duplicate_variations'
    };

    this.templatePriorities = {
      CORE_BUSINESS: 100,      // Welcome, appointment booking
      HIGH_PERFORMANCE: 80,    // Templates with >50% response rate
      RECENT_AI_GENERATED: 60, // AI templates from last 30 days
      STANDARD_FOLLOWUP: 40,   // Regular follow-up templates
      OLD_AI_GENERATED: 20,    // AI templates >90 days old
      UNUSED: 10               // Never used templates
    };
  }

  /**
   * Check template count for an agent and manage limits
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Limit status and actions taken
   */
  async checkAndManageTemplateLimits(agentId) {
    try {
      logger.debug({ agentId }, 'Checking template limits');

      // Get current template count
      const templateCount = await this._getTemplateCount(agentId);
      
      const status = {
        currentCount: templateCount,
        limit: this.WABA_TEMPLATE_LIMIT,
        warningThreshold: this.WARNING_THRESHOLD,
        isNearLimit: templateCount >= this.WARNING_THRESHOLD,
        isAtLimit: templateCount >= this.WABA_TEMPLATE_LIMIT,
        actionsRequired: [],
        actionsTaken: []
      };

      // Check if we need to take action
      if (status.isAtLimit) {
        logger.warn({ agentId, templateCount }, 'Template limit reached - initiating cleanup');
        const cleanupResult = await this._performEmergencyCleanup(agentId);
        status.actionsTaken = cleanupResult.actionsTaken;
        status.templatesRemoved = cleanupResult.templatesRemoved;
        status.currentCount = await this._getTemplateCount(agentId);
        
      } else if (status.isNearLimit) {
        logger.info({ agentId, templateCount }, 'Approaching template limit - recommending cleanup');
        status.actionsRequired = await this._getRecommendedActions(agentId);
      }

      return status;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error checking template limits');
      return {
        currentCount: 0,
        limit: this.WABA_TEMPLATE_LIMIT,
        error: error.message
      };
    }
  }

  /**
   * Perform emergency cleanup when limit is reached
   * @private
   */
  async _performEmergencyCleanup(agentId) {
    const actionsTaken = [];
    let templatesRemoved = 0;

    try {
      // Strategy 1: Remove unused templates (never used)
      const unusedResult = await this._removeUnusedTemplates(agentId);
      if (unusedResult.removed > 0) {
        actionsTaken.push(`Removed ${unusedResult.removed} unused templates`);
        templatesRemoved += unusedResult.removed;
      }

      // Check if we're still over limit
      const currentCount = await this._getTemplateCount(agentId);
      if (currentCount >= this.WABA_TEMPLATE_LIMIT) {
        
        // Strategy 2: Remove old AI-generated templates with low performance
        const oldAIResult = await this._removeOldAITemplates(agentId);
        if (oldAIResult.removed > 0) {
          actionsTaken.push(`Removed ${oldAIResult.removed} old AI templates`);
          templatesRemoved += oldAIResult.removed;
        }
      }

      // Check again
      const finalCount = await this._getTemplateCount(agentId);
      if (finalCount >= this.WABA_TEMPLATE_LIMIT) {
        
        // Strategy 3: Remove low-performing templates
        const lowPerfResult = await this._removeLowPerformingTemplates(agentId);
        if (lowPerfResult.removed > 0) {
          actionsTaken.push(`Removed ${lowPerfResult.removed} low-performing templates`);
          templatesRemoved += lowPerfResult.removed;
        }
      }

      logger.info({ 
        agentId, 
        templatesRemoved, 
        actionsTaken 
      }, 'Emergency template cleanup completed');

      return { actionsTaken, templatesRemoved };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error during emergency cleanup');
      return { actionsTaken, templatesRemoved, error: error.message };
    }
  }

  /**
   * Get current template count for agent
   * @private
   */
  async _getTemplateCount(agentId) {
    try {
      const { count, error } = await databaseService.supabase
        .from('waba_templates')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .eq('status', 'approved');

      if (error) throw error;
      return count || 0;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error getting template count');
      return 0;
    }
  }

  /**
   * Remove unused templates
   * @private
   */
  async _removeUnusedTemplates(agentId) {
    try {
      // Find templates that have never been used
      const { data: unusedTemplates, error } = await databaseService.supabase
        .from('waba_templates')
        .select('id, template_name, template_id')
        .eq('agent_id', agentId)
        .eq('status', 'approved')
        .or('usage_count.is.null,usage_count.eq.0')
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Older than 7 days
        .limit(20); // Remove max 20 at a time

      if (error) throw error;

      let removed = 0;
      for (const template of unusedTemplates || []) {
        try {
          await this._deleteTemplate(agentId, template);
          removed++;
        } catch (error) {
          logger.error({ err: error, templateId: template.id }, 'Error removing unused template');
        }
      }

      return { removed };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error removing unused templates');
      return { removed: 0 };
    }
  }

  /**
   * Remove old AI-generated templates
   * @private
   */
  async _removeOldAITemplates(agentId) {
    try {
      // Find old AI-generated templates with low usage
      const { data: oldAITemplates, error } = await databaseService.supabase
        .from('waba_templates')
        .select('id, template_name, template_id, usage_count')
        .eq('agent_id', agentId)
        .eq('status', 'approved')
        .eq('template_type', 'ai_generated')
        .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Older than 90 days
        .lt('usage_count', 5) // Used less than 5 times
        .order('usage_count', { ascending: true })
        .limit(15);

      if (error) throw error;

      let removed = 0;
      for (const template of oldAITemplates || []) {
        try {
          await this._deleteTemplate(agentId, template);
          removed++;
        } catch (error) {
          logger.error({ err: error, templateId: template.id }, 'Error removing old AI template');
        }
      }

      return { removed };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error removing old AI templates');
      return { removed: 0 };
    }
  }

  /**
   * Remove low-performing templates
   * @private
   */
  async _removeLowPerformingTemplates(agentId) {
    try {
      // Find templates with low response rates (but keep core business templates)
      const { data: lowPerfTemplates, error } = await databaseService.supabase
        .from('waba_templates')
        .select('id, template_name, template_id, usage_count, response_rate')
        .eq('agent_id', agentId)
        .eq('status', 'approved')
        .neq('template_category', 'core_business') // Don't remove core templates
        .lt('response_rate', 20) // Less than 20% response rate
        .gt('usage_count', 10) // But has been used enough to be statistically relevant
        .order('response_rate', { ascending: true })
        .limit(10);

      if (error) throw error;

      let removed = 0;
      for (const template of lowPerfTemplates || []) {
        try {
          await this._deleteTemplate(agentId, template);
          removed++;
        } catch (error) {
          logger.error({ err: error, templateId: template.id }, 'Error removing low-performing template');
        }
      }

      return { removed };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error removing low-performing templates');
      return { removed: 0 };
    }
  }

  /**
   * Delete a template from both database and Gupshup
   * @private
   */
  async _deleteTemplate(agentId, template) {
    try {
      // Delete from Gupshup first
      if (template.template_id) {
        try {
          await gupshupPartnerService.deleteTemplate(agentId, template.template_id);
        } catch (gupshupError) {
          logger.warn({ 
            err: gupshupError, 
            templateId: template.id 
          }, 'Failed to delete template from Gupshup - continuing with database deletion');
        }
      }

      // Delete from database
      const { error } = await databaseService.supabase
        .from('waba_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      logger.info({ 
        templateId: template.id, 
        templateName: template.template_name,
        agentId 
      }, 'Template deleted successfully');

    } catch (error) {
      logger.error({ err: error, templateId: template.id }, 'Error deleting template');
      throw error;
    }
  }

  /**
   * Get recommended cleanup actions
   * @private
   */
  async _getRecommendedActions(agentId) {
    const recommendations = [];

    try {
      // Check for unused templates
      const { count: unusedCount } = await databaseService.supabase
        .from('waba_templates')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .or('usage_count.is.null,usage_count.eq.0')
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (unusedCount > 0) {
        recommendations.push(`Remove ${unusedCount} unused templates`);
      }

      // Check for old AI templates
      const { count: oldAICount } = await databaseService.supabase
        .from('waba_templates')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .eq('template_type', 'ai_generated')
        .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .lt('usage_count', 5);

      if (oldAICount > 0) {
        recommendations.push(`Remove ${oldAICount} old AI-generated templates`);
      }

      return recommendations;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error getting recommendations');
      return ['Review templates manually'];
    }
  }

  /**
   * Get template usage analytics for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Template analytics
   */
  async getTemplateAnalytics(agentId) {
    try {
      const { data: templates, error } = await databaseService.supabase
        .from('waba_templates')
        .select('*')
        .eq('agent_id', agentId);

      if (error) throw error;

      const analytics = {
        total: templates.length,
        byStatus: {},
        byType: {},
        byUsage: {
          unused: 0,
          lowUsage: 0,
          mediumUsage: 0,
          highUsage: 0
        },
        byPerformance: {
          highPerforming: 0,
          mediumPerforming: 0,
          lowPerforming: 0,
          noData: 0
        },
        oldestTemplate: null,
        newestTemplate: null,
        averageUsage: 0
      };

      let totalUsage = 0;
      let oldestDate = new Date();
      let newestDate = new Date(0);

      templates.forEach(template => {
        // By status
        analytics.byStatus[template.status] = (analytics.byStatus[template.status] || 0) + 1;

        // By type
        const type = template.template_type || 'standard';
        analytics.byType[type] = (analytics.byType[type] || 0) + 1;

        // By usage
        const usage = template.usage_count || 0;
        totalUsage += usage;
        
        if (usage === 0) analytics.byUsage.unused++;
        else if (usage < 10) analytics.byUsage.lowUsage++;
        else if (usage < 50) analytics.byUsage.mediumUsage++;
        else analytics.byUsage.highUsage++;

        // By performance
        const responseRate = template.response_rate || 0;
        if (responseRate === 0) analytics.byPerformance.noData++;
        else if (responseRate >= 50) analytics.byPerformance.highPerforming++;
        else if (responseRate >= 20) analytics.byPerformance.mediumPerforming++;
        else analytics.byPerformance.lowPerforming++;

        // Date tracking
        const createdDate = new Date(template.created_at);
        if (createdDate < oldestDate) {
          oldestDate = createdDate;
          analytics.oldestTemplate = template.template_name;
        }
        if (createdDate > newestDate) {
          newestDate = createdDate;
          analytics.newestTemplate = template.template_name;
        }
      });

      analytics.averageUsage = templates.length > 0 ? totalUsage / templates.length : 0;

      return analytics;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error getting template analytics');
      return null;
    }
  }

  /**
   * Check if we can safely create a new template
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Safety check result
   */
  async canCreateNewTemplate(agentId) {
    try {
      const limitStatus = await this.checkAndManageTemplateLimits(agentId);
      
      return {
        canCreate: !limitStatus.isAtLimit,
        currentCount: limitStatus.currentCount,
        limit: limitStatus.limit,
        remainingSlots: limitStatus.limit - limitStatus.currentCount,
        recommendation: limitStatus.isNearLimit ? 
          'Consider cleaning up unused templates before creating new ones' : 
          'Safe to create new template'
      };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Error checking template creation safety');
      return {
        canCreate: false,
        error: error.message
      };
    }
  }
}

module.exports = new TemplateLimitManager();
