/**
 * Test database connection and table structure
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection and schema...\n');

    // Create Supabase client
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // Test 1: Basic connection
    console.log('1. Testing basic connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('leads')
      .select('count')
      .limit(1);

    if (connectionError) {
      console.log('❌ Connection failed:', connectionError.message);
      return;
    }
    console.log('✅ Database connection successful');

    // Test 2: Check if property_projects table exists
    console.log('\n2. Checking property_projects table...');
    const { data: projectsTest, error: projectsError } = await supabase
      .from('property_projects')
      .select('*')
      .limit(1);

    if (projectsError) {
      console.log('❌ property_projects table error:', projectsError.message);
      
      // Check what tables do exist
      console.log('\n3. Checking available tables...');
      const { data: tablesData, error: tablesError } = await supabase.rpc('get_table_names');
      
      if (tablesError) {
        console.log('❌ Could not list tables:', tablesError.message);
      } else {
        console.log('✅ Available tables:', tablesData);
      }
    } else {
      console.log('✅ property_projects table exists');
      console.log('Sample data:', projectsTest);
    }

    // Test 3: Try to insert a test property
    console.log('\n4. Testing property insertion...');
    const testProperty = {
      project_name: 'Test Property ' + Date.now(),
      developer: 'Test Developer',
      address: 'Test Address, Singapore',
      district: 'D01',
      property_type: 'Private Condo',
      tenure: '99 Years',
      source_url: 'test://webhook',
      last_scraped: new Date().toISOString(),
      scraping_status: 'completed'
    };

    const { data: insertResult, error: insertError } = await supabase
      .from('property_projects')
      .insert(testProperty)
      .select()
      .single();

    if (insertError) {
      console.log('❌ Insert failed:', insertError.message);
      console.log('Error details:', insertError);
    } else {
      console.log('✅ Insert successful:', insertResult.id);
      
      // Clean up test data
      await supabase
        .from('property_projects')
        .delete()
        .eq('id', insertResult.id);
      console.log('✅ Test data cleaned up');
    }

    // Test 4: Check visual_assets table
    console.log('\n5. Checking visual_assets table...');
    const { data: assetsTest, error: assetsError } = await supabase
      .from('visual_assets')
      .select('*')
      .limit(1);

    if (assetsError) {
      console.log('❌ visual_assets table error:', assetsError.message);
    } else {
      console.log('✅ visual_assets table exists');
    }

    console.log('\n🎉 Database test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testDatabase();
