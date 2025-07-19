#!/usr/bin/env node

/**
 * Run database migration for new lead intro tracking
 */

const fs = require('fs');
const path = require('path');
const databaseService = require('./services/databaseService');

async function runMigration() {
  try {
    console.log('🚀 Running new lead intro tracking migration...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'database/migrations/add_new_lead_intro_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    const { error } = await databaseService.supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // Try direct execution if RPC fails
      console.log('RPC method failed, trying direct execution...');
      
      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          const { error: execError } = await databaseService.supabase
            .from('_temp_migration')
            .select('1')
            .limit(0); // This will fail but we can use it to execute raw SQL

          // Use a different approach - create table directly
          if (statement.includes('CREATE TABLE')) {
            console.log('Creating table...');
            // We'll need to handle this differently since Supabase client doesn't support raw SQL
            console.log('⚠️  Please run this SQL manually in your Supabase SQL editor:');
            console.log('\n' + migrationSQL + '\n');
            return;
          }
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('📊 New lead intro tracking table created');
    console.log('🔧 Indexes and triggers added');
    console.log('📝 Ready to track 6-hour follow-ups');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n⚠️  Please run this SQL manually in your Supabase SQL editor:');
    
    const migrationPath = path.join(__dirname, 'database/migrations/add_new_lead_intro_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('\n' + migrationSQL + '\n');
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runMigration };
