#!/usr/bin/env node

/**
 * Monitor Webhook Events
 * 
 * This script monitors recent messages in the database to see if webhook events
 * are updating delivery status properly.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.development') });

const databaseService = require('../services/databaseService');

class WebhookEventMonitor {
  constructor() {
    this.testMessageId = 'f34d6d36-7c84-4616-949c-1b0dbab881bf'; // From our test
  }

  /**
   * Monitor messages for webhook updates
   */
  async monitorMessages() {
    console.log('🔍 Monitoring webhook events and database updates...\n');

    try {
      // Check for our specific test message
      console.log(`Looking for test message ID: ${this.testMessageId}`);
      
      const { data: testMessage, error: testError } = await databaseService.supabase
        .from('messages')
        .select('*')
        .eq('external_message_id', this.testMessageId)
        .single();

      if (testError && testError.code !== 'PGRST116') {
        console.log('❌ Error checking test message:', testError.message);
      } else if (testMessage) {
        console.log('✅ Found test message in database:');
        console.log(`   ID: ${testMessage.id}`);
        console.log(`   Phone: ${testMessage.phone_number}`);
        console.log(`   Status: ${testMessage.delivery_status || 'unknown'}`);
        console.log(`   Created: ${testMessage.created_at}`);
        console.log(`   Updated: ${testMessage.updated_at || 'N/A'}`);
        console.log(`   Delivered: ${testMessage.delivered_at || 'N/A'}`);
        if (testMessage.error_message) {
          console.log(`   Error: ${testMessage.error_message}`);
        }
      } else {
        console.log('⚠️ Test message not found in database yet');
      }

      // Check recent messages
      console.log('\n📋 Recent messages in database:');
      const { data: messages, error } = await databaseService.supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      if (messages.length === 0) {
        console.log('   No messages found in database');
      } else {
        messages.forEach((msg, index) => {
          console.log(`\n${index + 1}. Message ID: ${msg.id}`);
          console.log(`   External ID: ${msg.external_message_id || 'N/A'}`);
          console.log(`   Phone: ${msg.phone_number}`);
          console.log(`   Status: ${msg.delivery_status || 'unknown'}`);
          console.log(`   Template: ${msg.template_id || 'N/A'}`);
          console.log(`   Created: ${msg.created_at}`);
          console.log(`   Updated: ${msg.updated_at || 'N/A'}`);
          console.log(`   Delivered: ${msg.delivered_at || 'N/A'}`);
          if (msg.error_message) {
            console.log(`   Error: ${msg.error_message}`);
          }
        });
      }

      return { testMessage, allMessages: messages };

    } catch (error) {
      console.error('❌ Failed to monitor messages:', error.message);
      throw error;
    }
  }

  /**
   * Continuous monitoring with intervals
   */
  async startContinuousMonitoring(intervalSeconds = 10, maxChecks = 6) {
    console.log(`🔄 Starting continuous monitoring (${intervalSeconds}s intervals, ${maxChecks} checks max)\n`);

    for (let i = 1; i <= maxChecks; i++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 CHECK ${i}/${maxChecks} - ${new Date().toLocaleTimeString()}`);
      console.log('='.repeat(60));

      const result = await this.monitorMessages();

      if (result.testMessage && result.testMessage.delivery_status !== 'submitted') {
        console.log(`\n🎉 Status update detected! Message status: ${result.testMessage.delivery_status}`);
        break;
      }

      if (i < maxChecks) {
        console.log(`\n⏳ Waiting ${intervalSeconds} seconds for next check...`);
        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
      }
    }

    console.log('\n📝 Monitoring completed!');
  }

  /**
   * Check webhook subscription status
   */
  async checkWebhookStatus() {
    console.log('🔗 Checking webhook subscription status...\n');

    try {
      // This would require importing gupshupPartnerService
      // For now, just provide instructions
      console.log('To check webhook status manually:');
      console.log('1. Check Railway logs for webhook events');
      console.log('2. Look for "Received webhook event - analyzing event structure"');
      console.log('3. Verify webhook subscription in Gupshup Partner Portal');
      console.log('4. Ensure webhook URL is accessible: https://backend-api-production-d74a.up.railway.app/api/gupshup/webhook');

    } catch (error) {
      console.error('❌ Failed to check webhook status:', error.message);
    }
  }
}

// Run the monitor
async function main() {
  const monitor = new WebhookEventMonitor();
  
  console.log('🚀 Webhook Event Monitor\n');
  console.log('='.repeat(60) + '\n');

  // Check webhook status
  await monitor.checkWebhookStatus();

  // Start continuous monitoring
  await monitor.startContinuousMonitoring();

  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = WebhookEventMonitor;
