#!/usr/bin/env node

/**
 * Test Pause/Resume Functionality
 * Validates that pause/resume works correctly and maintains data integrity
 */

const fs = require('fs');
const path = require('path');

class PauseResumeTest {
  constructor() {
    this.controlFile = 'scraper-control.json';
    this.progressFile = 'scraping-progress.json';
    this.testProgressFile = 'test-progress.json';
  }

  async testControlFileOperations() {
    console.log('🧪 Testing Control File Operations...\n');

    try {
      // Test 1: Create pause command
      console.log('📝 Test 1: Creating pause command...');
      const pauseCommand = {
        state: 'pause',
        timestamp: new Date().toISOString(),
        command: 'test_pause'
      };
      
      fs.writeFileSync(this.controlFile, JSON.stringify(pauseCommand, null, 2));
      
      // Verify file was created
      if (fs.existsSync(this.controlFile)) {
        const readData = JSON.parse(fs.readFileSync(this.controlFile, 'utf8'));
        if (readData.state === 'pause') {
          console.log('✅ Pause command file created successfully');
        } else {
          throw new Error('Pause command data mismatch');
        }
      } else {
        throw new Error('Control file was not created');
      }

      // Test 2: Create resume command
      console.log('📝 Test 2: Creating resume command...');
      const resumeCommand = {
        state: 'resume',
        timestamp: new Date().toISOString(),
        command: 'test_resume'
      };
      
      fs.writeFileSync(this.controlFile, JSON.stringify(resumeCommand, null, 2));
      
      const resumeData = JSON.parse(fs.readFileSync(this.controlFile, 'utf8'));
      if (resumeData.state === 'resume') {
        console.log('✅ Resume command file created successfully');
      } else {
        throw new Error('Resume command data mismatch');
      }

      // Test 3: Create stop command
      console.log('📝 Test 3: Creating stop command...');
      const stopCommand = {
        state: 'stop',
        timestamp: new Date().toISOString(),
        command: 'test_stop'
      };
      
      fs.writeFileSync(this.controlFile, JSON.stringify(stopCommand, null, 2));
      
      const stopData = JSON.parse(fs.readFileSync(this.controlFile, 'utf8'));
      if (stopData.state === 'stop') {
        console.log('✅ Stop command file created successfully');
      } else {
        throw new Error('Stop command data mismatch');
      }

      return true;

    } catch (error) {
      console.error('❌ Control file operations test failed:', error.message);
      return false;
    } finally {
      // Clean up
      if (fs.existsSync(this.controlFile)) {
        fs.unlinkSync(this.controlFile);
      }
    }
  }

