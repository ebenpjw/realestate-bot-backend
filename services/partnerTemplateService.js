const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');
const databaseService = require('./databaseService');
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
    this.encryptionKey = config.REFRESH_TOKEN_ENCRYPTION_KEY;

    // Start template status check if enabled
    if (config.TEMPLATE_STATUS_CHECK_ENABLED !== false) {
      this.startTemplateStatusCheck();
    }

    logger.info('Partner Template Service initialized');
  }

  /**
   * Decrypt encrypted data (same logic as multiTenantConfigService)
   * @private
   */
  _decrypt(encryptedText) {
    if (!encryptedText) return null;

    // Handle test mode - if it's a simple test string, return as-is
    if (process.env.TESTING_MODE === 'true' && encryptedText.startsWith('test_')) {
      return encryptedText.replace('test_encrypted_key_', 'test_api_key_');
    }

    // Handle simple base64 encoding (new format)
    if (encryptedText.startsWith('enc_')) {
      const encoded = encryptedText.replace('enc_', '');
      return Buffer.from(encoded, 'base64').toString('utf8');
    }

    // Handle plain text (for backward compatibility)
    if (!encryptedText.includes(':')) {
      return encryptedText;
    }

    // Handle old GCM encryption format - for now, just return as-is for compatibility
    // TODO: Implement proper GCM decryption when needed
    return encryptedText;
  }

  /**
   * Get agent WABA configuration directly (to avoid circular dependency)
   * @private
   */
  async _getAgentWABAConfig(agentId) {
    try {
      // Fetch agent data directly from database
      const { data: agent, error } = await databaseService.supabase
        .from('agents')
        .select('waba_phone_number, gupshup_api_key_encrypted, gupshup_app_id, waba_display_name, full_name, bot_name')
        .eq('id', agentId)
        .eq('status', 'active')
        .single();

      if (error || !agent) {
        throw new Error(`Agent not found or inactive: ${agentId}`);
      }

      if (!agent.waba_phone_number || !agent.gupshup_api_key_encrypted) {
        throw new Error(`Agent ${agentId} does not have complete WABA configuration`);
      }

      // Decrypt API key
      const apiKey = this._decrypt(agent.gupshup_api_key_encrypted);

      return {
        wabaNumber: agent.waba_phone_number,
        apiKey: apiKey,
        appId: agent.gupshup_app_id,
        displayName: agent.waba_display_name || agent.full_name,
        botName: agent.bot_name || 'Doro'
      };

    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to get agent WABA configuration');
      throw error;
    }
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
      const { data: pendingTemplates, error } = await databaseService.supabase
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
          const { data: agent } = await databaseService.supabase
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
      const token = await gupshupPartnerService.getAppAccessToken(appId);

      const response = await axios.get(`${this.baseURL}/app/${appId}/templates`, {
        headers: {
          'Authorization': token
        }
      });
      
      if (!response.data || response.data.status !== 'success' || !Array.isArray(response.data.templates)) {
        throw new Error('Invalid response from get templates');
      }

      // Find the template in the response
      const template = response.data.templates.find(t => t.id === templateId);
      
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
      
      const { error } = await databaseService.supabase
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
   * @param {Array} params.templateButtons - Template buttons (optional)
   * @param {string} params.languageCode - Language code (default: en)
   * @param {string} params.templateType - Template type (standard, welcome, followup, reminder)
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(params) {
    try {
      // Get agent app ID
      const { data: agent, error: agentError } = await databaseService.supabase
        .from('agents')
        .select('gupshup_app_id, full_name')
        .eq('id', params.agentId)
        .single();
      
      if (agentError || !agent || !agent.gupshup_app_id) {
        throw new Error(`Agent not found or has no app ID: ${params.agentId}`);
      }
      
      // Prepare template data
      const hasButtons = params.templateButtons && params.templateButtons.length > 0;
      const templateData = {
        template_name: params.templateName,
        template_category: params.templateCategory || 'UTILITY',
        template_content: params.templateContent,
        template_params: params.templateParams || [],
        template_buttons: hasButtons ? JSON.stringify(params.templateButtons) : null,
        language_code: params.languageCode || 'en',
        // According to Gupshup API docs, templateType is always 'TEXT' even for button templates
        // The buttons are added via the 'buttons' parameter, not by changing the template type
        template_type: 'TEXT',
        agent_id: params.agentId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Insert template into database
      const { data: insertedTemplate, error: insertError } = await databaseService.supabase
        .from('waba_templates')
        .insert(templateData)
        .select()
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      // Submit template to Gupshup Partner API using agent's WABA credentials
      // Get agent's decrypted API key
      const agentConfig = await this._getAgentWABAConfig(templateData.agent_id);

      if (!agentConfig.apiKey) {
        throw new Error('Agent does not have WABA API key configured');
      }

      // Create template using agent's API key and Partner API endpoint
      // According to Gupshup Partner API docs, ALL templates (including button templates) use form data
      const formData = new URLSearchParams();
      formData.append('elementName', templateData.template_name);
      formData.append('languageCode', templateData.language_code);
      formData.append('category', templateData.template_category);
      formData.append('content', templateData.template_content);
      formData.append('vertical', 'Real Estate');
      formData.append('templateType', 'TEXT'); // Always TEXT, even for button templates
      formData.append('example', templateData.template_content);
      formData.append('enableSample', 'true'); // Required parameter
      formData.append('allowTemplateCategoryChange', 'false');

      // Add buttons if present - this is the correct format according to API docs
      if (hasButtons && params.templateButtons.length > 0) {
        const buttonsArray = params.templateButtons.map(button => {
          const buttonObj = {
            type: button.type,
            text: button.text
          };

          // Add type-specific properties
          if (button.type === 'URL' && button.url) {
            buttonObj.url = button.url;
            // Add example if URL has variables
            if (button.url.includes('{{')) {
              buttonObj.example = [button.url.replace(/\{\{\d+\}\}/g, 'example')];
            }
          } else if (button.type === 'PHONE_NUMBER' && button.phoneNumber) {
            buttonObj.phone_number = button.phoneNumber;
          }

          return buttonObj;
        });

        formData.append('buttons', JSON.stringify(buttonsArray));

        logger.info({
          templateName: templateData.template_name,
          buttonCount: buttonsArray.length,
          buttons: buttonsArray
        }, 'Creating template with buttons using correct API format');
      }

      const response = await axios.post(
        `${this.baseURL}/app/${agent.gupshup_app_id}/templates`,
        formData,
        {
          headers: {
            'Authorization': agentConfig.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      return await this._handleTemplateResponse(response, insertedTemplate, params);
      
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
   * Handle template creation response from Gupshup
   * @private
   */
  async _handleTemplateResponse(response, insertedTemplate, params) {
    if (!response.data || response.data.status !== 'success' || !response.data.template || !response.data.template.id) {
      throw new Error(`Template creation failed: ${response.data?.message || 'Invalid response'}`);
    }

    // Update template with Gupshup template ID
    const { error: updateError } = await databaseService.supabase
      .from('waba_templates')
      .update({
        template_id: response.data.template.id,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', insertedTemplate.id);

    if (updateError) {
      throw updateError;
    }

    logger.info({
      templateId: response.data.template.id,
      dbTemplateId: insertedTemplate.id,
      agentId: params.agentId,
      templateName: params.templateName
    }, 'Template created and submitted successfully');

    return {
      ...insertedTemplate,
      template_id: response.data.template.id,
      status: 'submitted',
      submitted_at: new Date().toISOString()
    };
  }

  /**
   * Get templates for an agent from database
   * @param {string} agentId - Agent ID
   * @param {string} status - Filter by status (optional)
   * @returns {Promise<Array>} Templates
   */
  async getAgentTemplates(agentId, status = null) {
    try {
      let query = databaseService.supabase
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

      return templates || [];

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        status
      }, 'Failed to get agent templates');

      throw error;
    }
  }

  /**
   * Get live templates directly from Gupshup Partner API
   * @param {string} agentId - Agent ID
   * @returns {Promise<Array>} Live templates from Gupshup
   */
  async getLiveAgentTemplates(agentId) {
    try {
      // Validate agentId
      if (!agentId || agentId === 'undefined' || agentId === 'null') {
        logger.warn({ agentId }, 'Invalid agent ID provided');
        return [];
      }

      // Get agent app ID
      const { data: agent, error: agentError } = await databaseService.supabase
        .from('agents')
        .select('gupshup_app_id, full_name')
        .eq('id', agentId)
        .single();

      if (agentError || !agent || !agent.gupshup_app_id) {
        logger.warn({ agentId, agentError }, 'Agent not found or has no app ID');
        return [];
      }

      // Get Partner App Token (required for app-specific operations like templates)
      const token = await gupshupPartnerService.getAppAccessToken(agent.gupshup_app_id);

      logger.info({
        agentId,
        appId: agent.gupshup_app_id,
        agentName: agent.full_name
      }, 'Fetching live templates from Gupshup Partner API');

      // Fetch templates directly from Gupshup Partner API
      const response = await axios.get(`${this.baseURL}/app/${agent.gupshup_app_id}/templates`, {
        headers: {
          'Authorization': token
        }
      });

      logger.info({
        agentId,
        appId: agent.gupshup_app_id,
        responseStatus: response.status,
        responseDataType: typeof response.data,
        responseDataLength: Array.isArray(response.data) ? response.data.length : 'not array',
        rawResponseData: response.data
      }, 'Gupshup templates API response received');

      if (!response.data) {
        logger.warn({ agentId, appId: agent.gupshup_app_id }, 'No data in Gupshup templates API response');
        return [];
      }

      // Handle response format according to official Gupshup Partner API documentation
      // Expected format: { "status": "success", "templates": [...] }
      let templatesArray = [];

      if (response.data && response.data.status === 'success' && Array.isArray(response.data.templates)) {
        templatesArray = response.data.templates;
      } else if (response.data && Array.isArray(response.data.templates)) {
        // Fallback: templates array exists but status might be missing
        templatesArray = response.data.templates;
      } else if (Array.isArray(response.data)) {
        // Fallback: direct array (legacy format)
        templatesArray = response.data;
      } else {
        logger.warn({
          agentId,
          appId: agent.gupshup_app_id,
          responseData: response.data,
          responseStatus: response.data?.status
        }, 'Unexpected response format from Gupshup templates API');
        return [];
      }

      // Transform Gupshup Partner API template format to our format
      // Based on official API documentation: https://docs.gupshup.io/reference/get_partner-app-appid-templates-1
      const templates = templatesArray.map(template => ({
        id: template.id,
        template_name: template.elementName,
        template_category: template.category,
        status: template.status,
        language_code: template.languageCode,
        template_content: template.data || '',
        created_at: template.createdOn ? new Date(template.createdOn).toISOString() : new Date().toISOString(),
        updated_at: template.modifiedOn ? new Date(template.modifiedOn).toISOString() : new Date().toISOString(),
        agent_id: agentId,
        template_id: template.id,
        vertical: 'Real Estate',
        template_type: template.templateType || 'TEXT',
        app_id: template.appId,
        external_id: template.externalId,
        namespace: template.namespace,
        waba_id: template.wabaId,
        quality: template.quality,
        button_supported: template.buttonSupported
      }));

      logger.info({
        agentId,
        appId: agent.gupshup_app_id,
        templateCount: templates.length,
        templates: templates.map(t => ({ name: t.template_name, status: t.status, category: t.template_category }))
      }, 'Live templates fetched and transformed from Gupshup Partner API');

      return templates;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        errorMessage: error.message,
        errorResponse: error.response?.data
      }, 'Failed to get live agent templates from Gupshup');

      // Return empty array instead of throwing to prevent breaking the overview
      return [];
    }
  }

  /**
   * Test method to directly fetch templates for the known DoroSmartGuide app
   * @returns {Promise<Array>} Live templates from Gupshup
   */
  async testFetchDoroTemplates() {
    try {
      const appId = '74099ef2-87bf-47ac-b104-b6c1e550c8ad'; // DoroSmartGuide app ID

      // Get Partner App Token (required for app-specific operations like templates)
      const token = await gupshupPartnerService.getAppAccessToken(appId);

      logger.info({ appId }, 'Testing direct template fetch for DoroSmartGuide');

      // Fetch templates directly from Gupshup Partner API
      const response = await axios.get(`${this.baseURL}/app/${appId}/templates`, {
        headers: {
          'Authorization': token
        }
      });

      logger.info({
        appId,
        responseStatus: response.status,
        responseDataType: typeof response.data,
        responseDataLength: Array.isArray(response.data) ? response.data.length : 'not array',
        rawResponseData: response.data
      }, 'Direct DoroSmartGuide templates API response');

      return response.data;

    } catch (error) {
      logger.error({
        err: error,
        errorMessage: error.message,
        errorResponse: error.response?.data
      }, 'Failed to test fetch Doro templates');

      return [];
    }
  }
}

module.exports = new PartnerTemplateService();
