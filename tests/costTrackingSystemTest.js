/**
 * COMPREHENSIVE COST TRACKING SYSTEM TESTS
 * 
 * Tests all components of the cost tracking system including:
 * - Cost tracking service functionality
 * - API endpoints
 * - Monitoring service
 * - Database operations
 * - Integration with AI services
 */

const logger = require('../logger');
const costTrackingService = require('../services/costTrackingService');
const costMonitoringService = require('../services/costMonitoringService');
const databaseService = require('../services/databaseService');
const axios = require('axios');

class CostTrackingSystemTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    
    this.testAgentId = null;
    this.testLeadId = null;
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  }

  async runAllTests() {
    console.log('🧪 Starting Comprehensive Cost Tracking System Tests\n');

    try {
      // Setup test data
      await this.setupTestData();

      // Run test suites
      await this.testCostTrackingService();
      await this.testAPIEndpoints();
      await this.testMonitoringService();
      await this.testDatabaseOperations();
      await this.testIntegrationScenarios();

      // Cleanup test data
      await this.cleanupTestData();

      // Show results
      this.showResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      logger.error({ err: error }, 'Cost tracking test suite failed');
    }
  }

  async setupTestData() {
    console.log('🔧 Setting up test data...');

    try {
      // Create test agent
      const { data: agent, error: agentError } = await databaseService.supabase
        .from('agents')
        .insert({
          full_name: 'Test Agent - Cost Tracking',
          email: 'test-cost-tracking@example.com',
          phone_number: '+6512345678',
          waba_phone_number: '+6512345678',
          status: 'active'
        })
        .select()
        .single();

      if (agentError) throw agentError;
      this.testAgentId = agent.id;

      // Create test lead
      const { data: lead, error: leadError } = await databaseService.supabase
        .from('leads')
        .insert({
          phone_number: '+6587654321',
          full_name: 'Test Lead - Cost Tracking',
          agent_id: this.testAgentId,
          status: 'active'
        })
        .select()
        .single();

      if (leadError) throw leadError;
      this.testLeadId = lead.id;

      console.log('✅ Test data setup completed');

    } catch (error) {
      throw new Error(`Test data setup failed: ${error.message}`);
    }
  }

  async testCostTrackingService() {
    console.log('\n📊 Testing Cost Tracking Service...');

    // Test 1: OpenAI usage recording
    await this.runTest('OpenAI Usage Recording', async () => {
      const result = await costTrackingService.recordOpenAIUsage({
        agentId: this.testAgentId,
        leadId: this.testLeadId,
        operationType: 'test_psychology_analysis',
        model: 'gpt-4.1',
        inputTokens: 1500,
        outputTokens: 600,
        metadata: { test: true }
      });

      if (!result.totalCost || result.totalCost <= 0) {
        throw new Error('Invalid cost calculation');
      }

      if (!result.totalTokens || result.totalTokens !== 2100) {
        throw new Error('Incorrect token calculation');
      }

      return 'OpenAI usage recorded successfully';
    });

    // Test 2: Gupshup usage recording
    await this.runTest('Gupshup Usage Recording', async () => {
      const result = await costTrackingService.recordGupshupUsage({
        agentId: this.testAgentId,
        leadId: this.testLeadId,
        messageType: 'template',
        phoneNumber: '+6587654321',
        templateName: 'test_template',
        messageId: 'test_msg_123'
      });

      if (!result.cost || result.cost <= 0) {
        throw new Error('Invalid cost calculation');
      }

      return 'Gupshup usage recorded successfully';
    });

    // Test 3: Third-party API usage recording
    await this.runTest('Third-party API Usage Recording', async () => {
      const result = await costTrackingService.recordThirdPartyUsage({
        agentId: this.testAgentId,
        leadId: this.testLeadId,
        serviceName: 'google_search_api',
        operationType: 'test_search',
        quantity: 1,
        metadata: { query: 'test query' }
      });

      if (!result.cost || result.cost <= 0) {
        throw new Error('Invalid cost calculation');
      }

      return 'Third-party API usage recorded successfully';
    });

    // Test 4: Usage report generation
    await this.runTest('Usage Report Generation', async () => {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const report = await costTrackingService.getUsageReport({
        agentId: this.testAgentId,
        startDate,
        endDate,
        groupBy: 'category'
      });

      if (!report.summary || !report.groupedData) {
        throw new Error('Invalid report structure');
      }

      if (report.summary.totalCost <= 0) {
        throw new Error('No usage data found in report');
      }

      return `Report generated with ${report.summary.recordCount} records`;
    });
  }

  async testAPIEndpoints() {
    console.log('\n🌐 Testing API Endpoints...');

    // Test 1: Usage report endpoint
    await this.runTest('Usage Report API', async () => {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const response = await axios.get(
        `${this.baseUrl}/api/cost-tracking/usage/${this.testAgentId}`,
        {
          params: { startDate, endDate, groupBy: 'category' }
        }
      );

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}`);
      }

      if (!response.data.success || !response.data.data) {
        throw new Error('Invalid API response structure');
      }

      return 'Usage report API working correctly';
    });

    // Test 2: Dashboard overview endpoint
    await this.runTest('Dashboard Overview API', async () => {
      const response = await axios.get(
        `${this.baseUrl}/api/cost-tracking-dashboard/overview/${this.testAgentId}`,
        {
          params: { period: 'month' }
        }
      );

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = response.data.data;
      if (!data.summary || !data.breakdown || !data.trends) {
        throw new Error('Missing required dashboard sections');
      }

      return 'Dashboard overview API working correctly';
    });

    // Test 3: Cost categories endpoint
    await this.runTest('Cost Categories API', async () => {
      const response = await axios.get(`${this.baseUrl}/api/cost-tracking/categories`);

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}`);
      }

      if (!response.data.data || !Array.isArray(response.data.data)) {
        throw new Error('Invalid categories response');
      }

      if (response.data.data.length === 0) {
        throw new Error('No cost categories found');
      }

      return `Found ${response.data.data.length} cost categories`;
    });

    // Test 4: Export functionality
    await this.runTest('Export API', async () => {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const response = await axios.get(
        `${this.baseUrl}/api/cost-tracking/export/${this.testAgentId}`,
        {
          params: { startDate, endDate, format: 'json' }
        }
      );

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}`);
      }

      if (!response.data.success || !response.data.data) {
        throw new Error('Invalid export response');
      }

      return 'Export API working correctly';
    });
  }

  async testMonitoringService() {
    console.log('\n📈 Testing Monitoring Service...');

    // Test 1: Real-time metrics
    await this.runTest('Real-time Metrics', async () => {
      const metrics = await costMonitoringService.getRealTimeMetrics(this.testAgentId);

      if (!metrics || typeof metrics.totalCost === 'undefined') {
        throw new Error('Invalid metrics structure');
      }

      return 'Real-time metrics retrieved successfully';
    });

    // Test 2: Budget alert setup
    await this.runTest('Budget Alert Setup', async () => {
      const budget = await costMonitoringService.setBudgetAlert({
        agentId: this.testAgentId,
        budgetType: 'monthly',
        budgetAmount: 100.00,
        warningThreshold: 80,
        criticalThreshold: 95
      });

      if (!budget || !budget.id) {
        throw new Error('Budget alert creation failed');
      }

      return 'Budget alert configured successfully';
    });

    // Test 3: Usage trends
    await this.runTest('Usage Trends', async () => {
      const trends = await costMonitoringService.getUsageTrends(this.testAgentId, 7);

      if (!trends || !trends.dailyTrends) {
        throw new Error('Invalid trends structure');
      }

      return `Usage trends retrieved for ${trends.dailyTrends.length} days`;
    });
  }

  async testDatabaseOperations() {
    console.log('\n🗄️  Testing Database Operations...');

    // Test 1: Usage tracking table
    await this.runTest('Usage Tracking Table', async () => {
      const { data, error } = await databaseService.supabase
        .from('usage_tracking')
        .select('*')
        .eq('agent_id', this.testAgentId)
        .limit(5);

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No usage tracking records found');
      }

      return `Found ${data.length} usage tracking records`;
    });

    // Test 2: Cost summary function
    await this.runTest('Cost Summary Function', async () => {
      const { data, error } = await databaseService.supabase
        .rpc('get_agent_cost_summary', {
          p_agent_id: this.testAgentId,
          p_start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          p_end_date: new Date().toISOString().split('T')[0]
        });

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No cost summary data returned');
      }

      return `Cost summary generated with ${data.length} categories`;
    });

    // Test 3: Budget tables
    await this.runTest('Budget Tables', async () => {
      const { data, error } = await databaseService.supabase
        .from('cost_budgets')
        .select('*')
        .eq('agent_id', this.testAgentId);

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No budget records found');
      }

      return `Found ${data.length} budget records`;
    });
  }

  async testIntegrationScenarios() {
    console.log('\n🔗 Testing Integration Scenarios...');

    // Test 1: End-to-end cost tracking flow
    await this.runTest('End-to-End Cost Tracking', async () => {
      // Record multiple types of usage
      await costTrackingService.recordOpenAIUsage({
        agentId: this.testAgentId,
        leadId: this.testLeadId,
        operationType: 'integration_test_ai',
        model: 'gpt-4.1',
        inputTokens: 1000,
        outputTokens: 500,
        metadata: { integration_test: true }
      });

      await costTrackingService.recordGupshupUsage({
        agentId: this.testAgentId,
        leadId: this.testLeadId,
        messageType: 'session',
        phoneNumber: '+6587654321',
        messageId: 'integration_test_msg'
      });

      // Generate report
      const report = await costTrackingService.getUsageReport({
        agentId: this.testAgentId,
        startDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        groupBy: 'operation'
      });

      if (report.summary.recordCount < 2) {
        throw new Error('Integration test usage not recorded properly');
      }

      return 'End-to-end cost tracking flow working correctly';
    });

    // Test 2: Performance under load
    await this.runTest('Performance Under Load', async () => {
      const startTime = Date.now();
      const promises = [];

      // Create 10 concurrent usage recordings
      for (let i = 0; i < 10; i++) {
        promises.push(
          costTrackingService.recordOpenAIUsage({
            agentId: this.testAgentId,
            leadId: this.testLeadId,
            operationType: `load_test_${i}`,
            model: 'gpt-4.1',
            inputTokens: 100,
            outputTokens: 50,
            metadata: { load_test: true, iteration: i }
          })
        );
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      if (duration > 5000) {
        throw new Error(`Performance test took too long: ${duration}ms`);
      }

      return `Performance test completed in ${duration}ms`;
    });
  }

  async runTest(testName, testFunction) {
    this.testResults.total++;
    
    try {
      const result = await testFunction();
      this.testResults.passed++;
      this.testResults.details.push({
        name: testName,
        status: 'PASSED',
        message: result
      });
      console.log(`  ✅ ${testName}: ${result}`);
    } catch (error) {
      this.testResults.failed++;
      this.testResults.details.push({
        name: testName,
        status: 'FAILED',
        message: error.message
      });
      console.log(`  ❌ ${testName}: ${error.message}`);
    }
  }

  async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');

    try {
      // Delete test usage records
      await databaseService.supabase
        .from('usage_tracking')
        .delete()
        .eq('agent_id', this.testAgentId);

      // Delete test budget records
      await databaseService.supabase
        .from('cost_budgets')
        .delete()
        .eq('agent_id', this.testAgentId);

      // Delete test lead
      if (this.testLeadId) {
        await databaseService.supabase
          .from('leads')
          .delete()
          .eq('id', this.testLeadId);
      }

      // Delete test agent
      if (this.testAgentId) {
        await databaseService.supabase
          .from('agents')
          .delete()
          .eq('id', this.testAgentId);
      }

      console.log('✅ Test data cleanup completed');

    } catch (error) {
      console.warn('⚠️  Test data cleanup failed:', error.message);
    }
  }

  showResults() {
    console.log('\n📋 Test Results Summary');
    console.log('========================');
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed}`);
    console.log(`Failed: ${this.testResults.failed}`);
    console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);

    if (this.testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.details
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.message}`);
        });
    }

    if (this.testResults.passed === this.testResults.total) {
      console.log('\n🎉 All tests passed! Cost tracking system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above.');
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new CostTrackingSystemTest();
  tester.runAllTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = CostTrackingSystemTest;
