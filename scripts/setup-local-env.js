#!/usr/bin/env node

/**
 * Setup Local Environment Script
 * Copies production environment variables to local development setup
 * with safety flags enabled
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function promptForEnvVar(rl, varName, description, currentValue = '') {
  return new Promise((resolve) => {
    const prompt = currentValue 
      ? `${varName} (${description}) [current: ${currentValue.substring(0, 20)}...]: `
      : `${varName} (${description}): `;
    
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || currentValue);
    });
  });
}

async function setupEnvironmentVariables() {
  log('🔧 Setting up local development environment variables', 'bright');
  log('This will use your production keys with safety flags enabled', 'cyan');
  log('=' .repeat(60), 'blue');
  
  const rl = createInterface();
  const envVars = {};
  
  try {
    // Database Configuration
    log('\n📊 Database Configuration:', 'bright');
    envVars.SUPABASE_URL = await promptForEnvVar(rl, 'SUPABASE_URL', 'Supabase project URL');
    envVars.SUPABASE_KEY = await promptForEnvVar(rl, 'SUPABASE_KEY', 'Supabase service role key');
    envVars.SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_KEY;
    envVars.SUPABASE_ANON_KEY = await promptForEnvVar(rl, 'SUPABASE_ANON_KEY', 'Supabase anon key');
    envVars.DATABASE_URL = await promptForEnvVar(rl, 'DATABASE_URL', 'Database connection URL');
    
    // API Keys
    log('\n🔑 API Keys:', 'bright');
    envVars.OPENAI_API_KEY = await promptForEnvVar(rl, 'OPENAI_API_KEY', 'OpenAI API key');
    envVars.GUPSHUP_API_KEY = await promptForEnvVar(rl, 'GUPSHUP_API_KEY', 'Gupshup API key');
    envVars.GUPSHUP_APP_NAME = await promptForEnvVar(rl, 'GUPSHUP_APP_NAME', 'Gupshup app name');
    envVars.GUPSHUP_PARTNER_EMAIL = await promptForEnvVar(rl, 'GUPSHUP_PARTNER_EMAIL', 'Gupshup partner email');
    envVars.GUPSHUP_PARTNER_PASSWORD = await promptForEnvVar(rl, 'GUPSHUP_PARTNER_PASSWORD', 'Gupshup partner password');
    
    // Google Services
    log('\n📅 Google Services:', 'bright');
    envVars.GOOGLE_CLIENT_ID = await promptForEnvVar(rl, 'GOOGLE_CLIENT_ID', 'Google OAuth client ID');
    envVars.GOOGLE_CLIENT_SECRET = await promptForEnvVar(rl, 'GOOGLE_CLIENT_SECRET', 'Google OAuth client secret');
    
    // Zoom
    log('\n🎥 Zoom Integration:', 'bright');
    envVars.ZOOM_ACCOUNT_ID = await promptForEnvVar(rl, 'ZOOM_ACCOUNT_ID', 'Zoom account ID');
    envVars.ZOOM_CLIENT_ID = await promptForEnvVar(rl, 'ZOOM_CLIENT_ID', 'Zoom client ID');
    envVars.ZOOM_CLIENT_SECRET = await promptForEnvVar(rl, 'ZOOM_CLIENT_SECRET', 'Zoom client secret');
    
    // Security
    log('\n🔒 Security:', 'bright');
    envVars.JWT_SECRET = await promptForEnvVar(rl, 'JWT_SECRET', 'JWT secret key');
    envVars.REFRESH_TOKEN_ENCRYPTION_KEY = await promptForEnvVar(rl, 'REFRESH_TOKEN_ENCRYPTION_KEY', 'Refresh token encryption key');
    envVars.WEBHOOK_SECRET_TOKEN = await promptForEnvVar(rl, 'WEBHOOK_SECRET_TOKEN', 'Webhook secret token');
    envVars.META_VERIFY_TOKEN = await promptForEnvVar(rl, 'META_VERIFY_TOKEN', 'Meta verify token');
    envVars.META_APP_SECRET = await promptForEnvVar(rl, 'META_APP_SECRET', 'Meta app secret');
    
    // Optional services
    log('\n🌐 Optional Services (press Enter to skip):', 'bright');
    envVars.SCRAPINGBEE_API_KEY = await promptForEnvVar(rl, 'SCRAPINGBEE_API_KEY', 'ScrapingBee API key (optional)');
    envVars.DEFAULT_AGENT_ID = await promptForEnvVar(rl, 'DEFAULT_AGENT_ID', 'Default agent ID (optional)');
    
    rl.close();
    
    // Create the .env file
    await createEnvFile(envVars);
    
  } catch (error) {
    rl.close();
    log(`❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function createEnvFile(envVars) {
  log('\n📝 Creating .env file...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const envPath = path.join(rootDir, '.env');
  
  // Read the template
  const templatePath = path.join(rootDir, '.env.development');
  let envContent = fs.readFileSync(templatePath, 'utf8');
  
  // Replace placeholders with actual values
  Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
      const regex = new RegExp(`${key}=.*`, 'g');
      envContent = envContent.replace(regex, `${key}=${value}`);
    }
  });
  
  // Write the .env file
  fs.writeFileSync(envPath, envContent);
  log('✅ .env file created successfully', 'green');
  
  // Create frontend .env.local
  const frontendDir = path.join(rootDir, 'frontend');
  const frontendEnvPath = path.join(frontendDir, '.env.local');
  const frontendTemplatePath = path.join(frontendDir, '.env.development');
  
  if (fs.existsSync(frontendTemplatePath)) {
    let frontendEnvContent = fs.readFileSync(frontendTemplatePath, 'utf8');
    
    // Update frontend-specific variables
    if (envVars.SUPABASE_URL) {
      frontendEnvContent = frontendEnvContent.replace(
        /NEXT_PUBLIC_SUPABASE_URL=.*/,
        `NEXT_PUBLIC_SUPABASE_URL=${envVars.SUPABASE_URL}`
      );
    }
    if (envVars.SUPABASE_ANON_KEY) {
      frontendEnvContent = frontendEnvContent.replace(
        /NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/,
        `NEXT_PUBLIC_SUPABASE_ANON_KEY=${envVars.SUPABASE_ANON_KEY}`
      );
    }
    
    fs.writeFileSync(frontendEnvPath, frontendEnvContent);
    log('✅ Frontend .env.local file created successfully', 'green');
  }
}

function displayInstructions() {
  log('\n🎉 Local development environment is ready!', 'green');
  log('\n🔒 Safety Features Enabled:', 'bright');
  log('  ✅ DISABLE_WHATSAPP_SENDING=true', 'green');
  log('  ✅ TESTING_MODE=true', 'green');
  log('  ✅ DRY_RUN_MODE=true', 'green');
  log('  ✅ MOCK_WHATSAPP_RESPONSES=true', 'green');
  
  log('\n🚀 Next Steps:', 'bright');
  log('  1. Run: npm run dev:full', 'cyan');
  log('  2. Open: http://localhost:3000', 'cyan');
  log('  3. Test your features safely!', 'cyan');
  
  log('\n⚠️  Important:', 'bright');
  log('  - All WhatsApp messages are disabled in development', 'yellow');
  log('  - You can test all other integrations normally', 'yellow');
  log('  - Database operations work with your production data', 'yellow');
  log('  - Changes are immediately visible with hot reload', 'yellow');
}

async function main() {
  log('🏗️  Real Estate Bot - Local Development Setup', 'bright');
  log('=' .repeat(60), 'blue');
  
  await setupEnvironmentVariables();
  displayInstructions();
}

if (require.main === module) {
  main().catch(error => {
    log(`❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main };
