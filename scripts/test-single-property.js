const LocalPropertyScraper = require('./localScraperWithWebhook');

async function testSingleProperty() {
  console.log('🧪 Testing 8@BT page with new unit mix extraction...');

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
    const testProperties = [
      { name: '8@BT', url: 'https://www.ecoprop.com/projectdetail/8@BT' }
    ];

    for (const property of testProperties) {
      console.log(`\n🔍 Testing: ${property.name}`);
      console.log(`🔗 URL: ${property.url}`);

      await testProperty(page, property.name, property.url);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (browser) await browser.close();
  }
}

async function testProperty(page, projectName, testUrl) {
  try {

    console.log(`🔍 Testing: ${projectName}`);
    console.log(`🔗 URL: ${testUrl}`);

      // Navigate to the property page
      console.log(`🌐 Navigating to property page...`);
      await page.goto(testUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page content to fully load
      console.log(`⏳ Waiting for page content to load...`);
      await page.waitForTimeout(3000);

    // Get page info for debugging
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        hasContent: document.body.textContent.length > 0,
        tableCount: document.querySelectorAll('table').length,
        bodyText: document.body.textContent.substring(0, 1000) // First 1000 chars for debugging
      };
    });

    console.log(`🔍 Page info: ${pageInfo.title} (${pageInfo.tableCount} tables, ${pageInfo.hasContent ? 'has content' : 'no content'})`);
    console.log(`📝 Page preview: ${pageInfo.bodyText.substring(0, 500)}...`);

    // Check if we're on the right page
    const currentUrl = await page.url();
    console.log(`🌐 Current URL: ${currentUrl}`);

    // Wait longer and try to find any property-specific content
    console.log(`⏳ Waiting longer for dynamic content...`);
    await page.waitForTimeout(10000); // Wait 10 seconds

    // Look for any property-related content
    const propertyContent = await page.evaluate(() => {
      const body = document.body.textContent;
      const hasPropertyName = body.includes('8@BT') || body.includes('8BT');
      const hasPrice = body.includes('$') || body.includes('price') || body.includes('Price');
      const hasUnit = body.includes('unit') || body.includes('bedroom') || body.includes('sqft');

      return {
        hasPropertyName,
        hasPrice,
        hasUnit,
        allText: body.substring(0, 2000) // More text for debugging
      };
    });

    console.log(`🏠 Property content check:`, {
      hasPropertyName: propertyContent.hasPropertyName,
      hasPrice: propertyContent.hasPrice,
      hasUnit: propertyContent.hasUnit
    });

    if (!propertyContent.hasPropertyName) {
      console.log(`⚠️ Property name not found on page. Full text:`, propertyContent.allText);
    }

    // Look for unit mix content
    const unitMixInfo = await page.evaluate(() => {
      const selectors = [
        '.unit_mix_table',
        '.unit-mix-table',
        '.unitmix_table',
        '.price_table',
        '.unit_table',
        'table[class*="unit"]',
        'table[class*="mix"]',
        'table[class*="price"]',
        '.pricing',
        '.unit_info',
        'table' // Any table
      ];

      const found = [];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          found.push({
            selector,
            count: elements.length,
            text: elements[0].textContent.substring(0, 200)
          });
        }
      }

      return found;
    });

      console.log(`🔍 Unit mix elements found:`, unitMixInfo);

      // Check if this property has available units
      if (propertyContent.hasUnit || unitMixInfo.length > 0) {
        console.log(`✅ ${projectName} appears to have unit data!`);
        return; // Found a good property, stop testing
      } else if (propertyContent.allText.includes('Fully Sold') || propertyContent.allText.includes('sold out')) {
        console.log(`❌ ${projectName} is sold out`);
      } else {
        console.log(`⚠️ ${projectName} - unclear status`);
      }

  } catch (error) {
    console.error(`❌ Error testing ${projectName}:`, error.message);
  }
}

testSingleProperty();
