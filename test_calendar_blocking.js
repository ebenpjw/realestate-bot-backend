// test_calendar_blocking.js
// Test Google Calendar blocking functionality for agents

require('dotenv').config();
const supabase = require('./supabaseClient');
const appointmentService = require('./services/appointmentService');
const { createEvent, deleteEvent } = require('./api/googleCalendarService');
const { isTimeSlotAvailable } = require('./api/bookingHelper');
const { formatForDisplay, toSgTime } = require('./utils/timezoneUtils');

class CalendarBlockingTester {
  constructor() {
    this.testAgentId = null;
    this.testLeadId = null;
    this.createdEvents = []; // Track events for cleanup
  }

  async setup() {
    console.log('🔧 Setting up test environment...');
    
    // Get test agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('status', 'active')
      .not('google_email', 'is', null)
      .single();

    if (agentError) {
      throw new Error(`Failed to find test agent: ${agentError.message}`);
    }

    this.testAgentId = agent.id;
    console.log(`✅ Using agent: ${agent.full_name} (${agent.google_email})`);

    // Get test lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone_number', '+6512345678')
      .single();

    if (leadError) {
      throw new Error(`Failed to find test lead: ${leadError.message}`);
    }

    this.testLeadId = lead.id;
    console.log(`✅ Using lead: ${lead.full_name}`);
  }

