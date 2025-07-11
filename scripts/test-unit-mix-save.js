const LocalPropertyScraper = require('./localScraperWithWebhook');

async function testUnitMixSave() {
  console.log('🧪 Testing Unit Mix Save Fix');
  console.log('============================');

  const scraper = new LocalPropertyScraper();

  try {
    // Create mock unit mix data with the correct property names
    const mockUnitMixData = [
      {
        unitType: '1 Bedroom',
        size: '517',
        priceRange: '$1.5M - $1.59M',
        availableUnits: 3,
        totalUnits: 32,
        availability: '3 / 32'
      },
      {
        unitType: '2 Bedroom', 
        size: '624 - 829',
        priceRange: '$1.92M - $2.21M',
        availableUnits: 15,
        totalUnits: 48,
        availability: '15 / 48'
      }
    ];

    console.log('\n📊 Mock unit mix data:');
    mockUnitMixData.forEach((unit, index) => {
      console.log(`${index + 1}. ${unit.unitType}: ${unit.availableUnits}/${unit.totalUnits} available`);
    });

    // Create a test project first
    const testProject = {
      project_name: 'Test Property for Unit Mix',
      project_url: 'https://test.com/test-property',
      district: 'Test District'
    };

    console.log('\n🏠 Creating test project...');
    const { data: project, error: projectError } = await scraper.supabase
      .from('property_projects')
      .insert(testProject)
      .select()
      .single();

    if (projectError) {
      throw new Error(`Project creation failed: ${projectError.message}`);
    }

    console.log(`✅ Test project created: ${project.project_name} (ID: ${project.id})`);

    // Test the unit mix save function
    console.log('\n💾 Testing unit mix save...');
    await scraper.saveUnitMixToDatabase(project.id, mockUnitMixData);

    // Verify the data was saved correctly
    console.log('\n🔍 Verifying saved data...');
    const { data: savedUnitMix, error: fetchError } = await scraper.supabase
      .from('property_unit_mix')
      .select('*')
      .eq('project_id', project.id);

    if (fetchError) {
      throw new Error(`Data verification failed: ${fetchError.message}`);
    }

    console.log(`✅ Verification successful! Found ${savedUnitMix.length} saved unit mix entries:`);
    savedUnitMix.forEach((unit, index) => {
      console.log(`${index + 1}. ${unit.unit_type}: ${unit.units_available}/${unit.units_total} available`);
      console.log(`   Size: ${unit.size_range_raw}`);
      console.log(`   Price: ${unit.price_range_raw}`);
      console.log(`   Availability: ${unit.availability_raw}`);
    });

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await scraper.supabase
      .from('property_projects')
      .delete()
      .eq('id', project.id);

    console.log('✅ Test data cleaned up');
    console.log('\n🎉 Unit Mix Save Test PASSED!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testUnitMixSave().catch(console.error);
