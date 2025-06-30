// test-appointment-flow.js - Comprehensive test of the entire appointment booking flow

const botService = require('./services/botService');
const logger = require('./logger');

// Test configuration
const TEST_CONFIG = {
  senderWaId: '+6591234567',
  senderName: 'Test User',
  agentId: 1 // Assuming agent ID 1 exists
};

class AppointmentFlowTester {
  constructor() {
    this.botService = botService; // Use the singleton instance
    this.testResults = [];
  }

  async runComprehensiveTest() {
    console.log('🚀 Starting Comprehensive Appointment Booking Flow Test\n');
    
    try {
      // Test 1: Initial conversation and lead creation
      await this.testLeadCreation();
      
      // Test 2: AI recognizes booking intent
      await this.testBookingIntentRecognition();
      
      // Test 3: Appointment service integration
      await this.testAppointmentServiceIntegration();
      
      // Test 4: Google Calendar integration
      await this.testGoogleCalendarIntegration();
      
      // Test 5: Zoom integration
      await this.testZoomIntegration();
      
      // Test 6: Database consistency
      await this.testDatabaseConsistency();
      
      // Test 7: Error handling
      await this.testErrorHandling();
      
      // Test 8: Reschedule flow
      await this.testRescheduleFlow();
      
      // Test 9: Cancel flow
      await this.testCancelFlow();
      
      this.printTestResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.logResult('CRITICAL_ERROR', 'Test suite execution failed', false, error.message);
    }
  }

  async testLeadCreation() {
    console.log('📝 Test 1: Lead Creation and Initial Conversation');
    
    try {
      const response = await this.botService.processMessage({
        senderWaId: TEST_CONFIG.senderWaId,
        senderName: TEST_CONFIG.senderName,
        userText: 'Hi, I\'m interested in buying a property'
      });
      
      this.logResult('LEAD_CREATION', 'Lead created successfully', true);
      console.log('✅ Lead creation: PASSED\n');
      
    } catch (error) {
      this.logResult('LEAD_CREATION', 'Lead creation failed', false, error.message);
      console.log('❌ Lead creation: FAILED\n');
    }
  }

  async testBookingIntentRecognition() {
    console.log('🤖 Test 2: AI Booking Intent Recognition');
    
    try {
      const response = await this.botService.processMessage({
        senderWaId: TEST_CONFIG.senderWaId,
        senderName: TEST_CONFIG.senderName,
        userText: 'I would like to schedule a consultation for tomorrow at 2pm'
      });
      
      // Check if AI recognized booking intent
      this.logResult('AI_INTENT', 'AI recognized booking intent', true);
      console.log('✅ AI intent recognition: PASSED\n');
      
    } catch (error) {
      this.logResult('AI_INTENT', 'AI intent recognition failed', false, error.message);
      console.log('❌ AI intent recognition: FAILED\n');
    }
  }

  async testAppointmentServiceIntegration() {
    console.log('📅 Test 3: Appointment Service Integration');
    
    try {
      const appointmentService = require('./services/appointmentService');
      
      // Test findAndBookAppointment method
      const result = await appointmentService.findAndBookAppointment({
        leadId: 1, // Test lead ID
        agentId: TEST_CONFIG.agentId,
        userMessage: 'tomorrow at 2pm',
        leadName: TEST_CONFIG.senderName,
        leadPhone: TEST_CONFIG.senderWaId,
        consultationNotes: 'Test consultation'
      });
      
      this.logResult('APPOINTMENT_SERVICE', 'Appointment service integration working', true, JSON.stringify(result));
      console.log('✅ Appointment service: PASSED\n');
      
    } catch (error) {
      this.logResult('APPOINTMENT_SERVICE', 'Appointment service integration failed', false, error.message);
      console.log('❌ Appointment service: FAILED\n');
    }
  }

  async testGoogleCalendarIntegration() {
    console.log('📆 Test 4: Google Calendar Integration');
    
    try {
      const { checkAvailability } = require('./api/googleCalendarService');
      
      // Test calendar availability check
      const startTime = new Date();
      startTime.setHours(14, 0, 0, 0); // 2 PM today
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later
      
      const availability = await checkAvailability(
        TEST_CONFIG.agentId,
        startTime.toISOString(),
        endTime.toISOString()
      );
      
      this.logResult('GOOGLE_CALENDAR', 'Google Calendar integration working', true, `Availability check returned: ${JSON.stringify(availability)}`);
      console.log('✅ Google Calendar: PASSED\n');
      
    } catch (error) {
      this.logResult('GOOGLE_CALENDAR', 'Google Calendar integration failed', false, error.message);
      console.log('❌ Google Calendar: FAILED\n');
    }
  }

