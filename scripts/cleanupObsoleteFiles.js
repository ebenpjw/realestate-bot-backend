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
    
    // Temporary test files
    'test-property-data.json',
    'sample-property-data.json',
    
    // Old progress files (will be recreated by enhanced scraper)
    'scraping-progress.json'
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
    'all-scraped-properties.json', // Enhanced scraper output
    'scripts/localScraperWithWebhook.js', // Main scraper
    'scripts/floorPlanAnalyzer.js', // AI analyzer
    'scripts/manageProgress.js', // Progress manager
    'api/webhooks.js', // Enhanced webhook
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
  console.log('   - all-scraped-properties.json (Enhanced scraper output)');
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
