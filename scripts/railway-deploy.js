#!/usr/bin/env node

/**
 * Railway Deployment Helper Script
 * Ensures proper environment setup before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Railway Deployment Helper');
console.log('============================');

// Check if we're in production
if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️  Warning: NODE_ENV is not set to production');
}

// Verify critical environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'GUPSHUP_API_KEY',
  'OPENAI_API_KEY',
  'META_VERIFY_TOKEN'
];

console.log('\n🔍 Checking environment variables...');
let missingVars = [];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
    console.log(`❌ Missing: ${varName}`);
  } else {
    console.log(`✅ Found: ${varName}`);
  }
});

if (missingVars.length > 0) {
  console.log(`\n⚠️  Warning: ${missingVars.length} environment variables are missing`);
  console.log('Make sure to set these in Railway dashboard:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
} else {
  console.log('\n✅ All required environment variables are set');
}

// Check package.json
console.log('\n📦 Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.scripts && packageJson.scripts.start) {
    console.log('✅ Start script found');
  } else {
    console.log('❌ No start script found in package.json');
  }
  
  if (packageJson.engines && packageJson.engines.node) {
    console.log(`✅ Node.js version specified: ${packageJson.engines.node}`);
  } else {
    console.log('⚠️  No Node.js version specified in engines');
  }
  
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
}

// Check for lock file
console.log('\n🔒 Checking lock files...');
if (fs.existsSync('package-lock.json')) {
  console.log('✅ package-lock.json found');
} else if (fs.existsSync('yarn.lock')) {
  console.log('✅ yarn.lock found');
} else {
  console.log('⚠️  No lock file found - this might cause dependency issues');
}

console.log('\n🎯 Deployment readiness check complete!');
console.log('If you see any ❌ or ⚠️  above, please address them before deploying.');
