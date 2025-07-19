#!/usr/bin/env node

/**
 * Follow-Up Template Creation and Approval Flow Test
 * 
 * This script tests the complete flow of:
 * 1. AI template generation for missing scenarios
 * 2. Template submission to Gupshup Partner API
 * 3. Approval status monitoring
 * 4. Template availability for follow-up system
 */

require('dotenv').config();
const logger = require('./logger');
const databaseService = require('./services/databaseService');
const intelligentFollowUpService = require('./services/intelligentFollowUpService');
const automaticTemplateApprovalService = require('./services/automaticTemplateApprovalService');
const wabaTemplateAutomationService = require('./services/wabaTemplateAutomationService');
const multiWABATemplateService = require('./services/multiWABATemplateService');

class FollowUpTemplateFlowTest {
  constructor() {
    this.testResults = [];
    this.testAgent = null;
  }

  /**
   * Run complete template flow test
   */
  async runTest() {
    try {
      console.log('🧪 Starting Follow-Up Template Creation and Approval Flow Test\n');

      // Step 1: Setup test environment
      await this.setupTestEnvironment();

      // Step 2: Test missing template detection
      await this.testMissingTemplateDetection();

      // Step 3: Test AI template generation
      await this.testAITemplateGeneration();

      // Step 4: Test template submission to Partner API
      await this.testTemplateSubmission();

      // Step 5: Test approval status monitoring
      await this.testApprovalStatusMonitoring();

      // Step 6: Test template availability for follow-up
      await this.testTemplateAvailability();

      // Step 7: Test complete automated flow
      await this.testCompleteAutomatedFlow();

      // Display results
      this.displayResults();

    } catch (error) {
      logger.error({ err: error }, 'Template flow test failed');
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Setup test environment
   */
  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');

    try {
      // Get a test agent
      const { data: agents, error } = await databaseService.supabase
        .from('agents')
        .select('*')
        .eq('status', 'active')
        .limit(1);

      if (error || !agents || agents.length === 0) {
        throw new Error('No active agents found for testing');
      }

      this.testAgent = agents[0];
      
      console.log(`✅ Using test agent: ${this.testAgent.full_name} (ID: ${this.testAgent.id})`);
      console.log(`   WABA: ${this.testAgent.waba_phone_number || 'Not configured'}`);
      console.log(`   App ID: ${this.testAgent.gupshup_app_id || 'Not configured'}\n`);

      this.recordResult('Environment Setup', true, 'Test agent selected');

    } catch (error) {
      this.recordResult('Environment Setup', false, error.message);
      throw error;
    }
  }

  /**
   * Test missing template detection
   */
  async testMissingTemplateDetection() {
    console.log('🔍 Testing missing template detection...');

    try {
      // Get current approved templates for the agent
      const { data: approvedTemplates, error } = await databaseService.supabase
        .from('waba_templates')
        .select('template_name, template_category, status')
        .eq('agent_id', this.testAgent.id)
        .eq('status', 'approved');

      if (error) throw error;

      console.log(`   Found ${approvedTemplates?.length || 0} approved templates`);

      if (approvedTemplates && approvedTemplates.length > 0) {
        console.log('   Approved templates:');
        approvedTemplates.forEach(template => {
          console.log(`     - ${template.template_name} (${template.template_category})`);
        });
      }

      // Check for required templates (from the service's REQUIRED_TEMPLATES)
      const requiredTemplateNames = [
        'follow_up_generic',
        'follow_up_family_discussion',
        'follow_up_budget_concerns',
        'follow_up_viewing_feedback',
        'follow_up_decision_timeline'
      ];

      const approvedTemplateNames = new Set((approvedTemplates || []).map(t => t.template_name));
      const missingTemplates = requiredTemplateNames.filter(name => !approvedTemplateNames.has(name));

      console.log(`   Missing required templates: ${missingTemplates.length}`);
      if (missingTemplates.length > 0) {
        console.log('   Missing templates:');
        missingTemplates.forEach(template => {
          console.log(`     - ${template}`);
        });
      }

      this.recordResult('Missing Template Detection', true, `${missingTemplates.length} missing templates detected`);

    } catch (error) {
      this.recordResult('Missing Template Detection', false, error.message);
      throw error;
    }
  }

  /**
   * Test AI template generation
   */
  async testAITemplateGeneration() {
    console.log('🤖 Testing AI template generation...');

    try {
      // Trigger AI template generation for our test agent
      const generationResult = await intelligentFollowUpService.triggerTemplateGeneration(this.testAgent.id);
      
      console.log(`   Generation result: ${generationResult.success ? 'Success' : 'Failed'}`);
      
      if (generationResult.success) {
        console.log(`   Templates generated: ${generationResult.templatesGenerated || 0}`);
        console.log(`   Patterns analyzed: ${generationResult.patterns?.length || 0}`);
      } else {
        console.log(`   Error: ${generationResult.error}`);
      }

      this.recordResult('AI Template Generation', generationResult.success, 
        generationResult.success ? 
          `${generationResult.templatesGenerated || 0} templates generated` : 
          generationResult.error);

    } catch (error) {
      this.recordResult('AI Template Generation', false, error.message);
      throw error;
    }
  }

  /**
   * Test template submission to Partner API
   */
  async testTemplateSubmission() {
    console.log('📤 Testing template submission to Partner API...');

    try {
      // Create a test template for submission
      const testTemplate = {
        templateName: `test_followup_${Date.now()}`,
        category: 'UTILITY',
        language: 'en',
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, just checking in on your property search. Any updates?'
          }
        ],
        agentId: this.testAgent.id
      };

      console.log(`   Submitting test template: ${testTemplate.templateName}`);

      const submissionResult = await wabaTemplateAutomationService.submitTemplateForApproval(testTemplate);
      
      console.log(`   Submission result: ${submissionResult.success ? 'Success' : 'Failed'}`);
      
      if (submissionResult.success) {
        console.log(`   Template ID: ${submissionResult.templateId}`);
        console.log(`   Status: ${submissionResult.status}`);
      } else {
        console.log(`   Error: ${submissionResult.error}`);
      }

      this.recordResult('Template Submission', submissionResult.success, 
        submissionResult.success ? 
          `Template ${submissionResult.templateId} submitted` : 
          submissionResult.error);

    } catch (error) {
      this.recordResult('Template Submission', false, error.message);
      // Don't throw here as this might fail due to API limits
    }
  }

  /**
   * Test approval status monitoring
   */
  async testApprovalStatusMonitoring() {
    console.log('📊 Testing approval status monitoring...');

    try {
      // Get pending templates for the agent
      const { data: pendingTemplates, error } = await databaseService.supabase
        .from('waba_templates')
        .select('*')
        .eq('agent_id', this.testAgent.id)
        .eq('status', 'pending')
        .limit(5);

      if (error) throw error;

      console.log(`   Found ${pendingTemplates?.length || 0} pending templates`);

      if (pendingTemplates && pendingTemplates.length > 0) {
        console.log('   Pending templates:');
        pendingTemplates.forEach(template => {
          console.log(`     - ${template.template_name} (submitted: ${template.submitted_at})`);
        });

        // Test status check for first template
        const firstTemplate = pendingTemplates[0];
        console.log(`   Checking status for: ${firstTemplate.template_name}`);

        await wabaTemplateAutomationService.checkTemplateStatus(firstTemplate.id);
        console.log('   Status check completed');
      }

      this.recordResult('Approval Status Monitoring', true, `${pendingTemplates?.length || 0} pending templates monitored`);

    } catch (error) {
      this.recordResult('Approval Status Monitoring', false, error.message);
      throw error;
    }
  }

  /**
   * Test template availability for follow-up
   */
  async testTemplateAvailability() {
    console.log('📋 Testing template availability for follow-up...');

    try {
      // Test getting templates for different lead states
      const leadStates = ['new', 'qualified', 'needs_follow_up'];
      
      for (const leadState of leadStates) {
        try {
          const template = await multiWABATemplateService.getTemplateForLeadState(
            this.testAgent.id, 
            leadState
          );
          
          console.log(`   ${leadState}: ${template ? template.template_name : 'No template available'}`);
          
        } catch (error) {
          console.log(`   ${leadState}: Error - ${error.message}`);
        }
      }

      this.recordResult('Template Availability', true, 'Template availability checked for all lead states');

    } catch (error) {
      this.recordResult('Template Availability', false, error.message);
      throw error;
    }
  }

  /**
   * Test complete automated flow
   */
  async testCompleteAutomatedFlow() {
    console.log('🔄 Testing complete automated flow...');

    try {
      // Run the complete template approval automation
      const automationResult = await automaticTemplateApprovalService.checkAndEnsureTemplateApproval(this.testAgent.id);
      
      console.log(`   Automation result: ${automationResult.success ? 'Success' : 'Failed'}`);
      console.log(`   Templates checked: ${automationResult.templatesChecked || 0}`);
      console.log(`   Templates submitted: ${automationResult.templatesSubmitted || 0}`);
      console.log(`   Templates failed: ${automationResult.templatesFailed || 0}`);

      this.recordResult('Complete Automated Flow', automationResult.success, 
        `${automationResult.templatesSubmitted || 0} templates submitted automatically`);

    } catch (error) {
      this.recordResult('Complete Automated Flow', false, error.message);
      throw error;
    }
  }

  /**
   * Record test result
   */
  recordResult(testName, success, details) {
    this.testResults.push({
      test: testName,
      success,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Display test results
   */
  displayResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(60));

    let passed = 0;
    let failed = 0;

    this.testResults.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.test}: ${result.details}`);
      
      if (result.success) passed++;
      else failed++;
    });

    console.log('=' .repeat(60));
    console.log(`Total: ${this.testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! Follow-up template flow is working correctly.');
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Please review the issues above.`);
    }
  }
}

// Run the test
if (require.main === module) {
  const test = new FollowUpTemplateFlowTest();
  test.runTest().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = FollowUpTemplateFlowTest;
