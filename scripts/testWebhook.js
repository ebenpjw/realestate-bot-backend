/**
 * Test webhook with a single property
 */

const axios = require('axios');

async function testWebhook() {
  try {
    console.log('🧪 Testing webhook with single property...\n');

    // Create test property data
    const testProperty = {
      name: 'Test Property Webhook',
      developer: 'Test Developer',
      address: 'Test Address, Singapore',
      district: 'D01',
      propertyType: 'Private Condo',
      priceRange: {
        raw: '$1.5M - $2.5M',
        min: 1500000,
        max: 2500000
      },
      description: 'Test property for webhook testing',
      units: 100,
      completion: '2026',
      tenure: '99 Years',
      sourceUrl: 'https://test.com/property',
      visualAssets: [
        {
          type: 'floor_plan',
          name: 'Test Floor Plan',
          bedroomType: '2 Bedroom',
          bedroomCount: '2',
          bedroomCategory: 'All(1)',
          url: 'https://test.com/floorplan.jpg',
          alt: 'Test floor plan',
          filename: 'test_floorplan.jpg',
          hasImage: true
        }
      ],
      floorPlans: [
        {
          type: 'floor_plan',
          name: 'Test Floor Plan',
          bedroomType: '2 Bedroom',
          bedroomCount: '2',
          bedroomCategory: 'All(1)',
          url: 'https://test.com/floorplan.jpg',
          alt: 'Test floor plan',
          filename: 'test_floorplan.jpg',
          hasImage: true
        }
      ],
      unitMix: [
        {
          type: '2 BEDROOM',
          sizeRange: {
            raw: '800 - 1000',
            min: 800,
            max: 1000,
            unit: 'sqft'
          },
          priceRange: {
            raw: '$1.5M - $2.0M',
            min: '1.5',
            max: '2.0',
            currency: 'SGD'
          },
          availability: {
            raw: '5 / 10',
            available: 5,
            total: 10,
            percentage: 50
          }
        }
      ],
      scrapedAt: new Date().toISOString(),
      extractedData: {
        hasDetailedInfo: true,
        imageCount: 1,
        floorPlanCount: 1,
        unitMixCount: 1,
        hasDescription: true
      }
    };

    // Test local webhook first
    console.log('1. Testing local webhook...');
    try {
      const localResponse = await axios.post('http://localhost:3000/api/webhooks/property-data', [testProperty], {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Local webhook response:', localResponse.data);
    } catch (localError) {
      console.log('❌ Local webhook failed:', localError.message);
      if (localError.response) {
        console.log('Response data:', localError.response.data);
        console.log('Response status:', localError.response.status);
      }
    }

    // Test Railway webhook with correct format
    console.log('\n2. Testing Railway webhook...');
    try {
      const webhookPayload = {
        properties: [testProperty],
        source: 'test-script',
        timestamp: new Date().toISOString(),
        metadata: {
          test: true,
          version: '1.0.0'
        }
      };

      const railwayResponse = await axios.post(
        'https://realestate-bot-backend-production.up.railway.app/api/webhooks/property-data',
        webhookPayload,
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Railway webhook response:', railwayResponse.data);
    } catch (railwayError) {
      console.log('❌ Railway webhook failed:', railwayError.message);
      if (railwayError.response) {
        console.log('Response data:', railwayError.response.data);
        console.log('Response status:', railwayError.response.status);
      }
    }

    console.log('\n🎉 Webhook test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWebhook();
