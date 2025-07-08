// test_deletion_debug.js
// Debug script to test event deletion specifically

require('dotenv').config();
const supabase = require('./supabaseClient');
const appointmentService = require('./services/appointmentService');
const { deleteEvent } = require('./api/googleCalendarService');
const { deleteZoomMeetingForUser } = require('./api/zoomServerService');

class DeletionDebugger {
  async testEventDeletion() {
    console.log('\n🔍 DEBUGGING EVENT DELETION ISSUES\n');
    
    try {
      // 1. Find recent appointments with events
      console.log('📋 Finding recent appointments...');
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_time,
          status,
          calendar_event_id,
          zoom_meeting_id,
          agent_id,
          consultation_notes,
          leads (full_name),
          agents (zoom_user_id, google_email)
        `)
        .or('calendar_event_id.not.is.null,zoom_meeting_id.not.is.null')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log(`Found ${appointments.length} appointments with events`);
      
      for (const appointment of appointments) {
        console.log(`\n📅 Appointment ${appointment.id}:`);
        console.log(`   Status: ${appointment.status}`);
        console.log(`   Calendar Event ID: ${appointment.calendar_event_id || 'None'}`);
        console.log(`   Zoom Meeting ID: ${appointment.zoom_meeting_id || 'None'}`);
        console.log(`   Agent ID: ${appointment.agent_id}`);
        console.log(`   Agent Zoom User ID: ${appointment.agents?.zoom_user_id || 'None'}`);
        console.log(`   Agent Google Email: ${appointment.agents?.google_email || 'None'}`);

        // Test calendar event deletion
        if (appointment.calendar_event_id) {
          console.log(`\n🗓️ Testing calendar event deletion...`);
          try {
            const result = await deleteEvent(appointment.agent_id, appointment.calendar_event_id);
            console.log(`   ✅ Calendar deletion result: ${result}`);
          } catch (error) {
            console.log(`   ❌ Calendar deletion failed: ${error.message}`);
            console.log(`   Error details:`, error.response?.data || error);
          }
        }

        // Test Zoom meeting deletion
        if (appointment.zoom_meeting_id && appointment.agents?.zoom_user_id) {
          console.log(`\n📹 Testing Zoom meeting deletion...`);
          try {
            await deleteZoomMeetingForUser(appointment.agents.zoom_user_id, appointment.zoom_meeting_id);
            console.log(`   ✅ Zoom deletion successful`);
          } catch (error) {
            console.log(`   ❌ Zoom deletion failed: ${error.message}`);
            console.log(`   Error details:`, error.response?.data || error);
          }
        }

        console.log(`\n${'='.repeat(50)}`);
      }

      // 2. Test appointment service cancellation
      if (appointments.length > 0) {
        const testAppointment = appointments[0];
        console.log(`\n🧪 Testing appointment service cancellation for ${testAppointment.id}...`);
        
        try {
          const result = await appointmentService.cancelAppointment(testAppointment.id, 'Debug test cancellation');
          console.log(`✅ Appointment service cancellation result:`, result);
        } catch (error) {
          console.log(`❌ Appointment service cancellation failed: ${error.message}`);
        }
      }

    } catch (error) {
      console.error('❌ Debug test failed:', error);
    }
  }

  async cleanupOrphanedEvents() {
    console.log('\n🧹 CLEANING UP ORPHANED EVENTS\n');
    
    try {
      // Find all cancelled/completed appointments with events still attached
      const { data: orphanedAppointments, error } = await supabase
        .from('appointments')
        .select(`
          id,
          status,
          calendar_event_id,
          zoom_meeting_id,
          agent_id,
          agents (zoom_user_id, google_email)
        `)
        .in('status', ['cancelled', 'completed'])
        .or('calendar_event_id.not.is.null,zoom_meeting_id.not.is.null');

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log(`Found ${orphanedAppointments.length} appointments with orphaned events`);

      for (const appointment of orphanedAppointments) {
        console.log(`\n🧹 Cleaning appointment ${appointment.id} (${appointment.status})...`);

        // Clean calendar event
        if (appointment.calendar_event_id) {
          try {
            await deleteEvent(appointment.agent_id, appointment.calendar_event_id);
            console.log(`   ✅ Deleted calendar event ${appointment.calendar_event_id}`);
            
            // Clear from database
            await supabase
              .from('appointments')
              .update({ calendar_event_id: null })
              .eq('id', appointment.id);
              
          } catch (error) {
            console.log(`   ❌ Failed to delete calendar event: ${error.message}`);
          }
        }

        // Clean Zoom meeting
        if (appointment.zoom_meeting_id && appointment.agents?.zoom_user_id) {
          try {
            await deleteZoomMeetingForUser(appointment.agents.zoom_user_id, appointment.zoom_meeting_id);
            console.log(`   ✅ Deleted Zoom meeting ${appointment.zoom_meeting_id}`);
            
            // Clear from database
            await supabase
              .from('appointments')
              .update({ 
                zoom_meeting_id: null,
                zoom_join_url: null,
                zoom_password: null
              })
              .eq('id', appointment.id);
              
          } catch (error) {
            console.log(`   ❌ Failed to delete Zoom meeting: ${error.message}`);
          }
        }
      }

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

// Run the debug tests
async function main() {
  const tester = new DeletionDebugger();

  const command = process.argv[2];

  if (command === 'cleanup') {
    await tester.cleanupOrphanedEvents();
  } else {
    await tester.testEventDeletion();
  }

  process.exit(0);
}

main().catch(console.error);
