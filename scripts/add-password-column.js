#!/usr/bin/env node

/**
 * Add password_hash column to agents table
 * Required for frontend authentication integration
 */

const supabase = require('../supabaseClient');
const logger = require('../logger');

async function addPasswordColumn() {
  try {
    logger.info('🔧 Adding password_hash column to agents table...');

    // Add password_hash column
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE agents 
        ADD COLUMN IF NOT EXISTS password_hash TEXT,
        ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('agent', 'admin'));
      `
    });

    if (alterError) {
      // Try alternative approach using direct SQL
      logger.warn('RPC failed, trying direct approach...');
      
      // Since we can't execute DDL directly, let's check if we can use the Supabase dashboard
      logger.info('⚠️  Please add the following columns to the agents table manually:');
      logger.info('   - password_hash TEXT');
      logger.info('   - role VARCHAR(20) DEFAULT \'agent\' CHECK (role IN (\'agent\', \'admin\'))');
      logger.info('');
      logger.info('You can do this in the Supabase dashboard SQL editor:');
      logger.info('ALTER TABLE agents ADD COLUMN password_hash TEXT;');
      logger.info('ALTER TABLE agents ADD COLUMN role VARCHAR(20) DEFAULT \'agent\' CHECK (role IN (\'agent\', \'admin\'));');
      
      return false;
    }

    logger.info('✅ Password column added successfully!');
    return true;

  } catch (error) {
    logger.error({ err: error }, '❌ Failed to add password column');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  addPasswordColumn().then((success) => {
    if (success) {
      logger.info('🎉 Database migration complete!');
      process.exit(0);
    } else {
      logger.error('💥 Database migration failed. Please add columns manually.');
      process.exit(1);
    }
  }).catch(error => {
    logger.error({ err: error }, 'Database migration crashed');
    process.exit(1);
  });
}

module.exports = { addPasswordColumn };
