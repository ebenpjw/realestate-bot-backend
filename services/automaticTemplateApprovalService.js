const logger = require('../logger');
const databaseService = require('./databaseService');
const config = require('../config');
const axios = require('axios');
const wabaTemplateAutomationService = require('./wabaTemplateAutomationService');
const multiTenantConfigService = require('./multiTenantConfigService');

/**
 * AUTOMATIC TEMPLATE APPROVAL SERVICE
 * 
 * Automatically checks if agents have all required templates approved in their WABA
 * and submits missing templates via Gupshup Partner API. Ensures all agents have
 * consistent template coverage for the intelligent follow-up system.
 * 
 * Features:
 * - Multi-agent template approval checking
 * - Automatic missing template submission
 * - Template synchronization across agents
 * - Approval status monitoring
 * - Integration with existing WABA automation
 */
class AutomaticTemplateApprovalService {
  constructor() {
    // Required templates for all agents
    this.REQUIRED_TEMPLATES = {
      // Core follow-up templates
      FOLLOW_UP_GENERIC: {
        name: 'follow_up_generic',
        category: 'UTILITY',
        priority: 'high',
        description: 'Generic follow-up message for leads'
      },
      FOLLOW_UP_FAMILY_DISCUSSION: {
        name: 'follow_up_family_discussion',
        category: 'UTILITY',
        priority: 'high',
        description: 'Follow-up for leads needing family discussion'
      },
      FOLLOW_UP_BUDGET_CONCERNS: {
        name: 'follow_up_budget_concerns',
        category: 'UTILITY',
        priority: 'high',
        description: 'Follow-up for leads with budget concerns'
      },
      FOLLOW_UP_TIMING_NOT_RIGHT: {
        name: 'follow_up_timing_not_right',
        category: 'UTILITY',
        priority: 'high',
        description: 'Follow-up for leads with timing issues'
      },
      
      // Appointment-related templates
      APPOINTMENT_REMINDER: {
        name: 'appointment_reminder',
        category: 'UTILITY',
        priority: 'medium',
        description: 'Appointment reminder message'
      },
      APPOINTMENT_CONFIRMATION: {
        name: 'appointment_confirmation',
        category: 'UTILITY',
        priority: 'medium',
        description: 'Appointment confirmation message'
      },
      
      // Property update templates
      PROPERTY_UPDATE_NOTIFICATION: {
        name: 'property_update_notification',
        category: 'MARKETING',
        priority: 'low',
        description: 'Property update notification'
      },
      MARKET_INSIGHT_SHARE: {
        name: 'market_insight_share',
        category: 'MARKETING',
        priority: 'low',
        description: 'Market insights sharing'
      }
    };

    // Service configuration
    this.checkInterval = null;
    this.isChecking = false;
    
    // Gupshup Partner API client
    this.partnerClient = axios.create({
      baseURL: 'https://api.gupshup.io/partner',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Initialize the automatic template approval service
   */
  async initialize() {
    try {
      logger.info('Initializing Automatic Template Approval Service');
      
      // Start periodic approval checking (every 2 hours)
      this.checkInterval = setInterval(async () => {
        await this._performPeriodicApprovalCheck();
      }, 2 * 60 * 60 * 1000);
      
      // Perform initial check
      await this._performPeriodicApprovalCheck();
      
      logger.info('Automatic Template Approval Service initialized successfully');
      
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize Automatic Template Approval Service');
      throw error;
    }
  }

  /**
   * Check and ensure all agents have required templates approved
   * @param {string} agentId - Optional specific agent ID to check
   * @returns {Promise<Object>} Check results
   */
  async checkAndEnsureTemplateApproval(agentId = null) {
    if (this.isChecking) {
      logger.warn('Template approval check already in progress');
      return { success: false, reason: 'check_in_progress' };
    }

    try {
      this.isChecking = true;
      logger.info({ agentId }, 'Starting template approval check');

      // Get agents to check
      const agents = await this._getAgentsToCheck(agentId);
      
      if (!agents || agents.length === 0) {
        logger.info('No agents found to check');
        return { success: true, agentsChecked: 0, templatesSubmitted: 0 };
      }

      const results = {
        agentsChecked: 0,
        templatesSubmitted: 0,
        agentResults: []
      };

      for (const agent of agents) {
        try {
          const agentResult = await this._checkAgentTemplateApproval(agent);
          results.agentResults.push(agentResult);
          results.agentsChecked++;
          results.templatesSubmitted += agentResult.templatesSubmitted;
        } catch (error) {
          logger.error({ 
            err: error, 
            agentId: agent.id,
            agentName: agent.full_name 
          }, 'Error checking agent template approval');
        }
      }

      logger.info({ 
        agentsChecked: results.agentsChecked,
        templatesSubmitted: results.templatesSubmitted 
      }, 'Template approval check completed');

      return { success: true, ...results };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to check template approval');
      return { success: false, error: error.message };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Get agents to check for template approval
   * @private
   */
  async _getAgentsToCheck(agentId = null) {
    try {
      let query = supabase
        .from('agents')
        .select('*')
        .eq('status', 'active')
        .not('gupshup_app_id', 'is', null); // Only agents with WABA setup

      if (agentId) {
        query = query.eq('id', agentId);
      }

      const { data: agents, error } = await query;

      if (error) throw error;

      return agents;
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get agents to check');
      return [];
    }
  }

  /**
   * Check template approval status for a specific agent
   * @private
   */
  async _checkAgentTemplateApproval(agent) {
    try {
      logger.debug({ agentId: agent.id, agentName: agent.full_name }, 'Checking agent template approval');

      // Get agent's current approved templates
      const approvedTemplates = await this._getAgentApprovedTemplates(agent.id);
      
      // Identify missing required templates
      const missingTemplates = await this._identifyMissingTemplates(agent.id, approvedTemplates);
      
      if (missingTemplates.length === 0) {
        logger.debug({ agentId: agent.id }, 'Agent has all required templates approved');
        return {
          agentId: agent.id,
          agentName: agent.full_name,
          templatesSubmitted: 0,
          missingTemplates: [],
          status: 'complete'
        };
      }

      // Submit missing templates
      const submissionResults = await this._submitMissingTemplates(agent, missingTemplates);
      
      return {
        agentId: agent.id,
        agentName: agent.full_name,
        templatesSubmitted: submissionResults.submitted,
        missingTemplates: missingTemplates.map(t => t.name),
        submissionResults,
        status: 'templates_submitted'
      };

    } catch (error) {
      logger.error({ err: error, agentId: agent.id }, 'Failed to check agent template approval');
      return {
        agentId: agent.id,
        agentName: agent.full_name,
        templatesSubmitted: 0,
        error: error.message,
        status: 'error'
      };
    }
  }

  /**
   * Get agent's currently approved templates
   * @private
   */
  async _getAgentApprovedTemplates(agentId) {
    try {
      const { data: templates, error } = await supabase
        .from('waba_template_status')
        .select('template_name, template_category, status')
        .eq('agent_id', agentId)
        .eq('status', 'approved');

      if (error) throw error;

      return templates || [];
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get agent approved templates');
      return [];
    }
  }

  /**
   * Identify missing required templates for an agent
   * @private
   */
  async _identifyMissingTemplates(agentId, approvedTemplates) {
    const approvedTemplateNames = new Set(approvedTemplates.map(t => t.template_name));
    const missingTemplates = [];

    for (const [key, template] of Object.entries(this.REQUIRED_TEMPLATES)) {
      if (!approvedTemplateNames.has(template.name)) {
        missingTemplates.push({
          key,
          ...template,
          agentId
        });
      }
    }

    // Sort by priority (high -> medium -> low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    missingTemplates.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    return missingTemplates;
  }

  /**
   * Submit missing templates for an agent
   * @private
   */
  async _submitMissingTemplates(agent, missingTemplates) {
    const results = {
      submitted: 0,
      failed: 0,
      submissions: []
    };

    for (const template of missingTemplates) {
      try {
        const templateDefinition = await this._generateTemplateDefinition(template, agent);
        
        const submissionResult = await wabaTemplateAutomationService.submitTemplateForApproval({
          templateName: template.name,
          category: template.category,
          language: 'en',
          components: templateDefinition.components,
          agentId: agent.id
        });

        if (submissionResult.success) {
          results.submitted++;
          logger.info({ 
            agentId: agent.id,
            templateName: template.name 
          }, 'Successfully submitted missing template');
        } else {
          results.failed++;
          logger.warn({ 
            agentId: agent.id,
            templateName: template.name,
            error: submissionResult.error 
          }, 'Failed to submit missing template');
        }

        results.submissions.push({
          templateName: template.name,
          success: submissionResult.success,
          error: submissionResult.error
        });

      } catch (error) {
        results.failed++;
        logger.error({ 
          err: error,
          agentId: agent.id,
          templateName: template.name 
        }, 'Error submitting missing template');
        
        results.submissions.push({
          templateName: template.name,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Generate template definition for submission
   * @private
   */
  async _generateTemplateDefinition(template, agent) {
    const templateDefinitions = {
      follow_up_generic: {
        components: [
          {
            type: 'BODY',
            text: 'Hey {{1}}, how are you doing? Just checking in regarding your property search. Anything I can help with?'
          }
        ]
      },
      follow_up_family_discussion: {
        components: [
          {
            type: 'BODY',
            text: 'Hey {{1}}, how are you doing? Just checking in regarding your property search. Have you had a chance to discuss with your family?'
          }
        ]
      },
      follow_up_budget_concerns: {
        components: [
          {
            type: 'BODY',
            text: 'Hey {{1}}, how are you doing? Just checking in regarding your property search. Any updates on your budget considerations?'
          }
        ]
      },
      follow_up_timing_not_right: {
        components: [
          {
            type: 'BODY',
            text: 'Hey {{1}}, how are you doing? Just checking in regarding your property search. Has the timing become more suitable for you?'
          }
        ]
      },
      appointment_reminder: {
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, this is a reminder about your property consultation scheduled for {{2}} at {{3}}. Looking forward to speaking with you!'
          }
        ]
      },
      appointment_confirmation: {
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, your property consultation has been confirmed for {{2}} at {{3}}. You will receive a Zoom link shortly. See you then!'
          }
        ]
      },
      property_update_notification: {
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, there\'s an update on {{2}} properties in {{3}} that might interest you. {{4}} units are now available with prices starting from ${{5}}.'
          }
        ]
      },
      market_insight_share: {
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, here\'s a market insight that might interest you: {{2}} in {{3}} area. This could impact your property decision. Let me know if you\'d like to discuss!'
          }
        ]
      }
    };

    return templateDefinitions[template.name] || {
      components: [
        {
          type: 'BODY',
          text: `Hi {{1}}, this is a message regarding your property inquiry. Please let me know if you need any assistance.`
        }
      ]
    };
  }

  /**
   * Perform periodic approval check for all agents
   * @private
   */
  async _performPeriodicApprovalCheck() {
    try {
      logger.info('Starting periodic template approval check');

      const result = await this.checkAndEnsureTemplateApproval();

      if (result.success) {
        logger.info({
          agentsChecked: result.agentsChecked,
          templatesSubmitted: result.templatesSubmitted
        }, 'Periodic template approval check completed');
      } else {
        logger.warn({ error: result.error }, 'Periodic template approval check failed');
      }

    } catch (error) {
      logger.error({ err: error }, 'Error in periodic template approval check');
    }
  }

  /**
   * Get template approval statistics
   * @param {string} agentId - Optional agent ID filter
   * @returns {Promise<Object>} Approval statistics
   */
  async getApprovalStatistics(agentId = null) {
    try {
      let query = supabase
        .from('waba_template_status')
        .select('agent_id, template_name, template_category, status, created_at');

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data: templates, error } = await query;

      if (error) throw error;

      const stats = {
        totalTemplates: templates.length,
        byStatus: {},
        byCategory: {},
        byAgent: {},
        requiredTemplatesCoverage: {},
        recentSubmissions: 0
      };

      const recentThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const requiredTemplateNames = Object.values(this.REQUIRED_TEMPLATES).map(t => t.name);

      templates.forEach(template => {
        // By status
        stats.byStatus[template.status] = (stats.byStatus[template.status] || 0) + 1;

        // By category
        stats.byCategory[template.template_category] = (stats.byCategory[template.template_category] || 0) + 1;

        // By agent
        if (template.agent_id) {
          if (!stats.byAgent[template.agent_id]) {
            stats.byAgent[template.agent_id] = { total: 0, approved: 0, pending: 0 };
          }
          stats.byAgent[template.agent_id].total++;
          if (template.status === 'approved') {
            stats.byAgent[template.agent_id].approved++;
          } else if (template.status === 'pending') {
            stats.byAgent[template.agent_id].pending++;
          }
        }

        // Required templates coverage
        if (requiredTemplateNames.includes(template.template_name)) {
          if (!stats.requiredTemplatesCoverage[template.template_name]) {
            stats.requiredTemplatesCoverage[template.template_name] = { total: 0, approved: 0 };
          }
          stats.requiredTemplatesCoverage[template.template_name].total++;
          if (template.status === 'approved') {
            stats.requiredTemplatesCoverage[template.template_name].approved++;
          }
        }

        // Recent submissions
        if (new Date(template.created_at) > recentThreshold) {
          stats.recentSubmissions++;
        }
      });

      return stats;

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get approval statistics');
      return null;
    }
  }

  /**
   * Sync templates across agents (copy approved templates from one agent to others)
   * @param {string} sourceAgentId - Agent ID to copy templates from
   * @param {Array} targetAgentIds - Agent IDs to copy templates to
   * @returns {Promise<Object>} Sync results
   */
  async syncTemplatesAcrossAgents(sourceAgentId, targetAgentIds = []) {
    try {
      logger.info({ sourceAgentId, targetAgentIds }, 'Starting template sync across agents');

      // Get source agent's approved templates
      const { data: sourceTemplates, error } = await supabase
        .from('waba_template_status')
        .select('*')
        .eq('agent_id', sourceAgentId)
        .eq('status', 'approved');

      if (error) throw error;

      if (!sourceTemplates || sourceTemplates.length === 0) {
        return { success: false, reason: 'no_source_templates' };
      }

      // If no target agents specified, get all other active agents
      if (targetAgentIds.length === 0) {
        const { data: allAgents, error: agentsError } = await supabase
          .from('agents')
          .select('id')
          .eq('status', 'active')
          .neq('id', sourceAgentId);

        if (agentsError) throw agentsError;
        targetAgentIds = allAgents.map(a => a.id);
      }

      const syncResults = {
        sourceAgentId,
        targetAgents: targetAgentIds.length,
        templatesProcessed: 0,
        templatesSubmitted: 0,
        agentResults: []
      };

      for (const targetAgentId of targetAgentIds) {
        try {
          const agentResult = await this._syncTemplatesForAgent(
            sourceTemplates,
            targetAgentId
          );

          syncResults.agentResults.push(agentResult);
          syncResults.templatesSubmitted += agentResult.templatesSubmitted;
        } catch (error) {
          logger.error({
            err: error,
            sourceAgentId,
            targetAgentId
          }, 'Error syncing templates for agent');
        }
      }

      syncResults.templatesProcessed = sourceTemplates.length;

      logger.info({
        sourceAgentId,
        targetAgents: syncResults.targetAgents,
        templatesSubmitted: syncResults.templatesSubmitted
      }, 'Template sync completed');

      return { success: true, ...syncResults };

    } catch (error) {
      logger.error({ err: error, sourceAgentId }, 'Failed to sync templates across agents');
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync templates for a specific target agent
   * @private
   */
  async _syncTemplatesForAgent(sourceTemplates, targetAgentId) {
    try {
      // Get target agent's existing templates
      const { data: existingTemplates, error } = await supabase
        .from('waba_template_status')
        .select('template_name')
        .eq('agent_id', targetAgentId);

      if (error) throw error;

      const existingTemplateNames = new Set(
        (existingTemplates || []).map(t => t.template_name)
      );

      let templatesSubmitted = 0;
      const submissionResults = [];

      for (const sourceTemplate of sourceTemplates) {
        // Skip if target agent already has this template
        if (existingTemplateNames.has(sourceTemplate.template_name)) {
          continue;
        }

        try {
          const submissionResult = await wabaTemplateAutomationService.submitTemplateForApproval({
            templateName: sourceTemplate.template_name,
            category: sourceTemplate.template_category,
            language: sourceTemplate.language_code || 'en',
            components: sourceTemplate.template_components,
            agentId: targetAgentId
          });

          if (submissionResult.success) {
            templatesSubmitted++;
          }

          submissionResults.push({
            templateName: sourceTemplate.template_name,
            success: submissionResult.success,
            error: submissionResult.error
          });

        } catch (error) {
          logger.error({
            err: error,
            templateName: sourceTemplate.template_name,
            targetAgentId
          }, 'Error submitting template for sync');
        }
      }

      return {
        targetAgentId,
        templatesSubmitted,
        submissionResults
      };

    } catch (error) {
      logger.error({ err: error, targetAgentId }, 'Failed to sync templates for agent');
      return {
        targetAgentId,
        templatesSubmitted: 0,
        error: error.message
      };
    }
  }

  /**
   * Stop the service
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Automatic Template Approval Service stopped');
  }
}

module.exports = new AutomaticTemplateApprovalService();