  async testAgentCalendarBlocking() {
    console.log('\n🚫 TESTING AGENT CALENDAR BLOCKING\n');

    try {
      // Step 1: Choose a test time (tomorrow at 2 PM)
      const testTime = new Date();
      testTime.setDate(testTime.getDate() + 1);
      testTime.setHours(14, 0, 0, 0);

      console.log(`📅 Test time: ${formatForDisplay(toSgTime(testTime))}`);

      // Step 2: Check if time is initially available
      console.log('\n🔍 Step 1: Checking initial availability...');
      const initiallyAvailable = await isTimeSlotAvailable(this.testAgentId, testTime);
      console.log(`   Initial availability: ${initiallyAvailable ? '✅ AVAILABLE' : '❌ BUSY'}`);

      if (!initiallyAvailable) {
        console.log('⚠️ Time slot already busy, choosing different time...');
        testTime.setHours(16, 0, 0, 0); // Try 4 PM instead
        console.log(`📅 New test time: ${formatForDisplay(toSgTime(testTime))}`);
      }

      // Step 3: Agent creates a blocking event in Google Calendar
      console.log('\n🚫 Step 2: Agent creates blocking event in Google Calendar...');
      
      const blockingEvent = await createEvent(this.testAgentId, {
        summary: '🚫 BLOCKED - Personal Time',
        description: 'Agent has blocked this time slot for personal use. Bot should not book appointments during this time.',
        startTimeISO: testTime.toISOString(),
        endTimeISO: new Date(testTime.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour
        location: 'Personal'
      });

      this.createdEvents.push({
        agentId: this.testAgentId,
        eventId: blockingEvent.id
      });

      console.log(`   ✅ Blocking event created: ${blockingEvent.id}`);
      console.log(`   📝 Event: "${blockingEvent.summary}"`);

      // Step 4: Wait a moment for Google Calendar to sync
      console.log('\n⏳ Step 3: Waiting for Google Calendar to sync...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 5: Check if time is now blocked
      console.log('\n🔍 Step 4: Checking availability after blocking...');
      const availableAfterBlocking = await isTimeSlotAvailable(this.testAgentId, testTime);
      console.log(`   Availability after blocking: ${availableAfterBlocking ? '❌ STILL AVAILABLE (ERROR!)' : '✅ BLOCKED (CORRECT!)'}`);

      // Step 6: Try to book appointment (should fail)
      console.log('\n📞 Step 5: Attempting to book appointment (should fail)...');
      
      try {
        const bookingResult = await appointmentService.createAppointment({
          leadId: this.testLeadId,
          agentId: this.testAgentId,
          appointmentTime: testTime,
          leadName: 'Test User for Calendar Blocking',
          consultationNotes: 'Testing calendar blocking functionality'
        });

        if (bookingResult.success) {
          console.log('   ❌ BOOKING SUCCEEDED (ERROR!) - Should have been blocked');
          return false;
        } else {
          console.log(`   ✅ BOOKING BLOCKED (CORRECT!) - ${bookingResult.error}`);
        }
      } catch (error) {
        console.log(`   ✅ BOOKING BLOCKED (CORRECT!) - ${error.message}`);
      }

      // Step 7: Remove blocking event
      console.log('\n🗑️ Step 6: Removing blocking event...');
      await deleteEvent(this.testAgentId, blockingEvent.id);
      console.log('   ✅ Blocking event removed');

      // Remove from tracking
      this.createdEvents = this.createdEvents.filter(e => e.eventId !== blockingEvent.id);

      // Step 8: Wait for sync and check availability again
      console.log('\n⏳ Step 7: Waiting for Google Calendar to sync...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('\n🔍 Step 8: Checking availability after unblocking...');
      const availableAfterUnblocking = await isTimeSlotAvailable(this.testAgentId, testTime);
      console.log(`   Availability after unblocking: ${availableAfterUnblocking ? '✅ AVAILABLE (CORRECT!)' : '❌ STILL BLOCKED (ERROR!)'}`);

      // Step 9: Try to book appointment again (should succeed)
      console.log('\n📞 Step 9: Attempting to book appointment (should succeed)...');
      
      const finalBookingResult = await appointmentService.createAppointment({
        leadId: this.testLeadId,
        agentId: this.testAgentId,
        appointmentTime: testTime,
        leadName: 'Test User for Calendar Blocking',
        consultationNotes: 'Testing calendar blocking functionality - final booking'
      });

      if (finalBookingResult.success) {
        console.log('   ✅ BOOKING SUCCEEDED (CORRECT!) - Time slot was properly unblocked');
        
        // Clean up the appointment
        await appointmentService.cancelAppointment({
          appointmentId: finalBookingResult.appointment.id,
          reason: 'Test cleanup',
          notifyLead: false
        });
        console.log('   🧹 Test appointment cleaned up');
        
        return true;
      } else {
        console.log(`   ❌ BOOKING FAILED (ERROR!) - ${finalBookingResult.error}`);
        return false;
      }

    } catch (error) {
      console.error('❌ Calendar blocking test failed:', error.message);
      return false;
    }
  }

  async testMultipleBlockingEvents() {
    console.log('\n🚫🚫 TESTING MULTIPLE BLOCKING EVENTS\n');

    try {
      const baseTime = new Date();
      baseTime.setDate(baseTime.getDate() + 2);
      baseTime.setHours(10, 0, 0, 0); // 10 AM day after tomorrow

      const blockingEvents = [];

      // Create multiple blocking events
      for (let i = 0; i < 3; i++) {
        const eventTime = new Date(baseTime.getTime() + (i * 2 * 60 * 60 * 1000)); // Every 2 hours
        
        console.log(`🚫 Creating blocking event ${i + 1}/3 at ${formatForDisplay(toSgTime(eventTime))}`);
        
        const event = await createEvent(this.testAgentId, {
          summary: `🚫 BLOCKED - Meeting ${i + 1}`,
          description: `Agent blocked time slot ${i + 1} for external meeting`,
          startTimeISO: eventTime.toISOString(),
          endTimeISO: new Date(eventTime.getTime() + 60 * 60 * 1000).toISOString(),
          location: 'External'
        });

        blockingEvents.push(event);
        this.createdEvents.push({
          agentId: this.testAgentId,
          eventId: event.id
        });
      }

      console.log('\n⏳ Waiting for Google Calendar to sync...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test each blocked time
      console.log('\n🔍 Testing each blocked time slot...');
      let allBlocked = true;

      for (let i = 0; i < 3; i++) {
        const eventTime = new Date(baseTime.getTime() + (i * 2 * 60 * 60 * 1000));
        const isAvailable = await isTimeSlotAvailable(this.testAgentId, eventTime);
        
        console.log(`   Slot ${i + 1} (${formatForDisplay(toSgTime(eventTime))}): ${isAvailable ? '❌ AVAILABLE (ERROR!)' : '✅ BLOCKED (CORRECT!)'}`);
        
        if (isAvailable) {
          allBlocked = false;
        }
      }

      // Clean up blocking events
      console.log('\n🗑️ Cleaning up blocking events...');
      for (const event of blockingEvents) {
        await deleteEvent(this.testAgentId, event.id);
        this.createdEvents = this.createdEvents.filter(e => e.eventId !== event.id);
      }

      return allBlocked;

    } catch (error) {
      console.error('❌ Multiple blocking events test failed:', error.message);
      return false;
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up any remaining test events...');
    
    for (const event of this.createdEvents) {
      try {
        await deleteEvent(event.agentId, event.eventId);
        console.log(`   ✅ Cleaned up event: ${event.eventId}`);
      } catch (error) {
        console.log(`   ⚠️ Failed to clean up event ${event.eventId}: ${error.message}`);
      }
    }
    
    this.createdEvents = [];
  }
}

async function main() {
  console.log('\n🧪 GOOGLE CALENDAR BLOCKING TEST SUITE\n');
  
  const tester = new CalendarBlockingTester();
  const results = [];

  try {
    await tester.setup();

    // Test 1: Basic calendar blocking
    results.push(await tester.testAgentCalendarBlocking());

    // Test 2: Multiple blocking events
    results.push(await tester.testMultipleBlockingEvents());

    // Summary
    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 CALENDAR BLOCKING TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Tests Passed: ${passed}/${total}`);
    console.log(`📈 Success Rate: ${Math.round((passed/total) * 100)}%`);
    
    if (passed === total) {
      console.log('\n🎉 ALL CALENDAR BLOCKING TESTS PASSED! 🎉');
      console.log('\n📋 AGENT INSTRUCTIONS:');
      console.log('1. Create any Google Calendar event to block time slots');
      console.log('2. Bot will automatically detect and respect blocked times');
      console.log('3. Delete calendar events to unblock time slots');
      console.log('4. Works with any calendar event (meetings, personal time, etc.)');
    } else {
      console.log('\n❌ Some tests failed. Please review the issues above.');
    }

  } finally {
    await tester.cleanup();
  }

  process.exit(0);
}

main().catch(console.error);
