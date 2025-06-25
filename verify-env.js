// verify-env.js - Environment variable verification script
const config = require('./config');
const logger = require('./logger');

async function verifyEnvironmentVariables() {
  logger.info('🔍 Verifying environment variables...');
  
  const requiredVars = {
    // Database
    'SUPABASE_URL': config.SUPABASE_URL,
    'SUPABASE_KEY': config.SUPABASE_KEY,
    
    // WhatsApp/Gupshup
    'WABA_NUMBER': config.WABA_NUMBER,
    'GUPSHUP_API_KEY': config.GUPSHUP_API_KEY,
    
    // AI
    'OPENAI_API_KEY': config.OPENAI_API_KEY,
    
    // Security
    'REFRESH_TOKEN_ENCRYPTION_KEY': config.REFRESH_TOKEN_ENCRYPTION_KEY,
    'WEBHOOK_SECRET_TOKEN': config.WEBHOOK_SECRET_TOKEN,
    
    // Meta
    'META_VERIFY_TOKEN': config.META_VERIFY_TOKEN,
    'META_APP_SECRET': config.META_APP_SECRET,
    
    // Google OAuth
    'GOOGLE_CLIENT_ID': config.GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': config.GOOGLE_CLIENT_SECRET,
    
    // Zoom OAuth
    'ZOOM_CLIENT_ID': config.ZOOM_CLIENT_ID,
    'ZOOM_CLIENT_SECRET': config.ZOOM_CLIENT_SECRET
  };
  
  const missing = [];
  const present = [];
  const invalid = [];
  
  for (const [name, value] of Object.entries(requiredVars)) {
    if (!value) {
      missing.push(name);
    } else {
      present.push(name);
      
      // Additional validation for specific variables
      if (name === 'REFRESH_TOKEN_ENCRYPTION_KEY' && value.length !== 64) {
        invalid.push(`${name} (must be 64 characters, got ${value.length})`);
      }
      
      if (name === 'WABA_NUMBER' && !/^\d{10,15}$/.test(value)) {
        invalid.push(`${name} (invalid phone number format)`);
      }
    }
  }
  
  // Log results
  logger.info(`✅ Present variables (${present.length}): ${present.join(', ')}`);
  
  if (missing.length > 0) {
    logger.error(`❌ Missing variables (${missing.length}): ${missing.join(', ')}`);
  }
  
  if (invalid.length > 0) {
    logger.error(`⚠️  Invalid variables (${invalid.length}): ${invalid.join(', ')}`);
  }
  
  // Test database connection
  await testDatabaseConnection();

  // Test WhatsApp service configuration
  await testWhatsAppConfiguration();
  
  return {
    present: present.length,
    missing: missing.length,
    invalid: invalid.length,
    allValid: missing.length === 0 && invalid.length === 0
  };
}

async function testDatabaseConnection() {
  try {
    const supabase = require('./supabaseClient');
    const { data, error } = await supabase.from('leads').select('count').limit(1);
    
    if (error) {
      logger.error({ err: error }, '❌ Database connection failed');
    } else {
      logger.info('✅ Database connection successful');
    }
  } catch (error) {
    logger.error({ err: error }, '❌ Database connection test failed');
  }
}

async function testWhatsAppConfiguration() {
  try {
    const whatsappService = require('./services/whatsappService');
    const healthCheck = await whatsappService.healthCheck();
    
    if (healthCheck.status === 'healthy') {
      logger.info('✅ WhatsApp service configuration valid');
    } else {
      logger.error({ healthCheck }, '❌ WhatsApp service configuration invalid');
    }
  } catch (error) {
    logger.error({ err: error }, '❌ WhatsApp service test failed');
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyEnvironmentVariables()
    .then(result => {
      if (result.allValid) {
        logger.info('🎉 All environment variables are properly configured!');
        process.exit(0);
      } else {
        logger.error('💥 Environment configuration issues detected');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error({ err: error }, '💥 Environment verification failed');
      process.exit(1);
    });
}

module.exports = { verifyEnvironmentVariables };
