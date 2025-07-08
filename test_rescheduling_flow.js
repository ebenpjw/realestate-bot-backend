#!/usr/bin/env node

/**
 * Real Estate Bot Rescheduling Flow Testing
 * Tests appointment rescheduling, event deletion, and calendar cleanup
 * 
 * Usage:
 *   node test_rescheduling_flow.js [test_type]
 * 
 * Test Types:
 *   - basic: Basic rescheduling flow
 *   - multiple: Multiple reschedule attempts
 *   - cleanup: Event deletion and cleanup
 *   - conflict: Rescheduling with conflicts
 *   - all: Run all rescheduling tests
 */

const axios = require('axios');
const supabase = require('./supabaseClient');
const appointmentService = require('./services/appointmentService');
const { formatForDisplay, toSgTime } = require('./utils/timezoneUtils');

// Configuration
const BASE_URL = process.env.RAILWAY_URL || 'http://localhost:8080';

class ReschedulingFlowTester {
  constructor() {
    this.results = [];
    this.testLeadId = null;
    this.testAgentId = null;
    this.createdAppointments = [];
    this.createdEvents = [];
    this.startTime = Date.now();
  }

  async runTests(testType = 'all') {
    console.log('📅 Real Estate Bot Rescheduling Flow Testing');
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
      console.error(`❌ Rescheduling testing failed: ${error.message}`);
      await this.cleanupTestData();
      process.exit(1);
    }
  }

  async setupTestData() {
    console.log('🔧 Setting up rescheduling test data...');
    
    try {
      // Create test lead
      const testPhoneNumber = `+65${Date.now().toString().slice(-8)}`;
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          phone_number: testPhoneNumber,
          full_name: 'Rescheduling Test Lead',
          status: 'qualified',
          budget: '$1M',
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
    console.log('🧪 Running all rescheduling tests...\n');
    
    const tests = [
      'basic',
      'multiple',
      'cleanup',
      'conflict'
    ];
    
    for (const test of tests) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📋 TEST: ${test.toUpperCase()}`);
      console.log(`${'='.repeat(50)}\n`);
      
      await this.runSingleTest(test);
      
      // Brief pause between tests
      await this.delay(3000);
    }
  }

  async runSingleTest(testType) {
    try {
      switch (testType) {
        case 'basic':
          await this.testBasicRescheduling();
          break;
        case 'multiple':
          await this.testMultipleReschedules();
          break;
        case 'cleanup':
          await this.testEventCleanup();
          break;
        case 'conflict':
          await this.testReschedulingWithConflicts();
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

  async testBasicRescheduling() {
    console.log('📅 Testing basic appointment rescheduling...');
    
    try {
      // Step 1: Create initial appointment
      const initialTime = new Date();
      initialTime.setDate(initialTime.getDate() + 1);
      initialTime.setHours(9, 0, 0, 0); // 9 AM tomorrow (less likely to conflict)

      console.log(`📝 Creating initial appointment for: ${formatForDisplay(toSgTime(initialTime))}`);
      
      const initialResult = await appointmentService.createAppointment({
        leadId: this.testLeadId,
        agentId: this.testAgentId,
        appointmentTime: initialTime,
        leadName: 'Rescheduling Test Lead',
        consultationNotes: 'Initial appointment for rescheduling test'
      });

      if (!initialResult.success) {
        throw new Error(`Initial appointment creation failed: ${initialResult.error}`);
      }

      const appointmentId = initialResult.appointment.id;
      this.createdAppointments.push(appointmentId);
      
      console.log('✅ Initial appointment created successfully');
      console.log(`📅 Time: ${formatForDisplay(toSgTime(initialTime))}`);
      console.log(`🆔 Appointment ID: ${appointmentId}`);
      console.log(`🔗 Zoom Link: ${initialResult.appointment.zoom_join_url ? 'Generated' : 'Missing'}`);
      console.log(`📧 Calendar Event: ${initialResult.appointment.google_event_id ? 'Created' : 'Missing'}`);

      // Store initial event ID for cleanup verification
      if (initialResult.appointment.google_event_id) {
        this.createdEvents.push(initialResult.appointment.google_event_id);
      }

      // Step 2: Reschedule to new time
      const newTime = new Date();
      newTime.setDate(newTime.getDate() + 2);
      newTime.setHours(11, 0, 0, 0); // 11 AM day after tomorrow

      console.log(`\n🔄 Rescheduling to: ${formatForDisplay(toSgTime(newTime))}`);

      const rescheduleResult = await appointmentService.rescheduleAppointment({
        appointmentId: appointmentId,
        newAppointmentTime: newTime,
        rescheduleReason: 'Testing rescheduling functionality'
      });

      if (!rescheduleResult.success) {
        throw new Error(`Rescheduling failed: ${rescheduleResult.error}`);
      }

      console.log('✅ Appointment rescheduled successfully');
      console.log(`📅 New Time: ${formatForDisplay(toSgTime(newTime))}`);
      console.log(`🔗 New Zoom Link: ${rescheduleResult.appointment.zoom_join_url ? 'Generated' : 'Missing'}`);
      console.log(`📧 New Calendar Event: ${rescheduleResult.appointment.calendar_event_id ? 'Created' : 'Missing'}`);

      // Wait a moment for async operations to complete
      await this.delay(2000);

      // Step 3: Verify old event was deleted and new one created
      const { data: finalAppointment } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      const oldEventDeleted = finalAppointment.calendar_event_id !== initialResult.appointment.calendar_event_id;
      const newEventCreated = !!finalAppointment.calendar_event_id;
      const timeUpdated = new Date(finalAppointment.appointment_time).getTime() === newTime.getTime();

      console.log(`\n🔍 Verification Results:`);
      console.log(`  📅 Time Updated: ${timeUpdated ? '✅' : '❌'}`);
      console.log(`  🗑️ Old Event Deleted: ${oldEventDeleted ? '✅' : '❌'}`);
      console.log(`  📧 New Event Created: ${newEventCreated ? '✅' : '❌'}`);

      this.results.push({
        testType: 'basic',
        success: timeUpdated && oldEventDeleted && newEventCreated,
        details: {
          initialAppointmentId: appointmentId,
          timeUpdated,
          oldEventDeleted,
          newEventCreated,
          initialTime: formatForDisplay(toSgTime(initialTime)),
          newTime: formatForDisplay(toSgTime(newTime))
        }
      });
      
    } catch (error) {
      console.error(`❌ Basic rescheduling test failed: ${error.message}`);
      throw error;
    }
  }

  async testMultipleReschedules() {
    console.log('🔄 Testing multiple reschedule attempts...');
    
    try {
      // Create initial appointment
      const initialTime = new Date();
      initialTime.setDate(initialTime.getDate() + 3);
      initialTime.setHours(10, 0, 0, 0); // 10 AM in 3 days

      const initialResult = await appointmentService.createAppointment({
        leadId: this.testLeadId,
        agentId: this.testAgentId,
        appointmentTime: initialTime,
        leadName: 'Multiple Reschedule Test',
        consultationNotes: 'Testing multiple reschedules'
      });

      if (!initialResult.success) {
        throw new Error(`Initial appointment creation failed: ${initialResult.error}`);
      }

      const appointmentId = initialResult.appointment.id;
      this.createdAppointments.push(appointmentId);
      
      console.log(`✅ Initial appointment created: ${formatForDisplay(toSgTime(initialTime))}`);

      const reschedules = [];
      const times = [
        { hours: 11, label: '11 AM' },
        { hours: 15, label: '3 PM' },
        { hours: 17, label: '5 PM' }
      ];

      // Perform multiple reschedules
      for (let i = 0; i < times.length; i++) {
        const rescheduleTime = new Date();
        rescheduleTime.setDate(rescheduleTime.getDate() + 3);
        rescheduleTime.setHours(times[i].hours, 0, 0, 0);

        console.log(`\n🔄 Reschedule ${i + 1}: ${times[i].label}`);

        const rescheduleResult = await appointmentService.rescheduleAppointment({
          appointmentId: appointmentId,
          newAppointmentTime: rescheduleTime,
          rescheduleReason: `Multiple reschedule test #${i + 1}`
        });

        reschedules.push({
          attempt: i + 1,
          success: rescheduleResult.success,
          time: formatForDisplay(toSgTime(rescheduleTime)),
          error: rescheduleResult.error
        });

        if (rescheduleResult.success) {
          console.log(`✅ Reschedule ${i + 1} successful`);
        } else {
          console.log(`❌ Reschedule ${i + 1} failed: ${rescheduleResult.error}`);
        }

        // Brief delay between reschedules
        await this.delay(1000);
      }

      const successfulReschedules = reschedules.filter(r => r.success).length;
      console.log(`\n📊 Multiple reschedule results: ${successfulReschedules}/${reschedules.length} successful`);

      this.results.push({
        testType: 'multiple',
        success: successfulReschedules === reschedules.length,
        details: {
          totalAttempts: reschedules.length,
          successfulReschedules,
          reschedules
        }
      });
      
    } catch (error) {
      console.error(`❌ Multiple reschedule test failed: ${error.message}`);
      throw error;
    }
  }

  async testEventCleanup() {
    console.log('🗑️ Testing event deletion and cleanup...');
    
    try {
      // Create appointment with calendar event
      const appointmentTime = new Date();
      appointmentTime.setDate(appointmentTime.getDate() + 4);
      appointmentTime.setHours(13, 0, 0, 0); // 1 PM in 4 days

      const createResult = await appointmentService.createAppointment({
        leadId: this.testLeadId,
        agentId: this.testAgentId,
        appointmentTime: appointmentTime,
        leadName: 'Cleanup Test Lead',
        consultationNotes: 'Testing event cleanup'
      });

      if (!createResult.success) {
        throw new Error(`Appointment creation failed: ${createResult.error}`);
      }

      const appointmentId = createResult.appointment.id;
      const originalEventId = createResult.appointment.google_event_id;
      this.createdAppointments.push(appointmentId);

      console.log(`✅ Appointment created with event ID: ${originalEventId}`);

      // Cancel the appointment (should delete calendar event)
      console.log('\n🗑️ Cancelling appointment to test cleanup...');

      const cancelResult = await appointmentService.cancelAppointment({
        appointmentId: appointmentId,
        cancellationReason: 'Testing event cleanup'
      });

      if (!cancelResult.success) {
        throw new Error(`Appointment cancellation failed: ${cancelResult.error}`);
      }

      console.log('✅ Appointment cancelled successfully');

      // Verify appointment status and event cleanup
      const { data: cancelledAppointment } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      const statusUpdated = cancelledAppointment.status === 'cancelled';
      const eventCleanedUp = !cancelledAppointment.google_event_id || 
                            cancelledAppointment.google_event_id !== originalEventId;

      console.log(`\n🔍 Cleanup Verification:`);
      console.log(`  📅 Status Updated: ${statusUpdated ? '✅' : '❌'}`);
      console.log(`  🗑️ Event Cleaned Up: ${eventCleanedUp ? '✅' : '❌'}`);

      this.results.push({
        testType: 'cleanup',
        success: statusUpdated && eventCleanedUp,
        details: {
          appointmentId,
          originalEventId,
          statusUpdated,
          eventCleanedUp,
          finalStatus: cancelledAppointment.status
        }
      });
      
    } catch (error) {
      console.error(`❌ Event cleanup test failed: ${error.message}`);
      throw error;
    }
  }

  async testReschedulingWithConflicts() {
    console.log('⚔️ Testing rescheduling with conflicts...');
    
    try {
      // Create two appointments at different times
      const time1 = new Date();
      time1.setDate(time1.getDate() + 5);
      time1.setHours(14, 0, 0, 0); // 2 PM in 5 days

      const time2 = new Date();
      time2.setDate(time2.getDate() + 5);
      time2.setHours(16, 0, 0, 0); // 4 PM in 5 days

      // Create first appointment
      const appointment1 = await appointmentService.createAppointment({
        leadId: this.testLeadId,
        agentId: this.testAgentId,
        appointmentTime: time1,
        leadName: 'Conflict Test Lead 1',
        consultationNotes: 'First appointment for conflict test'
      });

      if (!appointment1.success) {
        throw new Error(`First appointment creation failed: ${appointment1.error}`);
      }

      this.createdAppointments.push(appointment1.appointment.id);
      console.log(`✅ First appointment created: ${formatForDisplay(toSgTime(time1))}`);

      // Create second appointment
      const appointment2 = await appointmentService.createAppointment({
        leadId: this.testLeadId,
        agentId: this.testAgentId,
        appointmentTime: time2,
        leadName: 'Conflict Test Lead 2',
        consultationNotes: 'Second appointment for conflict test'
      });

      if (!appointment2.success) {
        throw new Error(`Second appointment creation failed: ${appointment2.error}`);
      }

      this.createdAppointments.push(appointment2.appointment.id);
      console.log(`✅ Second appointment created: ${formatForDisplay(toSgTime(time2))}`);

      // Try to reschedule first appointment to second appointment's time (should detect conflict)
      console.log(`\n⚔️ Attempting to reschedule first appointment to conflict with second...`);

      const conflictReschedule = await appointmentService.rescheduleAppointment({
        appointmentId: appointment1.appointment.id,
        newAppointmentTime: time2,
        rescheduleReason: 'Testing conflict detection'
      });

      const conflictDetected = !conflictReschedule.success && 
                              conflictReschedule.error.toLowerCase().includes('conflict');

      console.log(`🔍 Conflict Detection: ${conflictDetected ? '✅ DETECTED' : '❌ MISSED'}`);

      if (conflictDetected) {
        console.log(`📝 Conflict message: ${conflictReschedule.error}`);
      }

      // Try rescheduling to a non-conflicting time
      const safeTime = new Date();
      safeTime.setDate(safeTime.getDate() + 5);
      safeTime.setHours(18, 0, 0, 0); // 6 PM (no conflict)

      console.log(`\n✅ Rescheduling to safe time: ${formatForDisplay(toSgTime(safeTime))}`);

      const safeReschedule = await appointmentService.rescheduleAppointment({
        appointmentId: appointment1.appointment.id,
        newAppointmentTime: safeTime,
        rescheduleReason: 'Rescheduling to avoid conflict'
      });

      const safeRescheduleSuccess = safeReschedule.success;
      console.log(`🔍 Safe Reschedule: ${safeRescheduleSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);

      this.results.push({
        testType: 'conflict',
        success: conflictDetected && safeRescheduleSuccess,
        details: {
          conflictDetected,
          safeRescheduleSuccess,
          conflictError: conflictReschedule.error,
          safeRescheduleError: safeReschedule.error
        }
      });
      
    } catch (error) {
      console.error(`❌ Conflict rescheduling test failed: ${error.message}`);
      throw error;
    }
  }

  async cleanupTestData() {
    console.log('\n🧹 Cleaning up rescheduling test data...');
    
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
    console.log('📋 RESCHEDULING FLOW TEST REPORT');
    console.log('='.repeat(60));
    
    console.log(`🎯 Overall Result: ${passedTests === totalTests ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
    console.log(`📊 Success Rate: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
    console.log(`⏱️  Total Testing Time: ${Math.round(totalTime/1000)}s`);
    
    console.log('\n📈 Test Results:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${result.testType.toUpperCase()}`);
      
      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          if (typeof value === 'boolean') {
            console.log(`     ${key}: ${value ? '✅' : '❌'}`);
          } else if (typeof value === 'object' && !Array.isArray(value)) {
            console.log(`     ${key}: ${JSON.stringify(value, null, 2)}`);
          } else {
            console.log(`     ${key}: ${value}`);
          }
        });
      }
    });
    
    if (passedTests < totalTests) {
      console.log('\n🔍 Failed Tests:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`  ❌ ${result.testType}: ${result.error}`);
      });
    }
    
    console.log('\n🎉 Rescheduling Flow Testing Complete!');
    console.log('='.repeat(60));
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  const tester = new ReschedulingFlowTester();
  await tester.runTests(testType);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { ReschedulingFlowTester };
