#!/usr/bin/env node

/**
 * Stop Scraper Control Script
 * Sends graceful stop command to running scraper
 */

const fs = require('fs');
const path = require('path');

const controlFile = 'scraper-control.json';

try {
  console.log('🛑 Sending stop command to scraper...');
  
  const controlData = {
    state: 'stop',
    timestamp: new Date().toISOString(),
    command: 'external_stop'
  };
  
  fs.writeFileSync(controlFile, JSON.stringify(controlData, null, 2));
  
  console.log('✅ Stop command sent successfully');
  console.log('📋 The scraper will stop gracefully after completing the current property');
  console.log('💡 Progress will be saved and you can resume later with "npm run resume"');
  
} catch (error) {
  console.error('❌ Failed to send stop command:', error.message);
  process.exit(1);
}
