#!/usr/bin/env node

/**
 * Test v3 Message Delivery System
 * 
 * This script tests the updated v3 message delivery pipeline including:
 * - Phone number formatting consistency
 * - v3 API template message sending
 * - Webhook event processing for delivery confirmations
 * - Database status updates
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.development') });

const databaseService = require('../services/databaseService');
const messageService = require('../services/messageService');
const gupshupPartnerService = require('../services/gupshupPartnerService');
const logger = require('../logger');

class V3MessageDeliveryTester {
  constructor() {
    this.testResults = [];
  }

  /**
   * Test phone number formatting consistency
   */
  testPhoneNumberFormatting() {
    console.log('📱 Testing v3 phone number formatting...\n');

    const testCases = [
      { input: '80128102', expected: '6580128102', description: 'Singapore local number' },
      { input: '+6580128102', expected: '6580128102', description: 'International format' },
      { input: '6580128102', expected: '6580128102', description: 'Already formatted' },
      { input: '(65) 8012-8102', expected: '6580128102', description: 'With separators' },
      { input: '+65 8012 8102', expected: '6580128102', description: 'With spaces' },
      { input: '91234567890', expected: '91234567890', description: 'Indian number' }
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach((testCase, index) => {
      try {
        const result = messageService.formatPhoneNumber(testCase.input);
        if (result === testCase.expected) {
          console.log(`✅ Test ${index + 1}: ${testCase.description}`);
          console.log(`   ${testCase.input} → ${result}`);
          passed++;
        } else {
          console.log(`❌ Test ${index + 1}: ${testCase.description}`);
          console.log(`   ${testCase.input} → ${result} (expected: ${testCase.expected})`);
          failed++;
        }
      } catch (error) {
        console.log(`❌ Test ${index + 1}: ${testCase.description}`);
        console.log(`   ${testCase.input} → Error: ${error.message}`);
        failed++;
      }
    });

    console.log(`\n📊 Phone formatting tests: ${passed} passed, ${failed} failed\n`);
    return { passed, failed };
  }

  /**
   * Test v3 template component building
   */
  testTemplateComponents() {
    console.log('🧩 Testing v3 template component building...\n');

    const testCases = [
      {
        params: { '1': 'John Doe', '2': 'Condo', '3': '$500,000' },
        description: 'Multiple parameters'
      },
      {
        params: { '1': 'Jane Smith' },
        description: 'Single parameter'
      },
      {
        params: {},
        description: 'No parameters'
      }
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach((testCase, index) => {
      try {
        const components = messageService.buildTemplateComponents(testCase.params);
        
        console.log(`✅ Test ${index + 1}: ${testCase.description}`);
        console.log(`   Parameters: ${JSON.stringify(testCase.params)}`);
        console.log(`   Components: ${JSON.stringify(components, null, 2)}`);
        
        // Validate structure
        if (Array.isArray(components)) {
          if (Object.keys(testCase.params).length === 0) {
            // Should be empty array for no params
            if (components.length === 0) {
              passed++;
            } else {
              console.log(`   ⚠️ Expected empty array but got ${components.length} components`);
              failed++;
            }
          } else {
            // Should have body component with parameters
            const bodyComponent = components.find(c => c.type === 'body');
            if (bodyComponent && bodyComponent.parameters) {
              passed++;
            } else {
              console.log(`   ⚠️ Missing body component with parameters`);
              failed++;
            }
          }
        } else {
          console.log(`   ⚠️ Components should be an array`);
          failed++;
        }
        
      } catch (error) {
        console.log(`❌ Test ${index + 1}: ${testCase.description}`);
        console.log(`   Error: ${error.message}`);
        failed++;
      }
    });

    console.log(`\n📊 Template component tests: ${passed} passed, ${failed} failed\n`);
    return { passed, failed };
  }

  /**
   * Test webhook subscription configuration
   */
  async testWebhookConfiguration() {
    console.log('🔗 Testing v3 webhook configuration...\n');

    try {
      // Get a sample agent
      const { data: agents, error } = await databaseService.supabase
        .from('agents')
        .select('id, full_name, gupshup_app_id')
        .not('gupshup_app_id', 'is', null)
        .limit(1);

      if (error || !agents || agents.length === 0) {
        console.log('⚠️ No agents found for webhook testing');
        return { success: false, error: 'No agents available' };
      }

      const agent = agents[0];
      console.log(`Testing webhook for agent: ${agent.full_name} (${agent.gupshup_app_id})`);

      // Check current subscriptions
      const subscriptions = await gupshupPartnerService.getAppSubscriptions(agent.gupshup_app_id);
      
      console.log(`📋 Current subscriptions: ${subscriptions.length}`);
      subscriptions.forEach(sub => {
        console.log(`   • ID: ${sub.id}`);
        console.log(`     Version: ${sub.version}`);
        console.log(`     Modes: ${sub.mode}`);
        console.log(`     URL: ${sub.url}`);
        console.log(`     Active: ${sub.active}`);
      });

      // Check if we have v3 subscriptions with proper modes
      const v3Subscriptions = subscriptions.filter(sub => sub.version === 3);
      const hasProperModes = subscriptions.some(sub => {
        const modes = sub.mode.toString();
        return modes.includes('SENT') || modes.includes('DELIVERED') || modes.includes('MESSAGE');
      });

      console.log(`\n✅ v3 subscriptions: ${v3Subscriptions.length}`);
      console.log(`✅ Has delivery tracking modes: ${hasProperModes}`);

      return { 
        success: true, 
        subscriptions,
        v3Count: v3Subscriptions.length,
        hasDeliveryTracking: hasProperModes
      };

    } catch (error) {
      console.log(`❌ Webhook configuration test failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test database message logging and status updates
   */
  async testDatabaseOperations() {
    console.log('💾 Testing database message operations...\n');

    try {
      // Create a test message log entry
      const testMessageId = 'test_msg_' + Date.now();
      const testMessage = {
        phone_number: '6580128102',
        sender: 'agent',
        message: 'Test v3 message for delivery tracking',
        message_type: 'template',
        template_id: 'test_template_v3',
        template_params: { '1': 'Test User', '2': 'v3 API' },
        external_message_id: testMessageId,
        delivery_status: 'submitted',
        created_at: new Date().toISOString()
      };

      console.log('📝 Creating test message...');
      const { data, error } = await databaseService.supabase
        .from('messages')
        .insert(testMessage)
        .select()
        .single();

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      console.log(`✅ Test message created with ID: ${data.id}`);

      // Test delivery status updates (simulating webhook events)
      const statusUpdates = [
        { status: 'sent', timestamp: new Date() },
        { status: 'delivered', timestamp: new Date(Date.now() + 1000) },
        { status: 'read', timestamp: new Date(Date.now() + 2000) }
      ];

      for (const update of statusUpdates) {
        console.log(`📤 Testing status update: ${update.status}`);
        
        const { error: updateError } = await databaseService.supabase
          .from('messages')
          .update({
            delivery_status: update.status,
            delivered_at: update.timestamp.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('external_message_id', testMessageId);

        if (updateError) {
          throw new Error(`Status update failed for ${update.status}: ${updateError.message}`);
        }

        console.log(`✅ Status updated to: ${update.status}`);
      }

      // Verify final state
      const { data: finalMessage, error: fetchError } = await databaseService.supabase
        .from('messages')
        .select('*')
        .eq('id', data.id)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch final message state: ${fetchError.message}`);
      }

      console.log(`📊 Final message state:`);
      console.log(`   Status: ${finalMessage.delivery_status}`);
      console.log(`   Delivered at: ${finalMessage.delivered_at}`);
      console.log(`   Updated at: ${finalMessage.updated_at}`);

      // Clean up test message
      await databaseService.supabase
        .from('messages')
        .delete()
        .eq('id', data.id);

      console.log('🧹 Test message cleaned up');

      return { success: true, messageId: data.id, finalStatus: finalMessage.delivery_status };

    } catch (error) {
      console.log(`❌ Database operations test failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run all v3 tests
   */
  async runAllTests() {
    console.log('🧪 Starting v3 Message Delivery System Tests\n');
    console.log('='.repeat(70) + '\n');

    const results = {
      phoneFormatting: this.testPhoneNumberFormatting(),
      templateComponents: this.testTemplateComponents(),
      webhookConfig: await this.testWebhookConfiguration(),
      databaseOps: await this.testDatabaseOperations()
    };

    // Print comprehensive summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 V3 MESSAGE DELIVERY SYSTEM TEST SUMMARY');
    console.log('='.repeat(70));

    const phoneTests = results.phoneFormatting;
    const componentTests = results.templateComponents;
    
    console.log(`📱 Phone Formatting: ${phoneTests.passed}/${phoneTests.passed + phoneTests.failed} tests passed`);
    console.log(`🧩 Template Components: ${componentTests.passed}/${componentTests.passed + componentTests.failed} tests passed`);
    console.log(`🔗 Webhook Config: ${results.webhookConfig.success ? '✅ PASS' : '❌ FAIL'}`);
    if (results.webhookConfig.success) {
      console.log(`   • v3 subscriptions: ${results.webhookConfig.v3Count}`);
      console.log(`   • Delivery tracking: ${results.webhookConfig.hasDeliveryTracking ? '✅' : '❌'}`);
    }
    console.log(`💾 Database Operations: ${results.databaseOps.success ? '✅ PASS' : '❌ FAIL'}`);

    const allTestsPassed = 
      phoneTests.failed === 0 &&
      componentTests.failed === 0 &&
      results.webhookConfig.success &&
      results.databaseOps.success;

    console.log(`\n🎯 Overall System Status: ${allTestsPassed ? '✅ READY' : '⚠️ NEEDS ATTENTION'}`);

    if (allTestsPassed) {
      console.log('\n🎉 All tests passed! v3 message delivery system is ready for production.');
      console.log('📝 Next steps:');
      console.log('   1. Run webhook reconfiguration script if needed');
      console.log('   2. Test with actual message sending');
      console.log('   3. Monitor webhook events in logs');
    } else {
      console.log('\n⚠️ Some tests failed. Please review and fix the issues above.');
    }

    return results;
  }
}

// Run the tests
async function main() {
  const tester = new V3MessageDeliveryTester();
  await tester.runAllTests();
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = V3MessageDeliveryTester;