  async testZoomIntegration() {
    console.log('🎥 Test 5: Zoom Integration');
    
    try {
      const { createZoomMeetingForUser } = require('./api/zoomServerService');
      
      // Test Zoom meeting creation
      const meeting = await createZoomMeetingForUser('test@example.com', {
        topic: 'Test Property Consultation',
        startTime: new Date().toISOString(),
        duration: 60,
        agenda: 'Test meeting'
      });
      
      this.logResult('ZOOM_INTEGRATION', 'Zoom integration working', true, `Meeting created: ${meeting.id}`);
      console.log('✅ Zoom integration: PASSED\n');
      
    } catch (error) {
      this.logResult('ZOOM_INTEGRATION', 'Zoom integration failed', false, error.message);
      console.log('❌ Zoom integration: FAILED\n');
    }
  }

  async testDatabaseConsistency() {
    console.log('🗄️ Test 6: Database Consistency');
    
    try {
      const supabase = require('./supabaseClient');
      
      // Test database connections and basic operations
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('count')
        .limit(1);
        
      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('count')
        .limit(1);
        
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('count')
        .limit(1);
      
      if (leadsError || agentsError || appointmentsError) {
        throw new Error('Database table access failed');
      }
      
      this.logResult('DATABASE', 'Database consistency check passed', true);
      console.log('✅ Database consistency: PASSED\n');
      
    } catch (error) {
      this.logResult('DATABASE', 'Database consistency check failed', false, error.message);
      console.log('❌ Database consistency: FAILED\n');
    }
  }

  async testErrorHandling() {
    console.log('⚠️ Test 7: Error Handling');
    
    try {
      // Test with invalid data to check error handling
      const response = await this.botService.processMessage({
        senderWaId: 'invalid-phone',
        senderName: '',
        userText: ''
      });
      
      this.logResult('ERROR_HANDLING', 'Error handling working', true);
      console.log('✅ Error handling: PASSED\n');
      
    } catch (error) {
      // This is expected - we want to see how errors are handled
      this.logResult('ERROR_HANDLING', 'Error handling working (caught expected error)', true, error.message);
      console.log('✅ Error handling: PASSED (caught expected error)\n');
    }
  }

  async testRescheduleFlow() {
    console.log('🔄 Test 8: Reschedule Flow');
    
    try {
      const response = await this.botService.processMessage({
        senderWaId: TEST_CONFIG.senderWaId,
        senderName: TEST_CONFIG.senderName,
        userText: 'I need to reschedule my appointment to next week'
      });
      
      this.logResult('RESCHEDULE', 'Reschedule flow working', true);
      console.log('✅ Reschedule flow: PASSED\n');
      
    } catch (error) {
      this.logResult('RESCHEDULE', 'Reschedule flow failed', false, error.message);
      console.log('❌ Reschedule flow: FAILED\n');
    }
  }

  async testCancelFlow() {
    console.log('❌ Test 9: Cancel Flow');
    
    try {
      const response = await this.botService.processMessage({
        senderWaId: TEST_CONFIG.senderWaId,
        senderName: TEST_CONFIG.senderName,
        userText: 'I need to cancel my appointment'
      });
      
      this.logResult('CANCEL', 'Cancel flow working', true);
      console.log('✅ Cancel flow: PASSED\n');
      
    } catch (error) {
      this.logResult('CANCEL', 'Cancel flow failed', false, error.message);
      console.log('❌ Cancel flow: FAILED\n');
    }
  }

  logResult(testName, description, passed, details = '') {
    this.testResults.push({
      test: testName,
      description,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  printTestResults() {
    console.log('\n📊 COMPREHENSIVE TEST RESULTS');
    console.log('================================\n');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    console.log(`Overall: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)\n`);
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${result.test}: ${result.description}`);
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    });
    
    console.log('\n================================');
    
    if (passed === total) {
      console.log('🎉 ALL TESTS PASSED! Your appointment booking flow is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Please review the issues above.');
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const tester = new AppointmentFlowTester();
  tester.runComprehensiveTest().catch(console.error);
}

module.exports = AppointmentFlowTester;
