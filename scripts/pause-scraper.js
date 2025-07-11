#!/usr/bin/env node

/**
 * Pause Scraper Control Script
 * Sends pause command to running scraper
 */

const fs = require('fs');
const path = require('path');

const controlFile = 'scraper-control.json';

try {
  console.log('⏸️ Sending pause command to scraper...');
  
  const controlData = {
    state: 'pause',
    timestamp: new Date().toISOString(),
    command: 'external_pause'
  };
  
  fs.writeFileSync(controlFile, JSON.stringify(controlData, null, 2));
  
  console.log('✅ Pause command sent successfully');
  console.log('📋 The scraper will pause after completing the current property');
  console.log('💡 Use "npm run resume" to resume scraping');
  
} catch (error) {
  console.error('❌ Failed to send pause command:', error.message);
  process.exit(1);
}
