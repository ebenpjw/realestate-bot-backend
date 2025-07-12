const logger = require('../logger');
const multiTenantConfigService = require('../services/multiTenantConfigService');
const leadDeduplicationService = require('../services/leadDeduplicationService');
const botService = require('../services/botService');
const messageOrchestrator = require('../services/messageOrchestrator');

/**
 * Multi-Tenant Integration Tests
 * Comprehensive testing of multi-agent scenarios and lead deduplication flows
 */
class MultiTenantIntegrationTest {
  constructor() {
    this.testResults = [];
    this.testAgents = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Sarah Chen',
        wabaNumber: '+6591111111',
        botName: 'Sarah',
        displayName: 'Sarah - Property Expert'
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Mike Tan',
        wabaNumber: '+6592222222',
        botName: 'Mike',
        displayName: 'Mike - Investment Specialist'
      }
    ];
    this.testLeads = [
      {
        phoneNumber: '+6598887777',
        name: 'John Lim',
        scenario: 'Same lead contacts multiple agents'
      },
      {
        phoneNumber: '+6598888888',
        name: 'Mary Wong',
        scenario: 'Single agent conversation'
      }
    ];
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    logger.info('🚀 Starting Multi-Tenant Integration Tests');
    
    try {
      // Test 1: Agent Configuration Loading
      await this.testAgentConfigurationLoading();
      
      // Test 2: Lead Deduplication Logic
      await this.testLeadDeduplication();
      
      // Test 3: Cross-Agent Conversation Isolation
      await this.testConversationIsolation();
      
      // Test 4: Multi-Agent Message Routing
      await this.testMultiAgentRouting();
      
      // Test 5: Agent-Specific Template Management
      await this.testAgentTemplates();
      
      // Test 6: End-to-End Message Flow
      await this.testEndToEndFlow();
      
      // Generate test report
      this.generateTestReport();
      
    } catch (error) {
      logger.error({ err: error }, '❌ Integration tests failed');
      throw error;
    }
  }

  /**
   * Test 1: Agent Configuration Loading
   */
  async testAgentConfigurationLoading() {
    logger.info('📋 Test 1: Agent Configuration Loading');
    
    try {
      // Test loading agent config (will fail gracefully if agent doesn't exist)
      for (const testAgent of this.testAgents) {
        try {
          const config = await multiTenantConfigService.getAgentConfig(testAgent.id);
          this.recordTestResult('Agent Config Loading', testAgent.id, true, 'Config loaded successfully');
        } catch (error) {
          // Expected to fail if agent doesn't exist in database yet
          this.recordTestResult('Agent Config Loading', testAgent.id, false, `Expected failure: ${error.message}`);
        }
      }
      
      // Test WABA config loading
      try {
        const wabaConfig = await multiTenantConfigService.getAgentWABAConfig(this.testAgents[0].id);
        this.recordTestResult('WABA Config Loading', 'test-agent-1', true, 'WABA config loaded');
      } catch (error) {
        this.recordTestResult('WABA Config Loading', 'test-agent-1', false, `Expected failure: ${error.message}`);
      }
      
    } catch (error) {
      logger.error({ err: error }, 'Test 1 failed');
      throw error;
    }
  }

  /**
   * Test 2: Lead Deduplication Logic
   */
  async testLeadDeduplication() {
    logger.info('🔍 Test 2: Lead Deduplication Logic');
    
    try {
      const testLead = this.testLeads[0];
      
      // Test phone number normalization
      const normalizedNumbers = [
        '+6598887777',
        '6598887777', 
        '98887777',
        '+65 9888 7777'
      ];
      
      for (const number of normalizedNumbers) {
        try {
          // This will test the phone number normalization logic
          const result = await leadDeduplicationService.getLeadDeduplicationSummary(number);
          this.recordTestResult('Phone Normalization', number, true, 'Number normalized successfully');
        } catch (error) {
          this.recordTestResult('Phone Normalization', number, false, error.message);
        }
      }
      
      // Test lead conversation creation
      try {
        const conversation1 = await leadDeduplicationService.findOrCreateLeadConversation({
          phoneNumber: testLead.phoneNumber,
          agentId: this.testAgents[0].id,
          leadName: testLead.name,
          source: 'Facebook Ad'
        });
        
        this.recordTestResult('Lead Conversation Creation', 'Agent 1', true, 'Conversation created');
        
        // Test same lead with different agent
        const conversation2 = await leadDeduplicationService.findOrCreateLeadConversation({
          phoneNumber: testLead.phoneNumber,
          agentId: this.testAgents[1].id,
          leadName: testLead.name,
          source: 'Instagram Ad'
        });
        
        this.recordTestResult('Cross-Agent Lead Creation', 'Agent 2', true, 'Separate conversation created');
        
        // Verify conversations are isolated
        const isolated = conversation1.conversation.id !== conversation2.conversation.id;
        this.recordTestResult('Conversation Isolation', 'Different IDs', isolated, 
          isolated ? 'Conversations properly isolated' : 'Conversations not isolated');
        
      } catch (error) {
        this.recordTestResult('Lead Deduplication', 'Creation', false, error.message);
      }
      
    } catch (error) {
      logger.error({ err: error }, 'Test 2 failed');
      throw error;
    }
  }

  /**
   * Test 3: Cross-Agent Conversation Isolation
   */
  async testConversationIsolation() {
    logger.info('🔒 Test 3: Cross-Agent Conversation Isolation');
    
    try {
      const testLead = this.testLeads[0];
      
      // Test that each agent gets their own conversation thread
      const conversations = [];
      
      for (const agent of this.testAgents) {
        try {
          const conversation = await leadDeduplicationService.findOrCreateLeadConversation({
            phoneNumber: testLead.phoneNumber,
            agentId: agent.id,
            leadName: testLead.name,
            source: `Test Source ${agent.name}`
          });
          
          conversations.push({
            agentId: agent.id,
            conversationId: conversation.conversation.id,
            globalLeadId: conversation.globalLead.id
          });
          
          this.recordTestResult('Agent Conversation', agent.name, true, 'Conversation created');
        } catch (error) {
          this.recordTestResult('Agent Conversation', agent.name, false, error.message);
        }
      }
      
      // Verify all conversations have same global lead but different conversation IDs
      if (conversations.length >= 2) {
        const sameGlobalLead = conversations[0].globalLeadId === conversations[1].globalLeadId;
        const differentConversations = conversations[0].conversationId !== conversations[1].conversationId;
        
        this.recordTestResult('Global Lead Consistency', 'Same Lead ID', sameGlobalLead,
          sameGlobalLead ? 'Global lead properly shared' : 'Global lead not shared');
        
        this.recordTestResult('Conversation Isolation', 'Different Conversation IDs', differentConversations,
          differentConversations ? 'Conversations properly isolated' : 'Conversations not isolated');
      }
      
    } catch (error) {
      logger.error({ err: error }, 'Test 3 failed');
      throw error;
    }
  }

  /**
   * Test 4: Multi-Agent Message Routing
   */
  async testMultiAgentRouting() {
    logger.info('📨 Test 4: Multi-Agent Message Routing');
    
    try {
      // Test webhook routing logic
      for (const agent of this.testAgents) {
        try {
          // Simulate webhook message with agent's WABA number
          const messageData = {
            senderWaId: this.testLeads[0].phoneNumber,
            userText: `Hello, I'm interested in properties. Testing agent ${agent.name}`,
            senderName: this.testLeads[0].name,
            destinationWabaNumber: agent.wabaNumber
          };
          
          // Test agent identification by WABA number
          try {
            const agentConfig = await multiTenantConfigService.getAgentByWABANumber(agent.wabaNumber);
            this.recordTestResult('Agent Routing', agent.name, true, 'Agent identified by WABA number');
          } catch (error) {
            this.recordTestResult('Agent Routing', agent.name, false, `Expected failure: ${error.message}`);
          }
          
        } catch (error) {
          this.recordTestResult('Message Routing', agent.name, false, error.message);
        }
      }
      
    } catch (error) {
      logger.error({ err: error }, 'Test 4 failed');
      throw error;
    }
  }

  /**
   * Test 5: Agent-Specific Template Management
   */
  async testAgentTemplates() {
    logger.info('📝 Test 5: Agent-Specific Template Management');
    
    try {
      for (const agent of this.testAgents) {
        try {
          // Test getting agent templates
          const templates = await multiTenantConfigService.getAgentTemplates(agent.id);
          this.recordTestResult('Agent Templates', agent.name, true, `Found ${templates.length} templates`);
          
          // Test template creation
          const testTemplate = {
            templateId: `test-template-${agent.id}`,
            templateName: `test_welcome_${agent.name.toLowerCase()}`,
            category: 'MARKETING',
            content: `Hi {{1}}, this is ${agent.botName} from ${agent.displayName}!`,
            parameters: ['leadName'],
            languageCode: 'en',
            approvalStatus: 'pending'
          };
          
          const createdTemplate = await multiTenantConfigService.upsertAgentTemplate(agent.id, testTemplate);
          this.recordTestResult('Template Creation', agent.name, true, 'Template created successfully');
          
        } catch (error) {
          this.recordTestResult('Agent Templates', agent.name, false, `Expected failure: ${error.message}`);
        }
      }
      
    } catch (error) {
      logger.error({ err: error }, 'Test 5 failed');
      throw error;
    }
  }

  /**
   * Test 6: End-to-End Message Flow
   */
  async testEndToEndFlow() {
    logger.info('🔄 Test 6: End-to-End Message Flow');
    
    try {
      // Test complete message processing flow
      const testMessage = {
        senderWaId: this.testLeads[1].phoneNumber,
        userText: 'Hi, I\'m looking for a 3-bedroom condo in Orchard area',
        senderName: this.testLeads[1].name,
        agentId: this.testAgents[0].id
      };
      
      try {
        // Test bot service with agent context
        await botService.processMessage(testMessage);
        this.recordTestResult('End-to-End Flow', 'Bot Processing', true, 'Message processed successfully');
      } catch (error) {
        this.recordTestResult('End-to-End Flow', 'Bot Processing', false, `Expected failure: ${error.message}`);
      }
      
      try {
        // Test message orchestrator with agent context
        await messageOrchestrator.processMessage(testMessage);
        this.recordTestResult('End-to-End Flow', 'Orchestrator', true, 'Message orchestrated successfully');
      } catch (error) {
        this.recordTestResult('End-to-End Flow', 'Orchestrator', false, `Expected failure: ${error.message}`);
      }
      
    } catch (error) {
      logger.error({ err: error }, 'Test 6 failed');
      throw error;
    }
  }

  /**
   * Record test result
   */
  recordTestResult(testCategory, testName, success, message) {
    const result = {
      category: testCategory,
      name: testName,
      success,
      message,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(result);
    
    const status = success ? '✅' : '❌';
    logger.info({ result }, `${status} ${testCategory} - ${testName}: ${message}`);
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    logger.info({
      totalTests,
      passedTests,
      failedTests,
      successRate: `${successRate}%`,
      testResults: this.testResults
    }, '📊 Multi-Tenant Integration Test Report');
    
    console.log('\n' + '='.repeat(80));
    console.log('🧪 MULTI-TENANT INTEGRATION TEST REPORT');
    console.log('='.repeat(80));
    console.log(`📈 Success Rate: ${successRate}% (${passedTests}/${totalTests})`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log('='.repeat(80));
    
    // Group results by category
    const categories = [...new Set(this.testResults.map(r => r.category))];
    
    categories.forEach(category => {
      const categoryResults = this.testResults.filter(r => r.category === category);
      const categoryPassed = categoryResults.filter(r => r.success).length;
      const categoryTotal = categoryResults.length;
      
      console.log(`\n📋 ${category}: ${categoryPassed}/${categoryTotal}`);
      categoryResults.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${result.name}: ${result.message}`);
      });
    });
    
    console.log('\n' + '='.repeat(80));
    
    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: parseFloat(successRate),
      results: this.testResults
    };
  }
}

module.exports = MultiTenantIntegrationTest;
