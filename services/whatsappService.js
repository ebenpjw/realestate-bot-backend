const axios = require('axios');
const config = require('../config');
const logger = require('../logger');
const { MESSAGE, VALIDATION } = require('../constants');
const { ExternalServiceError, ValidationError } = require('../middleware/errorHandler');

class WhatsAppService {
  constructor(agentConfig = null) {
    this.baseURL = 'https://api.gupshup.io/wa/api/v1';
    this.timeout = config.GUPSHUP_TIMEOUT || 10000;

    // Multi-tenant support: use agent config if provided, otherwise use default config
    if (agentConfig) {
      this.apiKey = agentConfig.apiKey;
      this.wabaNumber = agentConfig.wabaNumber;
      this.displayName = agentConfig.displayName;
      this.isMultiTenant = true;
    } else {
      this.apiKey = config.GUPSHUP_API_KEY;
      this.wabaNumber = config.WABA_NUMBER;
      this.displayName = 'SmartGuide Doro';
      this.isMultiTenant = false;
    }

    // Create axios instance with configuration
    this._createAxiosClient();

    // Add request/response interceptors for logging
    this._setupInterceptors();
  }

  /**
   * Create or recreate axios client with current configuration
   * @private
   */
  _createAxiosClient() {
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }

  /**
   * Update configuration for multi-tenant support
   * @param {Object} agentConfig - Agent WABA configuration
   */
  updateConfiguration(agentConfig) {
    this.apiKey = agentConfig.apiKey;
    this.wabaNumber = agentConfig.wabaNumber;
    this.displayName = agentConfig.displayName;
    this.isMultiTenant = true;

    // Recreate axios client with new configuration
    this._createAxiosClient();
    this._setupInterceptors();

    logger.info({
      wabaNumber: this.wabaNumber,
      displayName: this.displayName
    }, 'WhatsApp service configuration updated for agent');
  }

