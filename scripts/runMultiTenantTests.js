#!/usr/bin/env node

/**
 * Multi-Tenant Integration Test Runner
 * Runs comprehensive tests for the multi-tenant real estate bot system
 */

const path = require('path');
const logger = require('../logger');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TESTING_MODE = 'true';
process.env.DISABLE_WHATSAPP_SENDING = 'true';

async function runTests() {
  console.log('🚀 Starting Multi-Tenant Integration Tests');
  console.log('Environment: TEST MODE (No real messages will be sent)');
  console.log('='.repeat(80));

  try {
    // Import test class
    const MultiTenantIntegrationTest = require('../tests/multiTenantIntegrationTest');
    
    // Create test instance
    const testRunner = new MultiTenantIntegrationTest();
    
    // Run all tests
    const startTime = Date.now();
    await testRunner.runAllTests();
    const endTime = Date.now();
    
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n⏱️  Total test duration: ${duration} seconds`);
    console.log('🎉 Multi-tenant integration tests completed!');
    
    // Exit with success
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    logger.error({ err: error }, 'Multi-tenant integration tests failed');
    
    // Exit with failure
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run tests
runTests();
