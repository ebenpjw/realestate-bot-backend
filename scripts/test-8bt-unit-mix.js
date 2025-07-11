const LocalPropertyScraper = require('./localScraperWithWebhook');

async function test8BTUnitMix() {
  console.log('🧪 Testing 8@BT Unit Mix Extraction');
  console.log('===================================');

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

    // Test the specific 8@BT page
    const testUrl = 'https://www.ecoprop.com/projectdetail/8@BT';
    console.log(`\n🔗 Testing URL: ${testUrl}`);

    await page.goto(testUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Debug: Check what unit mix elements exist on the page
    console.log('\n🔍 Debugging unit mix structure...');
    const pageStructure = await page.evaluate(() => {
      return {
        hasAvailableUnitMixId: !!document.querySelector('#AvailableUnitMix'),
        hasUnitMixClass: !!document.querySelector('.unitMix'),
        availableUnitMixHTML: document.querySelector('#AvailableUnitMix')?.innerHTML?.substring(0, 500) || 'Not found',
        h5Elements: Array.from(document.querySelectorAll('h5')).map(h => h.textContent.trim()),
        tableBodyCount: document.querySelectorAll('.table_body').length,
        contentDivs: document.querySelectorAll('.content').length
      };
    });
    
    console.log('Page structure:', pageStructure);

    // Test unit mix extraction
    console.log('\n📊 Testing unit mix extraction...');
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
      
      // Test if this would trigger floor plan extraction
      const hasAvailableUnits = scraper.hasAvailableUnits(unitMixData);
      console.log(`\n🔍 Would trigger floor plan extraction: ${hasAvailableUnits}`);
      
    } else {
      console.log('\n⚠️ No unit mix data found');
      
      // Additional debugging
      const debugInfo = await page.evaluate(() => {
        const container = document.querySelector('#AvailableUnitMix');
        if (container) {
          return {
            containerFound: true,
            containerHTML: container.innerHTML.substring(0, 1000),
            contentDiv: !!container.querySelector('.content'),
            tableBodyDivs: container.querySelectorAll('.table_body').length
          };
        }
        return { containerFound: false };
      });
      
      console.log('\n🔍 Debug info:', debugInfo);
    }

    // Keep browser open for manual inspection
    console.log('\n✅ Test complete. Browser will stay open for inspection.');
    console.log('Press Ctrl+C to close when done.');
    
    // Wait indefinitely
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
test8BTUnitMix().catch(console.error);
