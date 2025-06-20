const axios = require('axios');
const qs = require('qs');

async function sendWhatsAppMessage({ to, message }) {
  const payload = qs.stringify({
    channel: 'whatsapp',
    source: process.env.WABA_NUMBER,
    destination: to,
    'src.name': 'SmartGuide Doro', // use your approved display name
    message: JSON.stringify({
      type: 'text',
      text: message
    })
  });

  try {
    const response = await axios.post(
      'https://api.gupshup.io/wa/api/v1/msg',
      payload,
      {
        headers: {
          apikey: process.env.GUPSHUP_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    console.log('✅ WhatsApp message sent:', response.data);
  } catch (err) {
    console.error('❌ Failed to send WhatsApp message:', err.response?.data || err.message);
  }
}

module.exports = { sendWhatsAppMessage };
