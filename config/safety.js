/**
 * Safety Configuration for Real Estate Bot
 * Prevents real messages from being sent during testing and development
 */

const config = require('../config');
const logger = require('../logger');

class SafetyManager {
  constructor() {
    this.safetyFlags = {
      disableWhatsappSending: config.DISABLE_WHATSAPP_SENDING,
      testingMode: config.TESTING_MODE,
      dryRunMode: config.DRY_RUN_MODE,
      mockWhatsappResponses: config.MOCK_WHATSAPP_RESPONSES
    };

    // Log safety status on initialization
    this.logSafetyStatus();
  }

  /**
   * Check if any safety mode is enabled
   * @returns {boolean} True if safety mode is active
   */
  isSafetyModeEnabled() {
    return this.safetyFlags.disableWhatsappSending || 
           this.safetyFlags.testingMode || 
           this.safetyFlags.dryRunMode;
  }

  /**
   * Check if WhatsApp sending should be blocked
   * @returns {boolean} True if sending should be blocked
   */
  shouldBlockWhatsAppSending() {
    return this.isSafetyModeEnabled();
  }

  /**
   * Get safety status for logging/monitoring
   * @returns {Object} Safety status object
   */
  getSafetyStatus() {
    return {
      safetyEnabled: this.isSafetyModeEnabled(),
      flags: { ...this.safetyFlags },
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Enable testing mode (prevents all real messages)
   */
  enableTestingMode() {
    this.safetyFlags.testingMode = true;
    logger.warn('🚫 SAFETY: Testing mode enabled - all WhatsApp messages will be mocked');
  }

  /**
   * Enable dry run mode (logs what would be sent but doesn't send)
   */
  enableDryRunMode() {
    this.safetyFlags.dryRunMode = true;
    logger.warn('🚫 SAFETY: Dry run mode enabled - messages will be logged but not sent');
  }

  /**
   * Disable all WhatsApp sending
   */
  disableWhatsAppSending() {
    this.safetyFlags.disableWhatsappSending = true;
    logger.warn('🚫 SAFETY: WhatsApp sending disabled completely');
  }

  /**
   * Reset safety flags to environment defaults
   */
  resetToDefaults() {
    this.safetyFlags = {
      disableWhatsappSending: config.DISABLE_WHATSAPP_SENDING,
      testingMode: config.TESTING_MODE,
      dryRunMode: config.DRY_RUN_MODE,
      mockWhatsappResponses: config.MOCK_WHATSAPP_RESPONSES
    };
    this.logSafetyStatus();
  }

  /**
   * Log current safety status
   * @private
   */
  logSafetyStatus() {
    const status = this.getSafetyStatus();
    
    if (status.safetyEnabled) {
      logger.warn({
        safetyFlags: status.flags,
        environment: status.environment
      }, '🚫 SAFETY MODE ACTIVE: Real WhatsApp messages will NOT be sent');
    } else {
      logger.info({
        safetyFlags: status.flags,
        environment: status.environment
      }, '✅ LIVE MODE: Real WhatsApp messages WILL be sent');
    }
  }

  /**
   * Create a safe message response for testing
   * @param {string} to - Recipient phone number
   * @param {string} message - Message content
   * @param {string} type - Message type ('regular' or 'template')
   * @returns {Object} Mock response object
   */
  createSafeResponse(to, message, type = 'regular') {
    const baseResponse = {
      success: true,
      to,
      timestamp: new Date().toISOString(),
      mock: true,
      safetyMode: true,
      reason: this._getSafetyReason()
    };

    if (type === 'template') {
      return {
        ...baseResponse,
        messageId: `mock_template_${Date.now()}`,
        status: 'sent',
        templateId: message.templateId || 'unknown',
        templateName: message.templateName || 'unknown'
      };
    }

    return {
      ...baseResponse,
      messageId: `mock_msg_${Date.now()}`,
      status: 'sent',
      message: message,
      messageLength: message?.length || 0
    };
  }

  /**
   * Get reason for safety mode activation
   * @private
   */
  _getSafetyReason() {
    const activeFlags = [];
    
    if (this.safetyFlags.disableWhatsappSending) activeFlags.push('DISABLE_WHATSAPP_SENDING');
    if (this.safetyFlags.testingMode) activeFlags.push('TESTING_MODE');
    if (this.safetyFlags.dryRunMode) activeFlags.push('DRY_RUN_MODE');
    
    return `Safety mode active due to: ${activeFlags.join(', ')}`;
  }

  /**
   * Validate that safety measures are working
   * @returns {Object} Validation results
   */
  validateSafetyMeasures() {
    const validation = {
      passed: true,
      checks: [],
      warnings: [],
      errors: []
    };

    // Check if safety flags are properly configured
    if (config.NODE_ENV === 'development' && !this.isSafetyModeEnabled()) {
      validation.warnings.push('Development environment detected but no safety mode enabled');
    }

    // Check if testing mode is properly configured
    if (this.safetyFlags.testingMode) {
      validation.checks.push('✅ Testing mode enabled - messages will be mocked');
    }

    // Check if dry run mode is properly configured
    if (this.safetyFlags.dryRunMode) {
      validation.checks.push('✅ Dry run mode enabled - messages will be logged only');
    }

    // Check if WhatsApp sending is disabled
    if (this.safetyFlags.disableWhatsappSending) {
      validation.checks.push('✅ WhatsApp sending disabled - no real messages will be sent');
    }

    // Overall safety validation
    if (this.isSafetyModeEnabled()) {
      validation.checks.push('✅ Safety mode is active - real messages are blocked');
    } else {
      validation.warnings.push('⚠️ No safety mode active - real messages WILL be sent');
    }

    return validation;
  }
}

// Export singleton instance
module.exports = new SafetyManager();