  /**
   * Send a WhatsApp message
   * @param {Object} params - Message parameters
   * @param {string} params.to - Recipient phone number
   * @param {string} params.message - Message text
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendMessage({ to, message }, _options = {}) {
    try {
      // CRITICAL SAFETY CHECK: Block test phone numbers
      const testNumbers = ['+6591234567', '+6587654321', '+6512345678'];
      if (testNumbers.includes(to)) {
        logger.error({
          to,
          messageLength: message?.length,
          reason: 'Test phone number blocked'
        }, '🚫 CRITICAL SAFETY: Test phone number blocked - NO MESSAGE SENT');

        return this._createMockResponse(to, message);
      }

      // SAFETY CHECK: Prevent real messages during testing/development
      if (config.DISABLE_WHATSAPP_SENDING || config.TESTING_MODE || config.DRY_RUN_MODE) {
        logger.warn({
          to,
          messageLength: message?.length,
          disableFlag: config.DISABLE_WHATSAPP_SENDING,
          testingMode: config.TESTING_MODE,
          dryRunMode: config.DRY_RUN_MODE
        }, '🚫 SAFETY: WhatsApp message sending disabled - returning mock response');

        return this._createMockResponse(to, message);
      }

      // Validate inputs
      this._validateMessageParams({ to, message });

      // Split message into parts if needed
      const messageParts = this._splitMessage(message);
      const results = [];

      for (let i = 0; i < messageParts.length; i++) {
        const part = messageParts[i];
        
        // Calculate delay based on message length
        if (i > 0) {
          const delay = this._calculateDelay(part);
          await this._delay(delay);
        }

        const result = await this._sendSingleMessage({
          to,
          message: part,
          isMultipart: messageParts.length > 1,
          partIndex: i + 1,
          totalParts: messageParts.length
        });

        results.push(result);
      }

      logger.info({ 
        to, 
        messageLength: message.length,
        parts: messageParts.length,
        success: results.every(r => r.success)
      }, 'WhatsApp message sent');

      return {
        success: results.every(r => r.success),
        results,
        totalParts: messageParts.length
      };

    } catch (error) {
      logger.error({ 
        err: error, 
        to, 
        messageLength: message?.length 
      }, 'WhatsApp message send failed');
      
      throw error;
    }
  }

  /**
   * Send a template message (WABA compliant)
   * @param {Object} params - Template parameters
   * @param {string} params.to - Recipient phone number
   * @param {string} params.templateId - Template ID
   * @param {Array} params.params - Template parameters
   * @param {string} params.templateName - Template name for logging
   * @param {string} params.category - Template category (MARKETING, UTILITY, AUTHENTICATION)
   * @returns {Promise<Object>} Send result
   */
  async sendTemplateMessage({ to, templateId, params = [], templateName = '', category = 'UTILITY' }) {
    try {
      // CRITICAL SAFETY CHECK: Block test phone numbers
      const testNumbers = ['+6591234567', '+6587654321', '+6512345678'];
      if (testNumbers.includes(to)) {
        logger.error({
          to,
          templateId,
          templateName,
          reason: 'Test phone number blocked'
        }, '🚫 CRITICAL SAFETY: Test phone number blocked - NO TEMPLATE SENT');

        return this._createMockTemplateResponse(to, templateId, templateName);
      }

      // SAFETY CHECK: Prevent real template messages during testing/development
      if (config.DISABLE_WHATSAPP_SENDING || config.TESTING_MODE || config.DRY_RUN_MODE) {
        logger.warn({
          to,
          templateId,
          templateName,
          category,
          params: params.length,
          disableFlag: config.DISABLE_WHATSAPP_SENDING,
          testingMode: config.TESTING_MODE,
          dryRunMode: config.DRY_RUN_MODE
        }, '🚫 SAFETY: WhatsApp template sending disabled - returning mock response');

        return this._createMockTemplateResponse(to, templateId, templateName);
      }

      // Validate inputs
      this._validateTemplateParams({ to, templateId, params });

      // WABA 2025: Conversation-based pricing model with enhanced compliance
      await this._validateTemplateCompliance({ to, templateId, category, templateName });

      const templateObject = { id: templateId, params };
      const payload = new URLSearchParams({
        channel: 'whatsapp',
        source: this.wabaNumber,
        destination: to,
        'src.name': this.displayName,
        template: JSON.stringify(templateObject)
      }).toString();

      logger.info({
        to,
        templateId,
        templateName,
        category,
        params: params.length
      }, 'Sending WABA template message');

      const response = await this.client.post('/template/msg', payload);

      const success = response.data?.status === 'submitted';

      // Note: Template usage logging is handled by TemplateService to avoid duplication

      logger.info({
        to,
        templateId,
        templateName,
        success,
        messageId: response.data?.messageId
      }, 'WhatsApp template message sent');

      return {
        success,
        messageId: response.data?.messageId,
        response: response.data
      };

    } catch (error) {
      logger.error({
        err: error.response?.data || error.message,
        to,
        templateId,
        templateName
      }, 'WhatsApp template message failed');

      throw new ExternalServiceError('Gupshup', error.message, error);
    }
  }

  /**
   * Validate message parameters
   * @private
   */
  _validateMessageParams({ to, message }) {
    if (!to || typeof to !== 'string') {
      throw new ValidationError('Recipient phone number is required');
    }

    if (!VALIDATION.PHONE.PATTERN.test(to)) {
      throw new ValidationError('Invalid phone number format');
    }

    if (!message || typeof message !== 'string') {
      throw new ValidationError('Message text is required');
    }

    if (message.length > MESSAGE.MAX_LENGTH) {
      throw new ValidationError(`Message too long. Maximum ${MESSAGE.MAX_LENGTH} characters allowed`);
    }

    if (message.trim().length === 0) {
      throw new ValidationError('Message cannot be empty');
    }
  }

