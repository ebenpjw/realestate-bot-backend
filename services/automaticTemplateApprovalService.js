const logger = require('../logger');
const databaseService = require('./databaseService');
const config = require('../config');
const axios = require('axios');
const wabaTemplateAutomationService = require('./wabaTemplateAutomationService');
const multiTenantConfigService = require('./multiTenantConfigService');
const supabase = databaseService.supabase;

/**
 * DYNAMIC TEMPLATE APPROVAL SERVICE
 *
 * Manages template creation and approval for the appointment-setting bot.
 * Includes core templates for common appointment-setting scenarios plus
 * dynamic template creation based on AI analysis of conversation patterns.
 *
 * Features:
 * - Core templates for common appointment-setting scenarios
 * - Dynamic template creation based on AI analysis
 * - Context-aware template generation
 * - Automatic template approval workflow
 * - Template performance tracking
 */
class AutomaticTemplateApprovalService {
  constructor() {
    // Core templates for appointment-setting scenarios
    this.CORE_TEMPLATES = {
      WELCOME_INITIAL_CONTACT: {
        name: 'welcome_initial_contact',
        category: 'UTILITY',
        priority: 'high',
        description: 'Welcome message for new leads',
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, thanks for leaving your contact regarding {{2}}! 😊\n\nJust checking in to see what caught your eye or what you\'re exploring.\n\nFeel free to let me know, I\'ll do my best to help!'
          }
        ]
      },
      FAMILY_DISCUSSION_FOLLOWUP: {
        name: 'family_discussion_followup',
        category: 'UTILITY',
        priority: 'high',
        description: 'Follow-up for leads discussing with family/partner',
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, hope you\'re doing well!\n\nHave you had a chance to discuss {{2}} with your family/partner?\n\nI\'m here whenever you\'re ready to explore further! 😊'
          }
        ]
      },
      TIMING_FOLLOWUP: {
        name: 'timing_followup',
        category: 'UTILITY',
        priority: 'high',
        description: 'Follow-up for leads with timing concerns',
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, no worries about the timing!\n\nI\'ll check back with you in {{2}} as mentioned. In the meantime, feel free to reach out if anything changes or if you have questions about {{3}}!'
          }
        ]
      },
      GENERAL_FOLLOWUP: {
        name: 'general_followup',
        category: 'UTILITY',
        priority: 'high',
        description: 'General follow-up for non-responsive leads',
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, just a gentle follow-up on {{2}}!\n\nI know you\'re probably busy, but wanted to see if you had any questions or if there\'s anything specific I can help you with regarding your property search? 😊'
          }
        ]
      },
      CALLBACK_SCHEDULE_FOLLOWUP: {
        name: 'callback_schedule_followup',
        category: 'UTILITY',
        priority: 'high',
        description: 'Follow-up for leads who said they\'d get back',
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, hope you\'re well!\n\nYou mentioned you\'d get back to me about {{2}}. Just wanted to check if you\'ve had time to think it through or if you need any additional information?\n\nHappy to help! 😊'
          }
        ]
      },
      APPOINTMENT_REMINDER: {
        name: 'appointment_reminder',
        category: 'UTILITY',
        priority: 'medium',
        description: 'Reminder for scheduled appointments',
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, just a friendly reminder about our {{2}} appointment tomorrow at {{3}}!\n\nLooking forward to discussing {{4}} with you. See you then! 😊'
          }
        ]
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
   * Check and ensure agent has core templates, plus process pending approvals
   * @private
   */
  async _checkAgentTemplateApproval(agent) {
    try {
      logger.debug({ agentId: agent.id, agentName: agent.full_name }, 'Checking agent template approval');

      // Get agent's current approved templates
      const approvedTemplates = await this._getAgentApprovedTemplates(agent.id);

      // Check for missing core templates
      const missingCoreTemplates = await this._identifyMissingCoreTemplates(agent.id, approvedTemplates);

      // Submit missing core templates
      let coreTemplatesSubmitted = 0;
      if (missingCoreTemplates.length > 0) {
        const submissionResults = await this._submitMissingTemplates(agent, missingCoreTemplates);
        coreTemplatesSubmitted = submissionResults.submitted;
      }

      // Check status of pending templates with Gupshup
      const pendingTemplates = await this._getAgentPendingTemplates(agent.id);
      let templatesUpdated = 0;
      for (const template of pendingTemplates) {
        const statusUpdated = await this._checkAndUpdateTemplateStatus(template);
        if (statusUpdated) templatesUpdated++;
      }

      return {
        agentId: agent.id,
        agentName: agent.full_name,
        coreTemplatesSubmitted,
        templatesChecked: pendingTemplates.length,
        templatesUpdated,
        missingCoreTemplates: missingCoreTemplates.map(t => t.name),
        status: coreTemplatesSubmitted > 0 ? 'core_templates_submitted' : 'status_checked'
      };

    } catch (error) {
      logger.error({ err: error, agentId: agent.id }, 'Failed to check agent template approval');
      return {
        agentId: agent.id,
        agentName: agent.full_name,
        coreTemplatesSubmitted: 0,
        templatesChecked: 0,
        templatesUpdated: 0,
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
        .from('waba_templates')
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
   * Identify missing core templates for an agent
   * @private
   */
  async _identifyMissingCoreTemplates(agentId, approvedTemplates) {
    const approvedTemplateNames = new Set(approvedTemplates.map(t => t.template_name));
    const missingTemplates = [];

    for (const [key, template] of Object.entries(this.CORE_TEMPLATES)) {
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
   * Get agent's pending templates that need status updates
   * @private
   */
  async _getAgentPendingTemplates(agentId) {
    try {
      const { data: pendingTemplates, error } = await supabase
        .from('waba_templates')
        .select('*')
        .eq('agent_id', agentId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return pendingTemplates || [];
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get agent pending templates');
      return [];
    }
  }

  /**
   * Check and update template status with Gupshup
   * @private
   */
  async _checkAndUpdateTemplateStatus(template) {
    try {
      // Use the existing template status checking service
      const statusResult = await wabaTemplateAutomationService._checkSingleTemplateStatus(template);
      return statusResult; // Returns true if status was updated
    } catch (error) {
      logger.error({
        err: error,
        templateId: template.id,
        templateName: template.template_name
      }, 'Failed to check template status');
      return false;
    }
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
    // For core templates, use the predefined components
    if (this.CORE_TEMPLATES[template.key]) {
      return {
        components: this.CORE_TEMPLATES[template.key].components
      };
    }

    // For dynamic templates (AI-generated), this would be handled by AI service
    // For now, return a generic fallback
    return {
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
        .from('waba_templates')
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
        .from('waba_templates')
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
        .from('waba_templates')
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
