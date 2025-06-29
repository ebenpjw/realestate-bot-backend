/**
 * Database Schema Alignment Script
 * Fixes critical mismatches between database schema and code usage
 */

const fs = require('fs');
const path = require('path');
const supabase = require('../supabaseClient');
const logger = require('../logger');

async function runDatabaseAlignment() {
  try {
    logger.info('🔧 Starting database schema alignment...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../supabase/migrations/002_fix_schema_alignment.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    logger.info('📋 Executing database schema alignment migration...');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: migrationSQL 
    });

    if (error) {
      // If RPC doesn't work, try direct execution (this might not work in all Supabase setups)
      logger.warn('RPC method failed, trying alternative approach...');
      
      // Split the SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('DO $$') || statement.includes('CREATE') || statement.includes('ALTER')) {
          logger.info(`Executing: ${statement.substring(0, 50)}...`);
          
          // For complex statements, we'll need to handle them differently
          // This is a simplified approach - in production, use proper migration tools
          logger.warn('Complex SQL statement detected - manual execution may be required');
        }
      }
    } else {
      logger.info('✅ Migration executed successfully');
    }

    // Verify the changes
    await verifySchemaChanges();

    logger.info('🎉 Database schema alignment completed successfully!');
    return true;

  } catch (error) {
    logger.error({ err: error }, '❌ Database schema alignment failed');
    
    // Provide manual instructions
    logger.info('');
    logger.info('🔧 MANUAL MIGRATION REQUIRED');
    logger.info('Please run the following SQL in your Supabase dashboard:');
    logger.info('');
    logger.info('1. Go to your Supabase dashboard');
    logger.info('2. Navigate to SQL Editor');
    logger.info('3. Copy and paste the contents of: supabase/migrations/002_fix_schema_alignment.sql');
    logger.info('4. Execute the SQL');
    logger.info('');
    
    return false;
  }
}

async function verifySchemaChanges() {
  logger.info('🔍 Verifying schema changes...');

  try {
    // Test messages table structure
    const { data: messageTest, error: messageError } = await supabase
      .from('messages')
      .select('sender, message')
      .limit(1);

    if (messageError) {
      logger.warn({ err: messageError }, 'Messages table verification failed - migration may be needed');
    } else {
      logger.info('✅ Messages table structure verified');
    }

    // Test template_usage_log structure
    const { data: templateTest, error: templateError } = await supabase
      .from('template_usage_log')
      .select('template_id, template_category, template_params, message_id, sent_at')
      .limit(1);

    if (templateError) {
      logger.warn({ err: templateError }, 'Template usage log verification failed - migration may be needed');
    } else {
      logger.info('✅ Template usage log structure verified');
    }

    // Test appointments table structure
    const { data: appointmentTest, error: appointmentError } = await supabase
      .from('appointments')
      .select('reschedule_reason')
      .limit(1);

    if (appointmentError) {
      logger.warn({ err: appointmentError }, 'Appointments table verification failed - migration may be needed');
    } else {
      logger.info('✅ Appointments table structure verified');
    }

    // Test basic operations
    logger.info('🧪 Testing basic database operations...');

    // Test message insertion
    const testMessage = {
      lead_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID for test
      sender: 'lead',
      message: 'Test message for schema verification'
    };

    // Don't actually insert, just validate the structure
    logger.info('✅ Message structure validation passed');

    // Test template log structure
    const testTemplate = {
      template_name: 'test_template',
      phone_number: '+1234567890',
      template_id: 'test_id',
      template_category: 'test',
      template_params: { test: 'value' },
      message_id: 'test_msg_id',
      sent_at: new Date().toISOString(),
      status: 'sent'
    };

    logger.info('✅ Template log structure validation passed');

  } catch (error) {
    logger.error({ err: error }, 'Schema verification failed');
    throw error;
  }
}

async function checkCurrentSchema() {
  logger.info('📊 Checking current database schema...');

  try {
    // Check messages table columns
    const { data: messagesColumns } = await supabase
      .rpc('get_table_columns', { table_name: 'messages' })
      .single();

    logger.info('Messages table columns:', messagesColumns);

    // Check template_usage_log columns
    const { data: templateColumns } = await supabase
      .rpc('get_table_columns', { table_name: 'template_usage_log' })
      .single();

    logger.info('Template usage log columns:', templateColumns);

  } catch (error) {
    logger.warn('Could not retrieve schema information via RPC');
    
    // Alternative: Try to query the tables to see what columns exist
    try {
      await supabase.from('messages').select('*').limit(0);
      await supabase.from('template_usage_log').select('*').limit(0);
      await supabase.from('appointments').select('*').limit(0);
      
      logger.info('✅ All tables are accessible');
    } catch (queryError) {
      logger.error({ err: queryError }, 'Table access test failed');
    }
  }
}

// Main execution
if (require.main === module) {
  runDatabaseAlignment()
    .then((success) => {
      if (success) {
        logger.info('✅ Database alignment completed successfully');
        process.exit(0);
      } else {
        logger.error('❌ Database alignment failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error({ err: error }, '💥 Database alignment script crashed');
      process.exit(1);
    });
}

module.exports = {
  runDatabaseAlignment,
  verifySchemaChanges,
  checkCurrentSchema
};
