#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Validates the Railway deployment configuration and dependencies
 */

const fs = require('fs');
const path = require('path');

const logger = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`)
};

const validateFile = (filePath, description) => {
  if (fs.existsSync(filePath)) {
    logger.success(`${description} exists: ${filePath}`);
    return true;
  } else {
    logger.error(`${description} missing: ${filePath}`);
    return false;
  }
};

const validateDeployment = () => {
  logger.info('🔍 Validating Railway deployment configuration...');
  
  let isValid = true;

  // Check core configuration files
  isValid &= validateFile('railway.toml', 'Railway configuration');
  isValid &= validateFile('package.json', 'Package configuration');
  isValid &= validateFile('frontend/next.config.js', 'Next.js configuration');
  isValid &= validateFile('scripts/railway-unified-server.js', 'Unified server script');

  // Check frontend build directory structure
  const frontendPath = path.join(__dirname, '../frontend');
  if (fs.existsSync(frontendPath)) {
    logger.success('Frontend directory exists');
    
    // Check if package.json exists in frontend
    if (fs.existsSync(path.join(frontendPath, 'package.json'))) {
      logger.success('Frontend package.json exists');
    } else {
      logger.error('Frontend package.json missing');
      isValid = false;
    }
  } else {
    logger.error('Frontend directory missing');
    isValid = false;
  }

  // Check backend API routes
  const apiPath = path.join(__dirname, '../api');
  if (fs.existsSync(apiPath)) {
    logger.success('API directory exists');
    
    const requiredRoutes = [
      'gupshup.js',
      'meta.js', 
      'test.js',
      'auth.js',
      'dashboard.js',
      'leads.js'
    ];

    requiredRoutes.forEach(route => {
      if (fs.existsSync(path.join(apiPath, route))) {
        logger.success(`API route exists: ${route}`);
      } else {
        logger.warn(`API route missing: ${route}`);
      }
    });
  } else {
    logger.error('API directory missing');
    isValid = false;
  }

  // Check services
  const servicesPath = path.join(__dirname, '../services');
  if (fs.existsSync(servicesPath)) {
    logger.success('Services directory exists');
  } else {
    logger.warn('Services directory missing');
  }

  // Validate package.json scripts
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredScripts = [
      'build:unified',
      'start:unified',
      'build:frontend',
      'build:backend'
    ];

    requiredScripts.forEach(script => {
      if (packageJson.scripts && packageJson.scripts[script]) {
        logger.success(`Script exists: ${script}`);
      } else {
        logger.error(`Script missing: ${script}`);
        isValid = false;
      }
    });
  } catch (error) {
    logger.error('Failed to parse package.json');
    isValid = false;
  }

  // Check environment variables template
  logger.info('📋 Required environment variables for Railway dashboard:');
  const envVars = [
    'SUPABASE_URL',
    'SUPABASE_KEY', 
    'DATABASE_URL',
    'GUPSHUP_API_KEY',
    'OPENAI_API_KEY',
    'JWT_SECRET',
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_WS_URL'
  ];

  envVars.forEach(envVar => {
    logger.info(`   ${envVar}=${process.env[envVar] ? '✓ Set' : '✗ Not set'}`);
  });

  // Final validation result
  if (isValid) {
    logger.success('🎉 Deployment configuration is valid!');
    logger.info('📝 Next steps:');
    logger.info('   1. Set environment variables in Railway dashboard');
    logger.info('   2. Push to GitHub to trigger Railway deployment');
    logger.info('   3. Monitor deployment logs for any issues');
    return true;
  } else {
    logger.error('💥 Deployment configuration has issues that need to be fixed');
    return false;
  }
};

// Run validation
if (require.main === module) {
  const isValid = validateDeployment();
  process.exit(isValid ? 0 : 1);
}

module.exports = { validateDeployment };
