// create_test_appointment.js
// Create a test appointment with events for deletion testing

require('dotenv').config();
const supabase = require('./supabaseClient');
const appointmentService = require('./services/appointmentService');

async function createTestAppointment() {
  console.log('\n🧪 CREATING TEST APPOINTMENT FOR DELETION TESTING\n');
  
  try {
    // 1. Find or create a test lead
    console.log('👤 Finding or creating test lead...');
    let { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone_number', '+6512345678')
      .single();

    if (leadError && leadError.code === 'PGRST116') {
      // Create test lead
      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert({
          phone_number: '+6512345678',
          full_name: 'Test User for Deletion',
          budget: '$800K - $1.2M',
          timeline: 'within_3_months',
          intent: 'buying',
          source: 'manual_test',
          status: 'new'
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create test lead: ${createError.message}`);
      }
      lead = newLead;
      console.log('✅ Created new test lead:', lead.id);
    } else if (leadError) {
      throw new Error(`Failed to find test lead: ${leadError.message}`);
    } else {
      console.log('✅ Found existing test lead:', lead.id);
    }

    // 2. Find an agent
    console.log('👨‍💼 Finding agent...');
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('status', 'active')
      .not('google_email', 'is', null)
      .not('zoom_user_id', 'is', null)
      .single();

    if (agentError) {
      throw new Error(`Failed to find agent: ${agentError.message}`);
    }
    console.log('✅ Found agent:', agent.full_name, `(${agent.google_email})`);

    // 3. Create appointment for tomorrow at 3 PM
    const appointmentTime = new Date();
    appointmentTime.setDate(appointmentTime.getDate() + 1);
    appointmentTime.setHours(15, 0, 0, 0); // 3 PM tomorrow

    console.log('📅 Creating appointment...');
    console.log(`   Time: ${appointmentTime.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`);
    console.log(`   Lead: ${lead.full_name}`);
    console.log(`   Agent: ${agent.full_name}`);

    const result = await appointmentService.createAppointment({
      leadId: lead.id,
      agentId: agent.id,
      appointmentTime: appointmentTime,
      leadName: lead.full_name,
      consultationNotes: 'Test appointment for deletion testing - created by automation script'
    });

    if (!result.success) {
      throw new Error(`Failed to create appointment: ${result.error}`);
    }

    console.log('\n🎉 TEST APPOINTMENT CREATED SUCCESSFULLY!');
    console.log(`📋 Appointment ID: ${result.appointment.id}`);
    console.log(`📅 Calendar Event ID: ${result.appointment.calendar_event_id || 'None'}`);
    console.log(`📹 Zoom Meeting ID: ${result.appointment.zoom_meeting_id || 'None'}`);
    console.log(`🔗 Zoom Join URL: ${result.appointment.zoom_join_url ? 'Generated' : 'None'}`);

    // 4. Verify the appointment was created properly
    console.log('\n🔍 Verifying appointment in database...');
    const { data: verifyAppointment, error: verifyError } = await supabase
      .from('appointments')
      .select(`
        *,
        leads (full_name, phone_number),
        agents (full_name, google_email, zoom_user_id)
      `)
      .eq('id', result.appointment.id)
      .single();

    if (verifyError) {
      throw new Error(`Failed to verify appointment: ${verifyError.message}`);
    }

    console.log('✅ Appointment verified in database:');
    console.log(`   Status: ${verifyAppointment.status}`);
    console.log(`   Time: ${new Date(verifyAppointment.appointment_time).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`);
    console.log(`   Lead: ${verifyAppointment.leads.full_name} (${verifyAppointment.leads.phone_number})`);
    console.log(`   Agent: ${verifyAppointment.agents.full_name} (${verifyAppointment.agents.google_email})`);
    console.log(`   Calendar Event: ${verifyAppointment.calendar_event_id || 'None'}`);
    console.log(`   Zoom Meeting: ${verifyAppointment.zoom_meeting_id || 'None'}`);

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Check your Google Calendar for the created event');
    console.log('2. Check your Zoom account for the created meeting');
    console.log('3. Run deletion tests with: node test_deletion_debug.js');
    console.log('4. Test rescheduling with: node test_rescheduling_flow.js basic');
    console.log(`5. Test cancellation with appointment ID: ${result.appointment.id}`);

    return result.appointment;

  } catch (error) {
    console.error('❌ Failed to create test appointment:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the creation
async function main() {
  await createTestAppointment();
  process.exit(0);
}

main().catch(console.error);
