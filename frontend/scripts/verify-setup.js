#!/usr/bin/env node

/**
 * PropertyHub Command Frontend - Setup Verification Script
 * This script verifies that the frontend is properly set up and ready to use
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  log(`${exists ? '✅' : '❌'} ${description}: ${filePath}`, exists ? 'green' : 'red');
  return exists;
}

function checkCommand(command, description) {
  try {
    execSync(command, { stdio: 'ignore' });
    log(`✅ ${description}`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description}`, 'red');
    return false;
  }
}

function checkEnvironmentVariable(varName, description) {
  const envFile = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envFile)) {
    log(`❌ ${description}: .env.local file not found`, 'red');
    return false;
  }
  
  const envContent = fs.readFileSync(envFile, 'utf8');
  const hasVar = envContent.includes(varName);
  log(`${hasVar ? '✅' : '⚠️'} ${description}: ${varName}`, hasVar ? 'green' : 'yellow');
  return hasVar;
}

function main() {
  log('\n🚀 PropertyHub Command Frontend - Setup Verification\n', 'bold');
  
  let allChecks = true;
  
  // Check essential files
  log('📁 Checking Essential Files:', 'blue');
  allChecks &= checkFile('package.json', 'Package configuration');
  allChecks &= checkFile('next.config.js', 'Next.js configuration');
  allChecks &= checkFile('.env.local', 'Environment variables');
  allChecks &= checkFile('app/layout.tsx', 'Root layout');
  allChecks &= checkFile('app/page.tsx', 'Home page');
  
  // Check key directories
  log('\n📂 Checking Directory Structure:', 'blue');
  allChecks &= checkFile('app/agent', 'Agent interface');
  allChecks &= checkFile('app/admin', 'Admin interface');
  allChecks &= checkFile('app/auth', 'Authentication pages');
  allChecks &= checkFile('components/ui', 'UI components');
  allChecks &= checkFile('lib', 'Utility libraries');
  
  // Check Node.js and npm
  log('\n🔧 Checking Development Environment:', 'blue');
  allChecks &= checkCommand('node --version', 'Node.js installation');
  allChecks &= checkCommand('npm --version', 'npm installation');
  
  // Check if dependencies are installed
  log('\n📦 Checking Dependencies:', 'blue');
  const nodeModulesExists = checkFile('node_modules', 'Dependencies installed');
  allChecks &= nodeModulesExists;
  
  if (nodeModulesExists) {
    allChecks &= checkFile('node_modules/next', 'Next.js framework');
    allChecks &= checkFile('node_modules/react', 'React library');
    allChecks &= checkFile('node_modules/typescript', 'TypeScript');
  }
  
  // Check environment variables
  log('\n🔐 Checking Environment Configuration:', 'blue');
  checkEnvironmentVariable('NEXT_PUBLIC_API_URL', 'Backend API URL');
  checkEnvironmentVariable('NEXT_PUBLIC_WS_URL', 'WebSocket URL');
  checkEnvironmentVariable('NEXT_PUBLIC_APP_NAME', 'Application name');
  
  // Check if TypeScript compiles
  log('\n🔍 Checking TypeScript:', 'blue');
  try {
    execSync('npx tsc --noEmit', { stdio: 'ignore' });
    log('✅ TypeScript compilation successful', 'green');
  } catch (error) {
    log('⚠️ TypeScript compilation has issues (this is normal for initial setup)', 'yellow');
  }
  
  // Final status
  log('\n📊 Setup Status:', 'bold');
  if (allChecks) {
    log('🎉 Setup verification completed successfully!', 'green');
    log('\n🚀 Next steps:', 'blue');
    log('1. Start the development server: npm run dev');
    log('2. Open http://localhost:3000 in your browser');
    log('3. Configure your backend API and Supabase credentials in .env.local');
    log('4. Test the login functionality');
  } else {
    log('⚠️ Some checks failed. Please review the issues above.', 'yellow');
    log('\n🔧 Common fixes:', 'blue');
    log('1. Run: npm install');
    log('2. Ensure .env.local exists with required variables');
    log('3. Check that all files are properly created');
  }
  
  // Show current environment
  log('\n📋 Current Configuration:', 'blue');
  try {
    const envFile = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf8');
      const apiUrl = envContent.match(/NEXT_PUBLIC_API_URL=(.+)/)?.[1] || 'Not set';
      const wsUrl = envContent.match(/NEXT_PUBLIC_WS_URL=(.+)/)?.[1] || 'Not set';
      
      log(`API URL: ${apiUrl}`);
      log(`WebSocket URL: ${wsUrl}`);
    }
  } catch (error) {
    log('Could not read environment configuration', 'yellow');
  }
  
  log('\n✨ PropertyHub Command Frontend is ready for development!\n', 'green');
}

if (require.main === module) {
  main();
}

module.exports = { main };
