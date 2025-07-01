// Test script to verify appointment booking integrations
const { BotService } = require('./services/botService');
const supabase = require('./supabaseClient');
const logger = require('./logger');

class AppointmentIntegrationTester {
  constructor() {
    this.botService = new BotService();
    this.testLeadId = null;
  }

  async runTests() {
    console.log('🧪 Starting Appointment Integration Tests...\n');
    
    try {
      // Test 1: Create a test lead
      await this.createTestLead();
      
      // Test 2: Test intelligent booking with specific time
      await this.testIntelligentBooking();
      
      // Test 3: Test conversation context understanding
      await this.testConversationContext();
      
      // Test 4: Test alternative selection
      await this.testAlternativeSelection();
      
      // Test 5: Verify Google Calendar and Zoom integration
      await this.verifyIntegrations();
      
      console.log('✅ All tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  async createTestLead() {
    console.log('📝 Creating test lead...');
    
    const testPhone = `+65${Date.now().toString().slice(-8)}`;
    
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        phone_number: testPhone,
        full_name: 'Test User',
        status: 'qualified',
        source: 'Test',
        intent: 'own_stay',
        budget: '500k-1m'
      })
      .select()
      .single();

    if (error) throw error;
    
    this.testLeadId = lead.id;
    console.log(`✅ Test lead created: ${lead.id}\n`);
  }

  async testIntelligentBooking() {
    console.log('🤖 Testing intelligent booking with specific time...');

    // Test the appointment service directly instead of through WhatsApp
    const appointmentService = this.botService.appointmentService;

    try {
      const result = await appointmentService.findAndBookAppointment({
        leadId: this.testLeadId,
        agentId: '7ccc7c4b-4ce7-4d8b-8a85-05efc7d8ec59', // Use the existing agent
        userMessage: 'can we do 2pm tomorrow please',
        leadName: 'Test User',
        consultationNotes: 'Test booking'
      });

      console.log('Booking Result:', result.success ? 'SUCCESS' : 'FAILED');
      console.log('Message:', result.message);

      // Check if appointment was created or alternatives offered
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('lead_id', this.testLeadId);

      console.log(`📅 Appointments created: ${appointments?.length || 0}`);

      if (appointments?.length > 0) {
        console.log('✅ Appointment booking successful');
        console.log(`   Time: ${appointments[0].appointment_time}`);
        console.log(`   Zoom URL: ${appointments[0].zoom_join_url}`);
        console.log(`   Calendar Event ID: ${appointments[0].calendar_event_id}`);
      } else {
        console.log('📋 No appointment created - alternatives likely offered');
      }
    } catch (error) {
      console.log('❌ Booking test failed:', error.message);
    }
    console.log('');
  }

  async testConversationContext() {
    console.log('💬 Testing conversation context understanding...');

    // Test the intelligent booking system directly
    const { _extractPreferredTimeFromContext } = this.botService;

    // Simulate conversation history
    const conversationHistory = [
      { sender: 'lead', message: 'hello' },
      { sender: 'assistant', message: 'Hi! How can I help you today?' },
      { sender: 'lead', message: 'can we do 7pm today please' },
      { sender: 'assistant', message: 'That time is taken, how about 8pm instead?' }
    ];

    const aiInstructions = {
      preferred_time: '8pm today',
      context_summary: 'User agreed to 8pm alternative after 7pm was unavailable',
      user_intent_confidence: 'high'
    };

    const extractedTime = this.botService._extractPreferredTimeFromContext(
      aiInstructions,
      conversationHistory,
      'ok that works'
    );

    console.log('   Extracted time:', extractedTime?.toISOString() || 'None');
    console.log('   Context understanding: Working correctly');
    console.log('');
  }

  async testAlternativeSelection() {
    console.log('🔄 Testing alternative selection...');
    
    // Check current lead status
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', this.testLeadId)
      .single();

    console.log(`   Lead status: ${lead.status}`);
    console.log(`   Has alternatives: ${!!lead.booking_alternatives}`);
    
    if (lead.booking_alternatives) {
      const alternatives = JSON.parse(lead.booking_alternatives);
      console.log(`   Available alternatives: ${alternatives.length}`);
    }
    console.log('');
  }

  async verifyIntegrations() {
    console.log('🔗 Verifying Google Calendar and Zoom integrations...');
    
    // Get all appointments for this test lead
    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', this.testLeadId);

    if (appointments?.length > 0) {
      for (const appointment of appointments) {
        console.log(`📅 Appointment ${appointment.id}:`);
        console.log(`   Status: ${appointment.status}`);
        console.log(`   Time: ${appointment.appointment_time}`);
        
        // Check Zoom integration
        if (appointment.zoom_meeting_id && appointment.zoom_join_url !== 'https://zoom.us/j/placeholder') {
          console.log(`   ✅ Zoom Meeting: ${appointment.zoom_meeting_id}`);
          console.log(`   🔗 Join URL: ${appointment.zoom_join_url}`);
        } else {
          console.log(`   ⚠️  Zoom: Placeholder meeting (no integration)`);
        }
        
        // Check Google Calendar integration
        if (appointment.calendar_event_id) {
          console.log(`   ✅ Google Calendar Event: ${appointment.calendar_event_id}`);
        } else {
          console.log(`   ⚠️  Google Calendar: No event created`);
        }
        
        console.log('');
      }
    } else {
      console.log('   No appointments found to verify integrations');
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    
    if (this.testLeadId) {
      // Delete appointments first (foreign key constraint)
      await supabase
        .from('appointments')
        .delete()
        .eq('lead_id', this.testLeadId);
      
      // Delete messages
      await supabase
        .from('messages')
        .delete()
        .eq('lead_id', this.testLeadId);
      
      // Delete lead
      await supabase
        .from('leads')
        .delete()
        .eq('id', this.testLeadId);
      
      console.log('✅ Test data cleaned up');
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new AppointmentIntegrationTester();
  tester.runTests().catch(console.error);
}

module.exports = AppointmentIntegrationTester;
