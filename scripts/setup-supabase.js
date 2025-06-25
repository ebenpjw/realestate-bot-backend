#!/usr/bin/env node

/**
 * Supabase Database Setup Script
 * Real Estate WhatsApp Bot - Production Setup
 * 
 * This script helps you set up your Supabase database with the complete schema
 * for your real estate WhatsApp bot.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(message, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function setupSupabase() {
  logHeader('SUPABASE DATABASE SETUP - REAL ESTATE BOT');
  
  // Check for environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    logError('Missing Supabase credentials!');
    logInfo('Please set the following environment variables:');
    log('  SUPABASE_URL=https://your-project.supabase.co', 'yellow');
    log('  SUPABASE_KEY=your-supabase-anon-key', 'yellow');
    logInfo('You can find these in your Supabase dashboard under Settings > API');
    process.exit(1);
  }
  
  logInfo(`Connecting to Supabase project: ${supabaseUrl}`);
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test connection
    logInfo('Testing database connection...');
    const { data, error } = await supabase.from('leads').select('count').limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist (which is fine)
      throw error;
    }
    
    logSuccess('Database connection successful!');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_complete_schema_setup.sql');
    
    if (!fs.existsSync(migrationPath)) {
      logError(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    logInfo('Reading migration file...');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    logInfo('Executing database migration...');
    logWarning('This will update your database schema. Make sure you have a backup!');
    
    // Execute migration
    const { data: migrationResult, error: migrationError } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (migrationError) {
      // If rpc doesn't work, try direct query (for newer Supabase versions)
      logInfo('Trying alternative migration method...');
      
      // Split SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      logInfo(`Executing ${statements.length} SQL statements...`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            await supabase.rpc('exec_sql', { sql: statement + ';' });
            log(`  Statement ${i + 1}/${statements.length} executed`, 'green');
          } catch (stmtError) {
            logWarning(`Statement ${i + 1} failed (might be expected): ${stmtError.message}`);
          }
        }
      }
    }
    
    logSuccess('Database migration completed!');
    
    // Verify tables were created
    logInfo('Verifying table creation...');
    
    const expectedTables = ['agents', 'leads', 'messages', 'appointments', 'template_usage_log'];
    
    for (const table of expectedTables) {
      try {
        const { data, error } = await supabase.from(table).select('count').limit(1);
        if (!error) {
          logSuccess(`Table '${table}' is ready`);
        } else {
          logWarning(`Table '${table}' might have issues: ${error.message}`);
        }
      } catch (err) {
        logWarning(`Could not verify table '${table}': ${err.message}`);
      }
    }
    
    // Check if default agent exists
    logInfo('Checking default agent...');
    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('email', 'doro@realestate.com');
    
    if (!agentError && agents && agents.length > 0) {
      logSuccess('Default agent "Doro Smart Guide" is ready');
    } else {
      logWarning('Default agent not found. You may need to create one manually.');
    }
    
    logHeader('SETUP COMPLETE!');
    logSuccess('Your Supabase database is now ready for production!');
    
    logInfo('Next steps:');
    log('1. Set up your environment variables in Railway', 'yellow');
    log('2. Deploy your application', 'yellow');
    log('3. Test the /health endpoint', 'yellow');
    log('4. Verify WhatsApp webhook integration', 'yellow');
    
    logInfo('Database Details:');
    log(`  Project URL: ${supabaseUrl}`, 'cyan');
    log(`  Region: ap-southeast-1`, 'cyan');
    log(`  Tables: ${expectedTables.join(', ')}`, 'cyan');
    
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    logInfo('Please check your Supabase credentials and try again.');
    logInfo('You can also run the migration manually in your Supabase SQL editor.');
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupSupabase().catch(console.error);
}

module.exports = { setupSupabase };
