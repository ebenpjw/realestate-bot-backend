#!/usr/bin/env node

// Script to apply tone improvements to the bot
// This script will update the botService.js file with the improved prompt and settings

const fs = require('fs');
const path = require('path');
const { improvedPrompt, improvedFallbackMessages, toneConfiguration } = require('./improved-bot-prompt');

const BACKUP_SUFFIX = '.backup-' + Date.now();

function createBackup(filePath) {
  const backupPath = filePath + BACKUP_SUFFIX;
  fs.copyFileSync(filePath, backupPath);
  console.log(`✅ Created backup: ${backupPath}`);
  return backupPath;
}

function updateBotServicePrompt() {
  const botServicePath = path.join(__dirname, 'services', 'botService.js');
  
  if (!fs.existsSync(botServicePath)) {
    console.error('❌ botService.js not found at:', botServicePath);
    return false;
  }

  // Create backup
  createBackup(botServicePath);

  // Read current file
  let content = fs.readFileSync(botServicePath, 'utf8');

  // Find and replace the _buildPrompt method
  const promptStart = content.indexOf('return `');
  const promptEnd = content.indexOf('`;', promptStart);

  if (promptStart === -1 || promptEnd === -1) {
    console.error('❌ Could not find prompt section in botService.js');
    return false;
  }

  // Replace the prompt content
  const beforePrompt = content.substring(0, promptStart + 8);
  const afterPrompt = content.substring(promptEnd);
  
  const newContent = beforePrompt + improvedPrompt + afterPrompt;

  // Write updated file
  fs.writeFileSync(botServicePath, newContent, 'utf8');
  console.log('✅ Updated bot prompt in botService.js');
  
  return true;
}

function updateFallbackMessages() {
  const botServicePath = path.join(__dirname, 'services', 'botService.js');
  let content = fs.readFileSync(botServicePath, 'utf8');

  // Update the main fallback message
  content = content.replace(
    'const fallbackMessage = "Eh sorry, can you try again?";',
    `const fallbackMessages = ${JSON.stringify(improvedFallbackMessages, null, 6)};
        const fallbackMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];`
  );

  // Update the fallbackResponse property
  content = content.replace(
    'this.fallbackResponse = {\n      messages: ["Sorry, I had a slight issue there. Could you say that again?"],',
    `this.fallbackResponse = {
      messages: [improvedFallbackMessages[Math.floor(Math.random() * improvedFallbackMessages.length)]],`
  );

  fs.writeFileSync(botServicePath, content, 'utf8');
  console.log('✅ Updated fallback messages');
}

function updateConfiguration() {
  const configPath = path.join(__dirname, 'config.js');
  
  if (!fs.existsSync(configPath)) {
    console.log('⚠️  config.js not found, skipping configuration updates');
    return;
  }

  // Create backup
  createBackup(configPath);

  let content = fs.readFileSync(configPath, 'utf8');

  // Update OpenAI temperature
  content = content.replace(
    /OPENAI_TEMPERATURE: parseFloatEnv\(process\.env\.OPENAI_TEMPERATURE, 0\.5\)/,
    `OPENAI_TEMPERATURE: parseFloatEnv(process.env.OPENAI_TEMPERATURE, ${toneConfiguration.openai_temperature})`
  );

  // Update max tokens
  content = content.replace(
    /OPENAI_MAX_TOKENS: parseInteger\(process\.env\.OPENAI_MAX_TOKENS, 1000\)/,
    `OPENAI_MAX_TOKENS: parseInteger(process.env.OPENAI_MAX_TOKENS, ${toneConfiguration.max_tokens})`
  );

  fs.writeFileSync(configPath, content, 'utf8');
  console.log('✅ Updated configuration settings');
}

