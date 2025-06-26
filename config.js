// config.js
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file (if it exists)
const result = dotenv.config({ path: path.resolve(__dirname, '.env') });

if (result.error) {
  if (process.env.NODE_ENV !== 'production') {
    const errorMessage = "⚠️ FATAL: Could not find .env file. Please ensure it exists in the project root.";
    console.error(errorMessage, result.error);
    throw new Error(errorMessage);
  } else {
    console.log("ℹ️ No .env file found - using environment variables from Railway");
  }
}

// Helper function to parse boolean environment variables
const parseBoolean = (value, defaultValue = false) => {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return defaultValue;
};

// Helper function to parse integer environment variables
const parseInteger = (value, defaultValue = 0) => {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to parse float environment variables
const parseFloatEnv = (value, defaultValue = 0.0) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const config = {
  // Server Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInteger(process.env.PORT, 8080),

  // Feature flags
  ENABLE_RATE_LIMITING: parseBoolean(process.env.ENABLE_RATE_LIMITING, true),
  ENABLE_CACHING: parseBoolean(process.env.ENABLE_CACHING, true),
  ENABLE_REQUEST_LOGGING: parseBoolean(process.env.ENABLE_REQUEST_LOGGING, true),

  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  SUPABASE_TIMEOUT: parseInteger(process.env.SUPABASE_TIMEOUT, 10000),

  // Gupshup Configuration
  WABA_NUMBER: process.env.WABA_NUMBER,
  GUPSHUP_API_KEY: process.env.GUPSHUP_API_KEY,
  GUPSHUP_API_SECRET: process.env.GUPSHUP_API_SECRET,
  GUPSHUP_TIMEOUT: parseInteger(process.env.GUPSHUP_TIMEOUT, 10000),

  // Meta (Facebook) Configuration
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
  META_APP_SECRET: process.env.META_APP_SECRET,
  META_TIMEOUT: parseInteger(process.env.META_TIMEOUT, 10000),

  // OpenAI Configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TEMPERATURE: parseFloatEnv(process.env.OPENAI_TEMPERATURE, 0.5),
  OPENAI_MAX_TOKENS: parseInteger(process.env.OPENAI_MAX_TOKENS, 1000),
  OPENAI_TIMEOUT: parseInteger(process.env.OPENAI_TIMEOUT, 30000),

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_TIMEOUT: parseInteger(process.env.GOOGLE_TIMEOUT, 15000),
  PRODUCTION_REDIRECT_URI: process.env.PRODUCTION_REDIRECT_URI ||
    'https://realestate-bot-backend-production.up.railway.app/api/auth/google/callback',

  // Zoom OAuth Configuration
  ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID,
  ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
  ZOOM_REDIRECT_URI: process.env.ZOOM_REDIRECT_URI,
  ZOOM_TIMEOUT: parseInteger(process.env.ZOOM_TIMEOUT, 15000),

  // Security & Encryption
  REFRESH_TOKEN_ENCRYPTION_KEY: process.env.REFRESH_TOKEN_ENCRYPTION_KEY,
  WEBHOOK_SECRET_TOKEN: process.env.WEBHOOK_SECRET_TOKEN,

  // CORS Configuration
  CORS_ORIGINS: process.env.CORS_ORIGINS ?
    process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) :
    ['http://localhost:3000'],
};

// --- Configuration Validation ---
const requiredConfig = {
  // Critical for basic functionality
  SUPABASE_URL: 'Database connection required',
  SUPABASE_KEY: 'Database authentication required',
  WABA_NUMBER: 'WhatsApp Business Account number required',
  GUPSHUP_API_KEY: 'Gupshup API access required',
  OPENAI_API_KEY: 'OpenAI API access required for AI responses',
  REFRESH_TOKEN_ENCRYPTION_KEY: 'Encryption key required for secure token storage',
  WEBHOOK_SECRET_TOKEN: 'Webhook security token required',

  // Required for specific features
  META_VERIFY_TOKEN: 'Meta webhook verification required',
  META_APP_SECRET: 'Meta webhook signature verification required',
  GOOGLE_CLIENT_ID: 'Google OAuth required for calendar integration',
  GOOGLE_CLIENT_SECRET: 'Google OAuth required for calendar integration',
  ZOOM_CLIENT_ID: 'Zoom OAuth required for meeting integration',
  ZOOM_CLIENT_SECRET: 'Zoom OAuth required for meeting integration'
};

// Validate required configuration
const missingConfig = [];
const configErrors = [];

Object.entries(requiredConfig).forEach(([key, description]) => {
  if (!config[key]) {
    missingConfig.push(key);
    configErrors.push(`${key}: ${description}`);
  }
});

// Additional validation
if (config.REFRESH_TOKEN_ENCRYPTION_KEY && config.REFRESH_TOKEN_ENCRYPTION_KEY.length !== 64) {
  configErrors.push('REFRESH_TOKEN_ENCRYPTION_KEY: Must be a 64-character hex string (32 bytes)');
}

if (config.PORT < 1 || config.PORT > 65535) {
  configErrors.push(`PORT: Must be between 1 and 65535, got ${config.PORT}`);
}

if (configErrors.length > 0) {
  console.error('🚫 CONFIGURATION ERRORS:');
  configErrors.forEach(error => console.error(`   - ${error}`));

  if (process.env.NODE_ENV === 'production') {
    const errorMessage = 'Configuration errors in production environment';
    console.error('Exiting due to configuration errors in production');
    throw new Error(errorMessage);
  } else {
    console.warn('⚠️  Continuing in development mode despite configuration errors');
  }
}

// Log successful configuration load
if (missingConfig.length === 0) {
  console.log('✅ Configuration loaded successfully');
} else {
  console.warn(`⚠️  Configuration loaded with ${missingConfig.length} missing optional values`);
}

module.exports = config;