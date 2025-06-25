// test-webhook.js - Test webhook functionality
const axios = require('axios');
const logger = require('./logger');

async function testWebhook() {
  const webhookUrl = 'https://realestate-bot-backend-production.up.railway.app/api/gupshup/webhook';
  
  // Simulate a Gupshup webhook payload
  const testPayload = {
    type: 'message',
    payload: {
      type: 'text',
      source: '6596799123', // Your phone number from the logs
      payload: {
        text: 'Hello, I want to test the bot'
      },
      sender: {
        name: 'Test User'
      }
    }
  };

  try {
    logger.info('🧪 Testing webhook with simulated message...');
    
    const response = await axios.post(webhookUrl, testPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    logger.info({
      status: response.status,
      statusText: response.statusText
    }, '✅ Webhook test successful');

    return true;
  } catch (error) {
    logger.error({
      err: error.response?.data || error.message,
      status: error.response?.status
    }, '❌ Webhook test failed');
    
    return false;
  }
}

// Run test if called directly
if (require.main === module) {
  testWebhook()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error({ err: error }, '💥 Webhook test execution failed');
      process.exit(1);
    });
}

module.exports = { testWebhook };
