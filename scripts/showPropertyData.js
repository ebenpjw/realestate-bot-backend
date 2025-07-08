/**
 * Show exactly what data is extracted from a single property
 */

const puppeteer = require('puppeteer');

class PropertyDataExtractor {
  constructor() {
    this.outputFile = 'data/complete-property-data.json';
  }

  async extractSingleProperty() {
    let browser;
    
    try {
      console.log('🔍 Extracting complete data from one property...\n');

      browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
      });

      const page = await browser.newPage();
      
      // Go directly to 10 Evelyn (we know this one works well)
      console.log('🌐 Navigating to 10 Evelyn...');
      await page.goto('https://www.ecoprop.com/projectdetail/10-Evelyn', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Extract all data types
      console.log('📊 Extracting all property data...\n');

      // 1. Basic Property Info
      console.log('1️⃣ Basic Property Information:');
      const basicInfo = await this.extractBasicInfo(page);
      this.displayBasicInfo(basicInfo);

      // 2. Detailed Property Info
      console.log('\n2️⃣ Detailed Property Information:');
      const detailedInfo = await this.extractDetailedInfo(page);
      this.displayDetailedInfo(detailedInfo);

      // 3. Floor Plans
      console.log('\n3️⃣ Floor Plans:');
      const floorPlans = await this.extractFloorPlans(page);
      this.displayFloorPlans(floorPlans);

      // 4. Unit Mix
      console.log('\n4️⃣ Unit Mix Data:');
      const unitMix = await this.extractUnitMix(page);
      this.displayUnitMix(unitMix);

      // 5. Complete Combined Data
      const completeProperty = {
        name: '10 Evelyn',
        developer: detailedInfo.developer || 'Unknown Developer',
        address: basicInfo.address || 'Singapore',
        district: basicInfo.district || 'Unknown',
        propertyType: 'Private Condo',
        priceRange: {
          raw: basicInfo.price || 'Price on request'
        },
        description: detailedInfo.description,
        units: detailedInfo.units,
        completion: detailedInfo.completion,
        tenure: detailedInfo.tenure,
        sourceUrl: 'https://www.ecoprop.com/projectdetail/10-Evelyn',
        visualAssets: [...detailedInfo.images, ...floorPlans],
        floorPlans: floorPlans,
        unitMix: unitMix,
        scrapedAt: new Date().toISOString(),
        extractedData: {
          hasDetailedInfo: true,
          imageCount: detailedInfo.images.length,
          floorPlanCount: floorPlans.length,
          unitMixCount: unitMix.length,
          hasDescription: !!detailedInfo.description
        }
      };

      // Save complete data
      const fs = require('fs').promises;
      await fs.writeFile(this.outputFile, JSON.stringify(completeProperty, null, 2));
      console.log(`\n💾 Complete property data saved to ${this.outputFile}`);

      // Summary
      console.log('\n📋 EXTRACTION SUMMARY:');
      console.log('=====================');
      console.log(`🏠 Property: ${completeProperty.name}`);
      console.log(`🏗️ Developer: ${completeProperty.developer}`);
      console.log(`📍 Address: ${completeProperty.address}`);
      console.log(`🖼️ Images: ${completeProperty.extractedData.imageCount}`);
      console.log(`📐 Floor Plans: ${completeProperty.extractedData.floorPlanCount}`);
      console.log(`📊 Unit Types: ${completeProperty.extractedData.unitMixCount}`);
      console.log(`📝 Has Description: ${completeProperty.extractedData.hasDescription}`);

      return completeProperty;

    } catch (error) {
      console.error('❌ Extraction failed:', error.message);
      return null;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async extractBasicInfo(page) {
    return await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        address: document.querySelector('.address, .location')?.textContent?.trim(),
        district: document.querySelector('.district')?.textContent?.trim(),
        price: document.querySelector('.price, .pricing')?.textContent?.trim()
      };
    });
  }

  async extractDetailedInfo(page) {
    return await page.evaluate(() => {
      const images = [];
      const imageElements = document.querySelectorAll('img[src*="upload"], img[src*="property"], .gallery img');
      
      imageElements.forEach((img, index) => {
        if (img.src && !img.src.includes('logo') && !img.src.includes('icon')) {
          images.push({
            type: 'property_image',
            url: img.src,
            alt: img.alt || `Property image ${index + 1}`,
            filename: `property_${index + 1}.jpg`
          });
        }
      });

      return {
        developer: document.querySelector('.developer, .dev-name')?.textContent?.trim(),
        description: document.querySelector('.description, .project-desc, .about')?.textContent?.trim(),
        units: document.querySelector('.units, .total-units')?.textContent?.trim(),
        completion: document.querySelector('.completion, .top, .expected')?.textContent?.trim(),
        tenure: document.querySelector('.tenure, .lease')?.textContent?.trim(),
        images: images.slice(0, 5) // Limit to first 5 images
      };
    });
  }

  async extractFloorPlans(page) {
    // Use the same logic from the main scraper
    try {
      const floorPlans = await page.evaluate(() => {
        const plans = [];
        const floorPlanImages = document.querySelectorAll('img[src*="floorPlanImg"], .floor-plan img, [class*="floor"] img');
        
        floorPlanImages.forEach((img, index) => {
          if (img.src && img.src.includes('floorPlanImg')) {
            plans.push({
              type: 'floor_plan',
              name: img.alt || `Floor Plan ${index + 1}`,
              bedroomType: 'Unknown',
              bedroomCount: '0',
              url: img.src,
              alt: img.alt || `Floor plan ${index + 1}`,
              filename: `floorplan_${index + 1}.jpg`,
              hasImage: true
            });
          }
        });
        
        return plans;
      });
      
      return floorPlans;
    } catch (error) {
      console.log('Floor plan extraction failed:', error.message);
      return [];
    }
  }

  async extractUnitMix(page) {
    try {
      const unitMixData = await page.evaluate(() => {
        const unitMix = [];
        const unitMixContainer = document.querySelector('#AvailableUnitMix, .unitMix');
        
        if (unitMixContainer) {
          const contentDiv = unitMixContainer.querySelector('[data-v-f4fb3862].content, .content');
          
          if (contentDiv) {
            const rows = contentDiv.querySelectorAll('.table_body');
            
            rows.forEach((row) => {
              const cells = row.querySelectorAll('p');
              
              if (cells.length >= 4) {
                const typeText = cells[0]?.textContent?.trim() || '';
                const sizeText = cells[1]?.textContent?.trim() || '';
                const priceText = cells[2]?.textContent?.trim() || '';
                const availText = cells[3]?.textContent?.trim() || '';
                
                if (typeText && (typeText.toLowerCase().includes('bedroom') || 
                                typeText.toLowerCase().includes('penthouse') ||
                                typeText.toLowerCase().includes('studio'))) {
                  
                  const availMatch = availText.match(/(\d+)\s*\/\s*(\d+)/);
                  const available = availMatch ? parseInt(availMatch[1]) : null;
                  const total = availMatch ? parseInt(availMatch[2]) : null;
                  
                  const sizeMatch = sizeText.match(/(\d+)\s*-\s*(\d+)/);
                  const minSize = sizeMatch ? parseInt(sizeMatch[1]) : null;
                  const maxSize = sizeMatch ? parseInt(sizeMatch[2]) : null;
                  
                  const priceMatch = priceText.match(/\$?([\d.]+)M?\s*-\s*\$?([\d.]+)M?/);
                  const minPrice = priceMatch ? parseFloat(priceMatch[1]) : null;
                  const maxPrice = priceMatch ? parseFloat(priceMatch[2]) : null;
                  
                  const minPriceActual = minPrice && priceText.includes('M') ? minPrice * 1000000 : minPrice;
                  const maxPriceActual = maxPrice && priceText.includes('M') ? maxPrice * 1000000 : maxPrice;
                  
                  unitMix.push({
                    type: typeText,
                    sizeRange: {
                      raw: sizeText,
                      min: minSize,
                      max: maxSize,
                      unit: 'sqft'
                    },
                    priceRange: {
                      raw: priceText,
                      min: minPriceActual,
                      max: maxPriceActual,
                      currency: 'SGD'
                    },
                    availability: {
                      raw: availText,
                      available: available,
                      total: total,
                      percentage: total ? Math.round((available / total) * 100) : null
                    }
                  });
                }
              }
            });
          }
        }
        
        return unitMix;
      });
      
      return unitMixData;
    } catch (error) {
      console.log('Unit mix extraction failed:', error.message);
      return [];
    }
  }

  displayBasicInfo(info) {
    console.log(`   📍 URL: ${info.url}`);
    console.log(`   🏠 Title: ${info.title}`);
    console.log(`   📍 Address: ${info.address || 'Not found'}`);
    console.log(`   🗺️ District: ${info.district || 'Not found'}`);
    console.log(`   💰 Price: ${info.price || 'Not found'}`);
  }

  displayDetailedInfo(info) {
    console.log(`   🏗️ Developer: ${info.developer || 'Not found'}`);
    console.log(`   🏠 Units: ${info.units || 'Not found'}`);
    console.log(`   📅 Completion: ${info.completion || 'Not found'}`);
    console.log(`   📜 Tenure: ${info.tenure || 'Not found'}`);
    console.log(`   🖼️ Images: ${info.images.length} found`);
    console.log(`   📝 Description: ${info.description ? 'Yes (' + info.description.length + ' chars)' : 'Not found'}`);
  }

  displayFloorPlans(plans) {
    console.log(`   📐 Total Floor Plans: ${plans.length}`);
    plans.slice(0, 3).forEach((plan, index) => {
      console.log(`   ${index + 1}. ${plan.name} - ${plan.bedroomType}`);
    });
    if (plans.length > 3) {
      console.log(`   ... and ${plans.length - 3} more floor plans`);
    }
  }

  displayUnitMix(units) {
    console.log(`   📊 Total Unit Types: ${units.length}`);
    units.forEach((unit, index) => {
      console.log(`   ${index + 1}. ${unit.type}: ${unit.sizeRange.raw} sqft | ${unit.priceRange.raw} | ${unit.availability.available}/${unit.availability.total} available`);
    });
  }
}

// Run the extraction
async function showPropertyData() {
  const extractor = new PropertyDataExtractor();
  await extractor.extractSingleProperty();
}

showPropertyData();
