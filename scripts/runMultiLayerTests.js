#!/usr/bin/env node

/**
 * Multi-Layer AI Test Runner
 * 
 * Runs comprehensive tests for the 5-layer AI architecture and generates reports
 */

const MultiLayerAITest = require('../tests/multiLayerAITest');
const logger = require('../logger');
const fs = require('fs').promises;
const path = require('path');

async function runTests() {
  console.log('🚀 Starting Multi-Layer AI Test Suite...\n');
  
  try {
    const testSuite = new MultiLayerAITest();
    
    // Run full test suite
    const report = await testSuite.runFullTestSuite();
    
    // Display results
    displayResults(report);
    
    // Save detailed report
    await saveReport(report);
    
    // Exit with appropriate code
    const success = report.summary.overallScore >= 0.8;
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    logger.error({ err: error }, 'Test suite execution failed');
    process.exit(1);
  }
}

function displayResults(report) {
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('========================\n');
  
  // Overall summary
  const { summary } = report;
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`Passed: ${summary.passedTests} ✅`);
  console.log(`Failed: ${summary.failedTests} ❌`);
  console.log(`Overall Score: ${(summary.overallScore * 100).toFixed(1)}%`);
  console.log(`Status: ${summary.overallScore >= 0.8 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Layer tests
  console.log('🧠 LAYER TESTS');
  console.log('---------------');
  Object.entries(report.layerTests).forEach(([layer, result]) => {
    const status = result.success ? '✅' : '❌';
    const time = result.processingTime ? `(${result.processingTime}ms)` : '';
    console.log(`${layer}: ${status} ${time}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  console.log();
  
  // Integration tests
  console.log('🔗 INTEGRATION TESTS');
  console.log('--------------------');
  Object.entries(report.integrationTests).forEach(([test, result]) => {
    const status = result.success ? '✅' : '❌';
    const time = result.processingTime ? `(${result.processingTime}ms)` : '';
    const quality = result.qualityScore ? `Quality: ${(result.qualityScore * 100).toFixed(1)}%` : '';
    console.log(`${test}: ${status} ${time} ${quality}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  console.log();
  
  // Scenario tests
  console.log('🎭 SCENARIO TESTS');
  console.log('-----------------');
  Object.entries(report.scenarioTests).forEach(([scenario, result]) => {
    const status = result.success && result.meetsExpectations ? '✅' : '❌';
    const score = result.analysis ? `Score: ${(result.analysis.overallScore * 100).toFixed(1)}%` : '';
    console.log(`${scenario}: ${status} ${score}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  console.log();
  
  // Performance metrics
  console.log('⚡ PERFORMANCE METRICS');
  console.log('----------------------');
  const perf = report.performanceTests;
  console.log(`Health Status: ${perf.healthStatus}`);
  console.log(`Avg Processing Time: ${perf.averageProcessingTime}ms`);
  console.log(`Success Rate: ${(perf.successRate * 100).toFixed(1)}%`);
  console.log(`Conversion Rate: ${(perf.conversionRate * 100).toFixed(1)}%`);
  console.log(`Active Alerts: ${perf.activeAlerts}`);
  console.log();
  
  // Fact-checking tests
  console.log('🔍 FACT-CHECK TESTS');
  console.log('-------------------');
  Object.entries(report.factCheckTests).forEach(([query, result]) => {
    const status = result.success ? '✅' : '❌';
    const relevance = result.averageRelevance ? `Relevance: ${(result.averageRelevance * 100).toFixed(1)}%` : '';
    console.log(`${query.substring(0, 50)}...: ${status} ${relevance}`);
  });
  console.log();
  
  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('💡 RECOMMENDATIONS');
    console.log('------------------');
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    console.log();
  }
}

async function saveReport(report) {
  try {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `multilayer-ai-test-${timestamp}.json`);
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Detailed report saved to: ${reportPath}\n`);
    
  } catch (error) {
    console.warn('⚠️  Failed to save detailed report:', error.message);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Multi-Layer AI Test Runner

Usage: node scripts/runMultiLayerTests.js [options]

Options:
  --help, -h     Show this help message
  
This script runs comprehensive tests for the 5-layer AI architecture including:
- Individual layer testing
- Integration testing  
- Challenging scenario testing
- Fact-checking accuracy validation
- Performance metrics analysis

Exit codes:
  0 - All tests passed (score >= 80%)
  1 - Tests failed or error occurred
`);
  process.exit(0);
}

// Run the tests
runTests();
