#!/usr/bin/env node

/**
 * Real Estate Bot Appointment Booking Flow Testing
 * Tests appointment booking, conflict resolution, calendar integration, and Zoom link generation
 * 
 * Usage:
 *   node test_appointment_booking.js [test_type]
 * 
 * Test Types:
 *   - basic: Basic appointment booking
 *   - conflict: Conflict detection and resolution
 *   - calendar: Google Calendar integration
 *   - zoom: Zoom link generation
 *   - edge: Edge cases and error handling
 *   - all: Run all tests
 */

const axios = require('axios');
const supabase = require('./supabaseClient');
const appointmentService = require('./services/appointmentService');
const { isTimeSlotAvailable } = require('./api/bookingHelper');
const { formatForDisplay, toSgTime } = require('./utils/timezoneUtils');

// Configuration
const BASE_URL = process.env.RAILWAY_URL || 'http://localhost:3000';

class AppointmentBookingTester {
  constructor() {
    this.results = [];
    this.testLeadId = null;
    this.testAgentId = null;
    this.createdAppointments = [];
    this.startTime = Date.now();
  }

  async runTests(testType = 'all') {
    console.log('📅 Real Estate Bot Appointment Booking Testing');
    console.log('==============================================\n');
    
    try {
      await this.setupTestData();
      
      if (testType === 'all') {
        await this.runAllTests();
      } else {
        await this.runSingleTest(testType);
      }

      await this.cleanupTestData();
      this.printFinalReport();
      
    } catch (error) {
      console.error(`❌ Appointment testing failed: ${error.message}`);
      await this.cleanupTestData();
      process.exit(1);
    }
  }

  async setupTestData() {
    console.log('🔧 Setting up test data...');
    
    try {
      // Create test lead
      const testPhoneNumber = `+65${Date.now().toString().slice(-8)}`;
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          phone_number: testPhoneNumber,
          full_name: 'Appointment Test Lead',
          status: 'qualified',
          budget: '$800k',
          location_preference: 'CBD',
          timeline: 'within 3 months',
          source: 'WA Direct'
        })
        .select()
        .single();

      if (leadError) throw leadError;
      this.testLeadId = lead.id;
      console.log(`👤 Created test lead: ${lead.full_name} (${lead.id})`);

      // Get test agent
      const { data: agents, error: agentError } = await supabase
        .from('agents')
        .select('id, full_name, google_email')
        .limit(1);

      if (agentError) throw agentError;
      if (!agents || agents.length === 0) {
        throw new Error('No agents found in database for testing');
      }