  /**
   * Validate template parameters
   * @private
   */
  _validateTemplateParams({ to, templateId, params }) {
    if (!to || typeof to !== 'string') {
      throw new ValidationError('Recipient phone number is required');
    }

    if (!VALIDATION.PHONE.PATTERN.test(to)) {
      throw new ValidationError('Invalid phone number format');
    }

    if (!templateId || typeof templateId !== 'string') {
      throw new ValidationError('Template ID is required');
    }

    if (!Array.isArray(params)) {
      throw new ValidationError('Template parameters must be an array');
    }
  }

  /**
   * Split long messages into parts
   * @private
   */
  _splitMessage(message) {
    // Split by double newlines first (natural message breaks)
    const naturalParts = message.split('\n\n').filter(part => part.trim());
    
    // If all parts are within limit, return them
    if (naturalParts.every(part => part.length <= MESSAGE.MAX_LENGTH)) {
      return naturalParts;
    }

    // Otherwise, split more aggressively
    const parts = [];
    for (const part of naturalParts) {
      if (part.length <= MESSAGE.MAX_LENGTH) {
        parts.push(part);
      } else {
        // Split long parts by sentences or at word boundaries
        const sentences = part.split(/[.!?]+/).filter(s => s.trim());
        let currentPart = '';
        
        for (const sentence of sentences) {
          if ((currentPart + sentence).length <= MESSAGE.MAX_LENGTH) {
            currentPart += `${sentence}.`;
          } else {
            if (currentPart) parts.push(currentPart.trim());
            currentPart = `${sentence}.`;
          }
        }
        
        if (currentPart) parts.push(currentPart.trim());
      }
    }

    return parts.length > 0 ? parts : [message.substring(0, MESSAGE.MAX_LENGTH)];
  }

