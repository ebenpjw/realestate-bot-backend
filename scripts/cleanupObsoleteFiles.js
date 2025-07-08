/**
 * Cleanup Script for Obsolete Files
 * Removes redundant scraped data files and temporary test files
 */

const fs = require('fs').promises;
const path = require('path');

async function cleanupObsoleteFiles() {
  console.log('🧹 Starting codebase cleanup...\n');

  const filesToRemove = [
    // Old scraped data files (keep only the enhanced version)
    'scraped-properties.json',
    'enhanced-extraction-test.json',
    'enhanced-extraction-result.json',
    'debug-page-screenshot.png',
    'no-elements-found.png',
    'page-loaded.png',

    // Temporary test files
    'test-property-data.json',
    'sample-property-data.json',
    'test-ai-analysis.json',
    'test-unit-mix.json',

    // Old progress files (will be recreated by enhanced scraper)
    'scraping-progress.json',

    // Redundant test files (functionality moved to comprehensive test suite)
    'test_deletion_debug.js',
    'test_rescheduling_flow.js',
    'test_rescheduling_comprehensive.js',
    'test_appointment_cleanup.js',
    'test_visual_property_system.js',
    'test_personality_fix.js',
    'test_past_time_validation.js',
    'test_calendar_blocking.js',
    'test_conflict_detection.js',
    'test_conversation_improvements.js',
    'test_conversation_scenarios.js',
    'test_integration_validation.js',
    'test_ai_learning_integration.js',
    'test_appointment_booking.js',
    'test_appointment_booking_flow.js',
    'test_appointment_cancellation.js',

    // Standalone test files (replaced by comprehensive test suite)
    'test-bot.js',
    'create_test_appointment.js',
    'run_tests.js',
    'verify_ai_learning_setup.js'
  ];

  const directoriesToCheck = [
    '.',
    'scripts',
    'temp',
    'data'
  ];

  let removedCount = 0;
  let keptCount = 0;

  for (const dir of directoriesToCheck) {
    try {
      const dirExists = await fs.access(dir).then(() => true).catch(() => false);
      if (!dirExists) continue;

      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        
        if (filesToRemove.includes(file)) {
          try {
            await fs.unlink(filePath);
            console.log(`✅ Removed: ${filePath}`);
            removedCount++;
          } catch (error) {
            console.log(`⚠️ Could not remove ${filePath}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not check directory ${dir}: ${error.message}`);
    }
  }

  // Keep important files
  const importantFiles = [
    // Core application files
    'index.js', // Main server entry point
    'config.js', // Configuration management
    'logger.js', // Logging system
    'supabaseClient.js', // Database client
    'package.json', // Dependencies and scripts

    // Production data files
    'data/all-scraped-properties.json', // Enhanced scraper output
    'data/complete-property-data.json', // Complete property dataset

    // Core API routes
    'api/gupshup.js', // WhatsApp webhook handler
    'api/auth.js', // OAuth authentication
    'api/test.js', // Testing endpoints
    'api/webhooks.js', // Enhanced webhook endpoints
    'api/visualPropertyData.js', // Property data API

    // Essential services
    'services/botService.js', // Core bot logic
    'services/whatsappService.js', // WhatsApp integration
    'services/appointmentService.js', // Booking system
    'services/databaseService.js', // Database operations

    // Production scripts
    'scripts/localScraperWithWebhook.js', // Main scraper
    'scripts/floorPlanAnalyzer.js', // AI analyzer
    'scripts/manageProgress.js', // Progress manager
    'scripts/railway-deploy.js', // Deployment script

    // Comprehensive test suite (keep only the master runner)
    'tests/test_master_runner.js', // Master test runner
    'tests/test_complete_flow.js', // Complete flow testing

    // Database schema
    'database/database_schema_complete.sql', // Complete schema
    'supabase/migrations/002_enhanced_scraper_schema_alignment.sql' // Schema migration
  ];

  console.log('\n📋 Important files preserved:');
  for (const file of importantFiles) {
    try {
      await fs.access(file);
      console.log(`✅ Kept: ${file}`);
      keptCount++;
    } catch (error) {
      console.log(`⚠️ Missing: ${file}`);
    }
  }

  console.log('\n🎯 Cleanup Summary:');
  console.log('==================');
  console.log(`🗑️ Files removed: ${removedCount}`);
  console.log(`📁 Important files kept: ${keptCount}`);
  
  console.log('\n✅ Remaining Core Files:');
  console.log('========================');
  console.log('📊 Data Files:');
  console.log('   - data/all-scraped-properties.json (Enhanced scraper output)');
  console.log('');
  console.log('🔧 Scraper Files:');
  console.log('   - scripts/localScraperWithWebhook.js (Main enhanced scraper)');
  console.log('   - scripts/floorPlanAnalyzer.js (AI analysis)');
  console.log('   - scripts/manageProgress.js (Progress management)');
  console.log('');
  console.log('🌐 API Files:');
  console.log('   - api/webhooks.js (Enhanced webhook endpoints)');
  console.log('');
  console.log('🗄️ Database Files:');
  console.log('   - supabase/migrations/002_enhanced_scraper_schema_alignment.sql');
  console.log('');
  console.log('🎉 Codebase cleanup completed!');
  console.log('   Ready for production deployment with enhanced scraper system.');
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupObsoleteFiles().catch(console.error);
}

module.exports = cleanupObsoleteFiles;
