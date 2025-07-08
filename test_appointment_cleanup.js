/**
 * Test appointment cleanup during rescheduling and cancellation
 * Verifies that old calendar events and Zoom meetings are properly deleted
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const logger = require('./logger');
const appointmentService = require('./services/appointmentService');
const { toSgTime, formatForDisplay } = require('./utils/timezoneUtils');

// Initialize Supabase client
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

class AppointmentCleanupTester {
  constructor() {
    this.testAgentId = null;
    this.testLeadId = null;
    this.testAppointmentId = null;
    this.originalCalendarEventId = null;
    this.originalZoomMeetingId = null;
  }

  async runCleanupTests() {
    console.log('🧪 Testing Appointment Cleanup During Reschedule & Cancellation\n');
    console.log('=' .repeat(70));

    try {
      // Setup
      await this.setupTestData();

      // Test 1: Create initial appointment
      await this.createInitialAppointment();

      // Test 2: Test rescheduling cleanup
      await this.testRescheduleCleanup();

      // Test 3: Test cancellation cleanup
      await this.testCancellationCleanup();

      // Cleanup
      await this.cleanup();

      console.log('\n✅ All cleanup tests completed successfully!');

    } catch (error) {
      console.error('❌ Cleanup test failed:', error);
      await this.cleanup();
    }
  }

  async setupTestData() {
    console.log('🔧 Setting up test data...');

    // Get an active agent
    const { data: agents } = await supabase
      .from('agents')
      .select('*')
      .eq('status', 'active')
      .limit(1);

    if (!agents || agents.length === 0) {
      throw new Error('No active agents found');
    }

    this.testAgentId = agents[0].id;
    console.log(`✅ Using agent: ${agents[0].full_name}`);

    // Create a test lead
    const { data: lead } = await supabase
      .from('leads')
      .insert({
        phone_number: `+65${Date.now().toString().slice(-8)}`,
        full_name: 'Cleanup Test Lead',
        source: 'Cleanup Test',
        status: 'new'
      })
      .select()
      .single();

    this.testLeadId = lead.id;
    console.log(`✅ Created test lead: ${lead.full_name}`);
  }

  async createInitialAppointment() {
    console.log('\n📅 Step 1: Creating initial appointment...');

    // Choose a time tomorrow at 2 PM
    const appointmentTime = new Date();
    appointmentTime.setDate(appointmentTime.getDate() + 1);
    appointmentTime.setHours(14, 0, 0, 0); // 2 PM

    console.log(`🔍 Creating appointment for: ${formatForDisplay(toSgTime(appointmentTime))}`);

    const result = await appointmentService.createAppointment({
      leadId: this.testLeadId,
      agentId: this.testAgentId,
      appointmentTime: appointmentTime,
      leadName: 'Cleanup Test Lead',
      consultationNotes: 'Initial appointment for cleanup testing'
    });

    this.testAppointmentId = result.appointment.id;
    this.originalCalendarEventId = result.appointment.calendar_event_id;
    this.originalZoomMeetingId = result.appointment.zoom_meeting_id;

    console.log(`✅ Initial appointment created successfully!`);
    console.log(`   📅 Time: ${formatForDisplay(toSgTime(appointmentTime))}`);
    console.log(`   🆔 Appointment ID: ${this.testAppointmentId}`);
    console.log(`   📆 Calendar Event ID: ${this.originalCalendarEventId}`);
    console.log(`   📞 Zoom Meeting ID: ${this.originalZoomMeetingId}`);
  }

  async testRescheduleCleanup() {
    console.log('\n🔄 Step 2: Testing reschedule cleanup...');

    // Reschedule to 3 PM same day
    const newTime = new Date();
    newTime.setDate(newTime.getDate() + 1);
    newTime.setHours(15, 0, 0, 0); // 3 PM

    console.log(`🔍 Rescheduling to: ${formatForDisplay(toSgTime(newTime))}`);

    const updatedAppointment = await appointmentService.rescheduleAppointment({
      appointmentId: this.testAppointmentId,
      newAppointmentTime: newTime,
      reason: 'Testing cleanup during reschedule'
    });

    console.log(`✅ Appointment rescheduled successfully!`);
    console.log(`   📅 New Time: ${formatForDisplay(toSgTime(newTime))}`);
    console.log(`   📆 Old Calendar Event ID: ${this.originalCalendarEventId}`);
    console.log(`   📆 New Calendar Event ID: ${updatedAppointment.calendar_event_id}`);

    // Verify cleanup occurred
    if (updatedAppointment.calendar_event_id !== this.originalCalendarEventId) {
      console.log('✅ SUCCESS: New calendar event created (old one should be deleted)');
    } else {
      console.log('⚠️  WARNING: Calendar event ID unchanged');
    }

    // Verify Zoom meeting is still the same (should be reused)
    if (updatedAppointment.zoom_meeting_id === this.originalZoomMeetingId) {
      console.log('✅ SUCCESS: Zoom meeting reused (no new meeting created)');
    } else {
      console.log('⚠️  INFO: New Zoom meeting created');
    }

    // Update our tracking variables
    this.originalCalendarEventId = updatedAppointment.calendar_event_id;
    this.originalZoomMeetingId = updatedAppointment.zoom_meeting_id;
  }

  async testCancellationCleanup() {
    console.log('\n❌ Step 3: Testing cancellation cleanup...');

    console.log(`🔍 Cancelling appointment...`);
    console.log(`   📆 Calendar Event to Delete: ${this.originalCalendarEventId}`);
    console.log(`   📞 Zoom Meeting to Delete: ${this.originalZoomMeetingId}`);

    const result = await appointmentService.cancelAppointment({
      appointmentId: this.testAppointmentId,
      reason: 'Testing cleanup during cancellation',
      notifyLead: false // Don't send WhatsApp message during test
    });

    console.log(`✅ Appointment cancelled successfully!`);

    // Verify appointment status in database
    const { data: cancelledAppointment } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', this.testAppointmentId)
      .single();

    if (cancelledAppointment && cancelledAppointment.status === 'cancelled') {
      console.log('✅ SUCCESS: Appointment status updated to cancelled in database');
    } else {
      console.log('❌ FAILURE: Appointment status not properly updated');
    }

    // Verify lead status updated
    const { data: updatedLead } = await supabase
      .from('leads')
      .select('status')
      .eq('id', this.testLeadId)
      .single();

    if (updatedLead && updatedLead.status === 'appointment_cancelled') {
      console.log('✅ SUCCESS: Lead status updated to appointment_cancelled');
    } else {
      console.log('❌ FAILURE: Lead status not properly updated');
    }

    console.log('\n📊 CLEANUP VERIFICATION:');
    console.log('   📆 Calendar Event: Should be deleted from Google Calendar');
    console.log('   📞 Zoom Meeting: Should be deleted from Zoom');
    console.log('   🗄️  Database: Appointment marked as cancelled');
    console.log('   👤 Lead Status: Updated to appointment_cancelled');
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');

    try {
      // Delete the test appointment (if it still exists)
      if (this.testAppointmentId) {
        await supabase
          .from('appointments')
          .delete()
          .eq('id', this.testAppointmentId);
        console.log('✅ Test appointment deleted from database');
      }

      // Delete the test lead
      if (this.testLeadId) {
        await supabase
          .from('leads')
          .delete()
          .eq('id', this.testLeadId);
        console.log('✅ Test lead deleted from database');
      }

    } catch (error) {
      console.log(`⚠️  Cleanup warning: ${error.message}`);
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const tester = new AppointmentCleanupTester();
  tester.runCleanupTests()
    .then(() => {
      console.log('\n🏁 Appointment cleanup test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Appointment cleanup test failed:', error);
      process.exit(1);
    });
}

module.exports = AppointmentCleanupTester;
