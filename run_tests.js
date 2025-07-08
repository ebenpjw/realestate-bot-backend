#!/usr/bin/env node

/**
 * Real Estate Bot Test Launcher
 * Simple interface to run various test suites
 * 
 * Usage: node run_tests.js
 */

const readline = require('readline');
const { spawn } = require('child_process');

class TestLauncher {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('🤖 Real Estate Bot Test Launcher');
    console.log('================================\n');
    
    try {
      await this.showMainMenu();
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    } finally {
      this.rl.close();
    }
  }

  async showMainMenu() {
    console.log('📋 Available Test Suites:');
    console.log('1. 🚀 Quick Test (Integration + Basic Flow)');
    console.log('2. 🎭 Complete Flow Tests');
    console.log('3. 💬 Conversation Scenarios');
    console.log('4. 📅 Appointment Booking Tests');
    console.log('5. 🔧 Integration Validation');
    console.log('6. 📊 Full Test Suite + Report');
    console.log('7. 🎮 Interactive Mode');
    console.log('8. ❌ Exit\n');

    const choice = await this.askQuestion('Select test suite (1-8): ');
    await this.handleChoice(choice);
  }

  async handleChoice(choice) {
    switch (choice.trim()) {
      case '1':
        await this.runQuickTest();
        break;
      case '2':
        await this.runFlowTests();
        break;
      case '3':
        await this.runConversationTests();
        break;
      case '4':
        await this.runBookingTests();
        break;
      case '5':
        await this.runIntegrationTests();
        break;
      case '6':
        await this.runFullSuite();
        break;
      case '7':
        await this.runInteractiveMode();
        break;
      case '8':
        console.log('👋 Goodbye!');
        return;
      default:
        console.log('❌ Invalid choice. Please select 1-8.');
        await this.showMainMenu();
    }
  }

  async runQuickTest() {
    console.log('\n🚀 Running Quick Test Suite...');
    console.log('This will run integration validation and basic flow tests.\n');
    
    const confirm = await this.askQuestion('Continue? (y/n): ');
    if (confirm.toLowerCase() === 'y') {
      await this.executeCommand('node', ['test_master_runner.js', '--integration', '--flow']);
      await this.askToContinue();
    }
    await this.showMainMenu();
  }

  async runFlowTests() {
    console.log('\n🎭 Complete Flow Tests');
    console.log('Available scenarios:');
    console.log('1. Basic qualification to booking');
    console.log('2. Conflict resolution');
    console.log('3. Edge cases');
    console.log('4. Full journey');
    console.log('5. All scenarios\n');

    const scenario = await this.askQuestion('Select scenario (1-5): ');
    const scenarioMap = {
      '1': 'basic',
      '2': 'conflict', 
      '3': 'edge',
      '4': 'full',
      '5': 'all'
    };

    if (scenarioMap[scenario]) {
      await this.executeCommand('node', ['test_complete_flow.js', scenarioMap[scenario]]);
      await this.askToContinue();
    } else {
      console.log('❌ Invalid choice.');
    }
    await this.showMainMenu();
  }

  async runConversationTests() {
    console.log('\n💬 Conversation Scenario Tests');
    console.log('Available scenarios:');
    console.log('1. Eager buyer');
    console.log('2. Cautious buyer');
    console.log('3. Property investor');
    console.log('4. Difficult lead');
    console.log('5. Price sensitive buyer');
    console.log('6. First time buyer');
    console.log('7. All scenarios\n');

    const scenario = await this.askQuestion('Select scenario (1-7): ');
    const scenarioMap = {
      '1': 'eager_buyer',
      '2': 'cautious_buyer',
      '3': 'investor',
      '4': 'difficult_lead',
      '5': 'price_sensitive',
      '6': 'first_time_buyer',
      '7': 'all'
    };

    if (scenarioMap[scenario]) {
      await this.executeCommand('node', ['test_conversation_scenarios.js', scenarioMap[scenario]]);
      await this.askToContinue();
    } else {
      console.log('❌ Invalid choice.');
    }
    await this.showMainMenu();
  }

  async runBookingTests() {
    console.log('\n📅 Appointment Booking Tests');
    console.log('Available tests:');
    console.log('1. Basic booking');
    console.log('2. Conflict resolution');
    console.log('3. Calendar integration');
    console.log('4. Zoom integration');
    console.log('5. Edge cases');
    console.log('6. All tests\n');

    const test = await this.askQuestion('Select test (1-6): ');
    const testMap = {
      '1': 'basic',
      '2': 'conflict',
      '3': 'calendar',
      '4': 'zoom',
      '5': 'edge',
      '6': 'all'
    };

    if (testMap[test]) {
      await this.executeCommand('node', ['test_appointment_booking.js', testMap[test]]);
      await this.askToContinue();
    } else {
      console.log('❌ Invalid choice.');
    }
    await this.showMainMenu();
  }

  async runIntegrationTests() {
    console.log('\n🔧 Integration Validation Tests');
    console.log('Available integrations:');
    console.log('1. Database');
    console.log('2. Google Calendar');
    console.log('3. Zoom');
    console.log('4. WhatsApp (validation only)');
    console.log('5. OpenAI');
    console.log('6. All integrations\n');

    const integration = await this.askQuestion('Select integration (1-6): ');
    const integrationMap = {
      '1': 'database',
      '2': 'google',
      '3': 'zoom',
      '4': 'whatsapp',
      '5': 'openai',
      '6': 'all'
    };

    if (integrationMap[integration]) {
      await this.executeCommand('node', ['test_integration_validation.js', integrationMap[integration]]);
      await this.askToContinue();
    } else {
      console.log('❌ Invalid choice.');
    }
    await this.showMainMenu();
  }

  async runFullSuite() {
    console.log('\n📊 Full Test Suite');
    console.log('This will run ALL tests and generate an HTML report.');
    console.log('⚠️  This may take 5-10 minutes to complete.\n');
    
    const confirm = await this.askQuestion('Continue? (y/n): ');
    if (confirm.toLowerCase() === 'y') {
      console.log('\n🚀 Starting comprehensive test suite...\n');
      await this.executeCommand('node', ['test_master_runner.js', '--full', '--report']);
      
      console.log('\n✅ Test suite completed!');
      console.log('📄 Check test_report.html for detailed results.');
      await this.askToContinue();
    }
    await this.showMainMenu();
  }

  async runInteractiveMode() {
    console.log('\n🎮 Interactive Mode');
    console.log('This allows you to run custom test combinations.\n');
    
    const options = [];
    
    const includeIntegration = await this.askQuestion('Include integration tests? (y/n): ');
    if (includeIntegration.toLowerCase() === 'y') options.push('--integration');
    
    const includeConversation = await this.askQuestion('Include conversation tests? (y/n): ');
    if (includeConversation.toLowerCase() === 'y') options.push('--conversation');
    
    const includeBooking = await this.askQuestion('Include booking tests? (y/n): ');
    if (includeBooking.toLowerCase() === 'y') options.push('--booking');
    
    const includeFlow = await this.askQuestion('Include flow tests? (y/n): ');
    if (includeFlow.toLowerCase() === 'y') options.push('--flow');
    
    const generateReport = await this.askQuestion('Generate HTML report? (y/n): ');
    if (generateReport.toLowerCase() === 'y') options.push('--report');
    
    if (options.length === 0) {
      console.log('❌ No tests selected.');
    } else {
      console.log(`\n🚀 Running custom test suite with options: ${options.join(' ')}\n`);
      await this.executeCommand('node', ['test_master_runner.js', ...options]);
      await this.askToContinue();
    }
    
    await this.showMainMenu();
  }

  async executeCommand(command, args) {
    return new Promise((resolve, reject) => {
      console.log(`\n🔄 Executing: ${command} ${args.join(' ')}\n`);
      
      const process = spawn(command, args, {
        stdio: 'inherit',
        shell: true
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Command completed successfully!');
          resolve();
        } else {
          console.log(`\n❌ Command failed with exit code ${code}`);
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      process.on('error', (error) => {
        console.error(`\n❌ Failed to start process: ${error.message}`);
        reject(error);
      });
    });
  }

  async askQuestion(question) {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }

  async askToContinue() {
    await this.askQuestion('\nPress Enter to continue...');
  }
}

// Main execution
async function main() {
  const launcher = new TestLauncher();
  await launcher.start();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { TestLauncher };
