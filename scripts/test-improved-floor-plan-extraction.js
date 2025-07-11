const puppeteer = require('puppeteer');

async function testImprovedFloorPlanExtraction() {
  console.log('🧪 Testing Improved Floor Plan Extraction');
  console.log('==========================================');

  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // First, let's find a property with floor plans from the main page
    console.log('\n🔍 Finding a property with floor plans...');
    await page.goto('https://www.ecoprop.com/new-launch', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get a property URL from the listings
    const propertyUrl = await page.evaluate(() => {
      const projectCards = document.querySelectorAll('.project_detail a, .project_card a, [href*="/property/"]');
      for (const card of projectCards) {
        if (card.href && card.href.includes('/property/')) {
          return card.href;
        }
      }
      return null;
    });

    if (!propertyUrl) {
      console.log('❌ No property URLs found on the main page');
      return;
    }

    console.log(`\n🔗 Testing URL: ${propertyUrl}`);

    await page.goto(propertyUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for page to load and check what's available
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Debug: Check page content
    console.log('\n🔍 Debugging page content...');
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        hasFloorPlansSection: !!document.querySelector('#FloorPlans'),
        hasFloorPlanClass: !!document.querySelector('.floor_plan'),
        allElementsWithFloor: document.querySelectorAll('[id*="floor"], [class*="floor"]').length,
        allElementsWithPlan: document.querySelectorAll('[id*="plan"], [class*="plan"]').length
      };
    });

    console.log('Page info:', pageInfo);

    console.log('\n📐 Starting floor plan extraction...');

    // Extract floor plan data using the new method
    const floorPlanData = await extractFloorPlansImproved(page);
    
    console.log('\n📊 EXTRACTION RESULTS:');
    console.log('======================');
    console.log(`Total floor plans found: ${floorPlanData.length}`);
    
    floorPlanData.forEach((plan, index) => {
      console.log(`\n${index + 1}. ${plan.name}`);
      console.log(`   Type: ${plan.bedroomType}`);
      console.log(`   Count: ${plan.bedroomCount} bedrooms`);
      console.log(`   Category: ${plan.bedroomCategory}`);
      console.log(`   Has Image: ${plan.hasImage}`);
      if (plan.imageUrl) {
        console.log(`   Image URL: ${plan.imageUrl.substring(0, 80)}...`);
      }
    });

    // Test clicking functionality
    console.log('\n🖱️ Testing click functionality...');
    await testClickFunctionality(page);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

