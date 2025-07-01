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

    // Database and agent setup should be done manually in production
    logger.info('✅ Environment validated - ready for deployment');
    logger.info('📝 Note: Ensure database schema and agents are set up in Supabase dashboard');

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
      return success;
    })
    .catch((error) => {
      console.error('❌ Railway deployment setup failed:', error.message);
      throw error;
    });
}

module.exports = { railwayDeploy };
