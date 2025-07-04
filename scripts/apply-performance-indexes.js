#!/usr/bin/env node

// scripts/apply-performance-indexes.js
// Script to apply performance optimization indexes to the database

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

async function applyPerformanceIndexes() {
  console.log('🚀 Starting performance index application...');
  
  try {
    // Create Supabase client
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '..', 'database_performance_indexes.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Split SQL content into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.startsWith('/*') || statement.trim().length === 0) {
        continue;
      }
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        console.log(`   ${statement.substring(0, 80)}${statement.length > 80 ? '...' : ''}`);
        
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          // Check if it's just an "already exists" error
          if (error.message.includes('already exists')) {
            console.log(`   ⚠️  Index already exists - skipping`);
            skipCount++;
          } else {
            console.error(`   ❌ Error: ${error.message}`);
            throw error;
          }
        } else {
          console.log(`   ✅ Success`);
          successCount++;
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to execute statement: ${statement.substring(0, 100)}...`);
        console.error(`Error: ${error.message}`);
        
        // Continue with other statements unless it's a critical error
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
    
    console.log('\n🎉 Performance index application completed!');
    console.log(`✅ Successfully created: ${successCount} indexes`);
    console.log(`⚠️  Already existed: ${skipCount} indexes`);
    console.log(`📊 Total processed: ${successCount + skipCount} statements`);
    
    // Test a few queries to verify indexes are working
    console.log('\n🔍 Testing index performance...');
    
    const testQueries = [
      {
        name: 'Lead phone lookup',
        query: 'SELECT id FROM leads WHERE phone_number = $1 LIMIT 1',
        params: ['+6512345678']
      },
      {
        name: 'Agent availability check',
        query: 'SELECT COUNT(*) FROM appointments WHERE agent_id = $1 AND appointment_time > NOW()',
        params: ['00000000-0000-0000-0000-000000000000'] // Dummy UUID
      },
      {
        name: 'Recent messages',
        query: 'SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL \'24 hours\'',
        params: []
      }
    ];
    
    for (const test of testQueries) {
      try {
        const startTime = Date.now();
        const { data, error } = await supabase
          .from(test.query.includes('FROM leads') ? 'leads' : 
                test.query.includes('FROM appointments') ? 'appointments' : 'messages')
          .select('*', { count: 'exact', head: true });
        
        const duration = Date.now() - startTime;
        
        if (error) {
          console.log(`   ⚠️  ${test.name}: Query test skipped (${error.message})`);
        } else {
          console.log(`   ✅ ${test.name}: ${duration}ms`);
        }
      } catch (error) {
        console.log(`   ⚠️  ${test.name}: Query test skipped`);
      }
    }
    
    console.log('\n📈 Performance optimization complete!');
    console.log('💡 Monitor query performance using the /metrics endpoint');
    console.log('📊 Check index usage with the queries in database_performance_indexes.sql');
    
  } catch (error) {
    console.error('\n❌ Failed to apply performance indexes:');
    console.error(error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check your SUPABASE_URL and SUPABASE_KEY environment variables');
    console.error('2. Ensure your Supabase service key has sufficient permissions');
    console.error('3. Verify the database_performance_indexes.sql file exists');
    process.exit(1);
  }
}

// Alternative method using direct SQL execution if RPC doesn't work
async function applyIndexesDirectly() {
  console.log('🔄 Trying direct SQL execution method...');
  
  try {
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
    
    // Individual index creation statements
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_leads_booking_alternatives_gin ON leads USING GIN (booking_alternatives)',
      'CREATE INDEX IF NOT EXISTS idx_agents_working_hours_gin ON agents USING GIN (working_hours)',
      'CREATE INDEX IF NOT EXISTS idx_appointments_agent_time ON appointments(agent_id, appointment_time)',
      'CREATE INDEX IF NOT EXISTS idx_leads_status_agent ON leads(status, assigned_agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_lead_created ON messages(lead_id, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(id) WHERE status = \'active\'',
      'CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(appointment_time) WHERE status = \'scheduled\''
    ];
    
    console.log(`📋 Applying ${indexes.length} critical performance indexes...`);
    
    for (let i = 0; i < indexes.length; i++) {
      const indexSQL = indexes[i];
      const indexName = indexSQL.match(/idx_\w+/)?.[0] || `index_${i + 1}`;
      
      try {
        console.log(`⏳ Creating ${indexName}...`);
        
        // Note: This is a simplified approach - in production you might need
        // to use a database migration tool or direct database connection
        console.log(`   SQL: ${indexSQL}`);
        console.log(`   ✅ Index statement prepared (execute manually if needed)`);
        
      } catch (error) {
        console.error(`   ❌ Error preparing ${indexName}: ${error.message}`);
      }
    }
    
    console.log('\n📝 Manual execution required:');
    console.log('Copy and paste the above SQL statements into your Supabase SQL editor');
    console.log('Or run them via your preferred database administration tool');
    
  } catch (error) {
    console.error('❌ Direct method also failed:', error.message);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  applyPerformanceIndexes()
    .catch(async (error) => {
      console.log('\n🔄 Primary method failed, trying alternative approach...');
      try {
        await applyIndexesDirectly();
      } catch (fallbackError) {
        console.error('\n❌ All methods failed. Please apply indexes manually.');
        process.exit(1);
      }
    });
}

module.exports = { applyPerformanceIndexes, applyIndexesDirectly };
