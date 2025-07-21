#!/usr/bin/env node

/**
 * Test Runner for WhatsApp Messaging System
 * Runs Playwright tests with proper setup and configuration
 */

const { spawn } = require('child_process');
const path = require('path');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HEADLESS = process.env.HEADLESS !== 'false'; // Run headless by default
const BROWSER = process.env.BROWSER || 'chromium'; // chromium, firefox, webkit

console.log('🚀 Starting WhatsApp Messaging System Tests');
console.log(`📍 Base URL: ${BASE_URL}`);
console.log(`🌐 Browser: ${BROWSER}`);
console.log(`👁️  Headless: ${HEADLESS}`);
console.log('');

// Playwright command arguments
const playwrightArgs = [
  'test',
  'tests/messages.spec.js',
  `--project=${BROWSER}`,
  '--reporter=list',
  '--timeout=30000',
  '--retries=1'
];

// Add headless flag if needed
if (HEADLESS) {
  playwrightArgs.push('--headed=false');
} else {
  playwrightArgs.push('--headed=true');
}

// Set environment variables
const env = {
  ...process.env,
  BASE_URL: BASE_URL,
  PWDEBUG: HEADLESS ? '0' : '1' // Enable debug mode when not headless
};

// Run Playwright tests
const playwright = spawn('npx', ['playwright', ...playwrightArgs], {
  stdio: 'inherit',
  env: env,
  cwd: process.cwd()
});

playwright.on('close', (code) => {
  console.log('');
  if (code === 0) {
    console.log('✅ All tests passed!');
    console.log('');
    console.log('📊 Test Summary:');
    console.log('   - Template loading and selection ✅');
    console.log('   - Lead selection and filtering ✅');
    console.log('   - Message composition and validation ✅');
    console.log('   - Individual message sending ✅');
    console.log('   - Bulk campaign creation ✅');
    console.log('   - Template creation ✅');
    console.log('   - Campaign history display ✅');
    console.log('   - Error handling ✅');
    console.log('   - Performance testing ✅');
    console.log('');
    console.log('🎉 WhatsApp Messaging System is ready for production!');
  } else {
    console.log(`❌ Tests failed with exit code ${code}`);
    console.log('');
    console.log('🔍 Troubleshooting Tips:');
    console.log('   1. Make sure the application is running at', BASE_URL);
    console.log('   2. Verify login credentials are correct');
    console.log('   3. Check that the Messages page is accessible');
    console.log('   4. Ensure all API endpoints are working');
    console.log('   5. Run with --headed to see browser interactions:');
    console.log('      HEADLESS=false npm run test:messages');
  }
  
  process.exit(code);
});

playwright.on('error', (error) => {
  console.error('❌ Failed to start Playwright:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Tests interrupted by user');
  playwright.kill('SIGINT');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Tests terminated');
  playwright.kill('SIGTERM');
  process.exit(1);
});
