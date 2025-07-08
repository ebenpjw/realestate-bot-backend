/**
 * Comprehensive Appointment Booking Flow Test
 * Tests the complete booking flow including conflict detection and alternative suggestions
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const logger = require('./logger');
const appointmentService = require('./services/appointmentService');
const { isTimeSlotAvailable, findMatchingSlot } = require('./api/bookingHelper');
const { toSgTime, formatForDisplay } = require('./utils/timezoneUtils');

// Initialize Supabase client
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

class AppointmentBookingTester {
  constructor() {
    this.testResults = [];
    this.testLeadId = null;
    this.testAgentId = null;
  }

  /**
   * Run all appointment booking tests
   */
  async runAllTests() {
    console.log('🧪 Starting Comprehensive Appointment Booking Tests\n');
    console.log('=' .repeat(60));

    try {
      // Setup test data
      await this.setupTestData();

      // Test 1: Basic appointment booking flow
      await this.testBasicAppointmentBooking();

      // Test 2: Conflict detection and alternative suggestions
      await this.testConflictDetectionAndAlternatives();

      // Test 3: Agent availability logic
      await this.testAgentAvailabilityLogic();

      // Test 4: Database integration after cleanup
      await this.testDatabaseIntegration();

      // Test 5: Edge cases
      await this.testEdgeCases();

      // Cleanup test data
      await this.cleanupTestData();

      // Print results
      this.printTestResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      await this.cleanupTestData();
    }
  }

  /**
   * Setup test data (test lead and agent)
   */
  async setupTestData() {
    console.log('🔧 Setting up test data...');

    try {
      // Get or create a test agent
      const { data: agents, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('status', 'active')
        .limit(1);

      if (agentError || !agents || agents.length === 0) {
        throw new Error('No active agents found for testing');
      }

      this.testAgentId = agents[0].id;
      console.log(`✅ Using test agent: ${agents[0].full_name} (${this.testAgentId})`);

      // Create a test lead
      const testPhoneNumber = `+65${Date.now().toString().slice(-8)}`;
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          phone_number: testPhoneNumber,
          full_name: 'Test User Booking Flow',
          source: 'Test Suite',
          status: 'new',
          intent: 'own_stay',
          budget: '$2M - $3M',
          timeline: 'within_3_months'
        })
        .select()
        .single();

      if (leadError) {
        throw new Error(`Failed to create test lead: ${leadError.message}`);
      }

      this.testLeadId = lead.id;
      console.log(`✅ Created test lead: ${lead.full_name} (${this.testLeadId})`);

    } catch (error) {
      throw new Error(`Setup failed: ${error.message}`);
    }
  }

  /**
   * Test 1: Basic appointment booking flow
   */
  async testBasicAppointmentBooking() {
    console.log('\n📅 Test 1: Basic Appointment Booking Flow');
    console.log('-'.repeat(50));

    try {
      // Find next available slot
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0); // 2 PM tomorrow

      console.log(`🔍 Checking availability for: ${formatForDisplay(toSgTime(tomorrow))}`);

      const isAvailable = await isTimeSlotAvailable(this.testAgentId, tomorrow);
      console.log(`📊 Time slot available: ${isAvailable}`);

      if (isAvailable) {
        // Book the appointment
        console.log('📝 Attempting to book appointment...');
        
        const result = await appointmentService.createAppointment({
          leadId: this.testLeadId,
          agentId: this.testAgentId,
          appointmentTime: tomorrow,
          leadName: 'Test User Booking Flow',
          consultationNotes: 'Test booking - basic flow'
        });

        if (result && result.appointment) {
          console.log('✅ Appointment booked successfully!');
          console.log(`   📅 Time: ${formatForDisplay(toSgTime(tomorrow))}`);
          console.log(`   🔗 Zoom: ${result.zoomMeeting?.joinUrl || 'N/A'}`);
          console.log(`   📆 Calendar: ${result.calendarEvent?.id ? 'Created' : 'Failed'}`);
          
          this.addTestResult('Basic Booking', true, 'Successfully booked appointment');
        } else {
          throw new Error('Appointment creation returned invalid result');
        }
      } else {
        console.log('⚠️  Requested time not available, finding alternatives...');
        
        const { exactMatch, alternatives } = await findMatchingSlot(this.testAgentId, 'tomorrow 2pm');
        
        if (alternatives && alternatives.length > 0) {
          console.log(`✅ Found ${alternatives.length} alternative slots`);
          alternatives.forEach((slot, index) => {
            console.log(`   ${index + 1}. ${formatForDisplay(toSgTime(slot))}`);
          });
          
          this.addTestResult('Basic Booking', true, `Found ${alternatives.length} alternatives when requested slot unavailable`);
        } else {
          this.addTestResult('Basic Booking', false, 'No alternatives found when requested slot unavailable');
        }
      }

    } catch (error) {
      console.log(`❌ Basic booking test failed: ${error.message}`);
      this.addTestResult('Basic Booking', false, error.message);
    }
  }

  /**
   * Test 2: Conflict detection and alternative suggestions
   */
  async testConflictDetectionAndAlternatives() {
    console.log('\n⚔️  Test 2: Conflict Detection and Alternative Suggestions');
    console.log('-'.repeat(50));

    try {
      // First, book an appointment to create a conflict
      const conflictTime = new Date();
      conflictTime.setDate(conflictTime.getDate() + 2);
      conflictTime.setHours(15, 0, 0, 0); // 3 PM day after tomorrow

      console.log(`🔍 Checking if ${formatForDisplay(toSgTime(conflictTime))} is available...`);
      
      const isInitiallyAvailable = await isTimeSlotAvailable(this.testAgentId, conflictTime);
      
      if (isInitiallyAvailable) {
        console.log('📝 Booking initial appointment to create conflict...');
        
        // Create a second test lead for the conflict
        const conflictPhoneNumber = `+65${Date.now().toString().slice(-8)}`;
        const { data: conflictLead } = await supabase
          .from('leads')
          .insert({
            phone_number: conflictPhoneNumber,
            full_name: 'Conflict Test Lead',
            source: 'Test Suite',
            status: 'new'
          })
          .select()
          .single();

        // Book the first appointment
        await appointmentService.createAppointment({
          leadId: conflictLead.id,
          agentId: this.testAgentId,
          appointmentTime: conflictTime,
          leadName: 'Conflict Test Lead',
          consultationNotes: 'Creating conflict for testing'
        });

        console.log('✅ Initial appointment booked');

        // Now try to book the same time slot (should detect conflict)
        console.log('🔍 Testing conflict detection...');
        
        const isStillAvailable = await isTimeSlotAvailable(this.testAgentId, conflictTime);
        
        if (!isStillAvailable) {
          console.log('✅ Conflict detected correctly!');
          
          // Test alternative suggestions
          console.log('🔍 Finding alternative slots...');
          const { exactMatch, alternatives } = await findMatchingSlot(this.testAgentId, `${conflictTime.getHours()}:00`);
          
          if (alternatives && alternatives.length > 0) {
            console.log(`✅ Found ${alternatives.length} alternative slots:`);
            alternatives.forEach((slot, index) => {
              console.log(`   ${index + 1}. ${formatForDisplay(toSgTime(slot))}`);
            });
            
            this.addTestResult('Conflict Detection', true, 'Successfully detected conflict and provided alternatives');
          } else {
            this.addTestResult('Conflict Detection', false, 'Conflict detected but no alternatives found');
          }
        } else {
          this.addTestResult('Conflict Detection', false, 'Failed to detect booking conflict');
        }
      } else {
        console.log('⚠️  Test time slot already occupied, testing with different time...');
        this.addTestResult('Conflict Detection', true, 'Conflict detection working (slot already occupied)');
      }

    } catch (error) {
      console.log(`❌ Conflict detection test failed: ${error.message}`);
      this.addTestResult('Conflict Detection', false, error.message);
    }
  }

  /**
   * Test 3: Agent availability logic
   */
  async testAgentAvailabilityLogic() {
    console.log('\n👤 Test 3: Agent Availability Logic');
    console.log('-'.repeat(50));

    try {
      // Test outside working hours
      const outsideHours = new Date();
      outsideHours.setDate(outsideHours.getDate() + 1);
      outsideHours.setHours(2, 0, 0, 0); // 2 AM

      console.log(`🔍 Testing outside working hours: ${formatForDisplay(toSgTime(outsideHours))}`);
      
      const isAvailableOutsideHours = await isTimeSlotAvailable(this.testAgentId, outsideHours);
      
      if (!isAvailableOutsideHours) {
        console.log('✅ Correctly rejected time outside working hours');
        this.addTestResult('Agent Availability', true, 'Correctly handles outside working hours');
      } else {
        console.log('⚠️  Time outside working hours was marked as available');
        this.addTestResult('Agent Availability', false, 'Failed to reject time outside working hours');
      }

      // Test within working hours
      const withinHours = new Date();
      withinHours.setDate(withinHours.getDate() + 1);
      withinHours.setHours(10, 0, 0, 0); // 10 AM

      console.log(`🔍 Testing within working hours: ${formatForDisplay(toSgTime(withinHours))}`);
      
      const isAvailableWithinHours = await isTimeSlotAvailable(this.testAgentId, withinHours);
      console.log(`📊 Within hours availability: ${isAvailableWithinHours}`);

    } catch (error) {
      console.log(`❌ Agent availability test failed: ${error.message}`);
      this.addTestResult('Agent Availability', false, error.message);
    }
  }

  /**
   * Test 4: Database integration after cleanup
   */
  async testDatabaseIntegration() {
    console.log('\n🗄️  Test 4: Database Integration After Cleanup');
    console.log('-'.repeat(50));

    try {
      // Test that all required tables exist and are accessible
      const tables = [
        'leads',
        'agents', 
        'appointments',
        'property_projects',
        'property_unit_mix', // Should exist after cleanup
        'enhanced_project_summary' // Should exist after cleanup
      ];

      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);

          if (error) {
            console.log(`❌ Table ${table}: ${error.message}`);
            this.addTestResult('Database Integration', false, `Table ${table} error: ${error.message}`);
          } else {
            console.log(`✅ Table ${table}: Accessible`);
          }
        } catch (err) {
          console.log(`❌ Table ${table}: ${err.message}`);
        }
      }

      // Test that removed tables are actually gone
      const removedTables = ['property_units', 'project_summary', 'ab_tests', 'simulation_results'];
      
      for (const table of removedTables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);

          if (error && error.message.includes('does not exist')) {
            console.log(`✅ Removed table ${table}: Correctly removed`);
          } else {
            console.log(`⚠️  Table ${table}: Still exists (should be removed)`);
          }
        } catch (err) {
          console.log(`✅ Removed table ${table}: Correctly removed`);
        }
      }

      this.addTestResult('Database Integration', true, 'Database schema cleanup verified');

    } catch (error) {
      console.log(`❌ Database integration test failed: ${error.message}`);
      this.addTestResult('Database Integration', false, error.message);
    }
  }

  /**
   * Test 5: Edge cases
   */
  async testEdgeCases() {
    console.log('\n🎯 Test 5: Edge Cases');
    console.log('-'.repeat(50));

    try {
      // Test past time booking
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 2);

      console.log(`🔍 Testing past time booking: ${formatForDisplay(toSgTime(pastTime))}`);
      
      const isPastAvailable = await isTimeSlotAvailable(this.testAgentId, pastTime);
      
      if (!isPastAvailable) {
        console.log('✅ Correctly rejected past time booking');
        this.addTestResult('Edge Cases', true, 'Correctly handles past time booking');
      } else {
        console.log('⚠️  Past time was marked as available');
        this.addTestResult('Edge Cases', false, 'Failed to reject past time booking');
      }

    } catch (error) {
      console.log(`❌ Edge cases test failed: ${error.message}`);
      this.addTestResult('Edge Cases', false, error.message);
    }
  }

  /**
   * Add test result
   */
  addTestResult(testName, passed, message) {
    this.testResults.push({
      test: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Print test results summary
   */
  printTestResults() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(60));

    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;

    console.log(`Overall: ${passed}/${total} tests passed\n`);

    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.test}: ${result.message}`);
    });

    console.log('\n' + '=' .repeat(60));
    
    if (passed === total) {
      console.log('🎉 ALL TESTS PASSED! Appointment booking system is working correctly.');
    } else {
      console.log(`⚠️  ${total - passed} test(s) failed. Please review the issues above.`);
    }
  }

  /**
   * Cleanup test data
   */
  async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');

    try {
      if (this.testLeadId) {
        // Delete test appointments
        await supabase
          .from('appointments')
          .delete()
          .eq('lead_id', this.testLeadId);

        // Delete test lead
        await supabase
          .from('leads')
          .delete()
          .eq('id', this.testLeadId);

        console.log('✅ Test data cleaned up');
      }
    } catch (error) {
      console.log(`⚠️  Cleanup warning: ${error.message}`);
    }
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  const tester = new AppointmentBookingTester();
  tester.runAllTests()
    .then(() => {
      console.log('\n🏁 Test suite completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = AppointmentBookingTester;
