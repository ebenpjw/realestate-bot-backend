/**
 * Manage Scraping Progress
 * View, reset, or modify scraping progress
 */

const fs = require('fs').promises;

class ProgressManager {
  constructor() {
    this.progressFile = 'scraping-progress.json';
    this.propertiesFile = 'all-scraped-properties.json';
  }

  async viewProgress() {
    try {
      console.log('📊 Current Scraping Progress:');
      console.log('============================');

      // Load progress
      const progressData = await fs.readFile(this.progressFile, 'utf8');
      const progress = JSON.parse(progressData);

      const totalPages = progress.totalPages || 'Unknown';
      console.log(`📄 Current Page: ${progress.currentPage}/${totalPages}`);
      console.log(`📊 Total Properties Scraped: ${progress.totalPropertiesScraped}`);
      console.log(`✅ Completed Pages: ${progress.completedPages.length} (${progress.completedPages.join(', ')})`);
      console.log(`🕐 Started: ${new Date(progress.startTime).toLocaleString()}`);
      console.log(`🏠 Last Successful: ${progress.lastSuccessfulProperty || 'None'}`);
      console.log(`❌ Errors: ${progress.errors.length}`);

      if (progress.errors.length > 0) {
        console.log('\n❌ Recent Errors:');
        progress.errors.slice(-5).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.property || `Page ${error.page}`}: ${error.error}`);
        });
      }

      // Load properties
      try {
        const propertiesData = await fs.readFile(this.propertiesFile, 'utf8');
        const properties = JSON.parse(propertiesData);
        console.log(`\n📄 Properties File: ${properties.length} properties saved`);
      } catch (error) {
        console.log('\n📄 Properties File: Not found');
      }

      // Calculate progress percentage
      const progressPercent = Math.round((progress.completedPages.length / 30) * 100);
      console.log(`\n📈 Overall Progress: ${progressPercent}% complete`);

      if (progress.currentPage > 30) {
        console.log('🎉 Scraping is COMPLETE!');
      } else {
        console.log(`⏳ Next: Will resume from page ${progress.currentPage}`);
      }

    } catch (error) {
      console.log('📊 No progress file found - scraping hasn\'t started yet');
    }
  }

  async resetProgress() {
    try {
      console.log('🔄 Resetting scraping progress...');
      
      const newProgress = {
        currentPage: 1,
        completedPages: [],
        totalPropertiesScraped: 0,
        lastSuccessfulProperty: null,
        startTime: new Date().toISOString(),
        errors: []
      };

      await fs.writeFile(this.progressFile, JSON.stringify(newProgress, null, 2));
      console.log('✅ Progress reset to start from page 1');

      // Optionally reset properties file
      console.log('\n⚠️ Properties file kept intact');
      console.log('   To also reset properties, delete all-scraped-properties.json manually');

    } catch (error) {
      console.log(`❌ Failed to reset progress: ${error.message}`);
    }
  }

  async setPage(pageNumber) {
    try {
      if (pageNumber < 1 || pageNumber > 30) {
        console.log('❌ Page number must be between 1 and 30');
        return;
      }

      console.log(`🔄 Setting current page to ${pageNumber}...`);
      
      // Load existing progress or create new
      let progress;
      try {
        const progressData = await fs.readFile(this.progressFile, 'utf8');
        progress = JSON.parse(progressData);
      } catch (error) {
        progress = {
          currentPage: 1,
          completedPages: [],
          totalPropertiesScraped: 0,
          lastSuccessfulProperty: null,
          startTime: new Date().toISOString(),
          errors: []
        };
      }

      progress.currentPage = pageNumber;
      
      // Update completed pages (mark all pages before current as completed)
      progress.completedPages = [];
      for (let i = 1; i < pageNumber; i++) {
        progress.completedPages.push(i);
      }

      await fs.writeFile(this.progressFile, JSON.stringify(progress, null, 2));
      console.log(`✅ Progress updated - will resume from page ${pageNumber}`);

    } catch (error) {
      console.log(`❌ Failed to set page: ${error.message}`);
    }
  }

  async showHelp() {
    console.log('📋 Progress Manager Commands:');
    console.log('============================');
    console.log('node scripts/manageProgress.js view     - View current progress');
    console.log('node scripts/manageProgress.js reset    - Reset progress to start');
    console.log('node scripts/manageProgress.js page 15  - Resume from specific page');
    console.log('node scripts/manageProgress.js help     - Show this help');
    console.log('');
    console.log('📄 Files:');
    console.log('   scraping-progress.json     - Progress tracking');
    console.log('   all-scraped-properties.json - Scraped properties');
    console.log('');
    console.log('🚀 To start/resume scraping:');
    console.log('   node scripts/enhancedScraperWithPagination.js');
  }
}

// Handle command line arguments
async function main() {
  const manager = new ProgressManager();
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'view':
      await manager.viewProgress();
      break;
    case 'reset':
      await manager.resetProgress();
      break;
    case 'page':
      if (arg) {
        await manager.setPage(parseInt(arg));
      } else {
        console.log('❌ Please specify page number: node scripts/manageProgress.js page 15');
      }
      break;
    case 'help':
      await manager.showHelp();
      break;
    default:
      await manager.showHelp();
      break;
  }
}

main();
