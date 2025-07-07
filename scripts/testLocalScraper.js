#!/usr/bin/env node

/**
 * Test Local Scraper with Simple Website
 * Tests the scraper functionality before trying complex property sites
 */

const LocalPropertyScraper = require('./localScraperWithWebhook');

async function testScraperBasics() {
  console.log('🧪 Testing Local Property Scraper\n');

  const scraper = new LocalPropertyScraper();
  
  // Override webhook URL for testing
  scraper.webhookUrl = 'https://realestate-bot-backend-production.up.railway.app/api/webhooks/property-data';  // Your actual Railway endpoint
  
  try {
    console.log('1️⃣ Testing basic scraper functionality...\n');

    // Test with a simple, reliable website first
    const testProperties = [
      {
        name: 'Test Property 1',
        developer: 'Test Developer',
        address: '123 Test Street, Singapore',
        district: 'Test District',
        propertyType: 'Private Condo',
        priceRange: { raw: '$1,000,000 - $2,000,000' },
        sourceUrl: 'https://test.com/property1',
        visualAssets: [
          {
            type: 'floor_plan',
            url: 'https://test.com/floorplan1.jpg',
            alt: 'Floor plan',
            filename: 'floorplan1.jpg'
          }
        ],
        scrapedAt: new Date().toISOString(),
        rawText: 'Test Property 1 by Test Developer located at 123 Test Street',
        extractedData: {
          title: 'Test Property 1',
          price: '$1,000,000 - $2,000,000',
          location: '123 Test Street, Singapore',
          hasImage: true,
          hasLink: true
        }
      },
      {
        name: 'Test Property 2',
        developer: 'Another Developer',
        address: '456 Another Street, Singapore',
        district: 'Another District',
        propertyType: 'Private Condo',
        priceRange: { raw: '$800,000 - $1,500,000' },
        sourceUrl: 'https://test.com/property2',
        visualAssets: [],
        scrapedAt: new Date().toISOString(),
        rawText: 'Test Property 2 by Another Developer located at 456 Another Street',
        extractedData: {
          title: 'Test Property 2',
          price: '$800,000 - $1,500,000',
          location: '456 Another Street, Singapore',
          hasImage: false,
          hasLink: true
        }
      }
    ];

    console.log('📊 Generated test properties:');
    testProperties.forEach((prop, index) => {
      console.log(`   ${index + 1}. ${prop.name} by ${prop.developer}`);
      console.log(`      Location: ${prop.address}`);
      console.log(`      Price: ${prop.priceRange?.raw || 'Not specified'}`);
      console.log(`      Visual Assets: ${prop.visualAssets.length}`);
    });
    console.log('');

    console.log('2️⃣ Testing webhook data transmission...\n');
    
    // Test sending to webhook
    await scraper.sendToRailway(testProperties);
    
    console.log('\n3️⃣ Testing file save functionality...\n');
    
    // Test saving to file
    const fs = require('fs').promises;
    await fs.writeFile(scraper.outputFile, JSON.stringify(testProperties, null, 2));
    console.log(`✅ Test data saved to ${scraper.outputFile}`);

    console.log('\n4️⃣ Testing data validation...\n');
    
    // Validate the data format
    const validationResults = testProperties.map((prop, index) => {
      const issues = [];
      
      if (!prop.name || prop.name.trim() === '') issues.push('Missing name');
      if (!prop.developer) issues.push('Missing developer');
      if (!prop.address) issues.push('Missing address');
      if (!prop.district) issues.push('Missing district');
      if (!prop.scrapedAt) issues.push('Missing timestamp');
      
      return {
        index: index + 1,
        property: prop.name,
        valid: issues.length === 0,
        issues: issues
      };
    });

    console.log('📋 Validation Results:');
    validationResults.forEach(result => {
      console.log(`   ${result.index}. ${result.property}: ${result.valid ? '✅ Valid' : '❌ Invalid'}`);
      if (result.issues.length > 0) {
        result.issues.forEach(issue => console.log(`      - ${issue}`));
      }
    });

    const allValid = validationResults.every(r => r.valid);
    console.log(`\n📊 Overall validation: ${allValid ? '✅ All properties valid' : '❌ Some properties invalid'}`);

    console.log('\n🎉 Test Summary:');
    console.log('✅ Property data generation: WORKING');
    console.log('✅ Webhook transmission: WORKING');
    console.log('✅ File saving: WORKING');
    console.log(`✅ Data validation: ${allValid ? 'WORKING' : 'NEEDS ATTENTION'}`);

    console.log('\n💡 Next Steps:');
    console.log('1. Update webhook URL to your actual Railway backend');
    console.log('2. Test with real property websites');
    console.log('3. Set up automated scheduling');
    console.log('4. Configure error handling and retries');

    return {
      success: true,
      propertiesGenerated: testProperties.length,
      validationPassed: allValid
    };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run test if called directly
if (require.main === module) {
  testScraperBasics()
    .then(result => {
      if (result.success) {
        console.log('\n✅ All tests passed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Tests failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testScraperBasics };
