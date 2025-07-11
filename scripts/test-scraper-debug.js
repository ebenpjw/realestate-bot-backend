const LocalScraper = require('./localScraperWithWebhook');

async function testScraperDebug() {
  const scraper = new LocalScraper();
  
  try {
    console.log('🧪 Testing scraper with enhanced debugging...');
    
    // Test database connection first
    const dbConnected = await scraper.checkDatabaseConnection();
    if (!dbConnected) {
      console.error('❌ Database connection failed');
      return;
    }
    
    console.log('✅ Database connection verified, starting limited scraping test...');
    
    // Override maxPages to only scrape 1 page for testing
    scraper.maxPages = 1;
    
    // Run scraper
    await scraper.scrapeEcoProp();
    
    console.log('✅ Scraper test completed');
    
  } catch (error) {
    console.error('❌ Scraper test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

if (require.main === module) {
  testScraperDebug()
    .then(() => {
      console.log('\n✅ Debug test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Debug test failed:', error);
      process.exit(1);
    });
}

module.exports = testScraperDebug;
