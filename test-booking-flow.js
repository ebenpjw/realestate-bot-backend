// Test script for appointment booking flow
const axios = require('axios');

const BASE_URL = 'http://localhost:8080';
const TEST_PHONE = '6512345678';
const TEST_NAME = 'Test User';

async function testBookingFlow() {
  console.log('🧪 Starting appointment booking flow test...\n');

  try {
    // Test 1: Initial qualification
    console.log('📋 Test 1: Initial qualification');
    const response1 = await axios.post(`${BASE_URL}/api/test/simulate-inbound`, {
      from: TEST_PHONE,
      text: "Hi, I'm looking for a property to buy for my own stay. My budget is around 800k.",
      name: TEST_NAME
    });
    console.log('✅ Response:', response1.data.ai_response);
    console.log('');

    // Test 2: Request booking
    console.log('📅 Test 2: Request booking');
    const response2 = await axios.post(`${BASE_URL}/api/test/simulate-inbound`, {
      from: TEST_PHONE,
      text: "Yes, I'd like to schedule a consultation. Tomorrow at 3pm would be great.",
      name: TEST_NAME
    });
    console.log('✅ Response:', response2.data.ai_response);
    console.log('');

    // Test 3: Alternative time request
    console.log('🔄 Test 3: Alternative time request');
    const response3 = await axios.post(`${BASE_URL}/api/test/simulate-inbound`, {
      from: TEST_PHONE,
      text: "Actually, can we do it on Friday morning instead?",
      name: TEST_NAME
    });
    console.log('✅ Response:', response3.data.ai_response);
    console.log('');

    // Test 4: Reschedule request
    console.log('📝 Test 4: Reschedule request');
    const response4 = await axios.post(`${BASE_URL}/api/test/simulate-inbound`, {
      from: TEST_PHONE,
      text: "I need to reschedule my appointment to next Monday at 2pm.",
      name: TEST_NAME
    });
    console.log('✅ Response:', response4.data.ai_response);
    console.log('');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testBookingFlow();
