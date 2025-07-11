const LocalPropertyScraper = require('./localScraperWithWebhook');

async function debugUnitMixDetection() {
  console.log('🔍 Debugging Unit Mix Detection');
  console.log('===============================');

  const scraper = new LocalPropertyScraper();
  let browser;

  try {
    // Launch browser
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Test the specific 8@BT page that was having issues
    const testUrl = 'https://www.ecoprop.com/projectdetail/8@BT';
    console.log(`\n🔗 Testing URL: ${testUrl}`);

    await page.goto(testUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check page title
    const pageTitle = await page.title();
    console.log(`📄 Page title: ${pageTitle}`);

    // Test unit mix extraction with enhanced debugging
    console.log('\n📊 Testing unit mix extraction with debugging...');
    const unitMixData = await scraper.extractUnitMixData(page);
    
    console.log('\n📊 UNIT MIX RESULTS:');
    console.log('====================');
    console.log(`Total unit types found: ${unitMixData.length}`);
    
    if (unitMixData.length > 0) {
      unitMixData.forEach((unit, index) => {
        console.log(`\n${index + 1}. ${unit.unitType}`);
        console.log(`   Size: ${unit.size}`);
        console.log(`   Price: ${unit.priceRange}`);
        console.log(`   Available: ${unit.availableUnits}/${unit.totalUnits} (${unit.availability})`);
      });
      
      console.log('\n✅ Unit mix extraction successful!');
    } else {
      console.log('\n⚠️ No unit mix data found - check debug output above');
      
      // Additional manual debugging
      console.log('\n🔍 Manual page inspection...');
      const manualCheck = await page.evaluate(() => {
        return {
          hasAvailableUnitMixId: !!document.querySelector('#AvailableUnitMix'),
          hasUnitMixClass: !!document.querySelector('.unitMix'),
          allH5Elements: Array.from(document.querySelectorAll('h5')).map(h => h.textContent.trim()),
          allTablesCount: document.querySelectorAll('table').length,
          allDivsWithUnit: Array.from(document.querySelectorAll('div')).filter(div => 
            div.textContent.toLowerCase().includes('unit mix') || 
            div.textContent.toLowerCase().includes('available unit')
          ).length,
          bodyTextSample: document.body.textContent.substring(0, 2000)
        };
      });
      
      console.log('Manual check results:', manualCheck);
    }

    // Keep browser open for manual inspection
    console.log('\n✅ Debug complete. Browser will stay open for inspection.');
    console.log('Press Ctrl+C to close when done.');
    
    // Wait indefinitely
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error(error.stack);
  }
}

// Run the debug
debugUnitMixDetection().catch(console.error);
