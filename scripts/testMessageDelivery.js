#!/usr/bin/env node

/**
 * Test Message Delivery Script
 * 
 * This script tests the complete message delivery flow with detailed debugging
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.development') });

const logger = require('../logger');
const messageService = require('../services/messageService');
const databaseService = require('../services/databaseService');

class MessageDeliveryTester {
  constructor() {
    this.agentId = '2317daef-bad4-4e81-853c-3323b1eaacf7'; // Doro's agent ID
    this.templateId = 'c77bf37b-2424-4ef6-8cfb-7486c81916d0'; // general_followup template
    this.templateName = 'general_followup';
  }

  async run() {
    try {
      console.log('🧪 Testing Message Delivery Flow\n');

      // Step 1: Get test phone number
      const phoneNumber = await this.getTestPhoneNumber();
      console.log(`📱 Test phone number: ${phoneNumber}`);

      // Step 2: Find or create lead
      const lead = await this.findOrCreateTestLead(phoneNumber);
      console.log(`👤 Test lead ID: ${lead.id}`);
      console.log(`👤 Lead phone: ${lead.phone_number}`);

      // Step 3: Send test message
      console.log('\n📤 Sending test message...');
      const result = await this.sendTestMessage(lead);
      
      console.log('\n✅ Message sent successfully!');
      console.log(`📧 Message ID: ${result.messageId}`);
      console.log(`📊 Status: ${result.status}`);
      console.log(`📱 Phone: ${result.phoneNumber}`);

      // Step 4: Check database record
      await this.checkDatabaseRecord(result.messageId);

      // Step 5: Instructions for user
      this.printInstructions(phoneNumber);

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      logger.error({ err: error }, 'Message delivery test failed');
    }
  }

  async getTestPhoneNumber() {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const phoneNumber = await new Promise(resolve => {
      readline.question('Enter your WhatsApp phone number (e.g., 6591234567): ', resolve);
    });
    
    readline.close();

    if (!phoneNumber || phoneNumber.length < 8) {
      throw new Error('Invalid phone number provided');
    }

    return phoneNumber;
  }

  async findOrCreateTestLead(phoneNumber) {
    try {
      // Format phone number
      const formattedPhone = messageService.formatPhoneNumber(phoneNumber);
      console.log(`📱 Formatted phone: ${formattedPhone}`);

      // Try to find existing lead
      const { data: existingLead } = await databaseService.supabase
        .from('leads')
        .select('*')
        .eq('phone_number', formattedPhone)
        .limit(1)
        .maybeSingle();

      if (existingLead) {
        console.log('👤 Found existing lead');
        return existingLead;
      }

      // Create new test lead
      console.log('👤 Creating new test lead...');
      const { data: newLead, error } = await databaseService.supabase
        .from('leads')
        .insert({
          phone_number: formattedPhone,
          full_name: 'Test User',
          source: 'message_delivery_test',
          status: 'new',
          assigned_agent_id: this.agentId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create test lead: ${error.message}`);
      }

      console.log('👤 Created new test lead');
      return newLead;

    } catch (error) {
      throw new Error(`Lead creation failed: ${error.message}`);
    }
  }

  async sendTestMessage(lead) {
    const templateParams = {
      '1': 'Test User',
      '2': 'your message delivery test',
      '3': 'the test results',
      '4': 'Does this message reach you?'
    };

    console.log('📋 Template parameters:');
    console.log(JSON.stringify(templateParams, null, 2));

    const result = await messageService.sendTemplateMessage({
      agentId: this.agentId,
      phoneNumber: lead.phone_number,
      templateId: this.templateId,
      templateName: this.templateName,
      templateParams,
      leadId: lead.id
    });

    return result;
  }

  async checkDatabaseRecord(messageId) {
    console.log('\n🔍 Checking database record...');
    
    // Wait a moment for the database insert to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: message } = await databaseService.supabase
      .from('messages')
      .select('*')
      .eq('external_message_id', messageId)
      .single();

    if (message) {
      console.log('✅ Database record found:');
      console.log(`   Phone Number: ${message.phone_number || 'undefined'}`);
      console.log(`   Lead ID: ${message.lead_id}`);
      console.log(`   Status: ${message.delivery_status}`);
      console.log(`   Template: ${message.template_id}`);
      console.log(`   Created: ${message.created_at}`);
      
      if (!message.phone_number) {
        console.log('⚠️  WARNING: Phone number is still undefined in database!');
      }
    } else {
      console.log('❌ No database record found');
    }
  }

  printInstructions(phoneNumber) {
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Check your WhatsApp for the test message');
    console.log(`2. The message should be sent to: +${phoneNumber}`);
    console.log('3. If you receive it, the delivery system is working!');
    console.log('4. If not, check Railway logs for webhook events');
    console.log('\n💡 Template content should be:');
    console.log('   "Hi Test User, just a gentle follow-up on your message delivery test!"');
    console.log('   "I know you\'re probably busy, but wanted to see if you had any questions..."');
  }
}

// Run the test
if (require.main === module) {
  const tester = new MessageDeliveryTester();
  tester.run().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = MessageDeliveryTester;
