const logger = require('../logger');
const databaseService = require('./databaseService');
const config = require('../config');
const axios = require('axios');

/**
 * WABA Template Automation Service
 * 
 * Automates template submission to WABA via Gupshup Partner APIs
 * and ensures follow-ups only use approved templates
 */
class WABATemplateAutomationService {
  constructor() {
    this.gupshupPartnerBaseURL = 'https://api.gupshup.io/partner';
    this.partnerToken = null;
    this.templateCheckInterval = null;
    
    // Create axios instance for Partner API calls
    this.partnerClient = axios.create({
      baseURL: this.gupshupPartnerBaseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Initialize the template automation service
   */
  async initialize() {
    try {
      logger.info('Initializing WABA Template Automation Service');
      
      // Get partner token for API access
      await this._getPartnerToken();
      
      // Start periodic template status checking (every 30 minutes)
      this.templateCheckInterval = setInterval(async () => {
        await this._checkPendingTemplateStatus();
      }, 30 * 60 * 1000);
      
      logger.info('WABA Template Automation Service initialized successfully');
      
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize WABA Template Automation Service');
      throw error;
    }
  }

  /**
   * Get partner token for API authentication
   * @private
   */
  async _getPartnerToken() {
    try {
      const response = await axios.post(`${this.gupshupPartnerBaseURL}/account/login`, {
        email: config.GUPSHUP_PARTNER_EMAIL,
        password: config.GUPSHUP_PARTNER_PASSWORD
      });

      if (response.data && response.data.token) {
        this.partnerToken = response.data.token;
        this.partnerClient.defaults.headers['token'] = this.partnerToken;
        logger.info('Partner token obtained successfully');
      } else {
        throw new Error('Failed to obtain partner token');
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to get partner token');
      throw error;
    }
  }

  /**
   * Automatically submit template to WABA for approval
   * @param {Object} templateData - Template configuration
   * @returns {Promise<Object>} Submission result
   */
  async submitTemplateForApproval(templateData) {
    try {
      const {
        templateName,
        category,
        language = 'en',
        components,
        agentId = null
      } = templateData;

      logger.info({
        templateName,
        category,
        language,
        agentId
      }, 'Submitting template for WABA approval');

      // Get app ID (use agent-specific or default)
      const appId = agentId ? 
        await this._getAgentAppId(agentId) : 
        config.GUPSHUP_APP_ID;

      // Submit template via Partner API
      const response = await this.partnerClient.post(`/app/${appId}/templates`, {
        elementName: templateName,
        languageCode: language,
        category: category.toUpperCase(),
        components: components,
        // Add sample data for approval process
        sample: this._generateTemplateSamples(components)
      });

      if (response.data && response.data.status === 'success') {
        const templateId = response.data.template?.id;
        
        // Store template submission in database
        await this._storeTemplateSubmission({
          templateId,
          templateName,
          category,
          language,
          agentId,
          status: 'pending',
          submittedAt: new Date().toISOString(),
          components
        });

        logger.info({
          templateId,
          templateName,
          status: 'submitted'
        }, 'Template submitted successfully');

        return {
          success: true,
          templateId,
          status: 'pending',
          message: 'Template submitted for approval'
        };
      } else {
        throw new Error(`Template submission failed: ${response.data?.message || 'Unknown error'}`);
      }

    } catch (error) {
      logger.error({
        err: error,
        templateName: templateData.templateName
      }, 'Failed to submit template');

      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Check status of pending templates
   * @private
   */
  async _checkPendingTemplateStatus() {
    try {
      // Get all pending templates from database
      const { data: pendingTemplates, error } = await supabase
        .from('waba_template_status')
        .select('*')
        .eq('status', 'pending');

      if (error) {
        logger.error({ err: error }, 'Failed to fetch pending templates');
        return;
      }

      if (!pendingTemplates || pendingTemplates.length === 0) {
        return; // No pending templates
      }

      logger.info({ count: pendingTemplates.length }, 'Checking status of pending templates');

      for (const template of pendingTemplates) {
        await this._checkSingleTemplateStatus(template);
      }

    } catch (error) {
      logger.error({ err: error }, 'Error checking pending template status');
    }
  }

  /**
   * Check status of a single template
   * @private
   */
  async _checkSingleTemplateStatus(template) {
    try {
      const appId = template.agent_id ? 
        await this._getAgentAppId(template.agent_id) : 
        config.GUPSHUP_APP_ID;

      // Get template status from Gupshup
      const response = await this.partnerClient.get(`/app/${appId}/templates`);
      
      if (response.data && response.data.templates) {
        const gupshupTemplate = response.data.templates.find(t => 
          t.elementName === template.template_name && 
          t.languageCode === template.language_code
        );

        if (gupshupTemplate) {
          const newStatus = this._mapGupshupStatus(gupshupTemplate.status);
          
          if (newStatus !== template.status) {
            await this._updateTemplateStatus(template.id, newStatus, gupshupTemplate);
            
            logger.info({
              templateName: template.template_name,
              oldStatus: template.status,
              newStatus
            }, 'Template status updated');
          }
        }
      }

    } catch (error) {
      logger.error({
        err: error,
        templateId: template.id,
        templateName: template.template_name
      }, 'Failed to check template status');
    }
  }

  /**
   * Update template status in database
   * @private
   */
  async _updateTemplateStatus(templateId, status, gupshupData = null) {
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.template_id = gupshupData?.id; // Store Gupshup template ID
      } else if (status === 'rejected') {
        updateData.rejected_at = new Date().toISOString();
        updateData.rejection_reason = gupshupData?.rejectionReason || 'Template rejected by WhatsApp';
      }

      const { error } = await supabase
        .from('waba_template_status')
        .update(updateData)
        .eq('id', templateId);

      if (error) {
        throw error;
      }

      // If approved, enable for follow-up use
      if (status === 'approved') {
        await this._enableTemplateForFollowUp(templateId);
      }

    } catch (error) {
      logger.error({ err: error, templateId }, 'Failed to update template status');
      throw error;
    }
  }

  /**
   * Enable approved template for follow-up use
   * @private
   */
  async _enableTemplateForFollowUp(templateId) {
    try {
      // Update follow-up service configurations to include this template
      logger.info({ templateId }, 'Template approved - enabling for follow-up use');
      
      // You can add logic here to notify follow-up services
      // that a new template is available for use
      
    } catch (error) {
      logger.error({ err: error, templateId }, 'Failed to enable template for follow-up');
    }
  }

  /**
   * Get approved templates for follow-up use
   * @param {string} category - Template category (UTILITY, MARKETING, etc.)
   * @param {string} agentId - Optional agent ID for multi-tenant
   * @returns {Promise<Array>} Approved templates
   */
  async getApprovedTemplates(category = null, agentId = null) {
    try {
      let query = supabase
        .from('waba_template_status')
        .select('*')
        .eq('status', 'approved');

      if (category) {
        query = query.eq('template_category', category);
      }

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data: templates, error } = await query;

      if (error) {
        throw error;
      }

      logger.info({
        category,
        agentId,
        count: templates.length
      }, 'Retrieved approved templates');

      return templates;

    } catch (error) {
      logger.error({ err: error, category, agentId }, 'Failed to get approved templates');
      return [];
    }
  }

  /**
   * Validate if template is approved before sending
   * @param {string} templateName - Template name
   * @param {string} agentId - Optional agent ID
   * @returns {Promise<Object>} Validation result
   */
  async validateTemplateForSending(templateName, agentId = null) {
    try {
      let query = supabase
        .from('waba_template_status')
        .select('*')
        .eq('template_name', templateName)
        .eq('status', 'approved');

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data: templates, error } = await query.single();

      if (error || !templates) {
        return {
          valid: false,
          reason: 'Template not found or not approved',
          status: 'not_approved'
        };
      }

      return {
        valid: true,
        template: templates,
        templateId: templates.template_id,
        status: 'approved'
      };

    } catch (error) {
      logger.error({ err: error, templateName, agentId }, 'Failed to validate template');
      return {
        valid: false,
        reason: 'Validation error',
        status: 'error'
      };
    }
  }

  /**
   * Store template submission in database
   * @private
   */
  async _storeTemplateSubmission(templateData) {
    try {
      const { error } = await supabase
        .from('waba_template_status')
        .insert({
          template_name: templateData.templateName,
          template_category: templateData.category,
          language_code: templateData.language,
          agent_id: templateData.agentId,
          status: templateData.status,
          template_components: templateData.components,
          created_at: templateData.submittedAt,
          updated_at: templateData.submittedAt
        });

      if (error) {
        throw error;
      }

    } catch (error) {
      logger.error({ err: error }, 'Failed to store template submission');
      throw error;
    }
  }

  /**
   * Generate sample data for template approval
   * @private
   */
  _generateTemplateSamples(components) {
    const samples = [];
    
    components.forEach(component => {
      if (component.type === 'BODY' && component.text) {
        // Extract parameter placeholders and generate samples
        const paramMatches = component.text.match(/\{\{\d+\}\}/g);
        if (paramMatches) {
          const sampleParams = paramMatches.map((param, index) => {
            // Generate appropriate sample based on context
            return this._generateSampleParameter(param, index);
          });
          samples.push(sampleParams);
        }
      }
    });

    return samples;
  }

  /**
   * Generate sample parameter value
   * @private
   */
  _generateSampleParameter(param, index) {
    const sampleValues = [
      'John Doe',           // {{1}} - Name
      'Orchard Road',       // {{2}} - Location
      '5',                  // {{3}} - Count
      '850,000',           // {{4}} - Price
      'increased',         // {{5}} - Direction
      '3.2',               // {{6}} - Percentage
      'Great opportunity'   // {{7}} - Description
    ];
    
    return sampleValues[index] || `Sample ${index + 1}`;
  }

  /**
   * Map Gupshup status to internal status
   * @private
   */
  _mapGupshupStatus(gupshupStatus) {
    const statusMap = {
      'APPROVED': 'approved',
      'REJECTED': 'rejected',
      'PENDING': 'pending',
      'IN_APPEAL': 'pending',
      'PAUSED': 'disabled'
    };
    
    return statusMap[gupshupStatus] || 'pending';
  }

  /**
   * Get agent app ID for multi-tenant setup
   * @private
   */
  async _getAgentAppId(agentId) {
    try {
      const { data: agent, error } = await supabase
        .from('agents')
        .select('gupshup_app_id')
        .eq('id', agentId)
        .single();

      if (error || !agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      return agent.gupshup_app_id;
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get agent app ID');
      throw error;
    }
  }

  /**
   * Stop the service
   */
  stop() {
    if (this.templateCheckInterval) {
      clearInterval(this.templateCheckInterval);
      this.templateCheckInterval = null;
    }
    logger.info('WABA Template Automation Service stopped');
  }
}

module.exports = new WABATemplateAutomationService();
