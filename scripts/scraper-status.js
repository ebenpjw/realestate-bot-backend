#!/usr/bin/env node

/**
 * Scraper Status Script
 * Shows current scraper status and progress
 */

const fs = require('fs');
const path = require('path');

const controlFile = 'scraper-control.json';
const progressFile = 'scraping-progress.json';

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

try {
  console.log('📊 Scraper Status Report\n');
  
  // Check control file
  let controlData = null;
  let isRunning = false;
  
  if (fs.existsSync(controlFile)) {
    try {
      controlData = JSON.parse(fs.readFileSync(controlFile, 'utf8'));
      isRunning = controlData.state === 'running' || controlData.state === 'paused';
      
      console.log('🎛️ Control Status:');
      console.log(`   State: ${controlData.state}`);
      console.log(`   Last Update: ${new Date(controlData.timestamp).toLocaleString()}`);
      if (controlData.pid) {
        console.log(`   Process ID: ${controlData.pid}`);
      }
      console.log('');
    } catch (error) {
      console.log('⚠️ Could not read control file\n');
    }
  } else {
    console.log('🎛️ Control Status: No active control file\n');
  }
  
  // Check progress file
  if (fs.existsSync(progressFile)) {
    try {
      const progressData = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      
      console.log('📈 Progress Status:');
      console.log(`   Current Page: ${progressData.currentPage}/${progressData.totalPages || '?'}`);
      console.log(`   Properties Scraped: ${progressData.totalPropertiesScraped}`);
      console.log(`   New Properties: ${progressData.newPropertiesAdded}`);
      console.log(`   Updated Properties: ${progressData.propertiesUpdated}`);
      console.log(`   Duplicates Skipped: ${progressData.duplicatesSkipped}`);
      console.log(`   Errors: ${progressData.errors?.length || 0}`);
      
      if (progressData.lastProcessedProperty) {
        console.log(`   Last Property: ${progressData.lastProcessedProperty}`);
      }
      
      if (progressData.currentPropertyIndex !== undefined) {
        console.log(`   Property Index: ${progressData.currentPropertyIndex}`);
      }
      
      // Calculate runtime
      if (progressData.startTime) {
        const startTime = new Date(progressData.startTime);
        const currentTime = new Date();
        const totalRuntime = currentTime - startTime;
        const activeRuntime = totalRuntime - (progressData.totalPauseDuration || 0);
        
        console.log(`   Total Runtime: ${formatDuration(totalRuntime)}`);
        if (progressData.totalPauseDuration > 0) {
          console.log(`   Active Runtime: ${formatDuration(activeRuntime)}`);
          console.log(`   Pause Duration: ${formatDuration(progressData.totalPauseDuration)}`);
        }
      }
      
      if (progressData.pausedAt) {
        console.log(`   Paused At: ${new Date(progressData.pausedAt).toLocaleString()}`);
      }
      
      if (progressData.lastSaveTime) {
        console.log(`   Last Save: ${new Date(progressData.lastSaveTime).toLocaleString()}`);
      }
      
      console.log('');
      
      // Show recent errors
      if (progressData.errors && progressData.errors.length > 0) {
        console.log('⚠️ Recent Errors:');
        progressData.errors.slice(-3).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.property || 'Unknown'}: ${error.error}`);
          console.log(`      Page: ${error.page}, Time: ${new Date(error.timestamp).toLocaleString()}`);
        });
        console.log('');
      }
      
      // Calculate progress percentage
      if (progressData.totalPages) {
        const pageProgress = ((progressData.currentPage - 1) / progressData.totalPages) * 100;
        console.log(`📊 Overall Progress: ${pageProgress.toFixed(1)}%`);
        
        // Estimate completion time
        if (progressData.startTime && pageProgress > 0) {
          const elapsed = new Date() - new Date(progressData.startTime);
          const estimatedTotal = (elapsed / pageProgress) * 100;
          const remaining = estimatedTotal - elapsed;
          
          if (remaining > 0) {
            console.log(`⏱️ Estimated Time Remaining: ${formatDuration(remaining)}`);
          }
        }
      }
      
    } catch (error) {
      console.log('⚠️ Could not read progress file');
    }
  } else {
    console.log('📈 Progress Status: No progress file found');
  }
  
  console.log('\n💡 Available Commands:');
  console.log('   npm run scrape     # Start/resume scraping');
  console.log('   npm run pause      # Pause running scraper');
  console.log('   npm run resume     # Resume paused scraper');
  console.log('   npm run stop       # Stop scraper gracefully');
  console.log('   npm run status     # Show this status');
  
} catch (error) {
  console.error('❌ Failed to get scraper status:', error.message);
  process.exit(1);
}
