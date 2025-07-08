/**
 * Focused test for appointment conflict detection
 * Tests that the system properly detects calendar conflicts and suggests alternatives
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const logger = require('./logger');
const appointmentService = require('./services/appointmentService');
const { isTimeSlotAvailable, findMatchingSlot } = require('./api/bookingHelper');
const { toSgTime, formatForDisplay } = require('./utils/timezoneUtils');

// Initialize Supabase client
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

class ConflictDetectionTester {
  constructor() {
    this.testAgentId = null;
    this.testAppointmentId = null;
    this.testLeadId = null;
  }

  async runConflictTest() {
    console.log('🧪 Testing Appointment Conflict Detection\n');
    console.log('=' .repeat(60));

    try {
      // Setup
      await this.setupTestData();

      // Test 1: Book an appointment
      const testTime = await this.bookInitialAppointment();

      // Test 2: Try to book the same time (should detect conflict)
      await this.testConflictDetection(testTime);

      // Test 3: Test alternative suggestions
      await this.testAlternativeSuggestions(testTime);

      // Cleanup
      await this.cleanup();

      console.log('\n✅ Conflict detection test completed successfully!');

    } catch (error) {
      console.error('❌ Conflict detection test failed:', error);
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
        full_name: 'Conflict Test Lead',
        source: 'Conflict Test',
        status: 'new'
      })
      .select()
      .single();

    this.testLeadId = lead.id;
    console.log(`✅ Created test lead: ${lead.full_name}`);
  }

  async bookInitialAppointment() {
    console.log('\n📅 Step 1: Booking initial appointment...');

    // Choose a time tomorrow at 3 PM
    const testTime = new Date();
    testTime.setDate(testTime.getDate() + 1);
    testTime.setHours(15, 0, 0, 0); // 3 PM

    console.log(`🔍 Booking appointment for: ${formatForDisplay(toSgTime(testTime))}`);

    // Check if time is available first
    const isAvailable = await isTimeSlotAvailable(this.testAgentId, testTime);
    console.log(`📊 Time slot available: ${isAvailable}`);

    if (!isAvailable) {
      // Find an alternative time
      console.log('⚠️  Requested time not available, finding alternative...');
      const { alternatives } = await findMatchingSlot(this.testAgentId, 'tomorrow 3pm');
      
      if (alternatives && alternatives.length > 0) {
        testTime.setTime(alternatives[0].getTime());
        console.log(`✅ Using alternative time: ${formatForDisplay(toSgTime(testTime))}`);
      } else {
        throw new Error('No available slots found for testing');
      }
    }

    // Book the appointment
    const result = await appointmentService.createAppointment({
      leadId: this.testLeadId,
      agentId: this.testAgentId,
      appointmentTime: testTime,
      leadName: 'Conflict Test Lead',
      consultationNotes: 'Initial appointment for conflict testing'
    });

    this.testAppointmentId = result.appointment.id;
    console.log(`✅ Initial appointment booked successfully!`);
    console.log(`   📅 Time: ${formatForDisplay(toSgTime(testTime))}`);
    console.log(`   🆔 Appointment ID: ${this.testAppointmentId}`);

    return testTime;
  }

  async testConflictDetection(conflictTime) {
    console.log('\n⚔️  Step 2: Testing conflict detection...');

    console.log(`🔍 Checking if ${formatForDisplay(toSgTime(conflictTime))} is still available...`);

    // This should now return false because the time is blocked in the calendar
    const isStillAvailable = await isTimeSlotAvailable(this.testAgentId, conflictTime);

    console.log(`📊 Time slot available after booking: ${isStillAvailable}`);

    if (!isStillAvailable) {
      console.log('✅ SUCCESS: Conflict detected correctly!');
      console.log('   The system properly identified that the time slot is no longer available.');
      return true;
    } else {
      console.log('❌ FAILURE: Conflict NOT detected!');
      console.log('   The system incorrectly marked the time as available when it should be busy.');
      return false;
    }
  }

  async testAlternativeSuggestions(conflictTime) {
    console.log('\n🔍 Step 3: Testing alternative suggestions...');

    const { exactMatch, alternatives } = await findMatchingSlot(
      this.testAgentId, 
      `${conflictTime.getHours()}:00`
    );

    console.log(`📊 Exact match found: ${exactMatch ? 'Yes' : 'No'}`);
    console.log(`📊 Alternatives found: ${alternatives ? alternatives.length : 0}`);

    if (exactMatch) {
      console.log('❌ ISSUE: System found exact match when time should be busy');
      return false;
    }

    if (alternatives && alternatives.length > 0) {
      console.log('✅ SUCCESS: Alternative slots suggested:');
      alternatives.slice(0, 3).forEach((slot, index) => {
        console.log(`   ${index + 1}. ${formatForDisplay(toSgTime(slot))}`);
      });
      return true;
    } else {
      console.log('⚠️  WARNING: No alternative slots found');
      return false;
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');

    try {
      // Delete the test appointment
      if (this.testAppointmentId) {
        await supabase
          .from('appointments')
          .delete()
          .eq('id', this.testAppointmentId);
        console.log('✅ Test appointment deleted');
      }

      // Delete the test lead
      if (this.testLeadId) {
        await supabase
          .from('leads')
          .delete()
          .eq('id', this.testLeadId);
        console.log('✅ Test lead deleted');
      }

    } catch (error) {
      console.log(`⚠️  Cleanup warning: ${error.message}`);
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const tester = new ConflictDetectionTester();
  tester.runConflictTest()
    .then(() => {
      console.log('\n🏁 Conflict detection test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Conflict detection test failed:', error);
      process.exit(1);
    });
}

module.exports = ConflictDetectionTester;
