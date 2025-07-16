const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');
const logger = require('../logger');
const { supabase } = require('../database/supabaseClient');
const gupshupPartnerService = require('./gupshupPartnerService');

/**
 * Partner Template Service
 * Handles template management through Gupshup Partner API
 * 
 * Key Features:
 * - Template creation and submission
 * - Template approval tracking
 * - Template status management
 * - Template analytics
 */
class PartnerTemplateService {
  constructor() {
    this.baseURL = 'https://partner.gupshup.io/partner';
    this.templateCheckInterval = null;
    
    // Start template status check if enabled
    if (config.TEMPLATE_STATUS_CHECK_ENABLED !== false) {
      this.startTemplateStatusCheck();
    }
    
    logger.info('Partner Template Service initialized');
  }

  /**
   * Start periodic template status check
   */
  startTemplateStatusCheck() {
    // Check template status every 30 minutes
    const checkIntervalMs = 30 * 60 * 1000;
    
    this.templateCheckInterval = setInterval(() => {
      this.checkPendingTemplates().catch(err => {
        logger.error({ err }, 'Error checking pending templates');
      });
    }, checkIntervalMs);
    
    logger.info({ checkIntervalMs }, 'Template status check scheduled');
  }

  /**
   * Stop template status check
   */
  stopTemplateStatusCheck() {
    if (this.templateCheckInterval) {
      clearInterval(this.templateCheckInterval);
      this.templateCheckInterval = null;
      logger.info('Template status check stopped');
    }
  }

  /**
   * Check status of pending templates
   */
  async checkPendingTemplates() {
    try {
      // Get all pending templates
      const { data: pendingTemplates, error } = await supabase
        .from('waba_templates')
        .select('id, agent_id, template_id, template_name, submitted_at')
        .eq('status', 'submitted')
        .is('approved_at', null)
        .is('rejected_at', null);
      
      if (error) {
        throw error;
      }
      
      logger.info({ count: pendingTemplates.length }, 'Checking pending templates');
      
      // Process each pending template
      for (const template of pendingTemplates) {
        try {
          // Get agent app ID
          const { data: agent } = await supabase
            .from('agents')
            .select('gupshup_app_id')
            .eq('id', template.agent_id)
            .single();
          
          if (!agent || !agent.gupshup_app_id) {
            logger.warn({ templateId: template.id, agentId: template.agent_id }, 'Agent has no app ID');
            continue;
          }
          
          // Check template status
          await this.checkTemplateStatus({
            appId: agent.gupshup_app_id,
            templateId: template.template_id,
            dbTemplateId: template.id
          });
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (templateError) {
          logger.error({ 
            err: templateError, 
            templateId: template.id,
            agentId: template.agent_id 
          }, 'Error checking template status');
        }
      }
      
    } catch (error) {
      logger.error({ err: error }, 'Failed to check pending templates');
      throw error;
    }
  }

  /**
   * Check status of a specific template
   * @param {Object} params - Parameters
   * @param {string} params.appId - App ID
   * @param {string} params.templateId - Template ID
   * @param {string} params.dbTemplateId - Database template ID
   */
  async checkTemplateStatus({ appId, templateId, dbTemplateId }) {
    try {
      const token = await gupshupPartnerService.getPartnerToken();
      
      const response = await axios.get(`${this.baseURL}/app/${appId}/templates`, {
        headers: {
          'Authorization': token
        }
      });
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response from get templates');
      }
      
      // Find the template in the response
      const template = response.data.find(t => t.id === templateId);
      
      if (!template) {
        logger.warn({ appId, templateId }, 'Template not found in response');
        return;
      }
      
      // Update template status in database
      const updateData = {
        status: template.status.toLowerCase(),
        updated_at: new Date().toISOString()
      };
      
      if (template.status === 'APPROVED') {
        updateData.approved_at = new Date().toISOString();
      } else if (template.status === 'REJECTED') {
        updateData.rejected_at = new Date().toISOString();
        updateData.rejection_reason = template.reason || 'No reason provided';
      }
      
      const { error } = await supabase
        .from('waba_templates')
        .update(updateData)
        .eq('id', dbTemplateId);
      
      if (error) {
        throw error;
      }
      
      logger.info({
        templateId,
        dbTemplateId,
        status: template.status
      }, 'Template status updated');
      
    } catch (error) {
      logger.error({
        err: error,
        appId,
        templateId,
        dbTemplateId
      }, 'Failed to check template status');
      
      throw error;
    }
  }

  /**
   * Create and submit a new template
   * @param {Object} params - Template parameters
   * @param {string} params.agentId - Agent ID
   * @param {string} params.templateName - Template name
   * @param {string} params.templateCategory - Template category (MARKETING, UTILITY, AUTHENTICATION)
   * @param {string} params.templateContent - Template content
   * @param {Array} params.templateParams - Template parameters
   * @param {string} params.languageCode - Language code (default: en)
   * @param {string} params.templateType - Template type (standard, welcome, followup, reminder)
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(params) {
    try {
      // Get agent app ID
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('gupshup_app_id, full_name')
        .eq('id', params.agentId)
        .single();
      
      if (agentError || !agent || !agent.gupshup_app_id) {
        throw new Error(`Agent not found or has no app ID: ${params.agentId}`);
      }
      
      // Prepare template data
      const templateData = {
        template_name: params.templateName,
        template_category: params.templateCategory || 'UTILITY',
        template_content: params.templateContent,
        template_params: params.templateParams || [],
        language_code: params.languageCode || 'en',
        template_type: params.templateType || 'standard',
        agent_id: params.agentId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Insert template into database
      const { data: insertedTemplate, error: insertError } = await supabase
        .from('waba_templates')
        .insert(templateData)
        .select()
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      // Submit template to Gupshup Partner API
      const token = await gupshupPartnerService.getPartnerToken();
      
      // Format template for Gupshup API
      const formData = new FormData();
      formData.append('elementName', 'TEXT');
      formData.append('languageCode', templateData.language_code);
      formData.append('category', templateData.template_category);
      formData.append('templateName', templateData.template_name);
      formData.append('content', templateData.template_content);
      
      const response = await axios.post(
        `${this.baseURL}/app/${agent.gupshup_app_id}/template/text`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': token
          }
        }
      );
      
      if (!response.data || !response.data.id) {
        throw new Error('Invalid response from template creation');
      }
      
      // Update template with Gupshup template ID
      const { error: updateError } = await supabase
        .from('waba_templates')
        .update({
          template_id: response.data.id,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', insertedTemplate.id);
      
      if (updateError) {
        throw updateError;
      }
      
      logger.info({
        templateId: response.data.id,
        dbTemplateId: insertedTemplate.id,
        agentId: params.agentId,
        templateName: params.templateName
      }, 'Template created and submitted successfully');
      
      return {
        ...insertedTemplate,
        template_id: response.data.id,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error({
        err: error,
        agentId: params.agentId,
        templateName: params.templateName
      }, 'Failed to create template');
      
      throw error;
    }
  }

  /**
   * Get templates for an agent
   * @param {string} agentId - Agent ID
   * @param {string} status - Filter by status (optional)
   * @returns {Promise<Array>} Templates
   */
  async getAgentTemplates(agentId, status = null) {
    try {
      let query = supabase
        .from('waba_templates')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data: templates, error } = await query;
      
      if (error) {
        throw error;
      }
      
      return templates;
      
    } catch (error) {
      logger.error({
        err: error,
        agentId,
        status
      }, 'Failed to get agent templates');
      
      throw error;
    }
  }
}

module.exports = new PartnerTemplateService();
