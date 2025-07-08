const puppeteer = require('puppeteer');

async function testEnhancedUnitMix() {
  console.log('🧪 Testing Enhanced Unit Mix Data Structure...');
  
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null
  });

  try {
    const page = await browser.newPage();
    
    // Test Bagnall Haus
    console.log('\n📊 Testing Bagnall Haus...');
    await page.goto('https://www.ecoprop.com/projectdetail/Bagnall-Haus', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const bagnallData = await extractUnitMixData(page);
    console.log(`✅ Extracted ${bagnallData.length} unit types from Bagnall Haus:`);
    bagnallData.forEach((unit, i) => {
      console.log(`  ${i+1}. ${unit.standardized_type}`);
      console.log(`     Size: ${unit.size_range_text}`);
      console.log(`     Price: ${unit.price_range_text}`);
      console.log(`     Availability: ${unit.available_units}/${unit.total_units} (${unit.availability_percentage}%)`);
      console.log(`     Price per sqft: $${unit.price_per_sqft?.toLocaleString() || 'N/A'}`);
      console.log(`     Features: Study=${unit.has_study}, Flexi=${unit.has_flexi}, Penthouse=${unit.is_penthouse}`);
      console.log('');
    });

    // Test Chuan Park
    console.log('\n📊 Testing Chuan Park...');
    await page.goto('https://www.ecoprop.com/projectdetail/Chuan-Park-鑫丰瑞府', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const chuanData = await extractUnitMixData(page);
    console.log(`✅ Extracted ${chuanData.length} unit types from Chuan Park:`);
    chuanData.forEach((unit, i) => {
      console.log(`  ${i+1}. ${unit.standardized_type}`);
      console.log(`     Size: ${unit.size_range_text}`);
      console.log(`     Price: ${unit.price_range_text}`);
      console.log(`     Availability: ${unit.available_units}/${unit.total_units} (${unit.availability_percentage}%)`);
      console.log(`     Price per sqft: $${unit.price_per_sqft?.toLocaleString() || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

async function extractUnitMixData(page) {
  return await page.evaluate(() => {
    const unitMix = [];
    const unitMixContainer = document.querySelector('#AvailableUnitMix, .unitMix');

    if (unitMixContainer) {
      const contentDiv = unitMixContainer.querySelector('[data-v-f4fb3862].content, .content');
      if (contentDiv) {
        const rows = contentDiv.querySelectorAll('.table_body');

        rows.forEach((row) => {
          try {
            const cells = row.querySelectorAll('p');
            if (cells.length >= 4) {
              const typeText = cells[0]?.textContent?.trim() || '';
              const sizeText = cells[1]?.textContent?.trim() || '';
              const priceText = cells[2]?.textContent?.trim() || '';
              const availText = cells[3]?.textContent?.trim() || '';

              if (typeText && (typeText.toLowerCase().includes('bedroom') ||
                              typeText.toLowerCase().includes('penthouse') ||
                              typeText.toLowerCase().includes('studio') ||
                              typeText.match(/\d+br/i) ||
                              typeText.toLowerCase().includes('flexi'))) {

                // Parse availability
                const availMatch = availText.match(/(\d+)\s*\/\s*(\d+)/);
                const available = availMatch ? parseInt(availMatch[1]) : null;
                const total = availMatch ? parseInt(availMatch[2]) : null;

                // Parse size range
                const sizeMatch = sizeText.match(/(\d+)(?:\s*-\s*(\d+))?/);
                const minSize = sizeMatch ? parseInt(sizeMatch[1]) : null;
                const maxSize = sizeMatch && sizeMatch[2] ? parseInt(sizeMatch[2]) : minSize;

                // Parse price range
                const priceMatch = priceText.match(/\$?([\d.]+)M?\s*-\s*\$?([\d.]+)M?/);
                const minPrice = priceMatch ? parseFloat(priceMatch[1]) : null;
                const maxPrice = priceMatch ? parseFloat(priceMatch[2]) : minPrice;

                const minPriceActual = minPrice && priceText.includes('M') ? minPrice * 1000000 : minPrice;
                const maxPriceActual = maxPrice && priceText.includes('M') ? maxPrice * 1000000 : maxPrice;

                // Extract features
                const bedroomMatch = typeText.match(/(\d+)\s*(?:br|bedroom)/i);
                const bedroomCount = bedroomMatch ? parseInt(bedroomMatch[1]) : 0;
                const hasStudy = typeText.toLowerCase().includes('study');
                const hasFlexi = typeText.toLowerCase().includes('flexi');
                const isPenthouse = typeText.toLowerCase().includes('penthouse');
                
                let standardizedType = `${bedroomCount} Bedroom`;
                if (hasStudy) standardizedType += ' + Study';
                if (hasFlexi) standardizedType += ' + Flexi';
                if (isPenthouse) standardizedType += ' Penthouse';

                unitMix.push({
                  type: typeText,
                  bedroom_count: bedroomCount,
                  standardized_type: standardizedType,
                  has_study: hasStudy,
                  has_flexi: hasFlexi,
                  is_penthouse: isPenthouse,
                  size_min_sqft: minSize,
                  size_max_sqft: maxSize,
                  size_range_text: minSize === maxSize ? `${minSize} sqft` : `${minSize} - ${maxSize} sqft`,
                  price_min_sgd: minPriceActual,
                  price_max_sgd: maxPriceActual,
                  price_range_text: `$${(minPriceActual/1000000).toFixed(2)}M - $${(maxPriceActual/1000000).toFixed(2)}M`,
                  available_units: available,
                  total_units: total,
                  availability_percentage: total ? Math.round((available / total) * 100) : 0,
                  price_per_sqft: minSize > 0 && minPriceActual > 0 ? Math.round(minPriceActual / minSize) : null
                });
              }
            }
          } catch (error) {
            console.log('Error parsing row:', error.message);
          }
        });
      }
    }

    return unitMix;
  });
}

testEnhancedUnitMix().catch(console.error);
