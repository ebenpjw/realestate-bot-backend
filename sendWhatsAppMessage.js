const axios = require('axios');
const qs = require('qs');
const config = require('./config');
const logger = require('./logger');

function getDelayDuration(text) {
  const len = text.length;
  if (len < 80) return 1500 + Math.random() * 1000;
  if (len < 200) return 2500 + Math.random() * 1000;
  return 4500 + Math.random() * 1000;
}

async function sendWhatsAppMessage({ to, message }) {
  const messages = message.split('\n\n');

  for (const part of messages) {
    const delay = getDelayDuration(part);
    logger.info({ to, delay }, `Preparing to send message part: "${part}"`);
    
    await new Promise(resolve => setTimeout(resolve, delay));

    const payload = qs.stringify({
      channel: 'whatsapp',
      source: config.WABA_NUMBER,
      destination: to,
      'src.name': 'SmartGuide Doro',
      message: JSON.stringify({ type: 'text', text: part })
    });

    try {
      const response = await axios.post(
        'https://api.gupshup.io/wa/api/v1/msg',
        payload,
        {
          headers: {
            apikey: config.GUPSHUP_API_KEY,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      logger.info({ to, messageId: response.data?.messageId }, `WhatsApp message sent: "${part}"`);
    } catch (err) {
      logger.error({ err: err.response?.data || err.message, to }, `Send message error: "${part}"`);
    }
  }
}

module.exports = { sendWhatsAppMessage };