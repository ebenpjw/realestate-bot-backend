/**
 * Test past time validation
 * Ensures the system rejects appointment bookings for past times
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const { isTimeSlotAvailable } = require('./api/bookingHelper');
const { toSgTime, formatForDisplay } = require('./utils/timezoneUtils');

// Initialize Supabase client
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

async function testPastTimeValidation() {
  console.log('🧪 Testing Past Time Validation\n');
  console.log('=' .repeat(50));

  try {
    // Get an active agent
    const { data: agents } = await supabase
      .from('agents')
      .select('*')
      .eq('status', 'active')
      .limit(1);

    if (!agents || agents.length === 0) {
      throw new Error('No active agents found');
    }

    const agentId = agents[0].id;
    console.log(`✅ Using agent: ${agents[0].full_name}`);

    // Test 1: Past time (1 hour ago)
    const pastTime1 = new Date();
    pastTime1.setHours(pastTime1.getHours() - 1);

    console.log(`\n🔍 Testing 1 hour ago: ${formatForDisplay(toSgTime(pastTime1))}`);
    const isPast1Available = await isTimeSlotAvailable(agentId, pastTime1);
    console.log(`📊 Result: ${isPast1Available ? 'AVAILABLE (❌ WRONG)' : 'REJECTED (✅ CORRECT)'}`);

    // Test 2: Past time (yesterday)
    const pastTime2 = new Date();
    pastTime2.setDate(pastTime2.getDate() - 1);
    pastTime2.setHours(14, 0, 0, 0); // 2 PM yesterday

    console.log(`\n🔍 Testing yesterday: ${formatForDisplay(toSgTime(pastTime2))}`);
    const isPast2Available = await isTimeSlotAvailable(agentId, pastTime2);
    console.log(`📊 Result: ${isPast2Available ? 'AVAILABLE (❌ WRONG)' : 'REJECTED (✅ CORRECT)'}`);

    // Test 3: Future time (should be available)
    const futureTime = new Date();
    futureTime.setDate(futureTime.getDate() + 1);
    futureTime.setHours(14, 0, 0, 0); // 2 PM tomorrow

    console.log(`\n🔍 Testing tomorrow: ${formatForDisplay(toSgTime(futureTime))}`);
    const isFutureAvailable = await isTimeSlotAvailable(agentId, futureTime);
    console.log(`📊 Result: ${isFutureAvailable ? 'AVAILABLE (✅ CORRECT)' : 'REJECTED (❌ WRONG)'}`);

    // Summary
    console.log('\n📊 PAST TIME VALIDATION RESULTS');
    console.log('=' .repeat(50));

    const pastRejected = !isPast1Available && !isPast2Available;
    const futureAccepted = isFutureAvailable;

    if (pastRejected && futureAccepted) {
      console.log('✅ SUCCESS: Past time validation working correctly!');
      console.log('   - Past times are properly rejected');
      console.log('   - Future times are properly accepted');
    } else {
      console.log('❌ FAILURE: Past time validation has issues:');
      if (!pastRejected) {
        console.log('   - Past times are incorrectly accepted');
      }
      if (!futureAccepted) {
        console.log('   - Future times are incorrectly rejected');
      }
    }

  } catch (error) {
    console.error('❌ Past time validation test failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPastTimeValidation()
    .then(() => {
      console.log('\n🏁 Past time validation test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Past time validation test failed:', error);
      process.exit(1);
    });
}

module.exports = testPastTimeValidation;
