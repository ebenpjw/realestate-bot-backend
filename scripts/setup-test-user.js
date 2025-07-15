#!/usr/bin/env node

/**
 * Setup Test User Script
 * Creates a test user for integration testing
 */

const bcrypt = require('bcrypt');
const databaseService = require('../services/databaseService');
const logger = require('../logger');

async function setupTestUser() {
  try {
    logger.info('🔧 Setting up test user for integration tests...');

    const testEmail = 'test.agent@propertyhub.com';
    const testPassword = 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Check if test user already exists
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('*')
      .eq('email', testEmail)
      .single();

    if (existingAgent) {
      logger.info('✅ Test user already exists, updating password...');

      // Update password
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          password_hash: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('email', testEmail);

      if (updateError) {
        throw updateError;
      }
    } else {
      logger.info('👤 Creating new test user...');

      // Create test agent with password
      const { data: newAgent, error: agentError } = await supabase
        .from('agents')
        .insert({
          full_name: 'Test Agent',
          email: testEmail,
          phone_number: '+6599999999',
          status: 'active',
          password_hash: hashedPassword,
          role: 'agent',
          organization_id: 'dba41bdd-2a1c-4c83-9fc6-0f2e758f026a', // Use existing org
          waba_phone_number: '+6599999999',
          waba_display_name: 'Test Agent Bot',
          bot_name: 'TestBot',
          working_hours: {
            start: 9,
            end: 18,
            days: [1, 2, 3, 4, 5]
          },
          timezone: 'Asia/Singapore'
        })
        .select()
        .single();

      if (agentError) {
        throw agentError;
      }
    }

    logger.info('✅ Test user setup complete!');
    logger.info(`📧 Email: ${testEmail}`);
    logger.info(`🔑 Password: ${testPassword}`);
    
    logger.info('✅ Test user ready for integration tests!');

  } catch (error) {
    logger.error({ err: error }, '❌ Failed to setup test user');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupTestUser().then(() => {
    logger.info('🎉 Test user setup complete!');
    process.exit(0);
  }).catch(error => {
    logger.error({ err: error }, 'Test user setup failed');
    process.exit(1);
  });
}

module.exports = { setupTestUser };