function updateConstants() {
  const constantsPath = path.join(__dirname, 'constants', 'index.js');
  
  if (!fs.existsSync(constantsPath)) {
    console.log('⚠️  constants/index.js not found, skipping constants updates');
    return;
  }

  // Create backup
  createBackup(constantsPath);

  let content = fs.readFileSync(constantsPath, 'utf8');

  // Update message delays for more natural timing
  content = content.replace(
    /DELAY: \{[\s\S]*?\}/,
    `DELAY: {
      SHORT: ${toneConfiguration.message_delays.short},
      MEDIUM: ${toneConfiguration.message_delays.medium},
      LONG: ${toneConfiguration.message_delays.long},
      RANDOM_FACTOR: 1000
    }`
  );

  // Update AI temperature default
  content = content.replace(
    /DEFAULT_TEMPERATURE: 0\.5/,
    `DEFAULT_TEMPERATURE: ${toneConfiguration.openai_temperature}`
  );

  // Update max tokens
  content = content.replace(
    /MAX_TOKENS: 1000/,
    `MAX_TOKENS: ${toneConfiguration.max_tokens}`
  );

  fs.writeFileSync(constantsPath, content, 'utf8');
  console.log('✅ Updated constants');
}

function showSummary() {
  console.log('\n🎭 TONE IMPROVEMENTS APPLIED');
  console.log('============================');
  console.log('✅ Enhanced bot prompt with better personality');
  console.log('✅ Improved fallback messages with variety');
  console.log('✅ Updated configuration for more expressive responses');
  console.log('✅ Adjusted timing for more natural conversations');
  
  console.log('\n📋 CHANGES MADE:');
  console.log('• OpenAI Temperature: 0.5 → 0.7 (more personality)');
  console.log('• Max Tokens: 1000 → 1200 (more expressive)');
  console.log('• Message Delays: More natural timing');
  console.log('• Fallback Messages: 6 varied options instead of 2');
  console.log('• Prompt: Enhanced with empathy, enthusiasm, and local context');

  console.log('\n🧪 RECOMMENDED TESTING:');
  console.log('1. Test with enthusiastic users: "I\'m so excited to buy my first home!"');
  console.log('2. Test with worried users: "I\'m concerned about the prices"');
  console.log('3. Test with hesitant users: "I\'m not sure if I\'m ready"');
  console.log('4. Test location preferences: "I love the East Coast area"');
  console.log('5. Test appointment booking flow');

  console.log('\n⚠️  BACKUP FILES CREATED:');
  console.log('• services/botService.js' + BACKUP_SUFFIX);
  console.log('• config.js' + BACKUP_SUFFIX + ' (if updated)');
  console.log('• constants/index.js' + BACKUP_SUFFIX + ' (if updated)');
  
  console.log('\n🔄 TO REVERT CHANGES:');
  console.log('If you need to revert, restore from the backup files created.');
}

// Main execution
function main() {
  console.log('🚀 Applying Bot Tone Improvements...\n');

  try {
    // Apply improvements
    if (updateBotServicePrompt()) {
      updateFallbackMessages();
      updateConfiguration();
      updateConstants();
      showSummary();
    } else {
      console.error('❌ Failed to update bot service. Aborting other changes.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error applying improvements:', error.message);
    console.error('Check the backup files to restore if needed.');
    process.exit(1);
  }
}

// Command line options
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Bot Tone Improvement Script');
  console.log('===========================');
  console.log('Usage: node apply-tone-improvements.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --dry-run      Show what would be changed without making changes');
  console.log('');
  console.log('This script will:');
  console.log('• Update the bot prompt with improved tone and personality');
  console.log('• Add variety to fallback messages');
  console.log('• Adjust OpenAI configuration for better responses');
  console.log('• Create backup files before making changes');
  process.exit(0);
}

if (process.argv.includes('--dry-run')) {
  console.log('🔍 DRY RUN - Changes that would be made:');
  console.log('• Update bot prompt in services/botService.js');
  console.log('• Add improved fallback messages');
  console.log('• Update OpenAI temperature to 0.7');
  console.log('• Update max tokens to 1200');
  console.log('• Adjust message timing delays');
  console.log('\nRun without --dry-run to apply changes.');
  process.exit(0);
}

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  updateBotServicePrompt,
  updateFallbackMessages,
  updateConfiguration,
  updateConstants
};
