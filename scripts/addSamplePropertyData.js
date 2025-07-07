#!/usr/bin/env node

/**
 * Add Sample Property Data for Testing
 * This script adds realistic sample property data to test the visual property system
 */

const supabase = require('../supabaseClient');
const logger = require('../logger');

async function addSamplePropertyData() {
  try {
    console.log('🏠 Adding sample property data for testing...');

    // Sample property projects
    const sampleProjects = [
      {
        project_name: 'Bloomsbury Residences',
        developer: 'Premium Developments Pte Ltd',
        address: '123 Orchard Road, Singapore 238123',
        district: 'D09',
        postal_code: '238123',
        property_type: 'Private Condo',
        tenure: '99 Years',
        total_units: 180,
        price_range_min: 1200000,
        price_range_max: 2800000,
        sales_status: 'Available',
        launch_date: '2024-12-01',
        top_date: '2026-06-01',
        completion_status: 'BUC',
        source_url: 'https://www.ecoprop.com/project/bloomsbury-residences',
        scraping_status: 'completed'
      },
      {
        project_name: 'Marina Heights',
        developer: 'Luxury Living Pte Ltd',
        address: '456 Marina Bay Drive, Singapore 018956',
        district: 'D01',
        postal_code: '018956',
        property_type: 'Private Condo',
        tenure: 'Freehold',
        total_units: 220,
        price_range_min: 1800000,
        price_range_max: 4500000,
        sales_status: 'Available',
        launch_date: '2024-11-15',
        top_date: '2026-12-01',
        completion_status: 'BUC',
        source_url: 'https://www.ecoprop.com/project/marina-heights',
        scraping_status: 'completed'
      },
      {
        project_name: 'Garden Villas',
        developer: 'Green Spaces Development',
        address: '789 Bukit Timah Road, Singapore 269734',
        district: 'D10',
        postal_code: '269734',
        property_type: 'Landed House',
        tenure: 'Freehold',
        total_units: 45,
        price_range_min: 3200000,
        price_range_max: 5800000,
        sales_status: 'Available',
        launch_date: '2024-10-01',
        top_date: '2025-12-01',
        completion_status: 'BUC',
        source_url: 'https://www.ecoprop.com/project/garden-villas',
        scraping_status: 'completed'
      }
    ];

    // Insert projects
    const { data: projects, error: projectError } = await supabase
      .from('property_projects')
      .insert(sampleProjects)
      .select();

    if (projectError) {
      throw new Error(`Failed to insert projects: ${projectError.message}`);
    }

    console.log(`✅ Added ${projects.length} sample projects`);

    // Add property units for each project
    for (const project of projects) {
      const units = [];
      
      if (project.property_type === 'Private Condo') {
        units.push(
          {
            project_id: project.id,
            unit_type: '2 Bedroom',
            bedrooms: 2,
            bathrooms: 2,
            study_room: false,
            balcony: true,
            size_sqft: 750,
            size_sqm: 69.7,
            price_psf: Math.floor(project.price_range_min / 750),
            unit_price: project.price_range_min,
            available_units: 25,
            total_units_of_type: 60
          },
          {
            project_id: project.id,
            unit_type: '3 Bedroom',
            bedrooms: 3,
            bathrooms: 2,
            study_room: true,
            balcony: true,
            size_sqft: 1100,
            size_sqm: 102.2,
            price_psf: Math.floor(project.price_range_max / 1100),
            unit_price: project.price_range_max,
            available_units: 15,
            total_units_of_type: 40
          }
        );
      } else if (project.property_type === 'Landed House') {
        units.push(
          {
            project_id: project.id,
            unit_type: '4 Bedroom Terrace',
            bedrooms: 4,
            bathrooms: 3,
            study_room: true,
            balcony: false,
            size_sqft: 2200,
            size_sqm: 204.4,
            price_psf: Math.floor(project.price_range_min / 2200),
            unit_price: project.price_range_min,
            available_units: 8,
            total_units_of_type: 25
          },
          {
            project_id: project.id,
            unit_type: '5 Bedroom Semi-D',
            bedrooms: 5,
            bathrooms: 4,
            study_room: true,
            balcony: false,
            size_sqft: 3200,
            size_sqm: 297.3,
            price_psf: Math.floor(project.price_range_max / 3200),
            unit_price: project.price_range_max,
            available_units: 3,
            total_units_of_type: 20
          }
        );
      }

      if (units.length > 0) {
        const { error: unitsError } = await supabase
          .from('property_units')
          .insert(units);

        if (unitsError) {
          console.error(`Failed to insert units for ${project.project_name}:`, unitsError.message);
        } else {
          console.log(`✅ Added ${units.length} unit types for ${project.project_name}`);
        }
      }
    }

    // Add visual assets
    for (const project of projects) {
      const visualAssets = [
        {
          project_id: project.id,
          asset_type: 'floor_plan',
          file_name: `${project.project_name.toLowerCase().replace(/\s+/g, '_')}_2br_floor_plan.jpg`,
          file_size: 524288, // 512KB
          mime_type: 'image/jpeg',
          storage_path: `property-assets/${project.id}/floor_plans/2br_floor_plan.jpg`,
          public_url: `https://via.placeholder.com/800x600/f0f0f0/333333?text=2BR+Floor+Plan+-+${encodeURIComponent(project.project_name)}`,
          processing_status: 'completed',
          original_url: `${project.source_url}/floor-plans/2br`,
          alt_text: `2 Bedroom Floor Plan - ${project.project_name}`,
          description: '2-bedroom unit floor plan with open concept living'
        },
        {
          project_id: project.id,
          asset_type: 'floor_plan',
          file_name: `${project.project_name.toLowerCase().replace(/\s+/g, '_')}_3br_floor_plan.jpg`,
          file_size: 612352, // 598KB
          mime_type: 'image/jpeg',
          storage_path: `property-assets/${project.id}/floor_plans/3br_floor_plan.jpg`,
          public_url: `https://via.placeholder.com/800x600/f0f0f0/333333?text=3BR+Floor+Plan+-+${encodeURIComponent(project.project_name)}`,
          processing_status: 'completed',
          original_url: `${project.source_url}/floor-plans/3br`,
          alt_text: `3 Bedroom Floor Plan - ${project.project_name}`,
          description: '3-bedroom unit floor plan with study room and balcony'
        },
        {
          project_id: project.id,
          asset_type: 'brochure',
          file_name: `${project.project_name.toLowerCase().replace(/\s+/g, '_')}_brochure.jpg`,
          file_size: 1048576, // 1MB
          mime_type: 'image/jpeg',
          storage_path: `property-assets/${project.id}/brochures/property_brochure.jpg`,
          public_url: `https://via.placeholder.com/600x800/e8e8e8/333333?text=Property+Brochure+-+${encodeURIComponent(project.project_name)}`,
          processing_status: 'completed',
          original_url: `${project.source_url}/brochure`,
          alt_text: `Property Brochure - ${project.project_name}`,
          description: 'Complete property information brochure with amenities and pricing'
        }
      ];

      const { data: assets, error: assetsError } = await supabase
        .from('visual_assets')
        .insert(visualAssets)
        .select();

      if (assetsError) {
        console.error(`Failed to insert visual assets for ${project.project_name}:`, assetsError.message);
      } else {
        console.log(`✅ Added ${assets.length} visual assets for ${project.project_name}`);

        // Add AI analysis for each asset
        for (const asset of assets) {
          let analysisData = {};
          
          if (asset.asset_type === 'floor_plan') {
            const unitType = asset.file_name.includes('2br') ? '2BR' : '3BR';
            const bedrooms = asset.file_name.includes('2br') ? 2 : 3;
            
            analysisData = {
              visual_asset_id: asset.id,
              analysis_type: 'floor_plan_analysis',
              ai_model: 'gpt-4-vision-preview',
              confidence_score: 0.92,
              extracted_data: {
                totalRooms: bedrooms + 2,
                bedrooms: bedrooms,
                bathrooms: 2,
                layoutType: 'Open concept',
                keyFeatures: ['balcony', 'open kitchen', 'living room', 'master bedroom'],
                squareFootage: bedrooms === 2 ? 750 : 1100,
                summary: `${bedrooms}BR ${2}BA Open concept layout`,
                confidence: 0.92
              },
              room_count: bedrooms + 2,
              layout_type: 'Open concept',
              square_footage: bedrooms === 2 ? 750 : 1100,
              key_features: ['balcony', 'open kitchen', 'living room', 'master bedroom'],
              description: `This floor plan shows a ${bedrooms}-bedroom, 2-bathroom unit with an open concept layout. The unit features a spacious living room, modern kitchen, master bedroom with ensuite bathroom, and a balcony. Total area is approximately ${bedrooms === 2 ? 750 : 1100} square feet.`,
              summary: `${bedrooms}BR ${2}BA Open concept layout (${bedrooms === 2 ? 750 : 1100} sqft)`,
              tokens_used: 850
            };
          } else if (asset.asset_type === 'brochure') {
            analysisData = {
              visual_asset_id: asset.id,
              analysis_type: 'brochure_text_extraction',
              ai_model: 'gpt-4-vision-preview',
              confidence_score: 0.88,
              extracted_data: {
                propertyName: project.project_name,
                developer: project.developer,
                location: project.address,
                amenities: ['swimming pool', 'gym', 'playground', 'bbq area', 'function room', '24-hour security'],
                keyFeatures: ['near MRT', 'good investment', 'family-friendly', project.tenure],
                summary: `Property brochure analysis: 6 amenities identified, 4 key features found`,
                confidence: 0.88
              },
              key_features: ['swimming pool', 'gym', 'playground', 'bbq area', 'function room', '24-hour security'],
              description: `Property brochure for ${project.project_name} by ${project.developer}. Features include swimming pool, gym, playground, BBQ area, function room, and 24-hour security. Located ${project.address} with excellent connectivity and investment potential.`,
              summary: `Property brochure analysis: 6 amenities identified, 4 key features found`,
              tokens_used: 920
            };
          }

          const { error: analysisError } = await supabase
            .from('ai_visual_analysis')
            .insert(analysisData);

          if (analysisError) {
            console.error(`Failed to insert AI analysis for asset ${asset.id}:`, analysisError.message);
          }
        }
      }
    }

    // Add search index data
    for (const project of projects) {
      const searchIndexData = {
        project_id: project.id,
        keywords: [project.project_name, project.developer, project.district, project.property_type],
        amenities: ['swimming pool', 'gym', 'playground', 'bbq area', 'function room', '24-hour security'],
        nearby_schools: ['Orchard Primary School', 'Singapore International School'],
        nearby_mrt: ['Orchard MRT', 'Somerset MRT'],
        nearby_shopping: ['ION Orchard', 'Takashimaya'],
        family_friendly_score: project.property_type === 'Landed House' ? 0.95 : 0.85,
        investment_potential_score: project.district.startsWith('D0') ? 0.90 : 0.75,
        luxury_score: project.price_range_min > 2000000 ? 0.90 : 0.70
      };

      const { error: indexError } = await supabase
        .from('property_search_index')
        .insert(searchIndexData);

      if (indexError) {
        console.error(`Failed to insert search index for ${project.project_name}:`, indexError.message);
      } else {
        console.log(`✅ Added search index for ${project.project_name}`);
      }
    }

    console.log('\n🎉 Sample property data added successfully!');
    console.log('\nYou can now test:');
    console.log('1. "Show me 3-bedroom condos with floor plans"');
    console.log('2. "I want to see Bloomsbury Residences floor plans"');
    console.log('3. "What properties have swimming pools?"');
    console.log('4. "Show me properties in District 9"');

  } catch (error) {
    console.error('❌ Failed to add sample data:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  addSamplePropertyData().then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { addSamplePropertyData };
