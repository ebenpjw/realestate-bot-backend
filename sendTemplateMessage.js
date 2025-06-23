const axios = require('axios');
const qs = require('qs');

// NOTE: This function now expects a templateId, not a templateName.
async function sendTemplateMessage({ to, templateId, params }) {
  // Gupshup requires the template data to be a JSON object string
  // containing the template's ID and the parameters.
  const templateObject = {
    id: templateId,
    params: params
  };

  const payload = qs.stringify({
    channel: 'whatsapp',
    source: process.env.WABA_NUMBER,
    destination: to,
    'src.name': 'DoroSmartGuide', // Using the name from your curl command
    template: JSON.stringify(templateObject)
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