async function extractFloorPlansImproved(page) {
  try {
    console.log(`     🎯 Using targeted EcoProp floor plan extraction...`);
    
    // First, extract floor plan names and types from the "All" tab
    const floorPlanData = await page.evaluate(() => {
      const floorPlanItems = [];

      // Debug: Check what floor plan elements exist
      console.log('=== DEBUGGING FLOOR PLAN STRUCTURE ===');
      const floorPlanSection = document.querySelector('#FloorPlans');
      console.log('FloorPlans section found:', !!floorPlanSection);

      if (floorPlanSection) {
        const allTabs = floorPlanSection.querySelectorAll('[role="tab"]');
        console.log('Tabs found:', allTabs.length);
        allTabs.forEach((tab, i) => {
          console.log(`Tab ${i}: ${tab.textContent.trim()}`);
        });

        const allPanes = floorPlanSection.querySelectorAll('[role="tabpanel"]');
        console.log('Tab panes found:', allPanes.length);
      }

      // Target the specific structure: .floor_plan .content .el-tab-pane (All tab)
      const allTabPane = document.querySelector('#pane-0'); // All tab is pane-0
      if (!allTabPane) {
        console.log('All tab pane not found - trying alternative selectors');

        // Try alternative selectors
        const alternatives = [
          '.el-tab-pane:first-child',
          '[aria-labelledby="tab-0"]',
          '.floor_plan .el-tab-pane'
        ];

        for (const selector of alternatives) {
          const alt = document.querySelector(selector);
          if (alt) {
            console.log(`Found alternative: ${selector}`);
            break;
          }
        }
        return [];
      }
      
      // Get floor plan items from the left side (desktop) or mobile view
      const leftItems = allTabPane.querySelectorAll('.left .item');
      const mobileItems = allTabPane.querySelectorAll('.box-m .item');
      
      // Use whichever has more items (desktop vs mobile view)
      const items = leftItems.length > 0 ? leftItems : mobileItems;
      console.log(`Found ${items.length} floor plan items in All tab`);
      
      items.forEach((item, index) => {
        try {
          // Extract name from .mmm.name
          const nameEl = item.querySelector('.mmm.name');
          const typeEl = item.querySelector('.mrm.type');
          
          if (nameEl && typeEl) {
            const name = nameEl.textContent.trim();
            const type = typeEl.textContent.trim();
            
            // Extract bedroom count from type
            let bedroomCount = '0';
            let bedroomCategory = 'Unknown';
            
            if (type.includes('1 Bedroom')) {
              bedroomCount = '1';
              bedroomCategory = '1Bed';
            } else if (type.includes('2 Bedroom')) {
              bedroomCount = '2';
              bedroomCategory = '2Bed';
            } else if (type.includes('3 Bedroom')) {
              bedroomCount = '3';
              bedroomCategory = '3Bed';
            } else if (type.includes('4 Bedroom')) {
              bedroomCount = '4';
              bedroomCategory = '4Bed';
            } else if (type.includes('Penthouse')) {
              bedroomCount = '4+';
              bedroomCategory = 'Penthouse';
            }
            
            floorPlanItems.push({
              name: name,
              bedroomType: type,
              bedroomCount: bedroomCount,
              bedroomCategory: bedroomCategory,
              index: index
            });
            
            console.log(`Extracted: ${name} - ${type}`);
          }
        } catch (error) {
          console.log(`Error processing floor plan item ${index}: ${error.message}`);
        }
      });
      
      return floorPlanItems;
    });
    
    console.log(`     📋 Found ${floorPlanData.length} floor plan items`);
    
    // Now get the actual image URLs by clicking on each item
    const floorPlansWithImages = [];
    
    for (let i = 0; i < Math.min(floorPlanData.length, 5); i++) { // Limit to 5 for testing
      const floorPlan = floorPlanData[i];
      console.log(`     🖼️ Getting image for: ${floorPlan.name}`);
      
      try {
        // Click on the floor plan item to load its image
        const imageUrl = await page.evaluate((index) => {
          const allTabPane = document.querySelector('#pane-0');
          if (!allTabPane) return null;
          
          // Try both desktop and mobile selectors
          const leftItems = allTabPane.querySelectorAll('.left .item');
          const mobileItems = allTabPane.querySelectorAll('.box-m .item');
          const items = leftItems.length > 0 ? leftItems : mobileItems;
          
          if (items[index]) {
            // Click the item
            items[index].click();
            
            // Wait a moment for the image to update
            return new Promise(resolve => {
              setTimeout(() => {
                // Get the updated image from the right panel
                const rightPanel = allTabPane.querySelector('.right .el-image img');
                if (rightPanel && rightPanel.src) {
                  resolve(rightPanel.src);
                } else {
                  // Fallback: try to get from preview-src-list attribute
                  const previewSrc = items[index].getAttribute('preview-src-list');
                  resolve(previewSrc || null);
                }
              }, 500);
            });
          }
          return null;
        }, i);
        
        if (imageUrl && imageUrl !== 'null') {
          floorPlansWithImages.push({
            name: floorPlan.name,
            bedroomType: floorPlan.bedroomType,
            bedroomCount: floorPlan.bedroomCount,
            bedroomCategory: floorPlan.bedroomCategory,
            imageUrl: imageUrl,
            filename: `${floorPlan.name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`,
            hasImage: true
          });
          console.log(`       ✅ Got image for ${floorPlan.name}`);
        } else {
          console.log(`       ⚠️ No image found for ${floorPlan.name}`);
        }
        
        // Small delay between clicks
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`       ❌ Failed to get image for ${floorPlan.name}: ${error.message}`);
      }
    }
    
    return floorPlansWithImages;
    
  } catch (error) {
    console.log(`     ❌ Floor plan extraction failed: ${error.message}`);
    return [];
  }
}

async function testClickFunctionality(page) {
  try {
    const clickResults = await page.evaluate(() => {
      const results = [];
      const allTabPane = document.querySelector('#pane-0');
      
      if (allTabPane) {
        const items = allTabPane.querySelectorAll('.left .item, .box-m .item');
        
        for (let i = 0; i < Math.min(items.length, 3); i++) {
          const item = items[i];
          const nameEl = item.querySelector('.mmm.name');
          const name = nameEl ? nameEl.textContent.trim() : `Item ${i}`;
          
          // Click the item
          item.click();
          
          // Check if image changes
          setTimeout(() => {
            const rightPanel = allTabPane.querySelector('.right .el-image img');
            const imageUrl = rightPanel ? rightPanel.src : null;
            
            results.push({
              name: name,
              clicked: true,
              imageUrl: imageUrl ? imageUrl.substring(0, 100) + '...' : 'No image'
            });
          }, 200);
        }
      }
      
      return results;
    });
    
    console.log('Click test results:', clickResults);
    
  } catch (error) {
    console.log('Click test failed:', error.message);
  }
}

// Run the test
testImprovedFloorPlanExtraction().catch(console.error);