  async testProgressPersistence() {
    console.log('\n🧪 Testing Progress Persistence...\n');

    try {
      // Test 1: Create initial progress
      console.log('📝 Test 1: Creating initial progress...');
      const initialProgress = {
        currentPage: 1,
        currentPropertyIndex: 0,
        completedPages: [],
        totalPropertiesScraped: 0,
        lastSuccessfulProperty: null,
        lastProcessedProperty: null,
        startTime: new Date().toISOString(),
        lastSaveTime: new Date().toISOString(),
        errors: [],
        totalPages: 10,
        duplicatesSkipped: 0,
        propertiesUpdated: 0,
        newPropertiesAdded: 0,
        pausedAt: null,
        resumedAt: null,
        totalPauseDuration: 0
      };

      fs.writeFileSync(this.testProgressFile, JSON.stringify(initialProgress, null, 2));
      console.log('✅ Initial progress created');

      // Test 2: Simulate progress updates
      console.log('📝 Test 2: Simulating progress updates...');
      
      // Update 1: Process some properties
      initialProgress.currentPage = 2;
      initialProgress.currentPropertyIndex = 3;
      initialProgress.totalPropertiesScraped = 15;
      initialProgress.lastProcessedProperty = 'Test Property 15';
      initialProgress.newPropertiesAdded = 12;
      initialProgress.propertiesUpdated = 3;
      initialProgress.lastSaveTime = new Date().toISOString();

      fs.writeFileSync(this.testProgressFile, JSON.stringify(initialProgress, null, 2));
      console.log('✅ Progress updated with property data');

      // Test 3: Simulate pause
      console.log('📝 Test 3: Simulating pause state...');
      initialProgress.pausedAt = new Date().toISOString();
      fs.writeFileSync(this.testProgressFile, JSON.stringify(initialProgress, null, 2));
      console.log('✅ Pause state recorded');

      // Test 4: Simulate resume
      console.log('📝 Test 4: Simulating resume state...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const pauseStart = new Date(initialProgress.pausedAt);
      const resumeTime = new Date();
      const pauseDuration = resumeTime - pauseStart;
      
      initialProgress.resumedAt = resumeTime.toISOString();
      initialProgress.totalPauseDuration += pauseDuration;
      initialProgress.pausedAt = null;
      initialProgress.resumedAt = null; // Reset for next pause
      
      fs.writeFileSync(this.testProgressFile, JSON.stringify(initialProgress, null, 2));
      console.log(`✅ Resume state recorded (pause duration: ${pauseDuration}ms)`);

      // Test 5: Verify data integrity
      console.log('📝 Test 5: Verifying data integrity...');
      const savedProgress = JSON.parse(fs.readFileSync(this.testProgressFile, 'utf8'));
      
      const checks = [
        { field: 'currentPage', expected: 2, actual: savedProgress.currentPage },
        { field: 'currentPropertyIndex', expected: 3, actual: savedProgress.currentPropertyIndex },
        { field: 'totalPropertiesScraped', expected: 15, actual: savedProgress.totalPropertiesScraped },
        { field: 'lastProcessedProperty', expected: 'Test Property 15', actual: savedProgress.lastProcessedProperty },
        { field: 'totalPauseDuration', expected: true, actual: savedProgress.totalPauseDuration > 0 }
      ];

      let allChecksPass = true;
      checks.forEach(check => {
        if (check.actual !== check.expected) {
          console.log(`❌ ${check.field}: expected ${check.expected}, got ${check.actual}`);
          allChecksPass = false;
        } else {
          console.log(`✅ ${check.field}: ${check.actual}`);
        }
      });

      if (allChecksPass) {
        console.log('✅ All data integrity checks passed');
        return true;
      } else {
        throw new Error('Data integrity checks failed');
      }

    } catch (error) {
      console.error('❌ Progress persistence test failed:', error.message);
      return false;
    } finally {
      // Clean up
      if (fs.existsSync(this.testProgressFile)) {
        fs.unlinkSync(this.testProgressFile);
      }
    }
  }

  async testControlScripts() {
    console.log('\n🧪 Testing Control Scripts...\n');

    try {
      // Test pause script
      console.log('📝 Test 1: Testing pause script...');
      const { spawn } = require('child_process');
      
      await new Promise((resolve, reject) => {
        const pauseProcess = spawn('node', ['pause-scraper.js'], { stdio: 'pipe' });
        
        let output = '';
        pauseProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        pauseProcess.on('close', (code) => {
          if (code === 0 && output.includes('Pause command sent successfully')) {
            console.log('✅ Pause script executed successfully');
            resolve();
          } else {
            reject(new Error(`Pause script failed with code ${code}`));
          }
        });
      });

      // Verify pause command file was created
      if (fs.existsSync(this.controlFile)) {
        const controlData = JSON.parse(fs.readFileSync(this.controlFile, 'utf8'));
        if (controlData.state === 'pause') {
          console.log('✅ Pause command file created correctly');
        } else {
          throw new Error('Pause command file has incorrect state');
        }
      } else {
        throw new Error('Pause command file was not created');
      }

      // Test resume script
      console.log('📝 Test 2: Testing resume script...');
      await new Promise((resolve, reject) => {
        const resumeProcess = spawn('node', ['resume-scraper.js'], { stdio: 'pipe' });
        
        let output = '';
        resumeProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        resumeProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Resume script executed successfully');
            resolve();
          } else {
            reject(new Error(`Resume script failed with code ${code}`));
          }
        });
      });

      // Test status script
      console.log('📝 Test 3: Testing status script...');
      await new Promise((resolve, reject) => {
        const statusProcess = spawn('node', ['scraper-status.js'], { stdio: 'pipe' });
        
        let output = '';
        statusProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        statusProcess.on('close', (code) => {
          if (code === 0 && output.includes('Scraper Status Report')) {
            console.log('✅ Status script executed successfully');
            resolve();
          } else {
            reject(new Error(`Status script failed with code ${code}`));
          }
        });
      });

      return true;

    } catch (error) {
      console.error('❌ Control scripts test failed:', error.message);
      return false;
    } finally {
      // Clean up
      if (fs.existsSync(this.controlFile)) {
        fs.unlinkSync(this.controlFile);
      }
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Pause/Resume Functionality Tests...\n');

    const test1 = await this.testControlFileOperations();
    const test2 = await this.testProgressPersistence();
    const test3 = await this.testControlScripts();

    console.log('\n📊 Test Results Summary:');
    console.log(`   Control File Operations: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Progress Persistence: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Control Scripts: ${test3 ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = test1 && test2 && test3;
    
    if (allPassed) {
      console.log('\n🎉 All pause/resume tests passed!');
      console.log('\n💡 Available Commands:');
      console.log('   npm run scrape  # Start scraping (with pause/resume support)');
      console.log('   npm run pause   # Pause running scraper');
      console.log('   npm run resume  # Resume paused scraper');
      console.log('   npm run stop    # Stop scraper gracefully');
      console.log('   npm run status  # Check scraper status');
    } else {
      console.log('\n❌ Some tests failed. Please check the issues above.');
    }

    return allPassed;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new PauseResumeTest();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = PauseResumeTest;
