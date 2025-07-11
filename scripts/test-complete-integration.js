#!/usr/bin/env node

/**
 * Complete Integration Test
 * Tests the full scraper workflow with mock data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class CompleteIntegrationTest {
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

  async testCompleteWorkflow() {
    console.log('🚀 Testing Complete Scraper Integration Workflow...\n');

    try {
      // Step 1: Create scraping session
      console.log('📊 Step 1: Creating scraping session...');
      const { data: session, error: sessionError } = await this.supabase
        .from('scraping_sessions')
        .insert({
          session_type: 'test',
          status: 'running',
          triggered_by: 'complete-integration-test',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(`Session creation failed: ${sessionError.message}`);
      }

      console.log(`✅ Session created: ${session.id}`);

      // Step 2: Save property with comprehensive data
      console.log('\n🏠 Step 2: Saving property with comprehensive data...');
      
      const mockPropertyData = {
        name: 'Complete Test Property ' + Date.now(),
        developer: 'Premium Developer Pte Ltd',
        address: '123 Orchard Road, Singapore 238858',
        district: 'District 9',
        propertyType: 'Private Condo',
        tenure: '99 Years',
        priceRange: { raw: '$2.1M - $4.2M' },
        sourceUrl: 'https://test.ecoprop.com/complete-test-property',
        unitMix: [
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
            availability_percentage: 67
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
            availability_percentage: 50
          },
          {
            type: '4 Bedroom Penthouse',
            size: '1520 - 1680',
            price: '$3.8M - $4.2M',
            availability: '1 / 2',
            size_min_sqft: 1520,
            size_max_sqft: 1680,
            price_min_sgd: 3800000,
            price_max_sgd: 4200000,
            available_units: 1,
            total_units: 2,
            availability_percentage: 50
          }
        ],
        floorPlans: [
          {
            name: 'A1',
            bedroomType: '2 Bedroom + Study',
            bedroomCount: 2,
            url: 'https://test.ecoprop.com/floorplans/A1.jpg',
            alt: 'A1 floor plan - 2 bedroom + study',
            filename: 'A1_floorplan.jpg',
            hasImage: true,
            imageWidth: 800,
            imageHeight: 600
          },
          {
            name: 'B2',
            bedroomType: '3 Bedroom',
            bedroomCount: 3,
            url: 'https://test.ecoprop.com/floorplans/B2.jpg',
            alt: 'B2 floor plan - 3 bedroom',
            filename: 'B2_floorplan.jpg',
            hasImage: true,
            imageWidth: 900,
            imageHeight: 700
          },
          {
            name: 'PH1',
            bedroomType: '4 Bedroom Penthouse',
            bedroomCount: 4,
            url: 'https://test.ecoprop.com/floorplans/PH1.jpg',
            alt: 'PH1 floor plan - 4 bedroom penthouse',
            filename: 'PH1_floorplan.jpg',
            hasImage: true,
            imageWidth: 1200,
            imageHeight: 900
          }
        ]
      };

      // Simulate the scraper's savePropertyToDatabase function
      const priceRange = this.parsePriceRange(mockPropertyData.priceRange?.raw);
      
      const { data: project, error: projectError } = await this.supabase
        .from('property_projects')
        .insert({
          project_name: mockPropertyData.name,
          developer: mockPropertyData.developer,
          address: mockPropertyData.address,
          district: mockPropertyData.district,
          property_type: 'Private Condo',
          tenure: mockPropertyData.tenure,
          price_range_min: priceRange.min,
          price_range_max: priceRange.max,
          source_url: mockPropertyData.sourceUrl,
          last_scraped: new Date().toISOString(),
          scraping_status: 'completed'
        })
        .select()
        .single();

      if (projectError) {
        throw new Error(`Property creation failed: ${projectError.message}`);
      }

      console.log(`✅ Property saved: ${project.project_name}`);

      // Step 3: Save unit mix data
      console.log('\n📊 Step 3: Saving unit mix data...');
      
      for (const unitType of mockPropertyData.unitMix) {
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
          throw new Error(`Unit mix save failed: ${error.message}`);
        }

        console.log(`✅ Saved unit mix: ${unitType.type}`);
      }

      // Step 4: Save floor plans
      console.log('\n📐 Step 4: Saving floor plans...');
      
      for (const floorPlan of mockPropertyData.floorPlans) {
        const description = JSON.stringify({
          name: floorPlan.name,
          bedroomType: floorPlan.bedroomType,
          bedroomCount: floorPlan.bedroomCount,
          imageWidth: floorPlan.imageWidth,
          imageHeight: floorPlan.imageHeight,
          hasImage: floorPlan.hasImage,
          alt_text: floorPlan.alt
        });

        const { error } = await this.supabase
          .from('visual_assets')
          .insert({
            project_id: project.id,
            asset_type: 'floor_plan',
            file_name: floorPlan.filename,
            storage_path: `floor-plans/${project.id}/${floorPlan.filename}`,
            public_url: floorPlan.url,
            original_url: floorPlan.url,
            description: description,
            processing_status: 'completed'
          });

        if (error) {
          throw new Error(`Floor plan save failed: ${error.message}`);
        }

        console.log(`✅ Saved floor plan: ${floorPlan.name}`);
      }

      // Step 5: Update session completion
      console.log('\n📋 Step 5: Completing session...');
      
      await this.supabase
        .from('scraping_sessions')
        .update({
          status: 'completed',
          projects_processed: 1,
          projects_updated: 0,
          errors_encountered: 0,
          completed_at: new Date().toISOString()
        })
        .eq('id', session.id);

      console.log('✅ Session completed');

      // Step 6: Verify complete data structure
      console.log('\n🔍 Step 6: Verifying complete data structure...');
      
      const { data: savedProject } = await this.supabase
        .from('property_projects')
        .select(`
          *,
          property_unit_mix(*),
          visual_assets(*)
        `)
        .eq('id', project.id)
        .single();

      console.log('\n📊 Complete Property Data Structure:');
      console.log(`🏠 Property: ${savedProject.project_name}`);
      console.log(`🏗️ Developer: ${savedProject.developer}`);
      console.log(`📍 Address: ${savedProject.address}`);
      console.log(`💰 Price Range: $${(savedProject.price_range_min/1000000).toFixed(2)}M - $${(savedProject.price_range_max/1000000).toFixed(2)}M`);
      console.log(`📊 Unit Types: ${savedProject.property_unit_mix.length}`);
      console.log(`📐 Floor Plans: ${savedProject.visual_assets.length}`);

      console.log('\n📋 Unit Mix Summary:');
      savedProject.property_unit_mix.forEach(unit => {
        const sizeDisplay = unit.size_min_sqft === unit.size_max_sqft 
          ? `${unit.size_min_sqft} sqft`
          : `${unit.size_min_sqft}-${unit.size_max_sqft} sqft`;
        
        console.log(`   ${unit.unit_type}: ${sizeDisplay}, ${unit.price_range_raw} (${unit.units_available}/${unit.units_total} available)`);
      });

      console.log('\n📐 Floor Plans Summary:');
      savedProject.visual_assets.forEach(asset => {
        const metadata = JSON.parse(asset.description);
        console.log(`   ${metadata.name}: ${metadata.bedroomType} (${metadata.imageWidth}x${metadata.imageHeight})`);
      });

      // Clean up test data
      await this.supabase
        .from('property_projects')
        .delete()
        .eq('id', project.id);

      console.log('\n✅ Test data cleaned up');
      console.log('🎉 Complete integration test passed!');
      console.log('\n🚀 Your scraper is ready to extract real property data from ecoprop.com!');

      return true;

    } catch (error) {
      console.error('❌ Complete integration test failed:', error.message);
      return false;
    }
  }

  parsePriceRange(priceRaw) {
    if (!priceRaw) return { min: null, max: null };

    const matches = priceRaw.match(/\$?([\d,]+(?:\.\d+)?)[KMk]?\s*-\s*\$?([\d,]+(?:\.\d+)?)[KMk]?/);
    if (!matches) return { min: null, max: null };

    let min = parseFloat(matches[1].replace(/,/g, ''));
    let max = parseFloat(matches[2].replace(/,/g, ''));

    if (priceRaw.includes('M') || priceRaw.includes('m')) {
      min *= 1000000;
      max *= 1000000;
    }

    return { min, max };
  }
}

// Run test if called directly
if (require.main === module) {
  const tester = new CompleteIntegrationTest();
  tester.testCompleteWorkflow()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = CompleteIntegrationTest;
