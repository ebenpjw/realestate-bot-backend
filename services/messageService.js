const axios = require('axios');
const logger = require('../logger');
const config = require('../config');
const databaseService = require('./databaseService');
const multiTenantConfigService = require('./multiTenantConfigService');
const gupshupPartnerService = require('./gupshupPartnerService');
const socketService = require('./socketService');

/**
 * Message Service
 * Handles message sending via Gupshup Partner API v3
 * Supports individual and bulk messaging with rate limiting and error handling
 */
class MessageService {
  constructor() {
    this.baseURL = 'https://partner.gupshup.io/partner';
    this.rateLimitDelay = 1000; // 1 second between messages
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
  }

  /**
   * Send a template message to a single recipient
   * @param {Object} params - Message parameters
   * @param {string} params.agentId - Agent ID
   * @param {string} params.phoneNumber - Recipient phone number
   * @param {string} params.templateId - Template ID
   * @param {string} params.templateName - Template name
   * @param {Object} params.templateParams - Template parameters
   * @param {string} params.leadId - Lead ID for tracking
   * @returns {Promise<Object>} Message result
   */
  async sendTemplateMessage(params) {
    const { agentId, phoneNumber, templateId, templateName, templateParams, leadId } = params;

    try {
      logger.info({
        agentId,
        phoneNumber,
        templateId,
        templateName,
        leadId
      }, 'Sending template message');

      // Safety check removed - using Partner API for real message delivery

      // Get agent configuration
      const agentConfig = await multiTenantConfigService.getAgentConfig(agentId);
      if (!agentConfig || !agentConfig.gupshup_app_id) {
        throw new Error('Agent WABA configuration not found');
      }

      // Check if app is in live mode
      const appDetails = await this.checkAppStatus(agentConfig.gupshup_app_id);
      if (!appDetails.live) {
        logger.warn({
          agentId,
          appId: agentConfig.gupshup_app_id,
          appName: appDetails.name,
          isLive: appDetails.live
        }, '⚠️ WARNING: App is not in LIVE mode - messages may not be delivered');
      }

    // Auto-fill template parameters if empty (moved outside try block)
    let finalTemplateParams = templateParams;
    if (Object.keys(templateParams).length === 0 && leadId) {
      finalTemplateParams = await this.autoFillTemplateParameters(leadId, templateName);
    }

      // Get app access token
      const appToken = await gupshupPartnerService.getAppAccessToken(agentConfig.gupshup_app_id);

      // Run diagnostics to understand why messages aren't being delivered
      await this.diagnosePartnerAPIApp(agentId, agentConfig, appToken);

      // Format phone number (ensure it starts with country code)
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      // Prepare message payload for Gupshup v3 API
      const messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en' // Default to English, can be made configurable
          },
          components: this.buildTemplateComponents(finalTemplateParams)
        }
      };

      // Try v3 API first, fallback to v2 if callback billing not enabled
      let response;
      try {
        // Send message via Gupshup Partner API v3
        response = await this.sendWithRetry(
          `${this.baseURL}/app/${agentConfig.gupshup_app_id}/v3/message`,
          messagePayload,
          appToken
        );
      } catch (error) {
        // If v3 fails with callback billing error, try v2 API
        if ((error.message && error.message.includes('Callback Billing must be enabled')) ||
            (error.response && error.response.data && error.response.data.message &&
             error.response.data.message.includes('Callback Billing must be enabled'))) {
          logger.warn({
            agentId,
            appId: agentConfig.gupshup_app_id,
            error: error.message
          }, '⚠️ V3 API requires callback billing - falling back to V2 API');

          response = await this.sendWithV2API(agentConfig, templateId, templateName, finalTemplateParams, formattedPhone, appToken);
        } else {
          throw error;
        }
      }

      const messageId = response.data.messages?.[0]?.id;
      if (!messageId) {
        throw new Error('No message ID returned from Gupshup API');
      }

      // Log message in database
      await this.logMessage({
        leadId,
        agentId,
        messageId,
        templateId,
        templateName,
        templateParams: finalTemplateParams,
        phoneNumber: formattedPhone,
        status: 'sent',
        campaignId: params.campaignId
      });

      logger.info({
        agentId,
        messageId,
        phoneNumber: formattedPhone,
        templateName,
        appId: agentConfig.gupshup_app_id,
        templateParams: finalTemplateParams,
        gupshupResponse: response
      }, '📱 Template message sent successfully - CHECK DELIVERY STATUS');

      return {
        messageId,
        status: 'sent',
        phoneNumber: formattedPhone
      };

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        phoneNumber,
        templateId,
        templateName
      }, 'Failed to send template message');

      // Log failed message
      if (leadId) {
        await this.logMessage({
          leadId,
          agentId,
          messageId: null,
          templateId,
          templateName,
          templateParams: finalTemplateParams,
          phoneNumber,
          status: 'failed',
          errorMessage: error.message,
          campaignId: params.campaignId
        });
      }

      throw error;
    }
  }

  /**
   * Process bulk messages asynchronously
   * @param {Object} params - Bulk message parameters
   * @param {string} params.campaignId - Campaign ID
   * @param {string} params.agentId - Agent ID
   * @param {string} params.templateId - Template ID
   * @param {string} params.templateName - Template name
   * @param {Object} params.templateParams - Template parameters
   * @param {Array} params.leadIds - Array of lead IDs
   */
  async processBulkMessages(params) {
    const { campaignId, agentId, templateId, templateName, templateParams, leadIds } = params;

    try {
      logger.info({
        campaignId,
        agentId,
        templateId,
        leadCount: leadIds.length
      }, 'Starting bulk message processing');

      // Update campaign status
      await this.updateCampaignStatus(campaignId, 'in_progress');

      // Get leads data
      const { data: leads, error: leadsError } = await databaseService.supabase
        .from('leads')
        .select('id, phone_number, full_name')
        .in('id', leadIds)
        .eq('assigned_agent_id', agentId);

      if (leadsError) {
        throw leadsError;
      }

      let sentCount = 0;
      let failedCount = 0;
      const errors = [];

      // Process messages with rate limiting and pause/resume support
      for (const lead of leads) {
        // Check campaign status before processing each message
        const { data: campaign } = await databaseService.supabase
          .from('message_campaigns')
          .select('status')
          .eq('id', campaignId)
          .single();

        // Handle paused campaign
        if (campaign?.status === 'paused') {
          logger.info({ campaignId }, 'Campaign paused, waiting for resume');

          // Wait for resume or timeout
          let waitTime = 0;
          const maxWaitTime = 300000; // 5 minutes max wait

          while (waitTime < maxWaitTime) {
            await this.delay(5000); // Check every 5 seconds
            waitTime += 5000;

            const { data: updatedCampaign } = await databaseService.supabase
              .from('message_campaigns')
              .select('status')
              .eq('id', campaignId)
              .single();

            if (updatedCampaign?.status === 'in_progress') {
              logger.info({ campaignId }, 'Campaign resumed');
              break;
            } else if (updatedCampaign?.status === 'failed') {
              logger.info({ campaignId }, 'Campaign cancelled');
              return;
            }
          }

          // If still paused after max wait, mark as failed
          if (waitTime >= maxWaitTime) {
            await this.updateCampaignStatus(campaignId, 'failed', {
              error: 'Campaign paused for too long, automatically cancelled'
            });
            return;
          }
        }

        // Handle cancelled campaign
        if (campaign?.status === 'failed') {
          logger.info({ campaignId }, 'Campaign cancelled, stopping processing');
          return;
        }

        try {
          await this.sendTemplateMessage({
            agentId,
            phoneNumber: lead.phone_number,
            templateId,
            templateName,
            templateParams,
            leadId: lead.id,
            campaignId // Add campaign ID for message logging
          });

          sentCount++;

          // Update campaign progress
          await this.updateCampaignProgress(campaignId, sentCount, failedCount);

          // Emit progress update via WebSocket
          socketService.emitToAgent(agentId, 'bulk_message_progress', {
            campaignId,
            sent: sentCount,
            failed: failedCount,
            total: leads.length,
            currentLead: lead.full_name,
            progress: Math.round(((sentCount + failedCount) / leads.length) * 100)
          });

          // Rate limiting delay
          if (sentCount + failedCount < leads.length) {
            await this.delay(this.rateLimitDelay);
          }

        } catch (error) {
          failedCount++;
          errors.push({
            leadId: lead.id,
            leadName: lead.full_name,
            phoneNumber: lead.phone_number,
            error: error.message
          });

          logger.error({
            err: error,
            campaignId,
            leadId: lead.id,
            phoneNumber: lead.phone_number
          }, 'Failed to send message in bulk campaign');

          // Update campaign progress
          await this.updateCampaignProgress(campaignId, sentCount, failedCount);

          // Emit progress update
          socketService.emitToAgent(agentId, 'bulk_message_progress', {
            campaignId,
            sent: sentCount,
            failed: failedCount,
            total: leads.length,
            currentLead: lead.full_name,
            progress: Math.round(((sentCount + failedCount) / leads.length) * 100)
          });

          // Continue with next message
          continue;
        }
      }

      // Mark campaign as completed
      await this.updateCampaignStatus(campaignId, 'completed', {
        messages_sent: sentCount,
        messages_failed: failedCount,
        error_details: errors.length > 0 ? { errors } : null
      });

      // Emit completion notification
      socketService.emitToAgent(agentId, 'bulk_message_completed', {
        campaignId,
        sent: sentCount,
        failed: failedCount,
        total: leads.length,
        success: true
      });

      logger.info({
        campaignId,
        agentId,
        sent: sentCount,
        failed: failedCount,
        total: leads.length
      }, 'Bulk message campaign completed');

    } catch (error) {
      logger.error({
        err: error,
        campaignId,
        agentId
      }, 'Bulk message campaign failed');

      // Mark campaign as failed
      await this.updateCampaignStatus(campaignId, 'failed', {
        error_details: { error: error.message }
      });

      // Emit failure notification
      socketService.emitToAgent(agentId, 'bulk_message_failed', {
        campaignId,
        error: error.message,
        success: false
      });
    }
  }

  /**
   * Send HTTP request with retry logic
   * @param {string} url - Request URL
   * @param {Object} data - Request data
   * @param {string} token - Authorization token
   * @returns {Promise<Object>} Response data
   */
  async sendWithRetry(url, data, token, retryCount = 0) {
    try {
      const response = await axios.post(url, data, {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      return response;

    } catch (error) {
      // Handle rate limiting
      if (error.response?.status === 429 && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount); // Exponential backoff
        logger.warn({
          url,
          retryCount,
          delay
        }, 'Rate limited, retrying after delay');

        await this.delay(delay);
        return this.sendWithRetry(url, data, token, retryCount + 1);
      }

      // Handle other errors
      if (error.response?.status >= 500 && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        logger.warn({
          url,
          status: error.response.status,
          retryCount,
          delay
        }, 'Server error, retrying after delay');

        await this.delay(delay);
        return this.sendWithRetry(url, data, token, retryCount + 1);
      }

      // Log error details
      logger.error({
        err: error,
        url,
        status: error.response?.status,
        data: error.response?.data,
        retryCount
      }, 'HTTP request failed');

      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to send message'
      );
    }
  }

  /**
   * Build template components for Gupshup v3 API
   * @param {Object} templateParams - Template parameters
   * @returns {Array} Template components
   */
  buildTemplateComponents(templateParams) {
    if (!templateParams || Object.keys(templateParams).length === 0) {
      return [];
    }

    const components = [];

    // Build body component with parameters
    const bodyParams = Object.entries(templateParams).map(([key, value], index) => ({
      type: 'text',
      text: String(value)
    }));

    if (bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams
      });
    }

    return components;
  }

  /**
   * Format phone number for WhatsApp
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (default to Singapore +65)
    if (!cleaned.startsWith('65') && cleaned.length === 8) {
      cleaned = '65' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Log message in database
   * @param {Object} params - Message log parameters
   */
  async logMessage(params) {
    const {
      leadId,
      agentId,
      messageId,
      templateId,
      templateName,
      templateParams,
      phoneNumber,
      status,
      errorMessage,
      campaignId
    } = params;

    try {
      // Handle undefined templateName gracefully
      let displayName = templateName;

      // If templateName is missing, try to get it from the template ID
      if (!displayName && templateId && agentId) {
        try {
          const partnerTemplateService = require('./partnerTemplateService');
          const templates = await partnerTemplateService.getAgentTemplates(agentId);
          const template = templates.find(t => t.id === templateId);
          displayName = template?.elementName || templateId;
        } catch (error) {
          logger.warn({ templateId, agentId }, 'Could not fetch template name for logging');
          displayName = templateId;
        }
      }

      // Final fallback
      displayName = displayName || templateId || 'Unknown Template';

      await databaseService.supabase
        .from('messages')
        .insert({
          lead_id: leadId,
          sender: 'agent',
          message: `Template: ${displayName}`,
          message_type: 'template',
          template_id: templateId,
          template_params: templateParams,
          external_message_id: messageId,
          delivery_status: status,
          error_message: errorMessage,
          campaign_id: campaignId,
          created_at: new Date().toISOString()
        });

    } catch (error) {
      logger.error({
        err: error,
        leadId,
        messageId,
        campaignId
      }, 'Failed to log message in database');
    }
  }

  /**
   * Update campaign status
   * @param {string} campaignId - Campaign ID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to update
   */
  async updateCampaignStatus(campaignId, status, additionalData = {}) {
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...additionalData
      };

      if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString();
      }

      await databaseService.supabase
        .from('message_campaigns')
        .update(updateData)
        .eq('id', campaignId);

    } catch (error) {
      logger.error({
        err: error,
        campaignId,
        status
      }, 'Failed to update campaign status');
    }
  }

  /**
   * Update campaign progress
   * @param {string} campaignId - Campaign ID
   * @param {number} sent - Messages sent count
   * @param {number} failed - Messages failed count
   */
  async updateCampaignProgress(campaignId, sent, failed) {
    try {
      await databaseService.supabase
        .from('message_campaigns')
        .update({
          messages_sent: sent,
          messages_failed: failed,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

    } catch (error) {
      logger.error({
        err: error,
        campaignId,
        sent,
        failed
      }, 'Failed to update campaign progress');
    }
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check app status (live mode, health, etc.)
   * @param {string} appId - Gupshup app ID
   * @returns {Promise<Object>} App status details
   */
  async checkAppStatus(appId) {
    try {
      // Get partner apps list to check app status
      const partnerApps = await gupshupPartnerService.getPartnerApps();
      const app = partnerApps.find(app => app.id === appId);

      if (!app) {
        logger.error({ appId }, 'App not found in partner apps list');
        return { live: false, healthy: false, name: 'Unknown' };
      }

      logger.info({
        appId,
        appName: app.name,
        isLive: app.live,
        isHealthy: app.healthy,
        isStopped: app.stopped,
        customerId: app.customerId
      }, 'App status checked');

      return {
        live: app.live,
        healthy: app.healthy,
        stopped: app.stopped,
        name: app.name,
        customerId: app.customerId
      };

    } catch (error) {
      logger.error({
        err: error,
        appId
      }, 'Error checking app status');
      return { live: false, healthy: false, name: 'Unknown' };
    }
  }

  /**
   * Diagnose Partner API app configuration issues
   * @param {string} agentId - Agent ID
   * @param {Object} agentConfig - Agent configuration
   * @param {string} appToken - App access token
   * @returns {Promise<Object>} Diagnostic information
   */
  async diagnosePartnerAPIApp(agentId, agentConfig, appToken) {
    try {
      const diagnostics = {
        appId: agentConfig.gupshup_app_id,
        agentId,
        checks: {}
      };

      // Check business profile
      try {
        const profileResponse = await axios.get(
          `${this.baseURL}/app/${agentConfig.gupshup_app_id}/business-profile`,
          {
            headers: {
              'Authorization': appToken,
              'Accept': 'application/json'
            },
            timeout: 10000
          }
        );
        diagnostics.checks.businessProfile = {
          status: 'success',
          data: profileResponse.data
        };
      } catch (error) {
        diagnostics.checks.businessProfile = {
          status: 'error',
          error: error.response?.data || error.message
        };
      }

      // Check quality rating
      try {
        const ratingResponse = await axios.get(
          `${this.baseURL}/app/${agentConfig.gupshup_app_id}/ratings`,
          {
            headers: {
              'Authorization': appToken,
              'Accept': 'application/json'
            },
            timeout: 10000
          }
        );
        diagnostics.checks.qualityRating = {
          status: 'success',
          data: ratingResponse.data
        };
      } catch (error) {
        diagnostics.checks.qualityRating = {
          status: 'error',
          error: error.response?.data || error.message
        };
      }

      // Check WABA info
      try {
        const wabaResponse = await axios.get(
          `${this.baseURL}/app/${agentConfig.gupshup_app_id}/health`,
          {
            headers: {
              'Authorization': appToken,
              'Accept': 'application/json'
            },
            timeout: 10000
          }
        );
        diagnostics.checks.wabaHealth = {
          status: 'success',
          data: wabaResponse.data
        };
      } catch (error) {
        diagnostics.checks.wabaHealth = {
          status: 'error',
          error: error.response?.data || error.message
        };
      }

      logger.info({
        agentId,
        appId: agentConfig.gupshup_app_id,
        diagnostics
      }, '🔍 Partner API App Diagnostics');

      return diagnostics;

    } catch (error) {
      logger.error({
        err: error,
        agentId,
        appId: agentConfig.gupshup_app_id
      }, 'Error running Partner API diagnostics');
      throw error;
    }
  }

  /**
   * Send message using v2 API (fallback when v3 requires callback billing)
   * @param {Object} agentConfig - Agent configuration
   * @param {string} templateId - Template ID
   * @param {string} templateName - Template name
   * @param {Object} templateParams - Template parameters
   * @param {string} phoneNumber - Formatted phone number
   * @param {string} appToken - App access token
   * @returns {Promise<Object>} API response
   */
  async sendWithV2API(agentConfig, templateId, templateName, templateParams, phoneNumber, appToken) {
    try {
      // Convert template parameters to array format for v2 API
      const paramsArray = Object.keys(templateParams)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(key => templateParams[key]);

      // Prepare v2 API payload
      const v2Payload = new URLSearchParams({
        channel: 'whatsapp',
        source: agentConfig.waba_phone_number || '+6580128102',
        destination: phoneNumber,
        'src.name': agentConfig.waba_display_name || 'DoroSmartGuide',
        template: JSON.stringify({
          id: templateId,
          params: paramsArray
        }),
        sandbox: 'false'
      });

      logger.info({
        appId: agentConfig.gupshup_app_id,
        templateId,
        templateName,
        phoneNumber,
        paramsArray
      }, '📱 Sending message via v2 API (callback billing fallback)');

      // Send via v2 API
      const response = await axios.post(
        `${this.baseURL}/app/${agentConfig.gupshup_app_id}/template/msg`,
        v2Payload,
        {
          headers: {
            'Authorization': appToken,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      // Convert v2 response format to match v3 format
      if (response.data && response.data.messageId) {
        return {
          messages: [{ id: response.data.messageId }],
          messaging_product: 'whatsapp',
          contacts: [{
            input: phoneNumber,
            wa_id: phoneNumber
          }]
        };
      }

      throw new Error('Invalid v2 API response format');

    } catch (error) {
      logger.error({
        err: error,
        appId: agentConfig.gupshup_app_id,
        templateId,
        phoneNumber
      }, 'Error sending message via v2 API');
      throw error;
    }
  }

  /**
   * Auto-fill template parameters based on lead data
   * @param {string} leadId - Lead ID
   * @param {string} templateName - Template name for context
   * @returns {Promise<Object>} Template parameters object
   */
  async autoFillTemplateParameters(leadId, templateName) {
    try {
      // Get lead data
      const { data: lead, error } = await databaseService.supabase
        .from('leads')
        .select('full_name, property_type, location_preference, budget, timeline')
        .eq('id', leadId)
        .single();

      if (error || !lead) {
        logger.warn({ leadId, templateName }, 'Could not fetch lead data for auto-fill');
        return {};
      }

      // Auto-fill common template parameters
      const autoParams = {
        '1': lead.full_name?.split(' ')[0] || 'there', // First name
        '2': lead.property_type || lead.location_preference || 'your property inquiry', // Context
        '3': lead.location_preference || 'your preferred area', // Location
        '4': 'How does this sound?' // Call to action
      };

      logger.info({
        leadId,
        templateName,
        leadName: lead.full_name,
        autoParams
      }, 'Auto-filled template parameters');

      return autoParams;

    } catch (error) {
      logger.error({
        err: error,
        leadId,
        templateName
      }, 'Error auto-filling template parameters');
      return {};
    }
  }
}

module.exports = new MessageService();
