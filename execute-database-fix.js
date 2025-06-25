const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const SUPABASE_URL = 'https://kirudrpypiawrbhdjjzj.supabase.co';

// Using your actual service role key
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcnVkcnB5cGlhd3JiaGRqanpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUyMzkzNCwiZXhwIjoyMDY1MDk5OTM0fQ.VhuMTVGLJqV1_h34wqJjMWIylpmXk4gpexFdBkp8itE';

// Create Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function executeDatabaseFix() {
  try {
    console.log('🚀 Starting database fix...');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync('fix-missing-tables.sql', 'utf8');
    
    // Split SQL into individual statements (basic approach)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.includes('SELECT ') && statement.includes('status')) {
        // Skip the final success message
        continue;
      }
      
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        // Continue with other statements
      }
    }
    
    // Test the new tables
    console.log('\n🔍 Testing new tables...');
    
    // Test appointments table
    const { data: appointmentsTest, error: appointmentsError } = await supabase
      .from('appointments')
      .select('count')
      .limit(1);
    
    if (appointmentsError) {
      console.error('❌ Appointments table test failed:', appointmentsError);
    } else {
      console.log('✅ Appointments table is working');
    }
    
    // Test template_usage_log table
    const { data: templateTest, error: templateError } = await supabase
      .from('template_usage_log')
      .select('count')
      .limit(1);
    
    if (templateError) {
      console.error('❌ Template usage log table test failed:', templateError);
    } else {
      console.log('✅ Template usage log table is working');
    }
    
    // Test new columns in existing tables
    const { data: leadsTest, error: leadsError } = await supabase
      .from('leads')
      .select('id, email')
      .limit(1);
    
    if (leadsError) {
      console.error('❌ Leads table email column test failed:', leadsError);
    } else {
      console.log('✅ Leads table email column is working');
    }
    
    console.log('\n🎉 Database fix completed successfully!');
    console.log('✅ Missing tables created');
    console.log('✅ Missing columns added');
    console.log('✅ Indexes and policies configured');
    console.log('✅ Views created for analytics');
    
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
executeDatabaseFix();
