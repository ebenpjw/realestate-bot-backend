const puppeteer = require('puppeteer');

async function testFloorPlanFix() {
  console.log('🧪 Testing Floor Plan Extraction Fix');
  console.log('====================================');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Go to EcoProp listings
    console.log('\n🔍 Loading EcoProp listings...');
    await page.goto('https://www.ecoprop.com/new-launch', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find first property and get its URL
    console.log('\n🏠 Finding first property...');
    const propertyInfo = await page.evaluate(() => {
      const projectCards = document.querySelectorAll('.project_detail');
      console.log(`Found ${projectCards.length} project cards`);
      
      if (projectCards.length > 0) {
        const firstCard = projectCards[0];
        const nameEl = firstCard.querySelector('h2.mmm.one-line');
        const link = firstCard.querySelector('a') || firstCard.closest('a');
        
        if (nameEl && link) {
          return {
            name: nameEl.textContent.trim(),
            url: link.href,
            found: true
          };
        }
      }
      return { found: false };
    });

    if (!propertyInfo.found) {
      console.log('❌ No property found');
      return;
    }

    console.log(`\n🎯 Testing with: ${propertyInfo.name}`);
    console.log(`🔗 URL: ${propertyInfo.url}`);

    // Open property page in new tab
    const propertyPage = await browser.newPage();
    await propertyPage.goto(propertyInfo.url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test the improved floor plan extraction
    console.log('\n📐 Testing floor plan extraction...');
    const floorPlans = await extractFloorPlansImproved(propertyPage);
    
    console.log('\n📊 RESULTS:');
    console.log('===========');
    console.log(`Total floor plans found: ${floorPlans.length}`);
    
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

async function extractFloorPlansImproved(page) {
  try {
    console.log(`     🎯 Using targeted EcoProp floor plan extraction...`);
    
    // Debug page structure first
    const pageStructure = await page.evaluate(() => {
      return {
        hasFloorPlansId: !!document.querySelector('#FloorPlans'),
        hasFloorPlanClass: !!document.querySelector('.floor_plan'),
        tabPanes: document.querySelectorAll('[role="tabpanel"]').length,
        allTabs: document.querySelectorAll('[role="tab"]').length,
        pane0: !!document.querySelector('#pane-0'),
        floorPlanElements: document.querySelectorAll('[id*="floor"], [class*="floor"]').length
      };
    });
    
    console.log('     📋 Page structure:', pageStructure);
    
    if (!pageStructure.hasFloorPlansId && !pageStructure.hasFloorPlanClass) {
      console.log('     ⚠️ No floor plan section found');
      return [];
    }
    
    // Extract floor plan data from the "All" tab
    const floorPlanData = await page.evaluate(() => {
      const floorPlanItems = [];
      
      // Target the All tab (pane-0)
      const allTabPane = document.querySelector('#pane-0');
      if (!allTabPane) {
        console.log('All tab pane (#pane-0) not found');
        return [];
      }
      
      console.log('Found All tab pane');
      
      // Get floor plan items from both desktop (.left) and mobile (.box-m) views
      const leftItems = allTabPane.querySelectorAll('.left .item');
      const mobileItems = allTabPane.querySelectorAll('.box-m .item');
      
      console.log(`Desktop items: ${leftItems.length}, Mobile items: ${mobileItems.length}`);
      
      // Use whichever has more items
      const items = leftItems.length > 0 ? leftItems : mobileItems;
      console.log(`Using ${items.length} items from ${leftItems.length > 0 ? 'desktop' : 'mobile'} view`);
      
      items.forEach((item, index) => {
        try {
          // Extract name and type using the specific selectors
          const nameEl = item.querySelector('.mmm.name');
          const typeEl = item.querySelector('.mrm.type');
          
          if (nameEl && typeEl) {
            const name = nameEl.textContent.trim();
            const type = typeEl.textContent.trim();
            
            // Parse bedroom info
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
          } else {
            console.log(`Item ${index}: missing name or type elements`);
          }
        } catch (error) {
          console.log(`Error processing item ${index}: ${error.message}`);
        }
      });
      
      return floorPlanItems;
    });
    
    console.log(`     📋 Found ${floorPlanData.length} floor plan items`);
    
    if (floorPlanData.length === 0) {
      return [];
    }
    
    // Now get images by clicking on each item (limit to first 3 for testing)
    const floorPlansWithImages = [];
    const testLimit = Math.min(floorPlanData.length, 3);
    
    for (let i = 0; i < testLimit; i++) {
      const floorPlan = floorPlanData[i];
      console.log(`     🖼️ Getting image for: ${floorPlan.name}`);
      
      try {
        // Click on the floor plan item and get the image
        const imageUrl = await page.evaluate((index) => {
          const allTabPane = document.querySelector('#pane-0');
          if (!allTabPane) return null;
          
          const leftItems = allTabPane.querySelectorAll('.left .item');
          const mobileItems = allTabPane.querySelectorAll('.box-m .item');
          const items = leftItems.length > 0 ? leftItems : mobileItems;
          
          if (items[index]) {
            // Click the item
            items[index].click();
            
            // Wait for image to update
            return new Promise(resolve => {
              setTimeout(() => {
                // Get image from right panel
                const rightPanel = allTabPane.querySelector('.right .el-image img');
                if (rightPanel && rightPanel.src) {
                  resolve(rightPanel.src);
                } else {
                  resolve(null);
                }
              }, 1000);
            });
          }
          return null;
        }, i);
        
        if (imageUrl) {
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
        await new Promise(resolve => setTimeout(resolve, 1500));
        
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

// Run the test
testFloorPlanFix().catch(console.error);
