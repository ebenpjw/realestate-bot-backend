const puppeteer = require('puppeteer');

async function testBagnallHausFix() {
  console.log('🧪 Testing Bagnall Haus Fix...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();
    
    await page.goto('https://www.ecoprop.com/projectdetail/Bagnall-Haus', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test the updated extractUnitMix logic
    const unitMixResult = await page.evaluate(() => {
      const unitMix = [];

      const unitMixContainer = document.querySelector('#AvailableUnitMix, .unitMix');

      if (unitMixContainer) {
        const contentDiv = unitMixContainer.querySelector('[data-v-f4fb3862].content, .content');

        if (contentDiv) {
          const rows = contentDiv.querySelectorAll('.table_body');

          rows.forEach((row, index) => {
            try {
              const cells = row.querySelectorAll('p');

              if (cells.length >= 4) {
                const typeText = cells[0]?.textContent?.trim() || '';
                const sizeText = cells[1]?.textContent?.trim() || '';
                const priceText = cells[2]?.textContent?.trim() || '';
                const availText = cells[3]?.textContent?.trim() || '';

                console.log(`Row ${index + 1}: "${typeText}" | "${sizeText}" | "${priceText}" | "${availText}"`);

                // Test the updated filtering logic
                const matchesBedroom = typeText.toLowerCase().includes('bedroom');
                const matchesPenthouse = typeText.toLowerCase().includes('penthouse');
                const matchesStudio = typeText.toLowerCase().includes('studio');
                const matchesBR = typeText.match(/\d+br/i);
                const matchesFlexi = typeText.toLowerCase().includes('flexi');

                console.log(`  Matches: bedroom=${matchesBedroom}, penthouse=${matchesPenthouse}, studio=${matchesStudio}, BR=${!!matchesBR}, flexi=${matchesFlexi}`);

                // Updated filtering logic
                if (typeText && (matchesBedroom || matchesPenthouse || matchesStudio || matchesBR || matchesFlexi)) {
                  
                  // Parse availability (e.g., "4 / 12")
                  const availMatch = availText.match(/(\d+)\s*\/\s*(\d+)/);
                  const available = availMatch ? parseInt(availMatch[1]) : 0;
                  const total = availMatch ? parseInt(availMatch[2]) : 0;

                  console.log(`  ✅ ACCEPTED: Available=${available}, Total=${total}`);

                  unitMix.push({
                    type: typeText,
                    size: sizeText,
                    price: priceText,
                    availability: availText,
                    available: available,
                    total: total
                  });
                } else {
                  console.log(`  ❌ REJECTED: No match for unit type patterns`);
                }
              }
            } catch (error) {
              console.log(`Error processing row ${index}: ${error.message}`);
            }
          });
        } else {
          console.log('No content div found');
        }
      } else {
        console.log('No unit mix container found');
      }

      return {
        containerFound: !!unitMixContainer,
        contentDivFound: !!unitMixContainer?.querySelector('[data-v-f4fb3862].content, .content'),
        rowsFound: unitMixContainer?.querySelector('[data-v-f4fb3862].content, .content')?.querySelectorAll('.table_body').length || 0,
        unitMixData: unitMix
      };
    });

    console.log('\n📊 Results:');
    console.log(`Container found: ${unitMixResult.containerFound}`);
    console.log(`Content div found: ${unitMixResult.contentDivFound}`);
    console.log(`Rows found: ${unitMixResult.rowsFound}`);
    console.log(`Unit mix data extracted: ${unitMixResult.unitMixData.length} units`);
    
    if (unitMixResult.unitMixData.length > 0) {
      console.log('\nExtracted units:');
      unitMixResult.unitMixData.forEach((unit, i) => {
        console.log(`  ${i+1}. ${unit.type} - ${unit.size} - ${unit.price} - ${unit.availability} (${unit.available}/${unit.total})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testBagnallHausFix().catch(console.error);
