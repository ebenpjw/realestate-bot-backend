// test-simulation.js - Quick test script for various endpoints
const axios = require('axios');

async function testDatabaseDiagnostic() {
  try {
    console.log('🔍 Testing database diagnostic...');

    const response = await axios.get('http://localhost:8080/api/test/db-diagnostic', {
      timeout: 15000
    });

    console.log('✅ Database diagnostic successful!');
    console.log('Status:', response.data.status);
    console.log('Tests:', response.data.tests.map(t => `${t.name}: ${t.status}`));

  } catch (error) {
    console.error('❌ Database diagnostic failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

async function testLeadCreation() {
  try {
    console.log('👤 Testing lead creation...');

    const response = await axios.post('http://localhost:8080/api/test/simulate-new-lead', {
      full_name: 'Test User',
      phone_number: '+6512345678',
      template_id: 'c60dee92-5426-4890-96e4-65469620ac7e'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('✅ Lead creation successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Lead creation failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

async function runTests() {
  console.log('🧪 Starting comprehensive tests...\n');

  await testDatabaseDiagnostic();
  console.log('\n' + '='.repeat(50) + '\n');

  await testLeadCreation();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('🏁 Tests completed!');
}

runTests();
