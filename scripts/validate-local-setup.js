#!/usr/bin/env node

/**
 * Validate Local Development Setup
 * Checks that the local development environment is properly configured
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description}`, 'red');
    return false;
  }
}

function checkEnvironmentFile() {
  log('\n📝 Checking environment configuration...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const envPath = path.join(rootDir, '.env');
  
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found', 'red');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'DISABLE_WHATSAPP_SENDING',
    'TESTING_MODE',
    'DRY_RUN_MODE',
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'OPENAI_API_KEY'
  ];
  
  let allPresent = true;
  requiredVars.forEach(varName => {
    if (envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=your_`)) {
      log(`✅ ${varName} configured`, 'green');
    } else {
      log(`❌ ${varName} missing or not configured`, 'red');
      allPresent = false;
    }
  });
  
  // Check development flags
  const developmentFlags = [
    { name: 'DISABLE_WHATSAPP_SENDING', expected: 'false' },
    { name: 'TESTING_MODE', expected: 'false' },
    { name: 'DRY_RUN_MODE', expected: 'false' }
  ];

  log('\n🚀 Checking development flags...', 'blue');
  developmentFlags.forEach(flag => {
    const regex = new RegExp(`${flag.name}=(.*)`, 'i');
    const match = envContent.match(regex);
    if (match && match[1].trim() === flag.expected) {
      log(`✅ ${flag.name}=${flag.expected} (Real testing enabled)`, 'green');
    } else {
      log(`⚠️  ${flag.name} should be ${flag.expected} for full testing`, 'yellow');
    }
  });
  
  return allPresent;
}

function checkDependencies() {
  log('\n📦 Checking dependencies...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'frontend');
  
  let allGood = true;
  
  // Check backend node_modules
  if (fs.existsSync(path.join(rootDir, 'node_modules'))) {
    log('✅ Backend dependencies installed', 'green');
  } else {
    log('❌ Backend dependencies missing - run npm install', 'red');
    allGood = false;
  }
  
  // Check frontend node_modules
  if (fs.existsSync(path.join(frontendDir, 'node_modules'))) {
    log('✅ Frontend dependencies installed', 'green');
  } else {
    log('❌ Frontend dependencies missing - run npm install in frontend/', 'red');
    allGood = false;
  }
  
  return allGood;
}

function checkPorts() {
  log('\n🌐 Checking port availability...', 'blue');
  
  const ports = [3000, 8080];
  let allAvailable = true;
  
  ports.forEach(port => {
    try {
      // Try to connect to the port
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        execSync(`netstat -an | findstr :${port}`, { stdio: 'pipe' });
        log(`⚠️  Port ${port} may be in use`, 'yellow');
      } else {
        execSync(`lsof -i :${port}`, { stdio: 'pipe' });
        log(`⚠️  Port ${port} may be in use`, 'yellow');
      }
    } catch (error) {
      // Port is available (command failed)
      log(`✅ Port ${port} available`, 'green');
    }
  });
  
  return allAvailable;
}

async function testDatabaseConnection() {
  log('\n🗄️  Testing database connection...', 'blue');
  
  try {
    // Load environment variables
    require('dotenv').config();
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    // Test connection with a simple query
    const { data, error } = await supabase
      .from('agents')
      .select('count')
      .limit(1);
    
    if (error) {
      log(`❌ Database connection failed: ${error.message}`, 'red');
      return false;
    }
    
    log('✅ Database connection successful', 'green');
    return true;
  } catch (error) {
    log(`❌ Database test failed: ${error.message}`, 'red');
    return false;
  }
}

function checkScripts() {
  log('\n🛠️  Checking development scripts...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const packageJsonPath = path.join(rootDir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    log('❌ package.json not found', 'red');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredScripts = [
    'dev:full',
    'dev:backend',
    'dev:frontend',
    'dev:setup',
    'dev:reset'
  ];
  
  let allPresent = true;
  requiredScripts.forEach(script => {
    if (packageJson.scripts && packageJson.scripts[script]) {
      log(`✅ ${script} script available`, 'green');
    } else {
      log(`❌ ${script} script missing`, 'red');
      allPresent = false;
    }
  });
  
  return allPresent;
}

function displayResults(results) {
  log('\n📊 Validation Results:', 'bright');
  log('=' .repeat(50), 'blue');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`${icon} ${result.name}`, color);
  });
  
  log(`\n📈 Score: ${passed}/${total} checks passed`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n🎉 Local development environment is ready!', 'green');
    log('\n⚠️  IMPORTANT: WhatsApp sending is ENABLED!', 'yellow');
    log('  - Real messages will be sent to real phone numbers', 'yellow');
    log('  - Use test numbers or your own number for safety', 'yellow');
    log('\n🚀 Next steps:', 'bright');
    log('  1. Run: npm run dev:full', 'cyan');
    log('  2. Open: http://localhost:3000', 'cyan');
    log('  3. Test with real phone numbers safely!', 'cyan');
  } else {
    log('\n⚠️  Some issues need to be resolved:', 'yellow');
    log('\n🔧 Suggested fixes:', 'bright');
    
    results.forEach(result => {
      if (!result.passed && result.fix) {
        log(`  - ${result.fix}`, 'cyan');
      }
    });
  }
}

async function main() {
  log('🔍 Validating Local Development Setup', 'bright');
  log('=' .repeat(60), 'blue');
  
  const results = [];
  
  // File checks
  const rootDir = path.join(__dirname, '..');
  results.push({
    name: 'Environment file exists',
    passed: checkFile(path.join(rootDir, '.env'), '.env file'),
    fix: 'Run: node scripts/setup-local-env.js'
  });
  
  results.push({
    name: 'Frontend environment file exists',
    passed: checkFile(path.join(rootDir, 'frontend/.env.local'), 'Frontend .env.local file'),
    fix: 'Run: npm run dev:setup'
  });
  
  // Environment configuration
  results.push({
    name: 'Environment variables configured',
    passed: checkEnvironmentFile(),
    fix: 'Run: node scripts/setup-local-env.js'
  });
  
  // Dependencies
  results.push({
    name: 'Dependencies installed',
    passed: checkDependencies(),
    fix: 'Run: npm install && cd frontend && npm install'
  });
  
  // Scripts
  results.push({
    name: 'Development scripts available',
    passed: checkScripts(),
    fix: 'Run: npm run dev:setup'
  });
  
  // Ports
  results.push({
    name: 'Ports available',
    passed: checkPorts(),
    fix: 'Kill processes on ports 3000 and 8080'
  });
  
  // Database
  results.push({
    name: 'Database connection',
    passed: await testDatabaseConnection(),
    fix: 'Check Supabase URL and keys in .env file'
  });
  
  displayResults(results);
}

if (require.main === module) {
  main().catch(error => {
    log(`❌ Validation failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main };
