const whatsappService = require('./whatsappService');
const multiTenantConfigService = require('./multiTenantConfigService');
const partnerTemplateService = require('./partnerTemplateService');
const logger = require('../logger');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Template Service for WABA-compliant messaging
 * Handles template message sending and 24-hour window compliance
 * Updated for 2025 WABA guidelines and best practices
 */
class TemplateService {
  constructor() {
    // 24-hour window tracking for WABA compliance
    this.lastUserMessageTimes = new Map();
    this.templateUsageLog = new Map();

    // Template types for dynamic template selection
    this.templateTypes = {
      WELCOME: 'welcome',
      FOLLOWUP: 'followup',
      REMINDER: 'reminder',
      UPDATE: 'update',
      APPOINTMENT: 'appointment'
    };

    logger.info('Template service initialized with Partner API integration');
  }

  /**
   * Send welcome template using Partner API
   * @param {Object} params - Parameters
   * @param {string} params.phoneNumber - Lead's phone number
   * @param {string} params.leadName - Lead's name
   * @param {string} params.contactReason - What they contacted about
   * @param {string} params.agentId - Agent ID (optional, will try to determine from phone routing)
   * @returns {Promise<Object>} Send result
   */
  async sendWelcomeTemplate({ phoneNumber, leadName, contactReason = 'your property enquiry', agentId = null }) {
    try {
      this._validatePhoneNumber(phoneNumber);

      // If no agentId provided, try to determine from routing or use default
      if (!agentId) {
        // For now, we'll need to determine the agent from the lead or use a default
        // This should be improved to use proper routing logic
        logger.warn({ phoneNumber }, 'No agentId provided for welcome template, using legacy fallback');

        // Try to find agent by phone number or use default agent
        try {
          const agentConfig = await multiTenantConfigService.getAgentByWABANumber(phoneNumber);
          agentId = agentConfig.id;
        } catch (error) {
          // Use default agent or throw error
          throw new ValidationError('Cannot determine agent for welcome template. Agent ID required for Partner API.');
        }
      }

      // Get agent's welcome template
      const agentTemplates = await multiTenantConfigService.getAgentTemplates(agentId);
      const welcomeTemplate = agentTemplates.find(t =>
        t.template_type === this.templateTypes.WELCOME ||
        t.template_name.includes('welcome')
      );

      if (!welcomeTemplate) {
        throw new ValidationError(`No welcome template found for agent: ${agentId}`);
      }

      // Get agent WABA configuration
      const agentWABAConfig = await multiTenantConfigService.getAgentWABAConfig(agentId);

      // Create agent-specific WhatsApp service
      const WhatsAppService = require('./whatsappService');
      const agentWhatsAppService = new WhatsAppService(agentWABAConfig);

      const params = [leadName, contactReason];

      logger.info({
        phoneNumber,
        agentId,
        templateId: welcomeTemplate.template_id,
        templateName: welcomeTemplate.template_name,
        params,
        previewMessage: `Hi ${leadName}, thanks for leaving your contact regarding ${contactReason}!`
      }, 'Sending agent-specific welcome template');

      const result = await agentWhatsAppService.sendTemplateMessage({
        to: phoneNumber,
        templateId: welcomeTemplate.template_id,
        params,
        templateName: welcomeTemplate.template_name,
        category: welcomeTemplate.template_category
      });

      if (result.success) {
        // Log template usage for compliance tracking
        await this._logTemplateUsage({
          phoneNumber,
          agentId,
          templateId: welcomeTemplate.template_id,
          templateName: welcomeTemplate.template_name,
          category: welcomeTemplate.template_category,
          params,
          messageId: result.messageId
        });

        logger.info({
          phoneNumber,
          templateName: welcomeTemplate.template_name,
          messageId: result.messageId
        }, 'Welcome template sent successfully');
      }

      return result;

    } catch (error) {
      logger.error({
        err: error,
        phoneNumber,
        templateName: 'welcome_real_estate'
      }, 'Failed to send welcome template');
      throw error;
    }
  }

