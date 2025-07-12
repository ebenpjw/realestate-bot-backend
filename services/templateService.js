const whatsappService = require('./whatsappService');
const databaseService = require('./databaseService');
const multiTenantConfigService = require('./multiTenantConfigService');
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
    // WABA-compliant templates (these are your approved templates in Gupshup)
    this.approvedTemplates = {
      // Your existing approved welcome template (lead_intro_1)
      WELCOME_REAL_ESTATE: {
        id: process.env.TEMPLATE_WELCOME_ID ||
            process.env.DEFAULT_WELCOME_TEMPLATE_ID ||
            'c60dee92-5426-4890-96e4-65469620ac7e', // Your approved template ID
        gupshupName: 'lead_intro_1', // Template name in Gupshup dashboard
        name: 'welcome_real_estate', // Internal reference name
        category: 'MARKETING', // As shown in your Gupshup dashboard
        language: 'EN',
        description: 'Approved welcome message for real estate leads',
        params: ['{{1}}', '{{2}}'], // [leadName, contactReason]
        content: 'Hi {{1}}, thanks for leaving your contact regarding {{2}}! 😊\n\nJust checking in to see what caught your eye or what you\'re exploring.\n\nFeel free to let me know, I\'ll do my best to help!',
        example: 'Hi John, thanks for leaving your contact regarding your property enquiry! 😊',
        // WABA 2025: Enhanced metadata for compliance tracking
        businessInitiated: true,
        conversationType: 'marketing',
        qualityRating: 'HIGH', // Template quality rating
        approvalStatus: 'APPROVED',
        lastUpdated: '2025-06-25'
      },
      PROPERTY_INQUIRY_FOLLOWUP: {
        id: process.env.TEMPLATE_FOLLOWUP_ID || 'followup_template_id',
        name: 'property_inquiry_followup',
        category: 'UTILITY',
        description: 'Follow up on property inquiry',
        params: ['{{1}}', '{{2}}', '{{3}}'], // [leadName, propertyType, location]
        example: 'Hi {{1}}, following up on your interest in {{2}} properties in {{3}}.'
      },
      CONSULTATION_REMINDER: {
        id: process.env.TEMPLATE_REMINDER_ID || 'reminder_template_id',
        name: 'consultation_reminder',
        category: 'UTILITY',
        description: 'Reminder for scheduled consultation',
        params: ['{{1}}', '{{2}}'], // [leadName, appointmentTime]
        example: 'Hi {{1}}, reminder: Your property consultation is scheduled for {{2}}.'
      },
      PROPERTY_UPDATE: {
        id: process.env.TEMPLATE_UPDATE_ID || 'update_template_id',
        name: 'property_update',
        category: 'MARKETING',
        description: 'New property listings update',
        params: ['{{1}}', '{{2}}'], // [leadName, propertyDetails]
        example: 'Hi {{1}}, new property alert: {{2}}. Interested to know more?'
      }
    };

    logger.info({
      templatesConfigured: Object.keys(this.approvedTemplates).length,
      welcomeTemplateId: this.approvedTemplates.WELCOME_REAL_ESTATE.id
    }, 'Template service initialized with approved templates');
  }

  /**
   * Send your approved welcome template (lead_intro_1)
   * @param {Object} params - Parameters
   * @param {string} params.phoneNumber - Lead's phone number
   * @param {string} params.leadName - Lead's name ({{1}} in template)
   * @param {string} params.contactReason - What they contacted about ({{2}} in template)
   * @returns {Promise<Object>} Send result
   */
  async sendWelcomeTemplate({ phoneNumber, leadName, contactReason = 'your property enquiry' }) {
    try {
      this._validatePhoneNumber(phoneNumber);

      const template = this.approvedTemplates.WELCOME_REAL_ESTATE;
      // Exact parameters for your approved template: Hi {{1}}, thanks for leaving your contact regarding {{2}}!
      const params = [leadName, contactReason];

      logger.info({
        phoneNumber,
        templateId: template.id,
        gupshupName: template.gupshupName,
        params,
        previewMessage: `Hi ${leadName}, thanks for leaving your contact regarding ${contactReason}! 😊`
      }, 'Sending approved welcome template (lead_intro_1)');

      const result = await whatsappService.sendTemplateMessage({
        to: phoneNumber,
        templateId: template.id,
        params
      });

      if (result.success) {
        // Log template usage for compliance tracking
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
      await databaseService.supabase
        .from('template_usage_log')
        .insert({
          phone_number: templateData.phoneNumber,
          template_id: templateData.templateId,
          template_name: templateData.templateName,
          template_category: templateData.category,
          template_params: templateData.params,
          message_id: templateData.messageId,
          sent_at: new Date().toISOString(),
          status: 'sent',
          created_at: new Date().toISOString()
        });

      logger.debug({
        templateName: templateData.templateName,
        phoneNumber: templateData.phoneNumber
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
      const { error } = await databaseService.supabase
        .from('template_usage_log')
        .insert({
          agent_id: usageData.agentId,
          phone_number: usageData.phoneNumber,
          template_id: usageData.templateId,
          template_name: usageData.templateName,
          template_category: usageData.category,
          template_params: usageData.params,
          message_id: usageData.messageId,
          sent_at: new Date().toISOString(),
          status: 'sent',
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error({ err: error, usageData }, 'Failed to log agent template usage');
      } else {
        logger.debug({
          agentId: usageData.agentId,
          templateName: usageData.templateName,
          phoneNumber: usageData.phoneNumber
        }, 'Agent template usage logged for compliance');
      }
    } catch (error) {
      logger.error({ err: error, usageData }, 'Error logging agent template usage');
    }
  }
}

module.exports = new TemplateService();
