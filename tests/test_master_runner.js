#!/usr/bin/env node

/**
 * Real Estate Bot Master Test Runner
 * Comprehensive testing suite that runs all test categories and generates detailed reports
 * 
 * Usage:
 *   node test_master_runner.js [options]
 * 
 * Options:
 *   --quick: Run quick tests only
 *   --full: Run comprehensive test suite
 *   --report: Generate detailed HTML report
 *   --integration: Run integration tests only
 *   --conversation: Run conversation tests only
 *   --booking: Run appointment booking tests only
 */

const fs = require('fs');
const path = require('path');
// Import available test modules
let FlowTestRunner;
try {
  FlowTestRunner = require('./test_complete_flow').FlowTestRunner;
} catch (error) {
  console.log('⚠️ FlowTestRunner not available:', error.message);
}

// Placeholder classes for missing test modules
class ConversationScenarioTester {
  async runAllScenarios() {
    return { success: false, error: 'ConversationScenarioTester not implemented yet' };
  }
}

class AppointmentBookingTester {
  async runAllTests() {
    return { success: false, error: 'AppointmentBookingTester not implemented yet' };
  }
}

class IntegrationValidationSuite {
  async validateAllIntegrations() {
    return { success: false, error: 'IntegrationValidationSuite not implemented yet' };
  }
}

