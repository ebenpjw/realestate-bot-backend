const puppeteer = require('puppeteer');

async function testFloorPlanExtraction() {
  console.log('🧪 Testing Floor Plan Extraction for 35 Gilstead...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();
    
    // Navigate directly to 35 Gilstead
    console.log('🌐 Navigating to 35 Gilstead...');
    await page.goto('https://www.ecoprop.com/projectdetail/35-Gilstead', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check what floor plan elements are available
    const floorPlanInfo = await page.evaluate(() => {
      const results = {};
      
      // Check for floor plan types in left panel
      const floorPlanItems = document.querySelectorAll('[data-v-5a8fab23].item');
      results.floorPlanTypes = Array.from(floorPlanItems).map(item => ({
        name: item.querySelector('.name')?.textContent?.trim(),
        type: item.querySelector('.type')?.textContent?.trim(),
        html: item.outerHTML.substring(0, 200)
      }));

      // Check for all images on the page
      const allImages = document.querySelectorAll('img[src*="img.singmap.com"]');
      results.allImages = Array.from(allImages).map(img => ({
        src: img.src.substring(0, 100) + '...',
        width: img.naturalWidth,
        height: img.naturalHeight,
        classes: img.className,
        isFloorPlan: img.src.includes('floorPlanImg'),
        isIVT: img.src.includes('ivt/'),
        parent: img.parentElement?.tagName + '.' + img.parentElement?.className
      }));

      // Check for preview images specifically
      const previewImages = document.querySelectorAll('.el-image__inner');
      results.previewImages = Array.from(previewImages).map(img => ({
        src: img.src?.substring(0, 100) + '...',
        width: img.naturalWidth,
        height: img.naturalHeight
      }));

      return results;
    });

    console.log('📊 Floor Plan Info:');
    console.log('Floor Plan Types:', floorPlanInfo.floorPlanTypes.slice(0, 3));
    console.log('Total Images:', floorPlanInfo.allImages.length);
    console.log('Preview Images:', floorPlanInfo.previewImages.length);
    
    // Show breakdown of image types
    const floorPlanImages = floorPlanInfo.allImages.filter(img => img.isFloorPlan);
    const ivtImages = floorPlanInfo.allImages.filter(img => img.isIVT);
    
    console.log('Floor Plan Images:', floorPlanImages.length);
    console.log('IVT Preview Images:', ivtImages.length);

    if (floorPlanImages.length > 0) {
      console.log('Sample Floor Plan Images:');
      floorPlanImages.slice(0, 3).forEach((img, i) => {
        console.log(`  ${i+1}. ${img.src} (${img.width}x${img.height})`);
      });
    }

    if (ivtImages.length > 0) {
      console.log('Sample IVT Preview Images:');
      ivtImages.slice(0, 3).forEach((img, i) => {
        console.log(`  ${i+1}. ${img.src} (${img.width}x${img.height})`);
      });
    }

    // Test clicking on first floor plan type
    if (floorPlanInfo.floorPlanTypes.length > 0) {
      const firstFloorPlan = floorPlanInfo.floorPlanTypes[0];
      console.log(`\n🖱️ Testing click on: ${firstFloorPlan.name} (${firstFloorPlan.type})`);

      // Click on the first floor plan type
      await page.evaluate(() => {
        const items = document.querySelectorAll('[data-v-5a8fab23].item');
        if (items[0]) {
          items[0].click();
        }
      });

      // Wait for image to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check what images are available after clicking
      const afterClickImages = await page.evaluate(() => {
        const allImages = document.querySelectorAll('img[src*="img.singmap.com"]');
        return Array.from(allImages).map(img => ({
          src: img.src.substring(0, 100) + '...',
          width: img.naturalWidth,
          height: img.naturalHeight,
          isFloorPlan: img.src.includes('floorPlanImg'),
          isIVT: img.src.includes('ivt/'),
          isVisible: img.offsetWidth > 0 && img.offsetHeight > 0,
          classes: img.className
        }));
      });

      console.log('Images after clicking floor plan type:');
      afterClickImages.filter(img => img.isFloorPlan).forEach((img, i) => {
        console.log(`  Floor Plan ${i+1}: ${img.src} (${img.width}x${img.height}) visible:${img.isVisible}`);
      });

      // Try to click on a floor plan image to enlarge it
      console.log('\n🔍 Attempting to click floor plan image to enlarge...');
      
      const clickResult = await page.evaluate(() => {
        const floorPlanImages = document.querySelectorAll('img[src*="floorPlanImg"]');
        
        for (const img of floorPlanImages) {
          if (img.offsetWidth > 100 && img.offsetHeight > 100) {
            console.log(`Clicking on: ${img.src.substring(0, 100)}...`);
            img.click();
            return { success: true, imageUrl: img.src };
          }
        }
        
        return { success: false, reason: 'No clickable floor plan image found' };
      });

      console.log('Click result:', clickResult);

      if (clickResult.success) {
        // Wait for enlarged image
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check for enlarged image
        const enlargedImage = await page.evaluate(() => {
          const enlargedImg = document.querySelector('.el-image-viewer__img');
          if (enlargedImg) {
            return {
              src: enlargedImg.src.substring(0, 100) + '...',
              width: enlargedImg.naturalWidth,
              height: enlargedImg.naturalHeight,
              fullSrc: enlargedImg.src
            };
          }
          return null;
        });

        if (enlargedImage) {
          console.log('✅ Enlarged image found:');
          console.log(`  URL: ${enlargedImage.fullSrc}`);
          console.log(`  Size: ${enlargedImage.width}x${enlargedImage.height}`);
        } else {
          console.log('❌ No enlarged image found');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error during floor plan test:', error);
  } finally {
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will stay open for manual inspection...');
    console.log('Press Ctrl+C to close when done.');
    
    // Wait indefinitely
    await new Promise(() => {});
  }
}

testFloorPlanExtraction().catch(console.error);
