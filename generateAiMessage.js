// generateAiMessage.js
// DEPRECATED: This file is kept for backward compatibility
// New code should use services/aiService.js

const aiService = require('./services/aiService');
const logger = require('./logger');

/**
 * @deprecated Use aiService.generateResponse() instead
 */
module.exports = async function generateAiMessage({ lead, previousMessages = [] }) {
  logger.warn('generateAiMessage.js is deprecated. Use services/aiService.js instead');

  try {
    return await aiService.generateResponse({ lead, previousMessages });
  } catch (error) {
    logger.error({ err: error, leadId: lead?.id }, 'AI message generation failed');
    return {
      messages: ["Sorry, I had a slight issue there. Could you say that again?"],
      lead_updates: {},
      action: 'continue'
    };
  }
};