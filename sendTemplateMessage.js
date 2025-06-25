// sendTemplateMessage.js
// DEPRECATED: This file is kept for backward compatibility
// New code should use services/whatsappService.js

const whatsappService = require('./services/whatsappService');
const logger = require('./logger');

/**
 * @deprecated Use whatsappService.sendTemplateMessage() instead
 */
async function sendTemplateMessage({ to, templateId, params }) {
  logger.warn('sendTemplateMessage.js is deprecated. Use services/whatsappService.js instead');

  try {
    const result = await whatsappService.sendTemplateMessage({ to, templateId, params });
    return result.success ? result.response : null;
  } catch (error) {
    logger.error({ err: error, to, templateId }, 'Template message send failed');
    return null;
  }
}

module.exports = { sendTemplateMessage };