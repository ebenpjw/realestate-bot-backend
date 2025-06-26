/**
 * Railway Deployment Setup Script
 * Initializes database and creates default agent
 */

const logger = require('../logger');

async function railwayDeploy() {
  try {
    logger.info('🚀 Starting Railway deployment setup...');

    // Check critical environment variables
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_KEY',
      'DATABASE_URL',
      'GUPSHUP_API_KEY',
      'OPENAI_API_KEY'
    ];

    logger.info('🔍 Checking environment variables...');
    const missingVars = [];

    requiredEnvVars.forEach(varName => {
      if (!process.env[varName]) {
        missingVars.push(varName);
        logger.warn(`❌ Missing: ${varName}`);
      } else {
        logger.info(`✅ Found: ${varName}`);
      }
    });

    if (missingVars.length > 0) {
      logger.error({ missingVars }, 'Missing required environment variables');
      throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    // 1. Setup Supabase database
    logger.info('📊 Setting up Supabase database...');
    const { setupSupabase } = require('./setup-supabase');
    await setupSupabase();

    // 2. Create default agent
    logger.info('👤 Creating default agent...');
    const { createDefaultAgent } = require('./create-default-agent');
    const agent = await createDefaultAgent();

    // 3. Assign agents to existing leads (only if agent was created/found)
    if (agent) {
      logger.info('🔗 Assigning agents to leads...');
      const { assignAgentsToLeads } = require('./assign-agents-to-leads');
      await assignAgentsToLeads();
    } else {
      logger.warn('⚠️ Skipping lead assignment - no active agent available');
    }

    logger.info('✅ Railway deployment setup completed successfully!');
    return true;

  } catch (error) {
    logger.error({ err: error }, '❌ Railway deployment setup failed');
    // Don't throw error to prevent deployment failure
    logger.warn('⚠️ Continuing deployment despite setup issues...');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  railwayDeploy()
    .then((success) => {
      if (success) {
        console.log('✅ Railway deployment setup completed');
      } else {
        console.log('⚠️ Railway deployment setup had issues but continuing...');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Railway deployment setup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { railwayDeploy };