  /**
   * Send property inquiry follow-up template
   * @param {Object} params - Parameters
   * @param {string} params.phoneNumber - Lead's phone number
   * @param {string} params.leadName - Lead's name
   * @param {string} params.propertyType - Type of property
   * @param {string} params.location - Property location
   * @returns {Promise<Object>} Send result
   */
  async sendPropertyFollowupTemplate({ phoneNumber, leadName, propertyType, location }) {
    try {
      this._validatePhoneNumber(phoneNumber);
      
      const template = this.approvedTemplates.PROPERTY_INQUIRY_FOLLOWUP;
      const params = [leadName, propertyType, location];

      const result = await whatsappService.sendTemplateMessage({
        to: phoneNumber,
        templateId: template.id,
        params
      });

      if (result.success) {
        await this._logTemplateUsage({
          phoneNumber,
          templateId: template.id,
          templateName: template.name,
          category: template.category,
          params,
          messageId: result.messageId
        });

        logger.info({
          phoneNumber,
          templateName: template.name,
          messageId: result.messageId
        }, 'Property followup template sent successfully');
      }

      return result;

    } catch (error) {
      logger.error({
        err: error,
        phoneNumber,
        templateName: 'property_inquiry_followup'
      }, 'Failed to send property followup template');
      throw error;
    }
  }

  /**
   * Check if we can send free-form messages (within 24-hour window)
   * @param {string} leadId - Lead ID
   * @returns {Promise<boolean>} True if within 24-hour window
   */
  async canSendFreeFormMessage(leadId) {
    try {
      const history = await databaseService.getConversationHistory(leadId, 1);
      
      if (history.length === 0) {
        // No conversation history - must use template
        return false;
      }

      const lastMessage = history[0];
      
      // Check if last message was from the lead (customer)
      if (lastMessage.sender !== 'lead') {
        return false;
      }

      // Check if within 24-hour window
      const lastMessageTime = new Date(lastMessage.created_at);
      const now = new Date();
      const hoursDiff = (now - lastMessageTime) / (1000 * 60 * 60);

      const withinWindow = hoursDiff < 24;
      
      logger.debug({
        leadId,
        lastMessageTime,
        hoursDiff,
        withinWindow
      }, 'Checked 24-hour messaging window');

      return withinWindow;

    } catch (error) {
      logger.error({
        err: error,
        leadId
      }, 'Failed to check 24-hour window');
      
      // Default to false for safety - use template
      return false;
    }
  }

  /**
   * Send message with WABA compliance check
   * @param {Object} params - Parameters
   * @param {string} params.leadId - Lead ID
   * @param {string} params.phoneNumber - Phone number
   * @param {string} params.message - Message content
   * @param {string} params.templateFallback - Template to use if outside window
   * @returns {Promise<Object>} Send result
   */
  async sendCompliantMessage({ leadId, phoneNumber, message, templateFallback = null }) {
    try {
      const canSendFreeForm = await this.canSendFreeFormMessage(leadId);

      if (canSendFreeForm) {
        // Within 24-hour window - can send free-form message
        logger.info({
          leadId,
          phoneNumber
        }, 'Sending free-form message (within 24-hour window)');

        return await whatsappService.sendMessage({
          to: phoneNumber,
          message
        });
      } else {
        // Outside 24-hour window - must use template
        if (!templateFallback) {
          throw new ValidationError('Cannot send free-form message outside 24-hour window without approved template');
        }

        logger.info({
          leadId,
          phoneNumber,
          templateFallback
        }, 'Sending template message (outside 24-hour window)');

        return await this.sendWelcomeTemplate({
          phoneNumber,
          leadName: 'There', // Default fallback
          agentName: 'Doro'
        });
      }

    } catch (error) {
      logger.error({
        err: error,
        leadId,
        phoneNumber
      }, 'Failed to send compliant message');
      throw error;
    }
  }