  /**
   * Send a single message part
   * @private
   */
  async _sendSingleMessage({ to, message, isMultipart, partIndex, totalParts }) {
    try {
      // Validate inputs before sending
      if (!this.wabaNumber) {
        throw new Error('WABA number not configured');
      }

      if (!this.apiKey) {
        throw new Error('Gupshup API key not configured');
      }

      const payload = new URLSearchParams({
        channel: 'whatsapp',
        source: this.wabaNumber,
        destination: to,
        'src.name': this.displayName,
        message: JSON.stringify({ type: 'text', text: message })
      }).toString();

      logger.info({
        to,
        messageLength: message.length,
        wabaNumber: this.wabaNumber,
        payloadSize: payload.length,
        baseURL: this.baseURL,
        hasApiKey: !!this.apiKey
      }, 'Sending WhatsApp message to Gupshup API');

      const response = await this.client.post('/msg', payload);

      const success = response.data?.status === 'submitted';

      logger.info({
        to,
        messageLength: message.length,
        isMultipart,
        partIndex,
        totalParts,
        success,
        messageId: response.data?.messageId,
        responseStatus: response.data?.status,
        responseData: response.data
      }, success ? 'WhatsApp message part sent successfully' : 'WhatsApp message part submission failed');

      return {
        success,
        messageId: response.data?.messageId,
        response: response.data,
        partIndex,
        totalParts
      };

    } catch (error) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers ? { ...error.config.headers, apikey: '[REDACTED]' } : undefined
        }
      };

      logger.error({
        err: errorDetails,
        to,
        partIndex,
        messageLength: message.length
      }, 'WhatsApp message part failed');

      return {
        success: false,
        error: error.message,
        errorDetails,
        partIndex,
        totalParts
      };
    }
  }

  /**
   * Calculate delay based on message length
   * @private
   */
  _calculateDelay(text) {
    const length = text.length;
    let baseDelay;
    
    if (length < 80) {
      baseDelay = MESSAGE.DELAY.SHORT;
    } else if (length < 200) {
      baseDelay = MESSAGE.DELAY.MEDIUM;
    } else {
      baseDelay = MESSAGE.DELAY.LONG;
    }
    
    // Add random factor to make it more natural
    return baseDelay + Math.random() * MESSAGE.DELAY.RANDOM_FACTOR;
  }

  /**
   * Delay execution
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Setup axios interceptors for logging
   * @private
   */
  _setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        logger.debug({ 
          url: config.url, 
          method: config.method 
        }, 'Gupshup API request');
        return config;
      },
      (error) => {
        logger.error({ err: error }, 'Gupshup API request error');
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug({ 
          status: response.status, 
          url: response.config.url 
        }, 'Gupshup API response');
        return response;
      },
      (error) => {
        logger.error({ 
          err: error.response?.data || error.message,
          status: error.response?.status,
          url: error.config?.url
        }, 'Gupshup API response error');
        return Promise.reject(error);
      }
    );
  }

  /**
   * WABA 2025: Validate template compliance for conversation-based pricing
   * @private
   */
  async _validateTemplateCompliance({ to, templateId, category, templateName }) {
    try {
      // WABA 2025: Enhanced compliance checks
      const validationChecks = {
        templateExists: !!templateId,
        validCategory: ['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(category),
        validPhoneNumber: /^\d{10,15}$/.test(to.replace(/\D/g, '')),
        businessInitiated: true // All template messages are business-initiated
      };

      // Log compliance validation for audit trail
      logger.info({
        to: `${to.substring(0, 5)}***`, // Mask phone number for privacy
        templateId,
        templateName,
        category,
        validationChecks,
        complianceVersion: '2025.1'
      }, 'WABA 2025 template compliance validation');

      // Check for marketing template specific requirements
      if (category === 'MARKETING') {
        // WABA 2025: Marketing templates require user opt-in verification
        logger.info({
          to: `${to.substring(0, 5)}***`,
          templateId,
          category
        }, 'Marketing template - ensure user has opted in for marketing messages');
      }

      return {
        compliant: Object.values(validationChecks).every(check => check === true),
        checks: validationChecks,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error({ err: error, to, templateId }, 'Template compliance validation failed');
      return { compliant: false, error: error.message };
    }
  }





  /**
   * Create mock response for testing/development safety
   * @private
   */
  _createMockResponse(to, message) {
    const messageParts = this._splitMessage(message);
    const mockResults = messageParts.map((part, index) => ({
      success: true,
      messageId: `mock_msg_${Date.now()}_${index}`,
      status: 'sent',
      to,
      message: part,
      timestamp: new Date().toISOString(),
      mock: true
    }));

    return {
      success: true,
      results: mockResults,
      totalParts: messageParts.length,
      mock: true,
      reason: 'Safety mode enabled - no real message sent'
    };
  }

  /**
   * Create mock template response for testing/development safety
   * @private
   */
  _createMockTemplateResponse(to, templateId, templateName) {
    return {
      success: true,
      messageId: `mock_template_${Date.now()}`,
      status: 'sent',
      to,
      templateId,
      templateName,
      timestamp: new Date().toISOString(),
      mock: true,
      reason: 'Safety mode enabled - no real template sent'
    };
  }

  /**
   * Health check for WhatsApp service
   */
  async healthCheck() {
    try {
      // Check if safety modes are enabled
      if (config.DISABLE_WHATSAPP_SENDING || config.TESTING_MODE || config.DRY_RUN_MODE) {
        return {
          status: 'healthy',
          service: 'whatsapp',
          mode: 'safety_enabled',
          message: 'WhatsApp service running in safe mode - no real messages will be sent',
          safetyFlags: {
            disableWhatsappSending: config.DISABLE_WHATSAPP_SENDING,
            testingMode: config.TESTING_MODE,
            dryRunMode: config.DRY_RUN_MODE
          }
        };
      }

      // Check if required configuration is present
      if (!this.apiKey || !this.wabaNumber) {
        return {
          status: 'unhealthy',
          service: 'Gupshup WhatsApp API',
          error: 'Missing API key or WABA number configuration'
        };
      }

      // For Railway deployment, just verify configuration is present
      // Actual API connectivity will be tested when messages are sent
      return {
        status: 'healthy',
        service: 'Gupshup WhatsApp API',
        wabaNumber: this.wabaNumber,
        configured: true,
        note: 'Configuration verified - API connectivity tested on message send'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'Gupshup WhatsApp API',
        error: error.message
      };
    }
  }
}

module.exports = new WhatsAppService();
