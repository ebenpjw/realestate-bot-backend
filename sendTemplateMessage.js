const axios = require('axios');
const qs = require('qs');
const config = require('./config');
const logger = require('./logger');

async function sendTemplateMessage({ to, templateId, params }) {
  const templateObject = { id: templateId, params: params };
  const payload = qs.stringify({
    channel: 'whatsapp',
    source: config.WABA_NUMBER,
    destination: to,
    'src.name': 'DoroSmartGuide',
    template: JSON.stringify(templateObject)
  });

  try {
    const response = await axios.post(
      'https://api.gupshup.io/wa/api/v1/template/msg',
      payload,
      {
        headers: {
          apikey: config.GUPSHUP_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    logger.info({ to, templateId, response: response.data }, 'Template message sent successfully!');
    return response.data;
  } catch (err) {
    logger.error({ err: err.response?.data || err.message, to, templateId }, 'Template message error');
    return null;
  }
}

module.exports = { sendTemplateMessage };