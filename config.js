// config.js
const dotenv = require('dotenv');
const path = require('path');

const result = dotenv.config({ path: path.resolve(__dirname, '.env') });

if (result.error) {
  if (process.env.NODE_ENV !== 'production') {
    console.error("⚠️ FATAL: Could not find .env file. Please ensure it exists in the project root.", result.error);
    process.exit(1);
  }
}

const config = {
  // Server Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 8080,

  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,

  // Gupshup Configuration
  WABA_NUMBER: process.env.WABA_NUMBER,
  GUPSHUP_API_KEY: process.env.GUPSHUP_API_KEY,
  GUPSHUP_API_SECRET: process.env.GUPSHUP_API_SECRET,

  // Meta (Facebook) Configuration
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
  META_APP_SECRET: process.env.META_APP_SECRET,

  // OpenAI Configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.5,

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  PRODUCTION_REDIRECT_URI: 'https://realestate-bot-backend-production.up.railway.app/api/auth/google/callback',

  // Security & Encryption
  REFRESH_TOKEN_ENCRYPTION_KEY: process.env.REFRESH_TOKEN_ENCRYPTION_KEY,
  WEBHOOK_SECRET_TOKEN: process.env.WEBHOOK_SECRET_TOKEN,
};

// --- Configuration Validation ---
const requiredConfig = [
  'SUPABASE_URL', 'SUPABASE_KEY', 'WABA_NUMBER', 'GUPSHUP_API_KEY', 
  'OPENAI_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 
  'REFRESH_TOKEN_ENCRYPTION_KEY', 'META_VERIFY_TOKEN', 'META_APP_SECRET', 'WEBHOOK_SECRET_TOKEN'
];

const missingConfig = requiredConfig.filter(key => !config[key]);

if (missingConfig.length > 0) {
  console.error(`🚫 FATAL: Missing required environment variables: ${missingConfig.join(', ')}`);
  process.exit(1);
}

module.exports = config;