// Test 8pm today appointment - should detect conflict and offer alternatives
const { BotService } = require('./services/botService');
const supabase = require('./supabaseClient');

async function test8pmConflict() {
  console.log('🧪 Testing 8pm Today Appointment (Should be blocked)\n');
  
  const botService = new BotService();
  let testLeadId = null;
  
  try {
    // Create a test lead
    console.log('📝 Creating test lead...');
    const testPhone = `+6512345678`;
    
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        phone_number: testPhone,
        full_name: 'Test User 8PM',
        status: 'qualified',
        source: 'Test',
        intent: 'own_stay',
        budget: '500k-1m'
      })
      .select()
      .single();

    if (error) throw error;
    testLeadId = lead.id;
    console.log(`✅ Test lead created: ${lead.id}\n`);

    // Test the intelligent booking system with 8pm today
    console.log('🕰️ Testing appointment booking for 8pm today...');
    console.log('Expected: Should detect conflict and offer alternatives\n');
    
    const appointmentService = botService.appointmentService;
    const agentId = '7ccc7c4b-4ce7-4d8b-8a85-05efc7d8ec59';
    
    const result = await appointmentService.findAndBookAppointment({
      leadId: testLeadId,
      agentId: agentId,
      userMessage: 'can we do 8pm today please',
      leadName: 'Test User 8PM',
      consultationNotes: 'Test booking for 8pm conflict'
    });

    console.log('📋 Booking Result:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Message: ${result.message}`);
    
    // Check if alternatives were offered
    const { data: updatedLead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', testLeadId)
      .single();
    
    console.log('\n📊 Lead Status After Booking Attempt:');
    console.log(`   Status: ${updatedLead.status}`);
    console.log(`   Has alternatives: ${!!updatedLead.booking_alternatives}`);
    
    if (updatedLead.booking_alternatives) {
      const alternatives = JSON.parse(updatedLead.booking_alternatives);
      console.log(`   Number of alternatives: ${alternatives.length}`);
      
      alternatives.forEach((alt, index) => {
        const altTime = new Date(alt);
        const sgTime = altTime.toLocaleString('en-SG', { 
          timeZone: 'Asia/Singapore',
          weekday: 'short',
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        console.log(`   Alternative ${index + 1}: ${sgTime}`);
      });
    }
    
    // Check if any appointment was actually created
    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', testLeadId);

    console.log(`\n📅 Appointments created: ${appointments?.length || 0}`);
    
    if (appointments?.length > 0) {
      console.log('❌ Unexpected: Appointment was created despite conflict!');
      appointments.forEach(apt => {
        const aptTime = new Date(apt.appointment_time);
        const sgTime = aptTime.toLocaleString('en-SG', { 
          timeZone: 'Asia/Singapore',
          weekday: 'short',
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        console.log(`   Appointment: ${sgTime}`);
      });
    } else {
      console.log('✅ Correct: No appointment created due to conflict');
    }
    
    // Test the intelligent context system
    console.log('\n🧠 Testing Intelligent Context Understanding...');
    
    if (updatedLead.booking_alternatives) {
      console.log('Simulating user accepting first alternative...');
      
      // Test intelligent alternative selection
      const aiInstructions = {
        preferred_time: 'first option',
        context_summary: 'User accepting first alternative after 8pm was unavailable',
        user_intent_confidence: 'high'
      };
      
      const alternativeResult = await botService._handleIntelligentAlternativeSelection({
        lead: updatedLead,
        agentId: agentId,
        aiInstructions: aiInstructions
      });
      
      console.log('\n📋 Alternative Selection Result:');
      console.log(`   Success: ${alternativeResult.success}`);
      console.log(`   Message: ${alternativeResult.message}`);
      
      // Check if appointment was created this time
      const { data: finalAppointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('lead_id', testLeadId);

      console.log(`\n📅 Final appointments created: ${finalAppointments?.length || 0}`);
      
      if (finalAppointments?.length > 0) {
        console.log('✅ Success: Appointment created after alternative selection');
        finalAppointments.forEach(apt => {
          const aptTime = new Date(apt.appointment_time);
          const sgTime = aptTime.toLocaleString('en-SG', { 
            timeZone: 'Asia/Singapore',
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          console.log(`   Booked: ${sgTime}`);
          console.log(`   Zoom URL: ${apt.zoom_join_url}`);
          console.log(`   Calendar Event: ${apt.calendar_event_id || 'Not created'}`);
        });
      }
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Cleanup
    if (testLeadId) {
      console.log('\n🧹 Cleaning up test data...');
      
      // Delete appointments first
      await supabase
        .from('appointments')
        .delete()
        .eq('lead_id', testLeadId);
      
      // Delete messages
      await supabase
        .from('messages')
        .delete()
        .eq('lead_id', testLeadId);
      
      // Delete lead
      await supabase
        .from('leads')
        .delete()
        .eq('id', testLeadId);
      
      console.log('✅ Test data cleaned up');
    }
  }
}

// Run the test
if (require.main === module) {
  test8pmConflict().catch(console.error);
}

module.exports = test8pmConflict;
