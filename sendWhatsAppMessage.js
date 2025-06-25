// sendWhatsAppMessage.js
// DEPRECATED: This file is kept for backward compatibility
// New code should use services/whatsappService.js

const whatsappService = require('./services/whatsappService');
const logger = require('./logger');

/**
 * @deprecated Use whatsappService.sendMessage() instead
 */
async function sendWhatsAppMessage({ to, message }) {
  logger.warn('sendWhatsAppMessage.js is deprecated. Use services/whatsappService.js instead');

  try {
    const result = await whatsappService.sendMessage({ to, message });
    return result;
  } catch (error) {
    logger.error({ err: error, to, messageLength: message?.length }, 'WhatsApp message send failed');
    throw error;
  }
}

module.exports = { sendWhatsAppMessage };