      this.testAgentId = agents[0].id;
      console.log(`👨‍💼 Using test agent: ${agents[0].full_name} (${agents[0].id})`);
      
    } catch (error) {
      console.error(`❌ Test setup failed: ${error.message}`);
      throw error;
    }
  }

  async runAllTests() {
    console.log('🧪 Running all appointment booking tests...\n');
    
    const tests = [
      'basic',
      'conflict', 
      'calendar',
      'zoom',
      'edge'
    ];
    
    for (const test of tests) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📋 TEST: ${test.toUpperCase()}`);
      console.log(`${'='.repeat(50)}\n`);
      
      await this.runSingleTest(test);
      
      // Brief pause between tests
      await this.delay(2000);
    }
  }

  async runSingleTest(testType) {
    try {
      switch (testType) {
        case 'basic':
          await this.testBasicBooking();
          break;
        case 'conflict':
          await this.testConflictResolution();
          break;
        case 'calendar':
          await this.testCalendarIntegration();
          break;
        case 'zoom':
          await this.testZoomIntegration();
          break;
        case 'edge':
          await this.testEdgeCases();
          break;
        default:
          throw new Error(`Unknown test type: ${testType}`);
      }
    } catch (error) {
      console.error(`❌ Test ${testType} failed: ${error.message}`);
      this.results.push({
        testType,
        success: false,
        error: error.message
      });
    }
  }

  async testBasicBooking() {
    console.log('📅 Testing basic appointment booking...');
    
    try {
      // Find next available slot
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0); // 2 PM tomorrow

      console.log(`🔍 Checking availability for: ${formatForDisplay(toSgTime(tomorrow))}`);
      
      const isAvailable = await isTimeSlotAvailable(this.testAgentId, tomorrow);
      console.log(`📊 Time slot available: ${isAvailable}`);

      if (isAvailable) {
        console.log('📝 Creating appointment...');
        
        const result = await appointmentService.createAppointment({
          leadId: this.testLeadId,
          agentId: this.testAgentId,
          appointmentTime: tomorrow,
          leadName: 'Appointment Test Lead',
          consultationNotes: 'Basic booking test'
        });

        if (result.success) {
          console.log('✅ Appointment created successfully!');
          console.log(`📅 Time: ${formatForDisplay(toSgTime(tomorrow))}`);
          console.log(`🔗 Zoom Link: ${result.appointment.zoom_join_url ? 'Generated' : 'Missing'}`);
          console.log(`📧 Calendar Event: ${result.appointment.google_event_id ? 'Created' : 'Missing'}`);
          
          this.createdAppointments.push(result.appointment.id);
          
          this.results.push({
            testType: 'basic',
            success: true,
            appointmentId: result.appointment.id,
            hasZoomLink: !!result.appointment.zoom_join_url,
            hasCalendarEvent: !!result.appointment.google_event_id
          });
        } else {
          throw new Error(result.error || 'Appointment creation failed');
        }
      } else {
        console.log('⚠️ Time slot not available, testing alternative suggestion...');
        
        // Test alternative suggestion logic
        const { findMatchingSlot } = require('./api/bookingHelper');
        const { exactMatch, alternatives } = await findMatchingSlot(this.testAgentId, 'tomorrow 2pm');
        
        console.log(`🔍 Alternatives found: ${alternatives.length}`);
        
        this.results.push({
          testType: 'basic',
          success: true,
          alternativesOffered: alternatives.length,
          note: 'Slot unavailable, alternatives provided'
        });
      }
      
    } catch (error) {
      console.error(`❌ Basic booking test failed: ${error.message}`);
      throw error;
    }
  }

  async testConflictResolution() {
    console.log('⚔️ Testing conflict resolution...');
    
    try {
      // Create a conflicting appointment first
      const conflictTime = new Date();
      conflictTime.setDate(conflictTime.getDate() + 2);
      conflictTime.setHours(15, 0, 0, 0); // 3 PM day after tomorrow

      console.log(`🔧 Creating conflict at: ${formatForDisplay(toSgTime(conflictTime))}`);
      
      const conflictResult = await appointmentService.createAppointment({
        leadId: this.testLeadId,
        agentId: this.testAgentId,
        appointmentTime: conflictTime,
        leadName: 'Conflict Test Lead',
        consultationNotes: 'Conflict setup appointment'
      });

      if (conflictResult.success) {
        this.createdAppointments.push(conflictResult.appointment.id);
        console.log('✅ Conflict appointment created');

        // Now try to book the same time
        console.log('🔍 Testing conflict detection...');
        
        const isAvailable = await isTimeSlotAvailable(this.testAgentId, conflictTime);
        console.log(`📊 Time slot available: ${isAvailable}`);
        
        if (!isAvailable) {
          console.log('✅ Conflict detected correctly!');
          
          // Test alternative suggestions
          const { findMatchingSlot } = require('./api/bookingHelper');
          const { exactMatch, alternatives } = await findMatchingSlot(
            this.testAgentId, 
            `${conflictTime.toDateString()} 3pm`
          );
          
          console.log(`🔍 Alternatives suggested: ${alternatives.length}`);
          
          this.results.push({
            testType: 'conflict',
            success: true,
            conflictDetected: true,
            alternativesProvided: alternatives.length
          });
        } else {
          throw new Error('Conflict not detected - this is a problem!');
        }
      } else {
        throw new Error('Failed to create conflict appointment');
      }
      
    } catch (error) {
      console.error(`❌ Conflict resolution test failed: ${error.message}`);
      throw error;
    }
  }

  async testCalendarIntegration() {
    console.log('📅 Testing Google Calendar integration...');
    
    try {
      const { testGoogleCalendarIntegration } = require('./api/googleCalendarService');
      
      console.log('🔍 Testing calendar connection...');
      const calendarTest = await testGoogleCalendarIntegration(this.testAgentId);
      
      if (calendarTest.success) {
        console.log('✅ Calendar integration working!');
        console.log(`📧 Agent email: ${calendarTest.agent.email}`);
        console.log(`📅 Calendars: ${calendarTest.calendars.length}`);
        console.log(`📋 Today's events: ${calendarTest.todaysEvents.length}`);
        console.log(`⏰ Busy slots: ${calendarTest.busySlots.length}`);
        
        this.results.push({
          testType: 'calendar',
          success: true,
          calendarCount: calendarTest.calendars.length,
          todaysEvents: calendarTest.todaysEvents.length,
          busySlots: calendarTest.busySlots.length
        });
      } else {
        throw new Error(calendarTest.error || 'Calendar integration failed');
      }
      
    } catch (error) {
      console.error(`❌ Calendar integration test failed: ${error.message}`);
      throw error;
    }
  }

  async testZoomIntegration() {
    console.log('🎥 Testing Zoom integration...');
    
    try {
      const { createZoomMeetingForUser } = require('./api/zoomServerService');
      
      const meetingTime = new Date();
      meetingTime.setDate(meetingTime.getDate() + 3);
      meetingTime.setHours(16, 0, 0, 0); // 4 PM in 3 days
      
      console.log('🔍 Creating test Zoom meeting...');
      
      const zoomResult = await createZoomMeetingForUser({
        agentId: this.testAgentId,
        topic: 'Property Consultation Test',
        startTime: meetingTime,
        duration: 60,
        agenda: 'Test Zoom integration for appointment booking'
      });
      
      if (zoomResult.success) {
        console.log('✅ Zoom meeting created successfully!');
        console.log(`🔗 Join URL: ${zoomResult.meeting.join_url ? 'Generated' : 'Missing'}`);
        console.log(`🆔 Meeting ID: ${zoomResult.meeting.id}`);
        console.log(`🔑 Passcode: ${zoomResult.meeting.passcode || 'None'}`);
        
        this.results.push({
          testType: 'zoom',
          success: true,
          meetingId: zoomResult.meeting.id,
          hasJoinUrl: !!zoomResult.meeting.join_url,
          hasPasscode: !!zoomResult.meeting.passcode
        });
      } else {
        throw new Error(zoomResult.error || 'Zoom meeting creation failed');
      }
      
    } catch (error) {
      console.error(`❌ Zoom integration test failed: ${error.message}`);
      throw error;
    }
  }

  async testEdgeCases() {
    console.log('🔍 Testing edge cases...');
    
    try {
      const edgeTests = [];
      
      // Test 1: Invalid time slot
      try {
        const pastTime = new Date();
        pastTime.setHours(pastTime.getHours() - 1); // 1 hour ago
        
        const result = await appointmentService.createAppointment({
          leadId: this.testLeadId,
          agentId: this.testAgentId,
          appointmentTime: pastTime,
          leadName: 'Edge Case Test',
          consultationNotes: 'Past time test'
        });
        
        edgeTests.push({
          test: 'past_time',
          success: !result.success, // Should fail
          note: result.success ? 'ERROR: Past time accepted' : 'Correctly rejected past time'
        });
      } catch (error) {
        edgeTests.push({
          test: 'past_time',
          success: true,
          note: 'Correctly threw error for past time'
        });
      }
      
      // Test 2: Invalid lead ID
      try {
        const futureTime = new Date();
        futureTime.setDate(futureTime.getDate() + 5);
        futureTime.setHours(10, 0, 0, 0);
        
        const result = await appointmentService.createAppointment({
          leadId: 'invalid-uuid',
          agentId: this.testAgentId,
          appointmentTime: futureTime,
          leadName: 'Invalid Lead Test',
          consultationNotes: 'Invalid lead ID test'
        });
        
        edgeTests.push({
          test: 'invalid_lead',
          success: !result.success, // Should fail
          note: result.success ? 'ERROR: Invalid lead accepted' : 'Correctly rejected invalid lead'
        });
      } catch (error) {
        edgeTests.push({
          test: 'invalid_lead',
          success: true,
          note: 'Correctly threw error for invalid lead'
        });
      }
      
      console.log('✅ Edge case testing completed');
      edgeTests.forEach(test => {
        console.log(`  ${test.success ? '✅' : '❌'} ${test.test}: ${test.note}`);
      });
      
      this.results.push({
        testType: 'edge',
        success: edgeTests.every(t => t.success),
        edgeTests
      });
      
    } catch (error) {
      console.error(`❌ Edge case testing failed: ${error.message}`);
      throw error;
    }
  }

  async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      // Delete created appointments
      if (this.createdAppointments.length > 0) {
        const { error: appointmentError } = await supabase
          .from('appointments')
          .delete()
          .in('id', this.createdAppointments);
        
        if (appointmentError) {
          console.warn(`⚠️ Failed to cleanup appointments: ${appointmentError.message}`);
        } else {
          console.log(`🗑️ Deleted ${this.createdAppointments.length} test appointments`);
        }
      }
      
      // Delete test lead
      if (this.testLeadId) {
        const { error: leadError } = await supabase
          .from('leads')
          .delete()
          .eq('id', this.testLeadId);
        
        if (leadError) {
          console.warn(`⚠️ Failed to cleanup test lead: ${leadError.message}`);
        } else {
          console.log('🗑️ Deleted test lead');
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ Cleanup failed: ${error.message}`);
    }
  }

  printFinalReport() {
    const totalTime = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 APPOINTMENT BOOKING TEST REPORT');
    console.log('='.repeat(60));
    
    console.log(`🎯 Overall Result: ${passedTests === totalTests ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
    console.log(`📊 Success Rate: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
    console.log(`⏱️  Total Testing Time: ${Math.round(totalTime/1000)}s`);
    
    console.log('\n📈 Test Results:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${result.testType.toUpperCase()}`);
      
      if (result.testType === 'basic' && result.success) {
        console.log(`     Zoom Link: ${result.hasZoomLink ? '✅' : '❌'}`);
        console.log(`     Calendar: ${result.hasCalendarEvent ? '✅' : '❌'}`);
      }
      
      if (result.testType === 'conflict' && result.success) {
        console.log(`     Conflict Detection: ${result.conflictDetected ? '✅' : '❌'}`);
        console.log(`     Alternatives: ${result.alternativesProvided}`);
      }
    });
    
    if (passedTests < totalTests) {
      console.log('\n🔍 Failed Tests:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`  ❌ ${result.testType}: ${result.error}`);
      });
    }
    
    console.log('\n🎉 Appointment Booking Testing Complete!');
    console.log('='.repeat(60));
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showUsage() {
    console.log('\nUsage: node test_appointment_booking.js [test_type]');
    console.log('\nAvailable test types:');
    console.log('  basic: Basic appointment booking');
    console.log('  conflict: Conflict detection and resolution');
    console.log('  calendar: Google Calendar integration');
    console.log('  zoom: Zoom link generation');
    console.log('  edge: Edge cases and error handling');
    console.log('  all: Run all tests');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  const tester = new AppointmentBookingTester();
  await tester.runTests(testType);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { AppointmentBookingTester };