class MasterTestRunner {
  constructor() {
    this.results = {
      startTime: Date.now(),
      endTime: null,
      totalDuration: 0,
      testSuites: [],
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        successRate: 0
      }
    };
  }

  async runTests(options = {}) {
    console.log('🚀 Real Estate Bot Master Test Suite');
    console.log('====================================\n');
    
    try {
      if (options.integration || options.full) {
        await this.runIntegrationTests();
      }
      
      if (options.conversation || options.full) {
        await this.runConversationTests();
      }
      
      if (options.booking || options.full) {
        await this.runBookingTests();
      }
      
      if (options.flow || options.full || (!options.integration && !options.conversation && !options.booking)) {
        await this.runFlowTests();
      }
      
      this.results.endTime = Date.now();
      this.results.totalDuration = this.results.endTime - this.results.startTime;
      
      this.calculateSummary();
      this.printMasterReport();
      
      if (options.report) {
        await this.generateHTMLReport();
      }
      
    } catch (error) {
      console.error(`❌ Master test suite failed: ${error.message}`);
      process.exit(1);
    }
  }

  async runIntegrationTests() {
    console.log('\n🔧 Running Integration Validation Suite...');
    console.log('=' .repeat(50));
    
    try {
      const validator = new IntegrationValidationSuite();
      await validator.runValidation('all');
      
      this.results.testSuites.push({
        name: 'Integration Validation',
        type: 'integration',
        results: validator.results,
        success: validator.results.every(r => r.success),
        duration: Date.now() - validator.startTime
      });
      
    } catch (error) {
      console.error(`❌ Integration tests failed: ${error.message}`);
      this.results.testSuites.push({
        name: 'Integration Validation',
        type: 'integration',
        success: false,
        error: error.message
      });
    }
  }

  async runConversationTests() {
    console.log('\n💬 Running Conversation Scenario Tests...');
    console.log('=' .repeat(50));
    
    try {
      const conversationTester = new ConversationScenarioTester();
      await conversationTester.runScenarios('all');
      
      this.results.testSuites.push({
        name: 'Conversation Scenarios',
        type: 'conversation',
        results: conversationTester.results,
        success: conversationTester.results.every(r => r.success),
        duration: Date.now() - conversationTester.startTime
      });
      
    } catch (error) {
      console.error(`❌ Conversation tests failed: ${error.message}`);
      this.results.testSuites.push({
        name: 'Conversation Scenarios',
        type: 'conversation',
        success: false,
        error: error.message
      });
    }
  }

  async runBookingTests() {
    console.log('\n📅 Running Appointment Booking Tests...');
    console.log('=' .repeat(50));
    
    try {
      const bookingTester = new AppointmentBookingTester();
      await bookingTester.runTests('all');
      
      this.results.testSuites.push({
        name: 'Appointment Booking',
        type: 'booking',
        results: bookingTester.results,
        success: bookingTester.results.every(r => r.success),
        duration: Date.now() - bookingTester.startTime
      });
      
    } catch (error) {
      console.error(`❌ Booking tests failed: ${error.message}`);
      this.results.testSuites.push({
        name: 'Appointment Booking',
        type: 'booking',
        success: false,
        error: error.message
      });
    }
  }

  async runFlowTests() {
    console.log('\n🎭 Running Complete Flow Tests...');
    console.log('=' .repeat(50));
    
    try {
      const flowTester = new FlowTestRunner();
      await flowTester.runTests('all');
      
      this.results.testSuites.push({
        name: 'Complete Flow',
        type: 'flow',
        results: flowTester.results,
        success: flowTester.results.every(r => r.success),
        duration: Date.now() - flowTester.startTime
      });
      
    } catch (error) {
      console.error(`❌ Flow tests failed: ${error.message}`);
      this.results.testSuites.push({
        name: 'Complete Flow',
        type: 'flow',
        success: false,
        error: error.message
      });
    }
  }

  calculateSummary() {
    let totalTests = 0;
    let passedTests = 0;
    
    this.results.testSuites.forEach(suite => {
      if (suite.results && Array.isArray(suite.results)) {
        totalTests += suite.results.length;
        passedTests += suite.results.filter(r => r.success).length;
      } else if (suite.success !== undefined) {
        totalTests += 1;
        if (suite.success) passedTests += 1;
      }
    });
    
    this.results.summary = {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
    };
  }

  printMasterReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 MASTER TEST SUITE REPORT');
    console.log('='.repeat(80));
    
    const { summary } = this.results;
    const overallSuccess = summary.successRate === 100;
    
    console.log(`🎯 Overall Result: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log(`📊 Success Rate: ${summary.passedTests}/${summary.totalTests} (${summary.successRate}%)`);
    console.log(`⏱️  Total Duration: ${Math.round(this.results.totalDuration / 1000)}s`);
    console.log(`📅 Test Date: ${new Date(this.results.startTime).toLocaleString()}`);
    
    console.log('\n📈 Test Suite Breakdown:');
    this.results.testSuites.forEach(suite => {
      const status = suite.success ? '✅' : '❌';
      const duration = suite.duration ? `${Math.round(suite.duration / 1000)}s` : 'N/A';
      console.log(`  ${status} ${suite.name}: ${duration}`);
      
      if (suite.results && Array.isArray(suite.results)) {
        const suitePassedTests = suite.results.filter(r => r.success).length;
        const suiteTotalTests = suite.results.length;
        console.log(`     Tests: ${suitePassedTests}/${suiteTotalTests} passed`);
      }
      
      if (suite.error) {
        console.log(`     Error: ${suite.error}`);
      }
    });
    
    if (!overallSuccess) {
      console.log('\n🔍 Failed Test Details:');
      this.results.testSuites.forEach(suite => {
        if (!suite.success) {
          console.log(`\n❌ ${suite.name}:`);
          if (suite.results && Array.isArray(suite.results)) {
            suite.results.filter(r => !r.success).forEach(result => {
              console.log(`  - ${result.testType || result.scenarioName || result.integration}: ${result.error}`);
            });
          } else if (suite.error) {
            console.log(`  - ${suite.error}`);
          }
        }
      });
    }
    
    console.log('\n🎉 Master Test Suite Complete!');
    console.log('='.repeat(80));
  }

  async generateHTMLReport() {
    console.log('\n📄 Generating HTML report...');
    
    const htmlContent = this.generateHTMLContent();
    const reportPath = path.join(__dirname, 'test_report.html');
    
    try {
      fs.writeFileSync(reportPath, htmlContent);
      console.log(`✅ HTML report generated: ${reportPath}`);
    } catch (error) {
      console.error(`❌ Failed to generate HTML report: ${error.message}`);
    }
  }

  generateHTMLContent() {
    const { summary } = this.results;
    const overallSuccess = summary.successRate === 100;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real Estate Bot Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .status-badge { padding: 8px 16px; border-radius: 20px; font-weight: bold; }
        .success { background-color: #d4edda; color: #155724; }
        .failure { background-color: #f8d7da; color: #721c24; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .test-suite { margin-bottom: 30px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
        .suite-header { background: #e9ecef; padding: 15px; font-weight: bold; }
        .suite-content { padding: 15px; }
        .test-item { padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .test-item:last-child { border-bottom: none; }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Real Estate Bot Test Report</h1>
            <div class="status-badge ${overallSuccess ? 'success' : 'failure'}">
                ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}
            </div>
            <p class="timestamp">Generated: ${new Date(this.results.startTime).toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Success Rate</h3>
                <h2>${summary.successRate}%</h2>
                <p>${summary.passedTests}/${summary.totalTests} tests passed</p>
            </div>
            <div class="summary-card">
                <h3>Total Duration</h3>
                <h2>${Math.round(this.results.totalDuration / 1000)}s</h2>
                <p>Test execution time</p>
            </div>
            <div class="summary-card">
                <h3>Test Suites</h3>
                <h2>${this.results.testSuites.length}</h2>
                <p>Different test categories</p>
            </div>
        </div>
        
        ${this.results.testSuites.map(suite => `
            <div class="test-suite">
                <div class="suite-header">
                    ${suite.success ? '✅' : '❌'} ${suite.name}
                    <span style="float: right;">${suite.duration ? Math.round(suite.duration / 1000) + 's' : 'N/A'}</span>
                </div>
                <div class="suite-content">
                    ${suite.results && Array.isArray(suite.results) ? 
                        suite.results.map(result => `
                            <div class="test-item">
                                <span>${result.testType || result.scenarioName || result.integration || 'Test'}</span>
                                <span class="${result.success ? 'pass' : 'fail'}">
                                    ${result.success ? '✅ PASS' : '❌ FAIL'}
                                </span>
                            </div>
                        `).join('') : 
                        `<div class="test-item">
                            <span>Suite Status</span>
                            <span class="${suite.success ? 'pass' : 'fail'}">
                                ${suite.success ? '✅ PASS' : '❌ FAIL'}
                            </span>
                        </div>`
                    }
                </div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options = {
    quick: args.includes('--quick'),
    full: args.includes('--full'),
    report: args.includes('--report'),
    integration: args.includes('--integration'),
    conversation: args.includes('--conversation'),
    booking: args.includes('--booking'),
    flow: args.includes('--flow')
  };
  
  // Default to full test if no specific options
  if (!options.integration && !options.conversation && !options.booking && !options.flow) {
    options.full = true;
  }
  
  const runner = new MasterTestRunner();
  await runner.runTests(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { MasterTestRunner };
