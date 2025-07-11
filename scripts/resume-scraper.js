#!/usr/bin/env node

/**
 * Resume Scraper Control Script
 * Sends resume command to paused scraper or starts new session
 */

const fs = require('fs');
const path = require('path');

const controlFile = 'scraper-control.json';
const progressFile = 'scraping-progress.json';

try {
  console.log('▶️ Checking scraper status...');
  
  // Check if there's a paused session
  let hasProgress = false;
  let progressData = null;
  
  if (fs.existsSync(progressFile)) {
    try {
      progressData = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      hasProgress = true;
      
      console.log('📊 Found existing progress:');
      console.log(`   📄 Current page: ${progressData.currentPage}/${progressData.totalPages || '?'}`);
      console.log(`   🏠 Properties scraped: ${progressData.totalPropertiesScraped}`);
      console.log(`   📋 Last property: ${progressData.lastProcessedProperty || 'None'}`);
      
      if (progressData.pausedAt) {
        console.log(`   ⏸️ Paused at: ${new Date(progressData.pausedAt).toLocaleString()}`);
      }
    } catch (error) {
      console.log('⚠️ Could not read progress file');
    }
  }
  
  // Check if scraper is currently running
  let isRunning = false;
  if (fs.existsSync(controlFile)) {
    try {
      const controlData = JSON.parse(fs.readFileSync(controlFile, 'utf8'));
      if (controlData.state === 'running' || controlData.state === 'paused') {
        isRunning = true;
      }
    } catch (error) {
      // Ignore control file read errors
    }
  }
  
  if (isRunning) {
    // Send resume command to running scraper
    console.log('📡 Sending resume command to running scraper...');
    
    const controlData = {
      state: 'resume',
      timestamp: new Date().toISOString(),
      command: 'external_resume'
    };
    
    fs.writeFileSync(controlFile, JSON.stringify(controlData, null, 2));
    console.log('✅ Resume command sent successfully');
    
  } else if (hasProgress) {
    // Start new scraper session with existing progress
    console.log('🚀 Starting new scraper session from saved progress...');
    console.log('💡 Run: npm run scrape');
    
  } else {
    // No progress found, suggest starting fresh
    console.log('📋 No existing progress found');
    console.log('🚀 To start scraping: npm run scrape');
  }
  
} catch (error) {
  console.error('❌ Failed to resume scraper:', error.message);
  process.exit(1);
}
