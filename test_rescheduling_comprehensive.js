// test_rescheduling_comprehensive.js
// Comprehensive test for appointment rescheduling functionality

require('dotenv').config();
const supabase = require('./supabaseClient');
const appointmentService = require('./services/appointmentService');

class ReschedulingTester {
  constructor() {
    this.appointmentId = '72deb52b-a548-4120-95b9-d65a8626f27d';
    this.originalCalendarEventId = 'bop9stpsejgmmieqbd11o8h75s';
    this.originalZoomMeetingId = '86168771665';
  }

  async testSingleReschedule() {
    console.log('\n🔄 TESTING SINGLE RESCHEDULE\n');
    
    try {
      // Get original appointment details
      console.log('📋 Getting original appointment details...');
      const { data: originalAppointment, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', this.appointmentId)
        .single();

      if (error) {
        throw new Error(`Failed to get original appointment: ${error.message}`);
      }

      console.log('✅ Original appointment found:');
      console.log(`   Time: ${new Date(originalAppointment.appointment_time).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`);
      console.log(`   Calendar Event: ${originalAppointment.calendar_event_id}`);
      console.log(`   Zoom Meeting: ${originalAppointment.zoom_meeting_id}`);

      // Reschedule to 5 PM same day
      const newTime = new Date(originalAppointment.appointment_time);
      newTime.setHours(17, 0, 0, 0); // 5 PM

      console.log(`\n🔄 Rescheduling to: ${newTime.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`);

      const result = await appointmentService.rescheduleAppointment({
        appointmentId: this.appointmentId,
        newAppointmentTime: newTime,
        reason: 'Testing rescheduling functionality - automated test'
      });

      if (!result.success) {
        throw new Error(`Rescheduling failed: ${result.error}`);
      }

      console.log('\n✅ RESCHEDULING SUCCESSFUL!');
      console.log(`📅 New Time: ${new Date(result.appointment.appointment_time).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`);
      console.log(`🗓️ New Calendar Event: ${result.appointment.calendar_event_id}`);
      console.log(`📹 New Zoom Meeting: ${result.appointment.zoom_meeting_id}`);

      // Verify changes
      console.log('\n🔍 Verifying changes...');
      
      const timeChanged = new Date(result.appointment.appointment_time).getTime() !== new Date(originalAppointment.appointment_time).getTime();
      const calendarEventChanged = result.appointment.calendar_event_id !== originalAppointment.calendar_event_id;
      const zoomMeetingChanged = result.appointment.zoom_meeting_id !== originalAppointment.zoom_meeting_id;

      console.log(`   ✅ Time Changed: ${timeChanged ? 'YES' : 'NO'}`);
      console.log(`   ✅ Calendar Event Changed: ${calendarEventChanged ? 'YES' : 'NO'}`);
      console.log(`   ✅ Zoom Meeting Changed: ${zoomMeetingChanged ? 'YES' : 'NO'}`);

      if (timeChanged && calendarEventChanged && zoomMeetingChanged) {
        console.log('\n🎉 SINGLE RESCHEDULE TEST: PERFECT SUCCESS!');
        return true;
      } else {
        console.log('\n❌ SINGLE RESCHEDULE TEST: FAILED - Not all changes detected');
        return false;
      }

    } catch (error) {
      console.error('❌ Single reschedule test failed:', error.message);
      return false;
    }
  }

  async testMultipleReschedules() {
    console.log('\n🔄🔄 TESTING MULTIPLE RESCHEDULES\n');
    
    try {
      const reschedules = [
        { hour: 10, minute: 0, description: '10:00 AM' },
        { hour: 14, minute: 30, description: '2:30 PM' },
        { hour: 16, minute: 0, description: '4:00 PM' }
      ];

      let previousEventId = null;
      let previousZoomId = null;

      for (let i = 0; i < reschedules.length; i++) {
        const schedule = reschedules[i];
        console.log(`\n📅 Reschedule ${i + 1}/3: Moving to ${schedule.description}`);

        const newTime = new Date();
        newTime.setDate(newTime.getDate() + 2); // Day after tomorrow
        newTime.setHours(schedule.hour, schedule.minute, 0, 0);

        const result = await appointmentService.rescheduleAppointment({
          appointmentId: this.appointmentId,
          newAppointmentTime: newTime,
          reason: `Multiple reschedule test ${i + 1}/3 - moving to ${schedule.description}`
        });

        if (!result.success) {
          throw new Error(`Reschedule ${i + 1} failed: ${result.error}`);
        }

        console.log(`   ✅ New Time: ${new Date(result.appointment.appointment_time).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`);
        console.log(`   🗓️ Calendar Event: ${result.appointment.calendar_event_id}`);
        console.log(`   📹 Zoom Meeting: ${result.appointment.zoom_meeting_id}`);

        // Verify that IDs changed from previous reschedule
        if (i > 0) {
          const eventChanged = result.appointment.calendar_event_id !== previousEventId;
          const zoomChanged = result.appointment.zoom_meeting_id !== previousZoomId;
          console.log(`   ✅ Event ID Changed: ${eventChanged ? 'YES' : 'NO'}`);
          console.log(`   ✅ Zoom ID Changed: ${zoomChanged ? 'YES' : 'NO'}`);
        }

        previousEventId = result.appointment.calendar_event_id;
        previousZoomId = result.appointment.zoom_meeting_id;

        // Wait a moment between reschedules
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('\n🎉 MULTIPLE RESCHEDULES TEST: PERFECT SUCCESS!');
      return true;

    } catch (error) {
      console.error('❌ Multiple reschedules test failed:', error.message);
      return false;
    }
  }

  async testConflictDetection() {
    console.log('\n⚠️ TESTING CONFLICT DETECTION\n');
    
    try {
      // Try to reschedule to a time that conflicts with existing appointment
      const conflictTime = new Date();
      conflictTime.setDate(conflictTime.getDate() + 1);
      conflictTime.setHours(14, 0, 0, 0); // 2 PM tomorrow (where we have existing appointment)

      console.log(`🚫 Attempting to reschedule to conflicting time: ${conflictTime.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`);

      const result = await appointmentService.rescheduleAppointment({
        appointmentId: this.appointmentId,
        newAppointmentTime: conflictTime,
        reason: 'Testing conflict detection'
      });

      if (result.success) {
        console.log('❌ CONFLICT DETECTION FAILED: Should have detected conflict but didn\'t');
        return false;
      } else {
        console.log(`✅ CONFLICT DETECTED: ${result.error}`);
        console.log('🎉 CONFLICT DETECTION TEST: PERFECT SUCCESS!');
        return true;
      }

    } catch (error) {
      console.error('❌ Conflict detection test failed:', error.message);
      return false;
    }
  }
}

async function main() {
  console.log('\n🧪 COMPREHENSIVE RESCHEDULING TEST SUITE\n');
  
  const tester = new ReschedulingTester();
  const results = [];

  // Test 1: Single reschedule
  results.push(await tester.testSingleReschedule());

  // Test 2: Multiple reschedules
  results.push(await tester.testMultipleReschedules());

  // Test 3: Conflict detection
  results.push(await tester.testConflictDetection());

  // Summary
  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPREHENSIVE RESCHEDULING TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Tests Passed: ${passed}/${total}`);
  console.log(`📈 Success Rate: ${Math.round((passed/total) * 100)}%`);
  
  if (passed === total) {
    console.log('\n🎉 ALL RESCHEDULING TESTS PASSED! SYSTEM IS PERFECT! 🎉');
  } else {
    console.log('\n❌ Some tests failed. Please review the issues above.');
  }

  process.exit(passed === total ? 0 : 1);
}

main().catch(console.error);
