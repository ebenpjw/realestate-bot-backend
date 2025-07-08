const puppeteer = require('puppeteer');

async function testUnitMixDetection() {
  console.log('🧪 Testing Unit Mix Detection for Bagnall Haus...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();
    
    // Navigate directly to Bagnall Haus
    console.log('🌐 Navigating to Bagnall Haus...');
    await page.goto('https://www.ecoprop.com/projectdetail/Bagnall-Haus', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for unit mix containers and data
    const unitMixInfo = await page.evaluate(() => {
      const results = {};
      
      // Check for various unit mix container selectors
      const containerSelectors = [
        '#AvailableUnitMix',
        '.unitMix',
        '[data-v-f4fb3862]',
        '.unit-mix',
        '.available-units',
        '.pricing',
        '.unit-types'
      ];

      results.containers = {};
      
      for (const selector of containerSelectors) {
        const container = document.querySelector(selector);
        if (container) {
          results.containers[selector] = {
            found: true,
            innerHTML: container.innerHTML.substring(0, 500) + '...',
            textContent: container.textContent.substring(0, 200) + '...'
          };
        } else {
          results.containers[selector] = { found: false };
        }
      }

      // Look for any tables or structured data
      const tables = document.querySelectorAll('table, .table, .table_head, .table_body');
      results.tables = Array.from(tables).map(table => ({
        tagName: table.tagName,
        className: table.className,
        textContent: table.textContent.substring(0, 200) + '...'
      }));

      // Look for any text containing unit/pricing information
      const allText = document.body.textContent;
      results.hasUnitText = {
        bedroom: allText.toLowerCase().includes('bedroom'),
        sqft: allText.toLowerCase().includes('sqft'),
        price: allText.toLowerCase().includes('price') || allText.includes('$'),
        available: allText.toLowerCase().includes('available'),
        sold: allText.toLowerCase().includes('sold'),
        units: allText.toLowerCase().includes('units')
      };

      // Look for specific elements that might contain unit data
      const potentialUnitElements = document.querySelectorAll('*');
      results.potentialElements = [];
      
      for (const el of potentialUnitElements) {
        const text = el.textContent?.toLowerCase() || '';
        if ((text.includes('bedroom') || text.includes('sqft') || text.includes('available')) && 
            text.length < 100 && text.length > 10) {
          results.potentialElements.push({
            tagName: el.tagName,
            className: el.className,
            textContent: el.textContent.trim()
          });
        }
      }

      // Limit potential elements to first 10
      results.potentialElements = results.potentialElements.slice(0, 10);

      return results;
    });

    console.log('📊 Unit Mix Detection Results:');
    console.log('Containers found:');
    Object.entries(unitMixInfo.containers).forEach(([selector, info]) => {
      if (info.found) {
        console.log(`  ✅ ${selector}: Found`);
        console.log(`     Text: ${info.textContent.substring(0, 100)}...`);
      } else {
        console.log(`  ❌ ${selector}: Not found`);
      }
    });

    console.log('\nTables found:', unitMixInfo.tables.length);
    unitMixInfo.tables.forEach((table, i) => {
      console.log(`  Table ${i+1}: ${table.tagName}.${table.className}`);
      console.log(`    Text: ${table.textContent.substring(0, 100)}...`);
    });

    console.log('\nText content analysis:');
    Object.entries(unitMixInfo.hasUnitText).forEach(([key, found]) => {
      console.log(`  ${key}: ${found ? '✅' : '❌'}`);
    });

    console.log('\nPotential unit elements:');
    unitMixInfo.potentialElements.forEach((el, i) => {
      console.log(`  ${i+1}. ${el.tagName}.${el.className}: "${el.textContent}"`);
    });

    // Test the actual extractUnitMix function logic
    console.log('\n🔍 Testing current extractUnitMix logic...');
    
    const unitMixResult = await page.evaluate(() => {
      const unitMix = [];

      // Look for the specific unit mix container (current logic)
      const unitMixContainer = document.querySelector('#AvailableUnitMix, .unitMix');

      if (unitMixContainer) {
        // Find the content div with table structure
        const contentDiv = unitMixContainer.querySelector('[data-v-f4fb3862].content, .content');

        if (contentDiv) {
          // Extract table body rows (each .table_body div is a row)
          const rows = contentDiv.querySelectorAll('.table_body');

          rows.forEach((row, index) => {
            try {
              // Extract data from each row - each <p> is a cell
              const cells = row.querySelectorAll('p');

              if (cells.length >= 4) {
                const typeText = cells[0]?.textContent?.trim() || '';
                const sizeText = cells[1]?.textContent?.trim() || '';
                const priceText = cells[2]?.textContent?.trim() || '';
                const availText = cells[3]?.textContent?.trim() || '';

                // Only add if it looks like valid unit data
                if (typeText && (typeText.toLowerCase().includes('bedroom') ||
                                typeText.toLowerCase().includes('penthouse') ||
                                typeText.toLowerCase().includes('studio'))) {

                  unitMix.push({
                    type: typeText,
                    size: sizeText,
                    price: priceText,
                    availability: availText
                  });
                }
              }
            } catch (error) {
              console.log(`Error processing row ${index}: ${error.message}`);
            }
          });
        }
      }

      return {
        containerFound: !!unitMixContainer,
        contentDivFound: !!unitMixContainer?.querySelector('[data-v-f4fb3862].content, .content'),
        rowsFound: unitMixContainer?.querySelector('[data-v-f4fb3862].content, .content')?.querySelectorAll('.table_body').length || 0,
        unitMixData: unitMix
      };
    });

    console.log('Current logic results:');
    console.log(`  Container found: ${unitMixResult.containerFound}`);
    console.log(`  Content div found: ${unitMixResult.contentDivFound}`);
    console.log(`  Rows found: ${unitMixResult.rowsFound}`);
    console.log(`  Unit mix data: ${unitMixResult.unitMixData.length} units`);
    
    if (unitMixResult.unitMixData.length > 0) {
      unitMixResult.unitMixData.forEach((unit, i) => {
        console.log(`    ${i+1}. ${unit.type} - ${unit.size} - ${unit.price} - ${unit.availability}`);
      });
    }

  } catch (error) {
    console.error('❌ Error during unit mix test:', error);
  } finally {
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will stay open for manual inspection...');
    console.log('Press Ctrl+C to close when done.');
    
    // Wait indefinitely
    await new Promise(() => {});
  }
}

testUnitMixDetection().catch(console.error);
