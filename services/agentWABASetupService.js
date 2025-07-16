const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');
const { supabase } = require('../database/supabaseClient');
const gupshupPartnerService = require('./gupshupPartnerService');
const partnerTemplateService = require('./partnerTemplateService');

/**
 * Agent WABA Setup Service
 * Handles the setup and configuration of agent WABAs through Partner API
 * 
 * Key Features:
 * - Automated app creation for new agents
 * - Phone number registration
 * - Default template creation
 * - WABA configuration validation
 */
class AgentWABASetupService {
  constructor() {
    this.encryptionKey = config.REFRESH_TOKEN_ENCRYPTION_KEY;
    
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }
    
    logger.info('Agent WABA Setup Service initialized');
  }

  /**
   * Encrypt sensitive data
   * @private
   * @param {string} text - Text to encrypt
   * @returns {string} Encrypted text
   */
  _encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted;
  }

  /**
   * Setup WABA for a new agent
   * @param {Object} params - Setup parameters
   * @param {string} params.agentId - Agent ID
   * @param {string} params.phoneNumber - WABA phone number
   * @param {string} params.displayName - WABA display name
   * @param {string} params.botName - Bot name
   * @returns {Promise<Object>} Setup result
   */
  async setupAgentWABA(params) {
    try {
      // Get agent details
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', params.agentId)
        .single();
      
      if (agentError || !agent) {
        throw new Error(`Agent not found: ${params.agentId}`);
      }
      
      // Check if agent already has WABA setup
      if (agent.gupshup_app_id && agent.waba_phone_number) {
        logger.info({
          agentId: params.agentId,
          appId: agent.gupshup_app_id,
          phoneNumber: agent.waba_phone_number
        }, 'Agent already has WABA setup');
        
        return {
          success: true,
          message: 'Agent already has WABA setup',
          appId: agent.gupshup_app_id,
          phoneNumber: agent.waba_phone_number,
          displayName: agent.waba_display_name,
          botName: agent.bot_name
        };
      }
      
      // Create app name from agent name
      const appName = `${agent.full_name.replace(/[^a-zA-Z0-9]/g, '')}Bot`;
      
      // Create app through Partner API
      const app = await gupshupPartnerService.createApp({
        name: appName,
        templateMessaging: true
      });
      
      // Register phone number for app
      const phoneNumber = params.phoneNumber || agent.phone_number;
      if (!phoneNumber) {
        throw new Error('Phone number is required for WABA setup');
      }
      
      await gupshupPartnerService.registerPhoneForApp({
        appId: app.appId,
        phoneNumber
      });
      
      // Get app access token
      const appToken = await gupshupPartnerService.getAppAccessToken(app.appId);
      
      // Update agent with WABA details
      const updateData = {
        gupshup_app_id: app.appId,
        waba_phone_number: phoneNumber,
        waba_display_name: params.displayName || `${agent.full_name}'s Bot`,
        bot_name: params.botName || 'Doro',
        gupshup_api_key_encrypted: this._encrypt(appToken),
        partner_app_created: true,
        partner_app_created_at: new Date().toISOString(),
        waba_status: 'active',
        updated_at: new Date().toISOString()
      };
      
      const { error: updateError } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', params.agentId);
      
      if (updateError) {
        throw updateError;
      }
      
      // Create default templates
      await this._createDefaultTemplates(params.agentId);
      
      logger.info({
        agentId: params.agentId,
        appId: app.appId,
        phoneNumber,
        displayName: updateData.waba_display_name
      }, 'Agent WABA setup completed successfully');
      
      return {
        success: true,
        message: 'Agent WABA setup completed successfully',
        appId: app.appId,
        phoneNumber,
        displayName: updateData.waba_display_name,
        botName: updateData.bot_name
      };
      
    } catch (error) {
      logger.error({
        err: error,
        agentId: params.agentId,
        phoneNumber: params.phoneNumber
      }, 'Failed to setup agent WABA');
      
      // Update agent with error status
      await supabase
        .from('agents')
        .update({
          waba_status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.agentId);
      
      throw error;
    }
  }

  /**
   * Create default templates for an agent
   * @private
   * @param {string} agentId - Agent ID
   */
  async _createDefaultTemplates(agentId) {
    try {
      // Get agent details
      const { data: agent } = await supabase
        .from('agents')
        .select('full_name, bot_name')
        .eq('id', agentId)
        .single();
      
      const botName = agent?.bot_name || 'Doro';
      
      // Create welcome template
      await partnerTemplateService.createTemplate({
        agentId,
        templateName: 'welcome_message',
        templateCategory: 'UTILITY',
        templateContent: `Hi {{1}}, thanks for leaving your contact regarding {{2}}! I'm ${botName}, your personal real estate assistant. How can I help you today?`,
        templateParams: ['name', 'inquiry_type'],
        languageCode: 'en',
        templateType: 'welcome'
      });
      
      // Create followup template
      await partnerTemplateService.createTemplate({
        agentId,
        templateName: 'followup_message',
        templateCategory: 'UTILITY',
        templateContent: `Hi {{1}}, this is ${botName} following up on your property inquiry. Are you still interested in discussing your real estate needs?`,
        templateParams: ['name'],
        languageCode: 'en',
        templateType: 'followup'
      });
      
      // Create appointment template
      await partnerTemplateService.createTemplate({
        agentId,
        templateName: 'appointment_confirmation',
        templateCategory: 'UTILITY',
        templateContent: `Hi {{1}}, your appointment with {{2}} has been confirmed for {{3}}. You'll receive a Zoom link shortly. Looking forward to speaking with you!`,
        templateParams: ['name', 'agent_name', 'appointment_time'],
        languageCode: 'en',
        templateType: 'standard'
      });
      
      logger.info({
        agentId,
        botName
      }, 'Default templates created for agent');
      
    } catch (error) {
      logger.error({
        err: error,
        agentId
      }, 'Failed to create default templates for agent');
      
      // Don't throw error, as this is a non-critical step
    }
  }

  /**
   * Validate WABA setup for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Validation result
   */
  async validateAgentWABA(agentId) {
    try {
      // Get agent details
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();
      
      if (agentError || !agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }
      
      // Check if agent has WABA setup
      if (!agent.gupshup_app_id || !agent.waba_phone_number) {
        return {
          valid: false,
          message: 'Agent does not have WABA setup',
          missingFields: [
            !agent.gupshup_app_id ? 'gupshup_app_id' : null,
            !agent.waba_phone_number ? 'waba_phone_number' : null
          ].filter(Boolean)
        };
      }
      
      // Get app details from Partner API
      const apps = await gupshupPartnerService.getPartnerApps();
      const app = apps.find(a => a.id === agent.gupshup_app_id);
      
      if (!app) {
        return {
          valid: false,
          message: 'App not found in Partner API',
          appId: agent.gupshup_app_id
        };
      }
      
      // Get templates
      const templates = await partnerTemplateService.getAgentTemplates(agentId);
      const approvedTemplates = templates.filter(t => t.status === 'approved');
      
      return {
        valid: true,
        app,
        phoneNumber: agent.waba_phone_number,
        displayName: agent.waba_display_name,
        botName: agent.bot_name,
        templatesCount: templates.length,
        approvedTemplatesCount: approvedTemplates.length
      };
      
    } catch (error) {
      logger.error({
        err: error,
        agentId
      }, 'Failed to validate agent WABA');
      
      throw error;
    }
  }
}

module.exports = new AgentWABASetupService();
