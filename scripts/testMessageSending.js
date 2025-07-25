#!/usr/bin/env node

/**
 * Test Message Sending and Webhook Events
 * 
 * This script sends a test message and monitors webhook events to debug
 * the message delivery system.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.development') });

const databaseService = require('../services/databaseService');
const messageService = require('../services/messageService');
const partnerTemplateService = require('../services/partnerTemplateService');
const logger = require('../logger');

class MessageSendingTester {
  constructor() {
    this.testPhoneNumber = '6580128102'; // Test phone number
  }

  /**
   * Get a test agent for sending messages
   */
  async getTestAgent() {
    try {
      const { data: agents, error } = await databaseService.supabase
        .from('agents')
        .select('*')
        .not('gupshup_app_id', 'is', null)
        .not('waba_phone_number', 'is', null)
        .limit(1);

      if (error) {
        throw new Error(`Failed to fetch agents: ${error.message}`);
      }

      if (!agents || agents.length === 0) {
        throw new Error('No agents found with WABA configuration');
      }

      return agents[0];
    } catch (error) {
      console.error('❌ Failed to get test agent:', error.message);
      throw error;
    }
  }

  /**
   * Get an approved template for testing from Partner Template Service
   */
  async getTestTemplate(agent) {
    try {
      console.log('   Fetching templates from Partner Template Service...');

      // Get live templates from Partner Template Service
      const templates = await partnerTemplateService.getLiveAgentTemplates(agent.id);

      if (!templates || templates.length === 0) {
        throw new Error('No templates found for agent');
      }

      // Find an approved template
      const approvedTemplate = templates.find(t => t.status === 'APPROVED');

      if (!approvedTemplate) {
        console.log('   Available templates:', templates.map(t => `${t.template_name} (${t.status})`));
        throw new Error('No approved templates found for agent');
      }

      console.log(`   Found approved template: ${approvedTemplate.template_name}`);
      return approvedTemplate;

    } catch (error) {
      console.error('❌ Failed to get test template:', error.message);
      throw error;
    }
  }

  /**
   * Send a test message
   */
  async sendTestMessage() {
    console.log('🧪 Starting message sending test...\n');

    try {
      // Get test agent
      console.log('👤 Getting test agent...');
      const agent = await this.getTestAgent();
      console.log(`✅ Using agent: ${agent.full_name} (${agent.gupshup_app_id})`);

      // Get test template
      console.log('📝 Getting approved template...');
      const template = await this.getTestTemplate(agent);
      console.log(`✅ Using template: ${template.template_name} (${template.template_id})`);

      // Prepare test parameters based on template structure
      const testParams = {
        '1': 'Test User',
        '2': 'Webhook Test',
        '3': new Date().toLocaleString()
      };

      console.log('\n📤 Sending test message...');
      console.log(`   Phone: ${this.testPhoneNumber}`);
      console.log(`   Template: ${template.template_name}`);
      console.log(`   Template ID: ${template.template_id}`);
      console.log(`   Parameters:`, testParams);

      // Send the message
      const result = await messageService.sendTemplateMessage({
        agentId: agent.id,
        phoneNumber: this.testPhoneNumber,
        templateId: template.template_id,
        templateName: template.template_name,
        templateParams: testParams,
        leadId: null // Optional for testing
      });

      console.log('\n✅ Message sent successfully!');
      console.log('📊 Result:', {
        messageId: result.messageId,
        status: result.status,
        timestamp: new Date().toISOString()
      });

      console.log('\n🔍 Now monitor the Railway logs for webhook events...');
      console.log('   Look for: "Received webhook event - analyzing event structure"');
      console.log('   Expected events: enqueued → sent → delivered → read');

      return result;

    } catch (error) {
      console.error('❌ Test message sending failed:', error.message);
      if (error.response?.data) {
        console.error('   API Response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Monitor recent messages in database
   */
  async monitorRecentMessages() {
    console.log('\n📊 Checking recent messages in database...');

    try {
      const { data: messages, error } = await databaseService.supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      console.log(`\n📋 Found ${messages.length} recent messages:`);
      messages.forEach((msg, index) => {
        console.log(`\n${index + 1}. Message ID: ${msg.id}`);
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

    } catch (error) {
      console.error('❌ Failed to monitor messages:', error.message);
    }
  }

  /**
   * Run the complete test
   */
  async runTest() {
    console.log('🚀 WhatsApp Message Sending & Webhook Test\n');
    console.log('='.repeat(60) + '\n');

    try {
      // Send test message
      await this.sendTestMessage();

      // Wait a moment for webhook events
      console.log('\n⏳ Waiting 10 seconds for webhook events...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check database for updates
      await this.monitorRecentMessages();

      console.log('\n🎉 Test completed!');
      console.log('\n📝 Next steps:');
      console.log('   1. Check Railway logs for webhook events');
      console.log('   2. Verify message delivery status updates');
      console.log('   3. Confirm webhook event processing is working');

    } catch (error) {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the test
async function main() {
  const tester = new MessageSendingTester();
  await tester.runTest();
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

module.exports = MessageSendingTester;
