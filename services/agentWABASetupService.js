const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');
const databaseService = require('./databaseService');
const gupshupPartnerService = require('./gupshupPartnerService');
const partnerTemplateService = require('./partnerTemplateService');

/**
 * Agent WABA Setup Service
 * Handles the discovery and configuration of agent WABAs through Partner API
 *
 * Key Features:
 * - Auto-discovery of existing Gupshup apps
 * - Automated API key retrieval and encryption
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
   * Create default templates for an agent
   * @private
   * @param {string} agentId - Agent ID
   */
  async _createDefaultTemplates(agentId) {
    try {
      // Create welcome template only - dynamic templates will be generated based on context
      await partnerTemplateService.createTemplate({
        agentId,
        templateName: 'welcome_message',
        templateCategory: 'UTILITY',
        templateContent: `Hi {{1}}, thanks for leaving your contact regarding {{2}}! 😊

Just checking in to see what caught your eye or what you're exploring.

Feel free to let me know, I'll do my best to help!`,
        templateParams: ['name', 'inquiry_type'],
        languageCode: 'en',
        templateType: 'welcome'
      });

      logger.info({
        agentId
      }, 'Welcome template created for agent - dynamic templates will be generated based on conversation context');

    } catch (error) {
      logger.error({
        err: error,
        agentId
      }, 'Failed to create welcome template for agent');

      // Don't throw error, as this is a non-critical step
    }
  }

  /**
   * Auto-discover and configure WABA for agent - enhanced to work without pre-configured phone number
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Discovery and setup result
   */
  async autoDiscoverAndConfigureWABA(agentId) {
    try {
      // Get agent details
      const { data: agent, error: agentError } = await databaseService.supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (agentError || !agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // Enhanced: No longer require pre-configured phone number
      // We'll discover available phone numbers from Partner API

      // If already configured, validate and return
      if (agent.gupshup_app_id && agent.gupshup_api_key_encrypted) {
        logger.info({ agentId, phoneNumber: agent.waba_phone_number }, 'Agent WABA already configured, validating...');
        return await this.validateAgentWABA(agentId);
      }

      // Get all partner apps
      const apps = await gupshupPartnerService.getPartnerApps();

      // Try to find app by phone number matching
      let matchingApp = null;
      let appToken = null;

      for (const app of apps) {
        try {
          // Try to get app token - if successful, this app is accessible
          const token = await gupshupPartnerService.getAppAccessToken(app.id);

          // TODO: In a full implementation, we would check if this app has the phone number registered
          // For now, we'll use the first accessible app as a fallback
          // But ideally we should call an API to check which app has the specific phone number

          if (!matchingApp) {
            matchingApp = app;
            appToken = token;

            logger.info({
              agentId,
              appId: app.id,
              appName: app.name,
              phoneNumber: agent.waba_phone_number
            }, 'Found accessible Gupshup app for auto-discovery');
            break;
          }
        } catch (error) {
          logger.debug({
            appId: app.id,
            appName: app.name,
            error: error.message
          }, 'Skipping inaccessible app during auto-discovery');
          continue;
        }
      }

      if (!matchingApp || !appToken) {
        return {
          success: false,
          message: 'No accessible Gupshup app found for auto-discovery. Please create an app manually.',
          availableApps: apps.map(app => ({ id: app.id, name: app.name })),
          phoneNumber: agent.waba_phone_number
        };
      }

      // Update agent with discovered WABA details
      const updateData = {
        gupshup_app_id: matchingApp.id,
        gupshup_api_key_encrypted: this._encrypt(appToken),
        waba_status: 'active',
        partner_app_created: false, // This was discovered, not created
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await databaseService.supabase
        .from('agents')
        .update(updateData)
        .eq('id', agentId);

      if (updateError) {
        throw updateError;
      }

      // Configure webhook subscription for the app
      try {
        logger.info({
          agentId,
          appId: matchingApp.id
        }, 'Configuring webhook subscription for discovered app');

        const subscription = await gupshupPartnerService.configureWebhookSubscription(matchingApp.id);

        logger.info({
          agentId,
          appId: matchingApp.id,
          subscriptionId: subscription.id
        }, 'Webhook subscription configured successfully during auto-discovery');
      } catch (webhookError) {
        logger.error({
          err: webhookError,
          agentId,
          appId: matchingApp.id
        }, 'Failed to configure webhook subscription during auto-discovery - continuing anyway');
        // Don't fail the entire setup if webhook configuration fails
      }

      logger.info({
        agentId,
        appId: matchingApp.id,
        appName: matchingApp.name,
        phoneNumber: agent.waba_phone_number
      }, 'Agent WABA auto-discovery completed successfully');

      return {
        success: true,
        message: 'WABA auto-discovery completed successfully',
        appId: matchingApp.id,
        appName: matchingApp.name,
        phoneNumber: agent.waba_phone_number,
        displayName: agent.waba_display_name,
        botName: agent.bot_name
      };

    } catch (error) {
      logger.error({
        err: error,
        agentId
      }, 'Failed to auto-discover agent WABA');

      throw error;
    }
  }

  /**
   * Discover WABA details by phone number (for auto-population)
   * @param {string} phoneNumber - WABA phone number
   * @returns {Promise<Object>} Discovered WABA details
   */
  async discoverWABADetailsByPhoneNumber(phoneNumber) {
    try {
      logger.info({ phoneNumber }, 'Starting WABA auto-discovery by phone number');

      // Get all partner apps
      const apps = await gupshupPartnerService.getPartnerApps();

      let discoveredDetails = {
        phoneNumber,
        displayName: null,
        appId: null,
        apiKey: null,
        found: false
      };

      // Try each app to find one that matches this phone number
      for (const app of apps) {
        try {
          // Normalize both phone numbers for comparison
          const normalizePhone = (phone) => {
            if (!phone) return '';
            // Remove all non-digits and add +65 prefix if needed
            const digits = phone.replace(/\D/g, '');
            if (digits.startsWith('65')) {
              return '+' + digits;
            } else if (digits.length === 8) {
              return '+65' + digits;
            }
            return '+' + digits;
          };

          const normalizedInputPhone = normalizePhone(phoneNumber);
          const normalizedAppPhone = normalizePhone(app.phone);

          logger.debug({
            inputPhone: phoneNumber,
            normalizedInputPhone,
            appPhone: app.phone,
            normalizedAppPhone,
            appId: app.id,
            appName: app.name
          }, 'Comparing phone numbers for WABA discovery');

          // Check if this app's phone number matches the requested phone number
          if (normalizedInputPhone === normalizedAppPhone) {
            // Try to get app token - if successful, this app is accessible
            const appToken = await gupshupPartnerService.getAppAccessToken(app.id);

            discoveredDetails = {
              phoneNumber,
              displayName: app.name || `WABA ${phoneNumber}`,
              appId: app.id,
              apiKey: appToken,
              found: true,
              appName: app.name,
              appHealthy: app.healthy,
              appLive: app.live
            };

            logger.info({
              phoneNumber,
              appId: app.id,
              appName: app.name
            }, 'Successfully discovered WABA details by phone number');
            break;
          }
        } catch (error) {
          logger.debug({
            appId: app.id,
            appName: app.name,
            phoneNumber,
            error: error.message
          }, 'App not accessible during phone number discovery');
          continue;
        }
      }

      if (!discoveredDetails.found) {
        logger.warn({ phoneNumber }, 'No WABA details found for phone number');
      }

      return discoveredDetails;

    } catch (error) {
      logger.error({
        err: error,
        phoneNumber
      }, 'Failed to discover WABA details by phone number');

      throw error;
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
      const { data: agent, error: agentError } = await databaseService.supabase
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
