#!/usr/bin/env node

/**
 * Development Environment Setup Script
 * Sets up local development environment with safety checks
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
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkPrerequisites() {
  log('🔍 Checking prerequisites...', 'blue');
  
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 20) {
      throw new Error(`Node.js 20+ required, found ${nodeVersion}`);
    }
    log(`✅ Node.js ${nodeVersion}`, 'green');

    // Check Docker
    try {
      execSync('docker --version', { stdio: 'pipe' });
      log('✅ Docker available', 'green');
    } catch (error) {
      log('⚠️  Docker not found - Docker setup will be skipped', 'yellow');
    }

    // Check Docker Compose
    try {
      execSync('docker-compose --version', { stdio: 'pipe' });
      log('✅ Docker Compose available', 'green');
    } catch (error) {
      log('⚠️  Docker Compose not found - Docker setup will be skipped', 'yellow');
    }

  } catch (error) {
    log(`❌ Prerequisite check failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function setupEnvironmentFiles() {
  log('📝 Setting up environment files...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'frontend');
  
  // Backend environment
  const backendEnvSource = path.join(rootDir, '.env.development');
  const backendEnvTarget = path.join(rootDir, '.env');
  
  if (!fs.existsSync(backendEnvTarget)) {
    if (fs.existsSync(backendEnvSource)) {
      fs.copyFileSync(backendEnvSource, backendEnvTarget);
      log('✅ Backend .env created from .env.development', 'green');
    } else {
      log('❌ .env.development not found', 'red');
      process.exit(1);
    }
  } else {
    log('⚠️  Backend .env already exists - skipping', 'yellow');
  }
  
  // Frontend environment
  const frontendEnvSource = path.join(frontendDir, '.env.development');
  const frontendEnvTarget = path.join(frontendDir, '.env.local');
  
  if (!fs.existsSync(frontendEnvTarget)) {
    if (fs.existsSync(frontendEnvSource)) {
      fs.copyFileSync(frontendEnvSource, frontendEnvTarget);
      log('✅ Frontend .env.local created from .env.development', 'green');
    } else {
      log('❌ Frontend .env.development not found', 'red');
      process.exit(1);
    }
  } else {
    log('⚠️  Frontend .env.local already exists - skipping', 'yellow');
  }
}

function installDependencies() {
  log('📦 Installing dependencies...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'frontend');
  
  try {
    // Backend dependencies
    log('Installing backend dependencies...', 'cyan');
    execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
    
    // Frontend dependencies
    log('Installing frontend dependencies...', 'cyan');
    execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });
    
    log('✅ Dependencies installed successfully', 'green');
  } catch (error) {
    log(`❌ Failed to install dependencies: ${error.message}`, 'red');
    process.exit(1);
  }
}

function createDevelopmentScripts() {
  log('🛠️  Creating development scripts...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const packageJsonPath = path.join(rootDir, 'package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Add development scripts
    packageJson.scripts = {
      ...packageJson.scripts,
      'dev:full': 'concurrently "npm run dev:backend" "npm run dev:frontend"',
      'dev:backend': 'nodemon index.js | pino-pretty',
      'dev:frontend': 'cd frontend && npm run dev',
      'dev:docker': 'docker-compose -f docker-compose.dev.yml up --build',
      'dev:docker:down': 'docker-compose -f docker-compose.dev.yml down',
      'dev:docker:clean': 'docker-compose -f docker-compose.dev.yml down -v --remove-orphans',
      'dev:setup': 'node scripts/dev-setup.js',
      'dev:reset': 'node scripts/dev-reset.js',
      'dev:logs': 'docker-compose -f docker-compose.dev.yml logs -f',
      'dev:db': 'docker-compose -f docker-compose.dev.yml up supabase-db -d',
      'dev:test': 'NODE_ENV=test npm run test',
      'dev:lint': 'npm run lint && cd frontend && npm run lint',
      'dev:format': 'npm run format && cd frontend && npm run format'
    };
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    log('✅ Development scripts added to package.json', 'green');
  } catch (error) {
    log(`❌ Failed to update package.json: ${error.message}`, 'red');
    process.exit(1);
  }
}

function displayInstructions() {
  log('\n🎉 Development environment setup complete!', 'green');
  log('\n📋 Available commands:', 'bright');
  log('  npm run dev:full      - Start both backend and frontend', 'cyan');
  log('  npm run dev:backend   - Start backend only', 'cyan');
  log('  npm run dev:frontend  - Start frontend only', 'cyan');
  log('  npm run dev:docker    - Start with Docker Compose', 'cyan');
  log('  npm run dev:docker:down - Stop Docker services', 'cyan');
  log('  npm run dev:reset     - Reset development environment', 'cyan');
  log('  npm run dev:test      - Run tests in development mode', 'cyan');
  
  log('\n🔒 Safety Features Enabled:', 'bright');
  log('  ✅ WhatsApp sending disabled', 'green');
  log('  ✅ Testing mode enabled', 'green');
  log('  ✅ Dry run mode enabled', 'green');
  log('  ✅ Mock responses enabled', 'green');
  
  log('\n🌐 Local URLs:', 'bright');
  log('  Frontend: http://localhost:3000', 'cyan');
  log('  Backend:  http://localhost:8080', 'cyan');
  log('  Database: http://localhost:54321 (Supabase Studio)', 'cyan');
  
  log('\n🚀 Quick Start:', 'bright');
  log('  1. Run: npm run dev:full', 'yellow');
  log('  2. Open: http://localhost:3000', 'yellow');
  log('  3. Test: Make changes and see hot reload!', 'yellow');
  
  log('\n⚠️  Important Notes:', 'bright');
  log('  - All WhatsApp messages are mocked in development', 'yellow');
  log('  - Use mock API keys for external services', 'yellow');
  log('  - Database is local - safe to experiment', 'yellow');
  log('  - Check logs for any configuration issues', 'yellow');
}

function main() {
  log('🚀 Setting up Real Estate Bot Development Environment', 'bright');
  log('=' .repeat(60), 'blue');
  
  checkPrerequisites();
  setupEnvironmentFiles();
  installDependencies();
  createDevelopmentScripts();
  displayInstructions();
}

if (require.main === module) {
  main();
}

module.exports = { main };
