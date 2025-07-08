#!/usr/bin/env node

/**
 * Complete Real Estate Bot Flow Testing
 * Tests the entire lead-to-appointment journey without sending WhatsApp messages
 * 
 * Usage:
 *   node test_complete_flow.js [scenario]
 * 
 * Scenarios:
 *   - basic: Basic qualification to booking
 *   - conflict: Conflict resolution testing
 *   - edge: Edge cases and error handling
 *   - full: Complete end-to-end journey
 *   - all: Run all scenarios
 */

const axios = require('axios');
const readline = require('readline');

// Configuration
const BASE_URL = process.env.RAILWAY_URL || 'http://localhost:3000';
const SCENARIOS = {
  basic: 'basic_qualification_to_booking',
  conflict: 'conflict_resolution', 
  edge: 'edge_cases',
  full: 'full_journey'
};

class FlowTestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async runTests(scenario = 'all') {
    console.log('🚀 Real Estate Bot Complete Flow Testing');
    console.log('==========================================\n');
    
    try {
      if (scenario === 'all') {
        await this.runAllScenarios();
      } else if (SCENARIOS[scenario]) {
        await this.runSingleScenario(SCENARIOS[scenario]);
      } else {
        console.error(`❌ Unknown scenario: ${scenario}`);
        this.showUsage();
        return;
      }

      this.printFinalReport();
      
    } catch (error) {
      console.error(`❌ Testing failed: ${error.message}`);
      process.exit(1);
    }
  }

  async runAllScenarios() {
    console.log('🎭 Running all test scenarios...\n');
    
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎬 SCENARIO: ${name.toUpperCase()}`);
      console.log(`${'='.repeat(60)}\n`);
      
      await this.runSingleScenario(scenario);
      
      // Brief pause between scenarios
      await this.delay(2000);
    }
  }

  async runSingleScenario(scenario) {
    try {
      console.log(`📋 Testing scenario: ${scenario}`);
      console.log(`🌐 API Endpoint: ${BASE_URL}/api/test/complete-flow`);
      
      const response = await axios.post(`${BASE_URL}/api/test/complete-flow`, {
        scenario,
        options: {
          validateIntegrations: true,
          checkCalendarConflicts: true,
          generateZoomLinks: true
        }
      }, {
        timeout: 120000 // 2 minute timeout
      });

      const result = response.data;
      this.results.push({ scenario, ...result });
      
      this.printScenarioResult(scenario, result);
      
    } catch (error) {
      console.error(`❌ Scenario ${scenario} failed:`, error.response?.data || error.message);
      this.results.push({ 
        scenario, 
        success: false, 
        error: error.response?.data || error.message 
      });
    }
  }

  printScenarioResult(scenario, result) {
    console.log(`\n📊 SCENARIO RESULTS: ${scenario}`);
    console.log('-'.repeat(50));
    
    if (result.success) {
      console.log('✅ Status: PASSED');
      console.log(`⏱️  Total Time: ${result.totalTime}ms`);
      console.log(`👤 Lead ID: ${result.leadId}`);
      
      if (result.summary) {
        console.log(`💬 Messages: ${result.summary.totalMessages}`);
        console.log(`🤖 AI Responses: ${result.summary.totalAiResponses}`);
        console.log(`📅 Appointments: ${result.summary.appointmentsBooked}`);
        console.log(`⚡ Avg Processing: ${result.summary.avgProcessingTime}ms`);
        console.log(`🎯 Completed: ${result.summary.conversationCompleted ? 'YES' : 'NO'}`);
      }
      
      if (result.testResults && result.testResults.length > 0) {
        console.log('\n📝 Conversation Flow:');
        result.testResults.forEach((test, i) => {
          console.log(`  ${i + 1}. User: "${test.userMessage.substring(0, 50)}${test.userMessage.length > 50 ? '...' : ''}"`);
          if (test.aiResponses && test.aiResponses.length > 0) {
            test.aiResponses.forEach((resp, j) => {
              console.log(`     Bot: "${resp.substring(0, 50)}${resp.length > 50 ? '...' : ''}"`);
            });
          }
          if (test.appointmentBooked) {
            console.log(`     📅 APPOINTMENT BOOKED!`);
          }
        });
      }
      
    } else {
      console.log('❌ Status: FAILED');
      console.log(`💥 Error: ${result.error}`);
    }
    
    console.log('-'.repeat(50));
  }

  printFinalReport() {
    const totalTime = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL TEST REPORT');
    console.log('='.repeat(60));
    
    console.log(`🎯 Overall Result: ${passedTests === totalTests ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
    console.log(`📊 Success Rate: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
    console.log(`⏱️  Total Testing Time: ${Math.round(totalTime/1000)}s`);
    
    console.log('\n📈 Scenario Breakdown:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const time = result.totalTime ? `${result.totalTime}ms` : 'N/A';
      console.log(`  ${status} ${result.scenario}: ${time}`);
    });
    
    if (passedTests < totalTests) {
      console.log('\n🔍 Failed Scenarios:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`  ❌ ${result.scenario}: ${result.error}`);
      });
    }
    
    console.log('\n🎉 Testing Complete!');
    console.log('='.repeat(60));
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showUsage() {
    console.log('\nUsage: node test_complete_flow.js [scenario]');
    console.log('\nAvailable scenarios:');
    Object.keys(SCENARIOS).forEach(key => {
      console.log(`  ${key}: ${SCENARIOS[key]}`);
    });
    console.log('  all: Run all scenarios');
  }
}

// Interactive mode for detailed testing
class InteractiveFlowTester {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async startInteractiveMode() {
    console.log('🎮 Interactive Flow Testing Mode');
    console.log('================================\n');
    
    try {
      const scenario = await this.askQuestion('Enter scenario (basic/conflict/edge/full/all): ');
      const validateIntegrations = await this.askQuestion('Validate integrations? (y/n): ');
      const generateReport = await this.askQuestion('Generate detailed report? (y/n): ');
      
      const runner = new FlowTestRunner();
      await runner.runTests(scenario);
      
      if (generateReport.toLowerCase() === 'y') {
        console.log('\n📄 Generating detailed report...');
        // Could add detailed report generation here
      }
      
    } catch (error) {
      console.error(`❌ Interactive testing failed: ${error.message}`);
    } finally {
      this.rl.close();
    }
  }

  askQuestion(question) {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const scenario = args[0] || 'basic';
  
  if (args.includes('--interactive') || args.includes('-i')) {
    const interactive = new InteractiveFlowTester();
    await interactive.startInteractiveMode();
  } else {
    const runner = new FlowTestRunner();
    await runner.runTests(scenario);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { FlowTestRunner, InteractiveFlowTester };