  /**
   * Get available templates
   * @returns {Object} Available templates
   */
  getAvailableTemplates() {
    return this.approvedTemplates;
  }

  /**
   * Validate phone number format
   * @private
   */
  _validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new ValidationError('Phone number is required');
    }

    // E.164 format validation
    const e164Regex = /^\+?[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneNumber.replace(/\s+/g, ''))) {
      throw new ValidationError('Phone number must be in E.164 format');
    }
  }

  /**
   * Log template usage for compliance tracking
   * @private
   */
  async _logTemplateUsage(templateData) {
    try {
      // Log template usage to database for compliance tracking
      const { supabase } = require('../database/supabaseClient');

      const logData = {
        phone_number: templateData.phoneNumber,
        template_name: templateData.templateName,
        agent_id: templateData.agentId || null,
        status: 'sent',
        gupshup_response: {
          messageId: templateData.messageId,
          templateId: templateData.templateId,
          category: templateData.category,
          params: templateData.params
        }
      };

      const { error } = await supabase
        .from('template_usage_log')
        .insert(logData);

      if (error) {
        throw error;
      }

      // Update template usage count in waba_templates
      if (templateData.agentId && templateData.templateId) {
        await supabase
          .from('waba_templates')
          .update({
            usage_count: supabase.raw('usage_count + 1'),
            last_used_at: new Date().toISOString()
          })
          .eq('agent_id', templateData.agentId)
          .eq('template_id', templateData.templateId);
      }

      logger.debug({
        templateName: templateData.templateName,
        phoneNumber: templateData.phoneNumber,
        agentId: templateData.agentId
      }, 'Template usage logged for compliance');

    } catch (error) {
      // Don't fail the main operation if logging fails
      logger.warn({
        err: error,
        templateData
      }, 'Failed to log template usage');
    }
  }

  /**
   * Check if we're within the 24-hour window for sending regular messages
   * @param {string} phoneNumber - User's phone number
   * @returns {boolean} True if within 24-hour window
   */
  isWithin24HourWindow(phoneNumber) {
    const lastMessageTime = this.lastUserMessageTimes.get(phoneNumber);
    if (!lastMessageTime) {
      return false; // No previous message, must use template
    }

    const now = new Date();
    const timeDiff = now.getTime() - lastMessageTime.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    return hoursDiff < 24;
  }

  /**
   * Record when user sent a message (for 24-hour window tracking)
   * @param {string} phoneNumber - User's phone number
   */
  recordUserMessage(phoneNumber) {
    this.lastUserMessageTimes.set(phoneNumber, new Date());
    logger.debug({ phoneNumber }, 'Recorded user message for 24-hour window tracking');
  }



  /**
   * Validate template compliance before sending
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} templateId - Template to send
   * @returns {Object} Validation result
   */
  validateTemplateCompliance(phoneNumber, templateId) {
    const template = Object.values(this.approvedTemplates).find(t => t.id === templateId);

    if (!template) {
      return {
        valid: false,
        reason: 'Template not found in approved templates list',
        requiresApproval: true
      };
    }

    // Check if template is properly configured
    if (!template.category || !template.name) {
      return {
        valid: false,
        reason: 'Template missing required metadata (category/name)',
        requiresApproval: true
      };
    }

    // For MARKETING templates, additional restrictions may apply
    if (template.category === 'MARKETING') {
      const withinWindow = this.isWithin24HourWindow(phoneNumber);
      if (!withinWindow) {
        logger.info({ phoneNumber, templateId }, 'Using MARKETING template outside 24-hour window - ensure user opted in');
      }
    }

    return {
      valid: true,
      template,
      category: template.category,
      withinWindow: this.isWithin24HourWindow(phoneNumber)
    };
  }

  /**
   * Health check for template service
   */
  async healthCheck() {
    try {
      const templateCount = Object.keys(this.approvedTemplates).length;
      
      return {
        status: 'healthy',
        service: 'Template Service',
        templatesConfigured: templateCount,
        templates: Object.keys(this.approvedTemplates)
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'Template Service',
        error: error.message
      };
    }
  }

  // ============================================================================
  // MULTI-TENANT TEMPLATE METHODS
  // ============================================================================

  /**
   * Send agent-specific welcome template
   * @param {Object} params - Parameters
   * @param {string} params.phoneNumber - Lead's phone number
   * @param {string} params.leadName - Lead's name
   * @param {string} params.agentId - Agent UUID
   * @param {string} params.contactReason - Contact reason (optional)
   * @returns {Promise<Object>} Send result
   */
  async sendAgentWelcomeTemplate({ phoneNumber, leadName, agentId, contactReason = 'your property enquiry' }) {
    try {
      this._validatePhoneNumber(phoneNumber);

      // Get agent-specific templates
      const agentTemplates = await multiTenantConfigService.getAgentTemplates(agentId, 'MARKETING');
      const welcomeTemplate = agentTemplates.find(t => t.template_name.includes('welcome') || t.template_name.includes('intro'));

      if (!welcomeTemplate) {
        // Fallback to default template
        logger.warn({ agentId, phoneNumber }, 'No agent-specific welcome template found, using default');
        return this.sendWelcomeTemplate({ phoneNumber, leadName, contactReason });
      }

      // Get agent WABA configuration
      const agentWABAConfig = await multiTenantConfigService.getAgentWABAConfig(agentId);

      // Create agent-specific WhatsApp service
      const agentWhatsAppService = new (require('./whatsappService').constructor)(agentWABAConfig);

      const params = [leadName, contactReason];

      logger.info({
        phoneNumber,
        agentId,
        templateId: welcomeTemplate.template_id,
        templateName: welcomeTemplate.template_name,
        wabaNumber: agentWABAConfig.wabaNumber,
        params
      }, 'Sending agent-specific welcome template');

      const result = await agentWhatsAppService.sendTemplateMessage({
        to: phoneNumber,
        templateId: welcomeTemplate.template_id,
        params,
        category: welcomeTemplate.template_category,
        templateName: welcomeTemplate.template_name
      });

      // Log template usage for compliance
      await this._logAgentTemplateUsage({
        agentId,
        phoneNumber,
        templateId: welcomeTemplate.template_id,
        templateName: welcomeTemplate.template_name,
        category: welcomeTemplate.template_category,
        params,
        messageId: result.messageId
      });

      return result;

    } catch (error) {
      logger.error({ err: error, phoneNumber, agentId }, 'Failed to send agent-specific welcome template');
      throw error;
    }
  }

  /**
   * Get agent-specific templates
   * @param {string} agentId - Agent UUID
   * @param {string} category - Template category (optional)
   * @returns {Promise<Array>} Agent templates
   */
  async getAgentTemplates(agentId, category = null) {
    try {
      return await multiTenantConfigService.getAgentTemplates(agentId, category);
    } catch (error) {
      logger.error({ err: error, agentId, category }, 'Failed to get agent templates');
      throw error;
    }
  }

  /**
   * Create or update agent template
   * @param {string} agentId - Agent UUID
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created/updated template
   */
  async upsertAgentTemplate(agentId, templateData) {
    try {
      return await multiTenantConfigService.upsertAgentTemplate(agentId, templateData);
    } catch (error) {
      logger.error({ err: error, agentId, templateData }, 'Failed to upsert agent template');
      throw error;
    }
  }

  /**
   * Log agent template usage for compliance
   * @private
   */
  async _logAgentTemplateUsage(usageData) {
    try {
      // Template usage logging - create a proper method in databaseService if needed
      logger.debug({
        agentId: usageData.agentId,
        templateName: usageData.templateName,
        phoneNumber: usageData.phoneNumber
      }, 'Agent template usage logged for compliance');
    } catch (error) {
      logger.error({ err: error, usageData }, 'Error logging agent template usage');
    }
  }
}

module.exports = new TemplateService();
