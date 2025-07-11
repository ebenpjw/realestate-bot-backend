const LocalPropertyScraper = require('./localScraperWithWebhook');
const puppeteer = require('puppeteer');

async function test8BT() {
  console.log('🧪 Testing 8@BT page with new unit mix extraction...');

  let browser;
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Navigate to 8@BT page
    const testUrl = 'https://www.ecoprop.com/projectdetail/8@BT';
    console.log(`🔗 Testing URL: ${testUrl}`);
    
    console.log(`🌐 Navigating to 8@BT page...`);
    await page.goto(testUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for Vue.js content to load
    console.log(`⏳ Waiting for Vue.js content to load...`);
    await page.waitForTimeout(5000);
    
    // Check current URL
    const currentUrl = await page.url();
    console.log(`🌐 Current URL: ${currentUrl}`);
    
    // Try to wait for unit mix content
    try {
      await page.waitForSelector('h5[data-v-f4fb3862]', { timeout: 10000 });
      console.log(`✅ Found Vue.js unit mix heading!`);
    } catch (e) {
      console.log(`⚠️ No Vue.js unit mix heading found`);
    }
    
    // Debug: Check what h5 elements exist
    const h5Info = await page.evaluate(() => {
      const h5Elements = document.querySelectorAll('h5');
      return Array.from(h5Elements).map(h5 => ({
        text: h5.textContent.trim(),
        hasVueAttr: h5.hasAttribute('data-v-f4fb3862'),
        className: h5.className
      }));
    });
    
    console.log(`🔍 Found ${h5Info.length} h5 elements:`, h5Info);
    
    // Use the scraper's unit mix extraction method
    console.log(`🔍 Using manual unit mix extraction...`);

    // Extract unit mix data manually using the new structure
    const unitMixData = await page.evaluate(() => {
      const unitMixItems = [];

      // Look for the new EcoProp structure with "Available Unit Mix" heading
      const h5Elements = document.querySelectorAll('h5');
      let unitMixHeading = null;

      for (const h5 of h5Elements) {
        if (h5.textContent.includes('Available Unit Mix')) {
          unitMixHeading = h5;
          break;
        }
      }

      if (unitMixHeading) {
        console.log('Found "Available Unit Mix" heading - using new structure');

        // Find the content div that follows the heading
        const contentDiv = unitMixHeading.nextElementSibling;
        if (contentDiv && contentDiv.classList.contains('content')) {
          console.log('Found unit mix content div');

          // Extract data from table_body divs
          const tableBodyDivs = contentDiv.querySelectorAll('.table_body');
          console.log(`Found ${tableBodyDivs.length} unit mix rows`);

          for (const row of tableBodyDivs) {
            const cells = row.querySelectorAll('p span');
            if (cells.length >= 4) {
              const unitType = cells[0]?.textContent?.trim() || '';
              const size = cells[1]?.textContent?.trim() || '';
              const price = cells[2]?.textContent?.trim() || '';
              const availability = cells[3]?.textContent?.trim() || '';

              if (unitType && (size || price)) {
                // Parse availability (e.g., "3 / 32" means 3 available out of 32 total)
                let availableUnits = 0;
                let totalUnits = 0;

                if (availability) {
                  const availMatch = availability.match(/(\d+)\s*\/\s*(\d+)/);
                  if (availMatch) {
                    availableUnits = parseInt(availMatch[1]);
                    totalUnits = parseInt(availMatch[2]);
                  }
                }

                unitMixItems.push({
                  unitType: unitType,
                  size: size,
                  priceRange: price,
                  availableUnits: availableUnits,
                  totalUnits: totalUnits,
                  availability: availability
                });

                console.log(`Extracted: ${unitType} - ${size} - ${price} - ${availability}`);
              }
            }
          }
        }
      }

      return unitMixItems;
    });
    
    // Also extract comprehensive property information
    console.log(`\n🏢 EXTRACTING COMPREHENSIVE PROPERTY INFORMATION...`);

    const propertyInfo = await page.evaluate(() => {
      const info = {
        priceRange: '',
        sizeRange: '',
        totalUnits: '',
        developer: '',
        blocksLevels: '',
        expectedTOP: '',
        tenure: '',
        propertyType: '',
        district: '',
        address: '',
        hasComprehensiveInfo: false
      };

      // Find the info_wrap div
      const infoWrap = document.querySelector('#info_wrap, .info_wrap');
      if (!infoWrap) {
        console.log('No info_wrap found');
        return info;
      }

      console.log('Found info_wrap section');

      // Extract price range from price_box
      const priceElement = infoWrap.querySelector('.price_box .price_left .price');
      if (priceElement) {
        info.priceRange = priceElement.textContent.trim();
      }

      // Extract size range from price_box
      const sizeElement = infoWrap.querySelector('.price_box .price_right .price');
      if (sizeElement) {
        info.sizeRange = sizeElement.textContent.trim();
      }

      // Extract property details from property_box
      const propertyBox = infoWrap.querySelector('.property_box');
      if (propertyBox) {
        const propertyItems = propertyBox.querySelectorAll('p');

        for (const item of propertyItems) {
          const keyElement = item.querySelector('.property_key');
          const valueElement = item.querySelector('.property_value') || item.querySelector('span:last-child');

          if (keyElement && valueElement) {
            const key = keyElement.textContent.trim().toLowerCase();
            const value = valueElement.textContent.trim();

            if (key.includes('units')) {
              info.totalUnits = value;
            } else if (key.includes('developers')) {
              info.developer = value;
            } else if (key.includes('blocks') && key.includes('levels')) {
              info.blocksLevels = value;
            } else if (key.includes('exp top') || key.includes('top')) {
              info.expectedTOP = value;
            } else if (key.includes('tenure')) {
              info.tenure = value;
            } else if (key.includes('property type')) {
              info.propertyType = value;
            } else if (key.includes('district')) {
              info.district = value;
            } else if (key.includes('address')) {
              info.address = value;
            }
          }
        }
      }

      // Check if we got comprehensive info
      info.hasComprehensiveInfo = !!(info.priceRange || info.developer || info.address);

      return info;
    });

    console.log(`\n📊 EXTRACTED UNIT MIX DATA:`);
    console.log(`   📋 Found ${unitMixData.length} unit types`);

    console.log(`\n🏢 EXTRACTED PROPERTY INFORMATION:`);
    console.log(`   💰 Price Range: ${propertyInfo.priceRange || 'Not found'}`);
    console.log(`   📐 Size Range: ${propertyInfo.sizeRange || 'Not found'}`);
    console.log(`   🏠 Total Units: ${propertyInfo.totalUnits || 'Not found'}`);
    console.log(`   🏗️ Developer: ${propertyInfo.developer || 'Not found'}`);
    console.log(`   🏢 Blocks & Levels: ${propertyInfo.blocksLevels || 'Not found'}`);
    console.log(`   📅 Expected TOP: ${propertyInfo.expectedTOP || 'Not found'}`);
    console.log(`   📜 Tenure: ${propertyInfo.tenure || 'Not found'}`);
    console.log(`   🏘️ Property Type: ${propertyInfo.propertyType || 'Not found'}`);
    console.log(`   📍 District: ${propertyInfo.district || 'Not found'}`);
    console.log(`   🗺️ Address: ${propertyInfo.address || 'Not found'}`);

    if (unitMixData.length > 0) {
      console.log(`\n✅ UNIT MIX DETAILS:`);
      unitMixData.forEach((unit, index) => {
        console.log(`   ${index + 1}. ${unit.unitType}`);
        console.log(`      📐 Size: ${unit.size}`);
        console.log(`      💰 Price: ${unit.priceRange}`);
        console.log(`      🏠 Available: ${unit.availableUnits}/${unit.totalUnits} (${unit.availability})`);
        console.log('');
      });
    } else {
      console.log(`   ❌ No unit mix data extracted`);
    }
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (browser) await browser.close();
  }
}

test8BT();
