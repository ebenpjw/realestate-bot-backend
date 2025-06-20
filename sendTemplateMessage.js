
const axios = require('axios');
const qs = require('qs');

async function sendTemplateMessage({ to, templateName, params }) {
  const payload = qs.stringify({
    template: templateName,
    channel: 'whatsapp',
    source: process.env.WABA_NUMBER,
    destination: to,
    'src.name': 'SmartGuide Doro',
    templateParams: JSON.stringify(params)
  });

  try {
    const response = await axios.post(
      'https://api.gupshup.io/wa/api/v1/template/msg',
      payload,
      {
        headers: {
          apikey: process.env.GUPSHUP_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('✅ Template message sent! Gupshup response:', response.data);
    return response.data;
  } catch (err) {
    console.error('❌ Template message error:', err.response?.data || err.message);
    return null;
  }
}

module.exports = { sendTemplateMessage };
