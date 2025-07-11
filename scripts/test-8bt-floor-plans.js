const LocalPropertyScraper = require('./localScraperWithWebhook');

async function test8BTFloorPlans() {
  console.log('🧪 Testing 8@BT Floor Plan Extraction');
  console.log('====================================');

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

    console.log('\n📐 Testing floor plan extraction...');
    
    // Test unit mix extraction first
    console.log('\n📊 Testing unit mix extraction...');
    const unitMixData = await scraper.extractUnitMixData(page);
    console.log(`Unit mix results: ${unitMixData.length} unit types found`);
    
    unitMixData.forEach((unit, index) => {
      console.log(`  ${index + 1}. ${unit.unitType}: ${unit.availableUnits}/${unit.totalUnits} available`);
    });

    // Test floor plan extraction
    console.log('\n📐 Testing floor plan extraction...');
    const floorPlans = await scraper.extractFloorPlansComprehensive(page);
    
    console.log('\n📊 FLOOR PLAN RESULTS:');
    console.log('======================');
    console.log(`Total floor plans found: ${floorPlans.length}`);
    
    if (floorPlans.length > 0) {
      floorPlans.forEach((plan, index) => {
        console.log(`\n${index + 1}. ${plan.name}`);
        console.log(`   Type: ${plan.bedroomType}`);
        console.log(`   Count: ${plan.bedroomCount} bedrooms`);
        console.log(`   Category: ${plan.bedroomCategory}`);
        console.log(`   Has Image: ${plan.hasImage}`);
        if (plan.imageUrl) {
          console.log(`   Image: ${plan.imageUrl.substring(0, 80)}...`);
        }
      });
      
      console.log('\n✅ Floor plan extraction successful!');
    } else {
      console.log('\n⚠️ No floor plans found');
      
      // Debug: Check page structure
      const pageStructure = await page.evaluate(() => {
        return {
          hasFloorPlansId: !!document.querySelector('#FloorPlans'),
          hasFloorPlanClass: !!document.querySelector('.floor_plan'),
          tabPanes: document.querySelectorAll('[role="tabpanel"]').length,
          allTabs: document.querySelectorAll('[role="tab"]').length,
          pane0: !!document.querySelector('#pane-0'),
          floorPlanElements: document.querySelectorAll('[id*="floor"], [class*="floor"]').length,
          allImages: document.querySelectorAll('img').length,
          floorPlanImages: document.querySelectorAll('img[src*="floorPlanImg"]').length
        };
      });
      
      console.log('\n🔍 Page structure debug:', pageStructure);
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
test8BTFloorPlans().catch(console.error);
