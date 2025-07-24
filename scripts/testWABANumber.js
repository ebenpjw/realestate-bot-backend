#!/usr/bin/env node

/**
 * Test sending message to WABA number itself
 * WABA numbers are always eligible to receive business messages
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.development') });

const messageService = require('../services/messageService');
const databaseService = require('../services/databaseService');

async function testWABANumber() {
  try {
    console.log('🧪 Testing message delivery to WABA number itself...');
    console.log('This should work because WABA numbers can always receive business messages');
    console.log('');

    const agentId = '2317daef-bad4-4e81-853c-3323b1eaacf7';
    const wabaNumber = '6580128102'; // The WABA number itself
    const templateId = 'c77bf37b-2424-4ef6-8cfb-7486c81916d0';
    const templateName = 'general_followup';

    // Create or find test lead for WABA number
    console.log('📱 Creating test lead for WABA number:', wabaNumber);
    
    const { data: existingLead } = await databaseService.supabase
      .from('leads')
      .select('*')
      .eq('phone_number', wabaNumber)
      .limit(1)
      .maybeSingle();

    let lead;
    if (existingLead) {
      lead = existingLead;
      console.log('👤 Found existing lead for WABA number');
    } else {
      const { data: newLead, error } = await databaseService.supabase
        .from('leads')
        .insert({
          phone_number: wabaNumber,
          full_name: 'WABA Test',
          source: 'waba_delivery_test',
          status: 'new',
          assigned_agent_id: agentId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create WABA test lead: ${error.message}`);
      }
      lead = newLead;
      console.log('👤 Created new test lead for WABA number');
    }

    // Send test message
    console.log('📤 Sending test message to WABA number...');
    
    const templateParams = {
      '1': 'WABA Test',
      '2': 'WABA delivery test',
      '3': 'WABA functionality',
      '4': 'Does this reach the WABA number?'
    };

    const result = await messageService.sendTemplateMessage({
      agentId,
      phoneNumber: wabaNumber,
      templateId,
      templateName,
      templateParams,
      leadId: lead.id
    });

    console.log('');
    console.log('✅ Message sent to WABA number!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📊 Status:', result.status);
    console.log('📱 Phone:', result.phoneNumber);

    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('1. Check WhatsApp on the phone number +6580128102');
    console.log('2. If you receive this message, the delivery system works!');
    console.log('3. If not, there may be a deeper Gupshup configuration issue');
    console.log('');
    console.log('💡 Expected message:');
    console.log('   "Hi WABA Test, just a gentle follow-up on WABA delivery test!"');
    console.log('   "I know you\'re probably busy, but wanted to see if you had any questions..."');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWABANumber();
