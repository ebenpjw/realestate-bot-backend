#!/usr/bin/env node

/**
 * Local Testing Setup Script
 * 
 * This script helps you set up local testing for WhatsApp webhook functionality.
 * It guides you through creating an ngrok tunnel and configuring webhooks for local development.
 */

const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.development') });

const logger = require('../logger');
const gupshupPartnerService = require('../services/gupshupPartnerService');

class LocalTestingSetup {
  constructor() {
    this.ngrokUrl = null;
    this.agentId = '2317daef-bad4-4e81-853c-3323b1eaacf7'; // Doro's agent ID
    this.appId = '74099ef2-87bf-47ac-b104-b6c1e550c8ad'; // Doro's app ID
  }

  async run() {
    try {
      console.log('🚀 Local Testing Setup for WhatsApp Webhooks\n');

      // Step 1: Check if local server is running
      await this.checkLocalServer();

      // Step 2: Get ngrok URL
      await this.setupNgrokTunnel();

      // Step 3: Configure webhook with ngrok URL
      await this.configureWebhookForTesting();

      // Step 4: Test webhook
      await this.testWebhook();

      console.log('\n🎉 Local testing setup completed successfully!');
      console.log('\n📋 Next Steps:');
      console.log('1. Send a WhatsApp message to +6580128102');
      console.log('2. Check your local server logs for webhook events');
      console.log('3. Verify the bot responds to messages');
      console.log('\n⚠️ Remember: When you stop ngrok, webhooks will stop working');
      console.log('   Run this script again if you restart ngrok with a new URL');

    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      logger.error({ err: error }, 'Local testing setup failed');
      process.exit(1);
    }
  }

  async checkLocalServer() {
    console.log('1️⃣ Checking local server...');
    
    try {
      const response = await axios.get('http://localhost:8080/health', { timeout: 5000 });
      
      if (response.status === 200) {
        console.log('✅ Local server is running on port 8080\n');
      } else {
        throw new Error('Server health check failed');
      }
    } catch (error) {
      console.log('❌ Local server is not running on port 8080');
      console.log('\n💡 Please start your local server first:');
      console.log('   npm run dev');
      console.log('\nThen run this script again.');
      process.exit(1);
    }
  }

  async setupNgrokTunnel() {
    console.log('2️⃣ Setting up ngrok tunnel...');
    
    try {
      // Check if ngrok is already running by checking the API
      const response = await axios.get('http://localhost:4040/api/tunnels', { timeout: 3000 });
      
      if (response.data.tunnels && response.data.tunnels.length > 0) {
        const tunnel = response.data.tunnels.find(t => t.config.addr === 'http://localhost:8080');
        
        if (tunnel) {
          this.ngrokUrl = tunnel.public_url.replace('http://', 'https://');
          console.log(`✅ Found existing ngrok tunnel: ${this.ngrokUrl}\n`);
          return;
        }
      }
    } catch (error) {
      // ngrok not running, need to start it
    }

    console.log('⚠️ ngrok tunnel not found. Please follow these steps:');
    console.log('\n📋 Manual ngrok setup:');
    console.log('1. Open a new terminal/command prompt');
    console.log('2. Run: ngrok http 8080');
    console.log('3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)');
    console.log('4. Paste it below when prompted\n');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.ngrokUrl = await new Promise(resolve => {
      readline.question('Enter your ngrok HTTPS URL: ', resolve);
    });
    
    readline.close();

    if (!this.ngrokUrl || !this.ngrokUrl.startsWith('https://')) {
      throw new Error('Invalid ngrok URL. Must start with https://');
    }

    // Verify the ngrok URL works
    try {
      const testUrl = `${this.ngrokUrl}/health`;
      const response = await axios.get(testUrl, { timeout: 10000 });
      
      if (response.status === 200) {
        console.log(`✅ ngrok tunnel verified: ${this.ngrokUrl}\n`);
      } else {
        throw new Error('ngrok tunnel verification failed');
      }
    } catch (error) {
      console.log(`❌ Could not verify ngrok tunnel: ${error.message}`);
      console.log('Please make sure:');
      console.log('1. ngrok is running: ngrok http 8080');
      console.log('2. Your local server is running: npm run dev');
      console.log('3. The URL is correct and accessible');
      process.exit(1);
    }
  }

