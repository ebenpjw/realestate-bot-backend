
const axios = require('axios');
const qs = require('qs');

// Delay based on message length
function getDelayDuration(text) {
  const len = text.length;
  if (len < 80) return 1500 + 2000;     // ~3.5 sec
  if (len < 200) return 2500 + 2000;    // ~4.5 sec
  return 4500 + 2000;                   // ~6.5 sec
}

async function sendWhatsAppMessage({ to, message }) {
  const messages = message.split('\n\n'); // Split into 2 parts if formatted that way

  for (const part of messages) {
    const delay = getDelayDuration(part);
    console.log('⏳ Preparing to send:', part);
    console.log(`⏱ Waiting ${delay}ms before sending...`);

    await new Promise(resolve => setTimeout(resolve, delay));

    const payload = qs.stringify({
      channel: 'whatsapp',
      source: process.env.WABA_NUMBER,
      destination: to,
      'src.name': 'SmartGuide Doro',
      message: JSON.stringify({
        type: 'text',
        text: part
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

      console.log('✅ WhatsApp message sent:', part);
    } catch (err) {
      console.error('❌ Send error:', err.response?.data || err.message);
    }
  }
}

module.exports = { sendWhatsAppMessage };
