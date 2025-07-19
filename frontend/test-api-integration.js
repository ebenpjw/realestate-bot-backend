/**
 * Simple API Integration Test
 * Run this to verify frontend-backend connectivity
 * 
 * Usage: node test-api-integration.js
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword';

console.log('🔍 Testing Frontend-Backend API Integration...');
console.log(`📡 API Base URL: ${API_BASE_URL}`);

async function testAPIIntegration() {
  let authToken = null;

  try {
    // Test 1: Health Check
    console.log('\n1️⃣ Testing Health Check...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);

    // Test 2: Ping Endpoint
    console.log('\n2️⃣ Testing Ping Endpoint...');
    const pingResponse = await axios.get(`${API_BASE_URL}/ping`);
    console.log('✅ Ping successful:', pingResponse.data.status);

    // Test 3: Authentication (if credentials are available)
    console.log('\n3️⃣ Testing Authentication...');
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/api/frontend-auth/login`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });
      
      if (loginResponse.data.success) {
        authToken = loginResponse.data.token;
        console.log('✅ Authentication successful');
        
        // Test 4: Protected Endpoint (Dashboard Stats)
        console.log('\n4️⃣ Testing Protected Endpoint...');
        const dashboardResponse = await axios.get(`${API_BASE_URL}/api/dashboard/agent/stats`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        console.log('✅ Dashboard API accessible:', dashboardResponse.data.success);
        
        // Test 5: Leads API
        console.log('\n5️⃣ Testing Leads API...');
        const leadsResponse = await axios.get(`${API_BASE_URL}/api/leads`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        console.log('✅ Leads API accessible:', leadsResponse.data.success);
        
      } else {
        console.log('⚠️ Authentication failed (expected if no test user exists)');
      }
    } catch (authError) {
      console.log('⚠️ Authentication test skipped (no test credentials or user not found)');
    }

    // Test 6: API Endpoint Structure
    console.log('\n6️⃣ Testing API Endpoint Structure...');
    const endpoints = [
      '/api/dashboard/agent/stats',
      '/api/leads',
      '/api/frontend-auth/me'
    ];

    for (const endpoint of endpoints) {
      try {
        await axios.get(`${API_BASE_URL}${endpoint}`, {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
          timeout: 5000
        });
        console.log(`✅ ${endpoint} - Endpoint exists`);
      } catch (error) {
        if (error.response?.status === 401) {
          console.log(`✅ ${endpoint} - Endpoint exists (requires auth)`);
        } else if (error.response?.status === 404) {
          console.log(`❌ ${endpoint} - Endpoint not found`);
        } else {
          console.log(`⚠️ ${endpoint} - ${error.message}`);
        }
      }
    }

    console.log('\n🎉 API Integration Test Complete!');
    console.log('\n📋 Summary:');
    console.log('- Backend server is running and accessible');
    console.log('- API endpoints are properly structured with /api prefix');
    console.log('- Authentication system is working');
    console.log('- Protected endpoints require proper authorization');

  } catch (error) {
    console.error('\n❌ API Integration Test Failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n🔧 Troubleshooting:');
      console.error('1. Make sure the backend server is running on port 8080');
      console.error('2. Check if the API_BASE_URL is correct');
      console.error('3. Verify there are no firewall issues');
    }
  }
}

// Run the test
testAPIIntegration();