  async configureWebhookForTesting() {
    console.log('3️⃣ Configuring webhook for local testing...');
    
    const webhookUrl = `${this.ngrokUrl}/api/gupshup/webhook`;
    
    try {
      // Delete existing subscriptions first
      const existingSubscriptions = await gupshupPartnerService.getAppSubscriptions(this.appId);
      
      for (const subscription of existingSubscriptions) {
        try {
          await gupshupPartnerService.deleteSubscription(this.appId, subscription.id);
          console.log(`🗑️ Deleted existing subscription: ${subscription.id}`);
        } catch (deleteError) {
          console.log(`⚠️ Could not delete subscription ${subscription.id}: ${deleteError.message}`);
        }
      }

      // Configure new webhook with ngrok URL
      const subscription = await gupshupPartnerService.configureWebhookSubscription(this.appId, {
        webhookUrl
      });

      console.log('✅ Webhook configured for local testing');
      console.log(`   Subscription ID: ${subscription.id}`);
      console.log(`   Webhook URL: ${subscription.url}`);
      console.log(`   Modes: ALL (${subscription.mode})\n`);

    } catch (error) {
      throw new Error(`Failed to configure webhook: ${error.message}`);
    }
  }

  async testWebhook() {
    console.log('4️⃣ Testing webhook endpoint...');
    
    const webhookUrl = `${this.ngrokUrl}/api/gupshup/webhook`;
    
    try {
      // Test GET request (webhook verification)
      const getResponse = await axios.get(webhookUrl, { timeout: 5000 });
      
      if (getResponse.status === 200) {
        console.log('✅ Webhook GET endpoint working');
      }

      // Test POST request (simulate incoming message)
      const testPayload = {
        type: 'message',
        payload: {
          id: 'test-message-id',
          source: '6580128102',
          type: 'text',
          payload: {
            text: 'Test message from local setup'
          },
          sender: {
            phone: '6580128102',
            name: 'Local Test'
          },
          destination: '6580128102'
        }
      };

      const postResponse = await axios.post(webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      if (postResponse.status === 200) {
        console.log('✅ Webhook POST endpoint working');
        console.log('✅ Test message processed successfully\n');
      }

    } catch (error) {
      console.log(`⚠️ Webhook test failed: ${error.message}`);
      console.log('This might be normal if the webhook processing has issues');
      console.log('Check your local server logs for more details\n');
    }
  }

  async restoreProductionWebhook() {
    console.log('🔄 Restoring production webhook...');
    
    try {
      const productionWebhookUrl = 'https://backend-api-production-d74a.up.railway.app/api/gupshup/webhook';
      
      // Delete local testing subscriptions
      const existingSubscriptions = await gupshupPartnerService.getAppSubscriptions(this.appId);
      
      for (const subscription of existingSubscriptions) {
        if (subscription.url.includes('ngrok')) {
          try {
            await gupshupPartnerService.deleteSubscription(this.appId, subscription.id);
            console.log(`🗑️ Deleted local testing subscription: ${subscription.id}`);
          } catch (deleteError) {
            console.log(`⚠️ Could not delete subscription ${subscription.id}: ${deleteError.message}`);
          }
        }
      }

      // Configure production webhook
      const subscription = await gupshupPartnerService.configureWebhookSubscription(this.appId, {
        webhookUrl: productionWebhookUrl
      });

      console.log('✅ Production webhook restored');
      console.log(`   Subscription ID: ${subscription.id}`);
      console.log(`   Webhook URL: ${subscription.url}`);

    } catch (error) {
      throw new Error(`Failed to restore production webhook: ${error.message}`);
    }
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const setup = new LocalTestingSetup();

  if (args.includes('--restore-production')) {
    setup.restoreProductionWebhook().then(() => {
      console.log('🎉 Production webhook restored successfully!');
    }).catch(error => {
      console.error('❌ Failed to restore production webhook:', error.message);
      process.exit(1);
    });
  } else {
    setup.run();
  }
}

module.exports = LocalTestingSetup;
