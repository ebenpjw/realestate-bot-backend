const LocalPropertyScraper = require('./localScraperWithWebhook');

async function testEnhancedPropertyData() {
  console.log('🧪 Testing Enhanced Property Data Extraction');
  console.log('============================================');

  const scraper = new LocalPropertyScraper();

  try {
    // Test the helper functions with sample data
    console.log('\n🔧 Testing helper functions...');
    
    // Test parseTotalUnits
    const totalUnitsTests = [
      '158 units',
      '158',
      'Total: 158 units',
      'Unknown',
      null
    ];
    
    console.log('\n📊 Testing parseTotalUnits:');
    totalUnitsTests.forEach(test => {
      const result = scraper.parseTotalUnits(test);
      console.log(`  "${test}" → ${result}`);
    });

    // Test parseTopDate
    const topDateTests = [
      'Q4 2025',
      'Q1 2026', 
      'Dec 2025',
      '2025',
      'Quarter 2 2026',
      'Unknown',
      null
    ];
    
    console.log('\n📅 Testing parseTopDate:');
    topDateTests.forEach(test => {
      const result = scraper.parseTopDate(test);
      console.log(`  "${test}" → ${result}`);
    });

    // Test inferSalesStatus
    const salesStatusTests = [
      // Available units
      [{ unitType: '1BR', availableUnits: 5, totalUnits: 10 }],
      // Sold out
      [{ unitType: '1BR', availableUnits: 0, totalUnits: 10 }],
      // No data
      []
    ];
    
    console.log('\n🏷️ Testing inferSalesStatus:');
    salesStatusTests.forEach((test, index) => {
      const result = scraper.inferSalesStatus(test);
      console.log(`  Test ${index + 1}: ${result}`);
    });

    // Test inferCompletionStatus
    const completionStatusTests = [
      'Q4 2024', // Past date
      'Q1 2025', // Soon
      'Q4 2026', // Future
      'Unknown'
    ];
    
    console.log('\n🏗️ Testing inferCompletionStatus:');
    completionStatusTests.forEach(test => {
      const result = scraper.inferCompletionStatus(test);
      console.log(`  "${test}" → ${result}`);
    });

    // Test with real property data
    console.log('\n🏠 Testing with mock property data...');
    
    const mockPropertyData = {
      name: 'Test Enhanced Property',
      developer: 'Test Developer',
      address: 'Test Address, Singapore',
      district: 'D01',
      propertyType: 'Private Condo',
      tenure: '99 Years',
      totalUnits: '158 units',
      expectedTOP: 'Q4 2025',
      priceRange: '$1.5M - $2.5M',
      sourceUrl: 'https://test.com/test-property',
      unitMix: [
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
      ]
    };

    console.log('\n📋 Mock property data:');
    console.log(`  Name: ${mockPropertyData.name}`);
    console.log(`  Total Units: ${mockPropertyData.totalUnits}`);
    console.log(`  Expected TOP: ${mockPropertyData.expectedTOP}`);
    console.log(`  Unit Mix: ${mockPropertyData.unitMix.length} types`);

    // Test parsing
    const totalUnits = scraper.parseTotalUnits(mockPropertyData.totalUnits);
    const topDate = scraper.parseTopDate(mockPropertyData.expectedTOP);
    const salesStatus = scraper.inferSalesStatus(mockPropertyData.unitMix);
    const completionStatus = scraper.inferCompletionStatus(mockPropertyData.expectedTOP);

    console.log('\n✅ Parsed results:');
    console.log(`  Total Units: ${totalUnits}`);
    console.log(`  TOP Date: ${topDate}`);
    console.log(`  Sales Status: ${salesStatus}`);
    console.log(`  Completion Status: ${completionStatus}`);

    // Test database save (create and cleanup)
    console.log('\n💾 Testing database save with enhanced fields...');
    
    const { data: project, error: projectError } = await scraper.supabase
      .from('property_projects')
      .insert({
        project_name: mockPropertyData.name,
        developer: mockPropertyData.developer,
        address: mockPropertyData.address,
        district: mockPropertyData.district,
        property_type: 'Private Condo',
        tenure: mockPropertyData.tenure,
        total_units: totalUnits,
        price_range_min: 1500000,
        price_range_max: 2500000,
        top_date: topDate,
        sales_status: salesStatus,
        completion_status: completionStatus,
        source_url: mockPropertyData.sourceUrl,
        last_scraped: new Date().toISOString(),
        scraping_status: 'completed'
      })
      .select()
      .single();

    if (projectError) {
      throw new Error(`Project creation failed: ${projectError.message}`);
    }

    console.log(`✅ Test project created: ${project.project_name} (ID: ${project.id})`);
    console.log(`  Total Units: ${project.total_units}`);
    console.log(`  TOP Date: ${project.top_date}`);
    console.log(`  Sales Status: ${project.sales_status}`);
    console.log(`  Completion Status: ${project.completion_status}`);

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await scraper.supabase
      .from('property_projects')
      .delete()
      .eq('id', project.id);

    console.log('✅ Test data cleaned up');
    console.log('\n🎉 Enhanced Property Data Test PASSED!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testEnhancedPropertyData().catch(console.error);
