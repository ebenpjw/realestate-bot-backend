#!/usr/bin/env node

// Quick bot testing script - no webhooks needed!
const axios = require('axios');

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://YOUR_ACTUAL_RAILWAY_URL_HERE'; // Replace with your Railway URL
const TEST_PHONE = '+6591234567'; // Your test number

async function testMessage(message, options = {}) {
  try {
    console.log(`\n🧪 Testing: "${message}"`);
    console.log('⏳ Processing...\n');

    const response = await axios.post(`${RAILWAY_URL}/api/test/simulate-inbound`, {
      from: TEST_PHONE,
      text: message,
      name: options.name || 'Test User',
      reset_conversation: options.reset || false
    });

    const data = response.data;
    
    console.log('✅ Success!');
    console.log(`🤖 AI Response:`);
    if (data.ai_responses && data.ai_responses.length > 0) {
      data.ai_responses.forEach((resp, i) => {
        console.log(`   ${i + 1}. "${resp}"`);
      });
    } else {
      console.log('   (No response)');
    }
    console.log(`⏱️  Time: ${data.processing_time_ms}ms`);
    console.log(`💬 Total messages: ${data.conversation_length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Quick test functions
async function testGreeting() {
  await testMessage('hello', { reset: true });
}

async function testConversation() {
  await testMessage('hello', { reset: true });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await testMessage('I want to buy a house');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await testMessage('my budget is 1 million');
}

async function testBooking() {
  await testMessage('I want to speak to a consultant', { reset: true });
}

// Command line interface
const command = process.argv[2];
const message = process.argv.slice(3).join(' ');

if (command === 'msg' && message) {
  testMessage(message);
} else if (command === 'greeting') {
  testGreeting();
} else if (command === 'conversation') {
  testConversation();
} else if (command === 'booking') {
  testBooking();
} else {
  console.log(`
🧪 Bot Testing Tool

Usage:
  node test-bot.js msg "your message here"
  node test-bot.js greeting
  node test-bot.js conversation  
  node test-bot.js booking

Examples:
  node test-bot.js msg "hello"
  node test-bot.js msg "I want to buy a condo"
  node test-bot.js greeting
`);
}
