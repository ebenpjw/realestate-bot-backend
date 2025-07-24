#!/usr/bin/env node

/**
 * Development Environment Reset Script
 * Resets local development environment to clean state
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

function confirmReset() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('⚠️  This will reset your development environment. Continue? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function stopDockerServices() {
  log('🛑 Stopping Docker services...', 'blue');
  
  try {
    execSync('docker-compose -f docker-compose.dev.yml down -v --remove-orphans', { 
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    log('✅ Docker services stopped', 'green');
  } catch (error) {
    log('⚠️  No Docker services to stop or Docker not available', 'yellow');
  }
}

function cleanNodeModules() {
  log('🧹 Cleaning node_modules...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'frontend');
  
  try {
    // Backend node_modules
    const backendNodeModules = path.join(rootDir, 'node_modules');
    if (fs.existsSync(backendNodeModules)) {
      fs.rmSync(backendNodeModules, { recursive: true, force: true });
      log('✅ Backend node_modules removed', 'green');
    }
    
    // Frontend node_modules
    const frontendNodeModules = path.join(frontendDir, 'node_modules');
    if (fs.existsSync(frontendNodeModules)) {
      fs.rmSync(frontendNodeModules, { recursive: true, force: true });
      log('✅ Frontend node_modules removed', 'green');
    }
    
    // Scripts node_modules
    const scriptsDir = path.join(rootDir, 'scripts');
    const scriptsNodeModules = path.join(scriptsDir, 'node_modules');
    if (fs.existsSync(scriptsNodeModules)) {
      fs.rmSync(scriptsNodeModules, { recursive: true, force: true });
      log('✅ Scripts node_modules removed', 'green');
    }
    
  } catch (error) {
    log(`❌ Failed to clean node_modules: ${error.message}`, 'red');
  }
}

function cleanBuildArtifacts() {
  log('🗑️  Cleaning build artifacts...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'frontend');
  
  const artifactsToClean = [
    // Frontend build artifacts
    path.join(frontendDir, '.next'),
    path.join(frontendDir, 'dist'),
    path.join(frontendDir, 'build'),
    // Backend artifacts
    path.join(rootDir, 'dist'),
    path.join(rootDir, 'build'),
    // Logs
    path.join(rootDir, 'logs'),
    // Cache directories
    path.join(rootDir, '.cache'),
    path.join(frontendDir, '.cache'),
    // Coverage
    path.join(rootDir, 'coverage'),
    path.join(frontendDir, 'coverage')
  ];
  
  artifactsToClean.forEach(artifactPath => {
    try {
      if (fs.existsSync(artifactPath)) {
        fs.rmSync(artifactPath, { recursive: true, force: true });
        log(`✅ Removed ${path.basename(artifactPath)}`, 'green');
      }
    } catch (error) {
      log(`⚠️  Could not remove ${path.basename(artifactPath)}: ${error.message}`, 'yellow');
    }
  });
}

function cleanLockFiles() {
  log('🔒 Cleaning lock files...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'frontend');
  const scriptsDir = path.join(rootDir, 'scripts');
  
  const lockFiles = [
    path.join(rootDir, 'package-lock.json'),
    path.join(frontendDir, 'package-lock.json'),
    path.join(scriptsDir, 'package-lock.json'),
    path.join(rootDir, 'yarn.lock'),
    path.join(frontendDir, 'yarn.lock'),
    path.join(scriptsDir, 'yarn.lock')
  ];
  
  lockFiles.forEach(lockFile => {
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        log(`✅ Removed ${path.basename(lockFile)}`, 'green');
      }
    } catch (error) {
      log(`⚠️  Could not remove ${path.basename(lockFile)}: ${error.message}`, 'yellow');
    }
  });
}

function resetEnvironmentFiles() {
  log('🔄 Resetting environment files...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'frontend');
  
  // Remove existing .env files
  const envFiles = [
    path.join(rootDir, '.env'),
    path.join(frontendDir, '.env.local')
  ];
  
  envFiles.forEach(envFile => {
    try {
      if (fs.existsSync(envFile)) {
        fs.unlinkSync(envFile);
        log(`✅ Removed ${path.relative(rootDir, envFile)}`, 'green');
      }
    } catch (error) {
      log(`⚠️  Could not remove ${path.relative(rootDir, envFile)}: ${error.message}`, 'yellow');
    }
  });
}

function cleanDockerResources() {
  log('🐳 Cleaning Docker resources...', 'blue');
  
  try {
    // Remove development containers
    execSync('docker container prune -f --filter "label=com.docker.compose.project=realestate-bot-backend"', { 
      stdio: 'pipe' 
    });
    
    // Remove development volumes
    execSync('docker volume prune -f --filter "label=com.docker.compose.project=realestate-bot-backend"', { 
      stdio: 'pipe' 
    });
    
    // Remove development networks
    execSync('docker network prune -f --filter "label=com.docker.compose.project=realestate-bot-backend"', { 
      stdio: 'pipe' 
    });
    
    log('✅ Docker resources cleaned', 'green');
  } catch (error) {
    log('⚠️  Docker cleanup skipped (Docker not available or no resources to clean)', 'yellow');
  }
}

function reinstallDependencies() {
  log('📦 Reinstalling dependencies...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'frontend');
  
  try {
    // Backend dependencies
    log('Installing backend dependencies...', 'cyan');
    execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
    
    // Frontend dependencies
    log('Installing frontend dependencies...', 'cyan');
    execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });
    
    log('✅ Dependencies reinstalled successfully', 'green');
  } catch (error) {
    log(`❌ Failed to reinstall dependencies: ${error.message}`, 'red');
    process.exit(1);
  }
}

function recreateEnvironmentFiles() {
  log('📝 Recreating environment files...', 'blue');
  
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'frontend');
  
  // Backend environment
  const backendEnvSource = path.join(rootDir, '.env.development');
  const backendEnvTarget = path.join(rootDir, '.env');
  
  if (fs.existsSync(backendEnvSource)) {
    fs.copyFileSync(backendEnvSource, backendEnvTarget);
    log('✅ Backend .env recreated', 'green');
  }
  
  // Frontend environment
  const frontendEnvSource = path.join(frontendDir, '.env.development');
  const frontendEnvTarget = path.join(frontendDir, '.env.local');
  
  if (fs.existsSync(frontendEnvSource)) {
    fs.copyFileSync(frontendEnvSource, frontendEnvTarget);
    log('✅ Frontend .env.local recreated', 'green');
  }
}

async function main() {
  log('🔄 Resetting Real Estate Bot Development Environment', 'bright');
  log('=' .repeat(60), 'blue');
  
  const shouldReset = await confirmReset();
  if (!shouldReset) {
    log('❌ Reset cancelled', 'yellow');
    process.exit(0);
  }
  
  stopDockerServices();
  cleanNodeModules();
  cleanBuildArtifacts();
  cleanLockFiles();
  resetEnvironmentFiles();
  cleanDockerResources();
  reinstallDependencies();
  recreateEnvironmentFiles();
  
  log('\n🎉 Development environment reset complete!', 'green');
  log('\n🚀 Next steps:', 'bright');
  log('  1. Run: npm run dev:setup (if needed)', 'cyan');
  log('  2. Run: npm run dev:full', 'cyan');
  log('  3. Open: http://localhost:3000', 'cyan');
}

if (require.main === module) {
  main().catch(error => {
    log(`❌ Reset failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main };
