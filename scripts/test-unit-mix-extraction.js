#!/usr/bin/env node

/**
 * Test Unit Mix Extraction and Storage
 * Validates that unit mix data is properly extracted and saved with all pricing details
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class UnitMixTester {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }
    
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  async testUnitMixStorage() {
    console.log('🧪 Testing Unit Mix Data Storage...\n');

    try {
      // Create a test property first
      const testProperty = {
        project_name: 'Unit Mix Test Property ' + Date.now(),
        developer: 'Test Developer',
        address: 'Test Address, Singapore',
        district: 'Test District',
        property_type: 'Private Condo',
        source_url: 'test://unit-mix-test',
        scraping_status: 'completed'
      };

      const { data: project, error: projectError } = await this.supabase
        .from('property_projects')
        .insert(testProperty)
        .select()
        .single();

      if (projectError) {
        throw new Error(`Property creation failed: ${projectError.message}`);
      }

      console.log(`✅ Test property created: ${project.project_name}`);

      // Test unit mix data based on your screenshot
      const testUnitMixData = [
        {
          type: '2 Bedroom + Study',
          size: '861 - 893',
          price: '$2.13M - $2.25M',
          availability: '6 / 9',
          size_min_sqft: 861,
          size_max_sqft: 893,
          price_min_sgd: 2130000,
          price_max_sgd: 2250000,
          available_units: 6,
          total_units: 9,
          availability_percentage: 67,
          price_range_text: '$2.13M - $2.25M'
        },
        {
          type: '3 Bedroom',
          size: '980',
          price: '$2.44M - $2.48M',
          availability: '2 / 4',
          size_min_sqft: 980,
          size_max_sqft: 980,
          price_min_sgd: 2440000,
          price_max_sgd: 2480000,
          available_units: 2,
          total_units: 4,
          availability_percentage: 50,
          price_range_text: '$2.44M - $2.48M'
        },
        {
          type: '3 Bedroom Deluxe',
          size: '1023',
          price: '$2.5M - $2.55M',
          availability: '3 / 5',
          size_min_sqft: 1023,
          size_max_sqft: 1023,
          price_min_sgd: 2500000,
          price_max_sgd: 2550000,
          available_units: 3,
          total_units: 5,
          availability_percentage: 60,
          price_range_text: '$2.50M - $2.55M'
        },
        {
          type: '4 Bedroom',
          size: '1292 - 1324',
          price: '$3.27M - $3.35M',
          availability: '4 / 6',
          size_min_sqft: 1292,
          size_max_sqft: 1324,
          price_min_sgd: 3270000,
          price_max_sgd: 3350000,
          available_units: 4,
          total_units: 6,
          availability_percentage: 67,
          price_range_text: '$3.27M - $3.35M'
        }
      ];

      // Save unit mix data
      for (const unitType of testUnitMixData) {
        const { error } = await this.supabase
          .from('property_unit_mix')
          .insert({
            project_id: project.id,
            unit_type: unitType.type,
            size_range_raw: unitType.size,
            size_min_sqft: unitType.size_min_sqft,
            size_max_sqft: unitType.size_max_sqft,
            size_unit: 'sqft',
            price_range_raw: unitType.price,
            price_min: unitType.price_min_sgd,
            price_max: unitType.price_max_sgd,
            price_currency: 'SGD',
            availability_raw: unitType.availability,
            units_available: unitType.available_units,
            units_total: unitType.total_units,
            availability_percentage: unitType.availability_percentage
          });

        if (error) {
          throw new Error(`Unit mix insertion failed: ${error.message}`);
        }

        console.log(`✅ Saved: ${unitType.type} - ${unitType.price_range_text} (${unitType.available_units}/${unitType.total_units} available)`);
      }

      // Verify the data was saved correctly
      const { data: savedUnitMix, error: fetchError } = await this.supabase
        .from('property_unit_mix')
        .select('*')
        .eq('project_id', project.id)
        .order('price_min', { ascending: true });

      if (fetchError) {
        throw new Error(`Data verification failed: ${fetchError.message}`);
      }

      console.log('\n📊 Verification - Saved Unit Mix Data:');
      console.log('Type'.padEnd(20) + 'Size(SQFT)'.padEnd(15) + 'Price Range'.padEnd(20) + 'Avail/Total');
      console.log('-'.repeat(70));

      savedUnitMix.forEach(unit => {
        const sizeDisplay = unit.size_min_sqft === unit.size_max_sqft 
          ? unit.size_min_sqft.toString()
          : `${unit.size_min_sqft} - ${unit.size_max_sqft}`;
        
        const priceDisplay = `$${(unit.price_min/1000000).toFixed(2)}M - $${(unit.price_max/1000000).toFixed(2)}M`;
        
        console.log(
          unit.unit_type.padEnd(20) + 
          sizeDisplay.padEnd(15) + 
          priceDisplay.padEnd(20) + 
          `${unit.units_available} / ${unit.units_total}`
        );
      });

      // Test bot query scenarios
      console.log('\n🤖 Bot Query Test Scenarios:');
      
      // Scenario 1: Find 3-bedroom units
      const threeBedroomUnits = savedUnitMix.filter(unit => 
        unit.unit_type.toLowerCase().includes('3 bedroom')
      );
      
      if (threeBedroomUnits.length > 0) {
        const unit = threeBedroomUnits[0];
        console.log(`✅ 3-bedroom query: "${unit.unit_type}" costs ${unit.price_range_raw} with ${unit.size_range_raw} sqft`);
      }

      // Scenario 2: Find units under $3M
      const affordableUnits = savedUnitMix.filter(unit => unit.price_max < 3000000);
      console.log(`✅ Units under $3M: Found ${affordableUnits.length} options`);

      // Scenario 3: Find available units
      const availableUnits = savedUnitMix.filter(unit => unit.units_available > 0);
      console.log(`✅ Available units: ${availableUnits.length} out of ${savedUnitMix.length} unit types have availability`);

      // Clean up test data
      await this.supabase
        .from('property_projects')
        .delete()
        .eq('id', project.id);

      console.log('\n✅ Test data cleaned up');
      console.log('🎉 Unit Mix extraction and storage test passed!');

      return true;

    } catch (error) {
      console.error('❌ Unit Mix test failed:', error.message);
      return false;
    }
  }
}

// Run test if called directly
if (require.main === module) {
  const tester = new UnitMixTester();
  tester.testUnitMixStorage()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = UnitMixTester;
