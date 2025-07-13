#!/usr/bin/env node

/**
 * Frontend-Backend Integration Test Script
 * Tests all API endpoints and integration points
 */

const axios = require('axios');
const logger = require('../logger');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const TEST_AGENT_EMAIL = process.env.TEST_AGENT_EMAIL || 'test.agent@propertyhub.com';
const TEST_AGENT_PASSWORD = process.env.TEST_AGENT_PASSWORD || 'TestPassword123!';

class IntegrationTester {
  constructor() {
    this.authToken = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runAllTests() {
    logger.info('🚀 Starting Frontend-Backend Integration Tests');
    
    try {
      // Authentication Tests
      await this.testAuthentication();
      
      // Dashboard API Tests
      await this.testDashboardAPI();
      
      // Conversations API Tests
      await this.testConversationsAPI();
      
      // Leads API Tests
      await this.testLeadsAPI();
      
      // Appointments API Tests
      await this.testAppointmentsAPI();
      
      // Integrations API Tests
      await this.testIntegrationsAPI();
      
      // Testing API Tests
      await this.testTestingAPI();
      
      // Multi-tenant Tests
      await this.testMultiTenantSecurity();
      
      // Error Handling Tests
      await this.testErrorHandling();
      
      this.printResults();
      
    } catch (error) {
      logger.error({ err: error }, '❌ Integration test suite failed');
      process.exit(1);
    }
  }

  async testAuthentication() {
    logger.info('🔐 Testing Authentication...');
    
    try {
      // Test login
      const loginResponse = await axios.post(`${API_BASE_URL}/api/frontend-auth/login`, {
        email: TEST_AGENT_EMAIL,
        password: TEST_AGENT_PASSWORD
      });
      
      this.authToken = loginResponse.data.token;
      this.assert(!!this.authToken, 'Login should return auth token');
      this.assert(loginResponse.data.user.email === TEST_AGENT_EMAIL, 'Login should return correct user');
      
      // Test token validation
      const meResponse = await this.authenticatedRequest('GET', '/api/frontend-auth/me');
      this.assert(meResponse.data.user.email === TEST_AGENT_EMAIL, 'Token validation should return correct user');
      
      logger.info('✅ Authentication tests passed');
      
    } catch (error) {
      this.recordError('Authentication', error);
    }
  }

  async testDashboardAPI() {
    logger.info('📊 Testing Dashboard API...');
    
    try {
      // Test agent stats
      const statsResponse = await this.authenticatedRequest('GET', '/api/dashboard/agent/stats');
      this.assert(typeof statsResponse.data.data.totalLeads === 'number', 'Stats should include totalLeads');
      this.assert(typeof statsResponse.data.data.activeConversations === 'number', 'Stats should include activeConversations');
      
      // Test recent activity
      const activityResponse = await this.authenticatedRequest('GET', '/api/dashboard/agent/activity?limit=5');
      this.assert(Array.isArray(activityResponse.data.data), 'Activity should return array');
      
      // Test performance metrics
      const performanceResponse = await this.authenticatedRequest('GET', '/api/dashboard/performance?period=week');
      this.assert(typeof performanceResponse.data.data.leadsGenerated === 'number', 'Performance should include leadsGenerated');
      
      logger.info('✅ Dashboard API tests passed');
      
    } catch (error) {
      this.recordError('Dashboard API', error);
    }
  }

  async testConversationsAPI() {
    logger.info('💬 Testing Conversations API...');
    
    try {
      // Test conversations list
      const conversationsResponse = await this.authenticatedRequest('GET', '/api/dashboard/conversations?limit=10');
      this.assert(Array.isArray(conversationsResponse.data.data.conversations), 'Conversations should return array');
      this.assert(typeof conversationsResponse.data.data.total === 'number', 'Conversations should include total count');
      
      // Test conversation details (if any conversations exist)
      if (conversationsResponse.data.data.conversations.length > 0) {
        const conversationId = conversationsResponse.data.data.conversations[0].id;
        const detailsResponse = await this.authenticatedRequest('GET', `/api/dashboard/conversations/${conversationId}`);
        this.assert(detailsResponse.data.data.id === conversationId, 'Conversation details should match requested ID');
        this.assert(Array.isArray(detailsResponse.data.data.messages), 'Conversation details should include messages');
      }
      
      logger.info('✅ Conversations API tests passed');
      
    } catch (error) {
      this.recordError('Conversations API', error);
    }
  }

  async testLeadsAPI() {
    logger.info('👥 Testing Leads API...');
    
    try {
      // Test leads list
      const leadsResponse = await this.authenticatedRequest('GET', '/api/leads?limit=10');
      this.assert(Array.isArray(leadsResponse.data.data.leads), 'Leads should return array');
      this.assert(typeof leadsResponse.data.data.total === 'number', 'Leads should include total count');
      
      // Test lead creation
      const createLeadResponse = await this.authenticatedRequest('POST', '/api/leads', {
        phoneNumber: '+6599999999',
        fullName: 'Test Lead',
        source: 'WhatsApp',
        intent: 'buying',
        budget: '$1M - $2M'
      });
      this.assert(createLeadResponse.data.data.phoneNumber === '+6599999999', 'Created lead should have correct phone number');
      
      // Test lead details
      const leadId = createLeadResponse.data.data.id;
      const leadDetailsResponse = await this.authenticatedRequest('GET', `/api/leads/${leadId}`);
      this.assert(leadDetailsResponse.data.data.id === leadId, 'Lead details should match requested ID');
      
      logger.info('✅ Leads API tests passed');
      
    } catch (error) {
      this.recordError('Leads API', error);
    }
  }

  async testAppointmentsAPI() {
    logger.info('📅 Testing Appointments API...');
    
    try {
      // Test appointments list
      const appointmentsResponse = await this.authenticatedRequest('GET', '/api/appointments?limit=10');
      this.assert(Array.isArray(appointmentsResponse.data.data.appointments), 'Appointments should return array');
      
      // Test today's appointments
      const todayResponse = await this.authenticatedRequest('GET', '/api/appointments/today');
      this.assert(Array.isArray(todayResponse.data.data), 'Today\'s appointments should return array');
      
      // Test available slots
      const slotsResponse = await this.authenticatedRequest('GET', '/api/appointments/available-slots');
      this.assert(Array.isArray(slotsResponse.data.data), 'Available slots should return array');
      
      logger.info('✅ Appointments API tests passed');
      
    } catch (error) {
      this.recordError('Appointments API', error);
    }
  }

  async testIntegrationsAPI() {
    logger.info('🔗 Testing Integrations API...');
    
    try {
      // Test integration status
      const statusResponse = await this.authenticatedRequest('GET', '/api/dashboard/integrations/status');
      this.assert(typeof statusResponse.data.data === 'object', 'Integration status should return object');
      
      // Test WABA integration
      const wabaResponse = await this.authenticatedRequest('GET', '/api/dashboard/integrations/waba');
      this.assert(typeof wabaResponse.data.data.status === 'string', 'WABA integration should have status');
      
      // Test integration health check
      const healthResponse = await this.authenticatedRequest('GET', '/api/dashboard/integrations/health');
      this.assert(typeof healthResponse.data.data.overall === 'string', 'Health check should return overall status');
      
      logger.info('✅ Integrations API tests passed');
      
    } catch (error) {
      this.recordError('Integrations API', error);
    }
  }

  async testTestingAPI() {
    logger.info('🧪 Testing Testing API...');
    
    try {
      // Test scenarios list
      const scenariosResponse = await this.authenticatedRequest('GET', '/api/test/scenarios');
      this.assert(Array.isArray(scenariosResponse.data.data), 'Test scenarios should return array');
      
      // Test active tests
      const activeTestsResponse = await this.authenticatedRequest('GET', '/api/test/active');
      this.assert(Array.isArray(activeTestsResponse.data.data), 'Active tests should return array');
      
      // Test analytics
      const analyticsResponse = await this.authenticatedRequest('GET', '/api/test/analytics');
      this.assert(typeof analyticsResponse.data.data.totalTests === 'number', 'Test analytics should include totalTests');
      
      logger.info('✅ Testing API tests passed');
      
    } catch (error) {
      this.recordError('Testing API', error);
    }
  }

  async testMultiTenantSecurity() {
    logger.info('🔒 Testing Multi-tenant Security...');
    
    try {
      // Test agent access restrictions
      // This should work for the authenticated agent
      const ownDataResponse = await this.authenticatedRequest('GET', '/api/dashboard/agent/stats');
      this.assert(ownDataResponse.status === 200, 'Agent should access own data');
      
      // Test that agent cannot access other agent's data
      try {
        await this.authenticatedRequest('GET', '/api/dashboard/agent/stats?agentId=other_agent_id');
        this.recordError('Multi-tenant Security', new Error('Agent should not access other agent data'));
      } catch (error) {
        if (error.response?.status === 403) {
          this.testResults.passed++;
          logger.info('✅ Multi-tenant access restriction working correctly');
        } else {
          throw error;
        }
      }
      
      logger.info('✅ Multi-tenant security tests passed');
      
    } catch (error) {
      this.recordError('Multi-tenant Security', error);
    }
  }

  async testErrorHandling() {
    logger.info('⚠️ Testing Error Handling...');
    
    try {
      // Test 404 error
      try {
        await this.authenticatedRequest('GET', '/api/nonexistent-endpoint');
      } catch (error) {
        this.assert(error.response?.status === 404, 'Should return 404 for nonexistent endpoint');
      }
      
      // Test validation error
      try {
        await this.authenticatedRequest('POST', '/api/leads', {
          phoneNumber: 'invalid-phone',
          source: 'invalid-source'
        });
      } catch (error) {
        this.assert(error.response?.status >= 400 && error.response?.status < 500, 'Should return 4xx for validation error');
      }
      
      logger.info('✅ Error handling tests passed');
      
    } catch (error) {
      this.recordError('Error Handling', error);
    }
  }

  async authenticatedRequest(method, url, data = null) {
    const config = {
      method,
      url: `${API_BASE_URL}${url}`,
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    return await axios(config);
  }

  assert(condition, message) {
    if (condition) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
      this.testResults.errors.push(message);
      logger.error(`❌ Assertion failed: ${message}`);
    }
  }

  recordError(testName, error) {
    this.testResults.failed++;
    const errorMessage = `${testName}: ${error.message}`;
    this.testResults.errors.push(errorMessage);
    logger.error({ err: error }, `❌ ${testName} test failed`);
  }

  printResults() {
    logger.info('\n📋 Integration Test Results:');
    logger.info(`✅ Passed: ${this.testResults.passed}`);
    logger.info(`❌ Failed: ${this.testResults.failed}`);
    
    if (this.testResults.errors.length > 0) {
      logger.info('\n🚨 Errors:');
      this.testResults.errors.forEach((error, index) => {
        logger.info(`${index + 1}. ${error}`);
      });
    }
    
    const totalTests = this.testResults.passed + this.testResults.failed;
    const successRate = totalTests > 0 ? (this.testResults.passed / totalTests * 100).toFixed(1) : 0;
    
    logger.info(`\n📊 Success Rate: ${successRate}%`);
    
    if (this.testResults.failed === 0) {
      logger.info('🎉 All integration tests passed!');
    } else {
      logger.error('💥 Some integration tests failed. Please review the errors above.');
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new IntegrationTester();
  tester.runAllTests().catch(error => {
    logger.error({ err: error }, 'Integration test suite crashed');
    process.exit(1);
  });
}

module.exports = IntegrationTester;
