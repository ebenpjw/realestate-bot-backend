const LocalScraper = require('./localScraperWithWebhook');

async function testSinglePage() {
  const scraper = new LocalScraper();
  
  try {
    console.log('🧪 Testing single page scraping with fixes...');
    
    // Test database connection first
    const dbConnected = await scraper.checkDatabaseConnection();
    if (!dbConnected) {
      console.error('❌ Database connection failed');
      return;
    }
    
    console.log('✅ Database connection verified');
    
    // Override maxPages to only scrape 1 page for testing
    scraper.maxPages = 1;
    
    // Force start from page 1
    const progress = {
      currentPage: 1,
      completedPages: [],
      totalPropertiesScraped: 0,
      lastSuccessfulProperty: null,
      startTime: new Date().toISOString(),
      errors: [],
      totalPages: 1,
      newPropertiesAdded: 0,
      propertiesUpdated: 0,
      duplicatesSkipped: 0
    };
    
    await scraper.saveProgress(progress);
    
    console.log('✅ Progress reset to page 1, starting scraper...');
    
    // Run scraper
    await scraper.scrapeEcoProp();
    
    console.log('✅ Single page test completed');
    
  } catch (error) {
    console.error('❌ Single page test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

if (require.main === module) {
  testSinglePage()
    .then(() => {
      console.log('\n✅ Single page test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Single page test failed:', error);
      process.exit(1);
    });
}

module.exports = testSinglePage;
