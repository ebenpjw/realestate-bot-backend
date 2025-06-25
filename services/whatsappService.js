const axios = require('axios');
const qs = require('qs');
const config = require('../config');
const logger = require('../logger');
const { SERVICES, MESSAGE, VALIDATION } = require('../constants');
const { ExternalServiceError, ValidationError } = require('../middleware/errorHandler');

class WhatsAppService {
  constructor() {
    this.baseURL = SERVICES.GUPSHUP.BASE_URL;
    this.timeout = config.GUPSHUP_TIMEOUT || SERVICES.GUPSHUP.TIMEOUT;
    this.apiKey = config.GUPSHUP_API_KEY;
    this.wabaNumber = config.WABA_NUMBER;
    
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Add request/response interceptors for logging
    this._setupInterceptors();
  }

  /**
   * Send a WhatsApp message
   * @param {Object} params - Message parameters
   * @param {string} params.to - Recipient phone number
   * @param {string} params.message - Message text
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendMessage({ to, message }, options = {}) {
    try {
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
      // Validate inputs
      this._validateTemplateParams({ to, templateId, params });

      // Check template rate limits (WABA compliance)
      await this._checkTemplateRateLimit(to, templateId, category);

      const templateObject = { id: templateId, params };
      const payload = qs.stringify({
        channel: 'whatsapp',
        source: this.wabaNumber,
        destination: to,
        'src.name': 'DoroSmartGuide',
        template: JSON.stringify(templateObject)
      });

      logger.info({
        to,
        templateId,
        templateName,
        category,
        params: params.length
      }, 'Sending WABA template message');

      const response = await this.client.post('/template/msg', payload);

      const success = response.data?.status === 'submitted';

      if (success) {
        // Log successful template usage for compliance
        await this._logTemplateUsage({
          to,
          templateId,
          templateName,
          category,
          messageId: response.data?.messageId
        });
      }

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
            currentPart += sentence + '.';
          } else {
            if (currentPart) parts.push(currentPart.trim());
            currentPart = sentence + '.';
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

      const payload = qs.stringify({
        channel: 'whatsapp',
        source: this.wabaNumber,
        destination: to,
        'src.name': 'SmartGuide Doro',
        message: JSON.stringify({ type: 'text', text: message })
      });

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
   * Check template rate limits for WABA compliance
   * @private
   */
  async _checkTemplateRateLimit(phoneNumber, templateId, category) {
    try {
      const databaseService = require('./databaseService');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check daily template limits per phone number
      const { data: todayUsage, error } = await databaseService.supabase
        .from('template_usage_log')
        .select('*')
        .eq('phone_number', phoneNumber)
        .gte('sent_at', today.toISOString());

      if (error) {
        logger.warn({ err: error }, 'Failed to check template rate limit');
        return; // Don't block on rate limit check failure
      }

      const dailyCount = todayUsage?.length || 0;
      const categoryCount = todayUsage?.filter(t => t.template_category === category).length || 0;

      // WABA limits (conservative approach)
      const limits = {
        MARKETING: 10, // Marketing templates are more restricted
        UTILITY: 50,   // Utility templates have higher limits
        AUTHENTICATION: 100 // Auth templates have highest limits
      };

      const dailyLimit = limits[category] || limits.UTILITY;

      if (categoryCount >= dailyLimit) {
        throw new ValidationError(`Daily ${category} template limit (${dailyLimit}) exceeded for ${phoneNumber}`);
      }

      logger.debug({
        phoneNumber,
        category,
        dailyCount,
        categoryCount,
        limit: dailyLimit
      }, 'Template rate limit check passed');

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.warn({ err: error }, 'Template rate limit check failed, proceeding');
    }
  }

  /**
   * Log template usage for compliance tracking
   * @private
   */
  async _logTemplateUsage({ to, templateId, templateName, category, messageId }) {
    try {
      const databaseService = require('./databaseService');

      await databaseService.supabase
        .from('template_usage_log')
        .insert({
          phone_number: to,
          template_id: templateId,
          template_name: templateName,
          template_category: category,
          message_id: messageId,
          whatsapp_message_id: messageId,
          sent_at: new Date().toISOString()
        });

      logger.debug({
        templateName,
        category,
        phoneNumber: to
      }, 'Template usage logged for WABA compliance');

    } catch (error) {
      // Don't fail the main operation if logging fails
      logger.warn({
        err: error,
        templateName,
        phoneNumber: to
      }, 'Failed to log template usage');
    }
  }

  /**
   * Health check for WhatsApp service
   */
  async healthCheck() {
    try {
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
