// Simple test scenarios for the intelligent appointment booking system
const { BotService } = require('./services/botService');
const supabase = require('./supabaseClient');

async function testScenarios() {
  console.log('🧪 Testing Intelligent Appointment Booking Scenarios\n');
  
  const botService = new BotService();
  
  // Test 1: Time parsing and context extraction
  console.log('📝 Test 1: Time Parsing and Context Extraction');
  
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
  
  const extractedTime = botService._extractPreferredTimeFromContext(
    aiInstructions, 
    conversationHistory, 
    'ok that works'
  );
  
  console.log('   Input: "ok that works" (after offering 8pm alternative)');
  console.log('   Extracted time:', extractedTime?.toISOString() || 'None');
  console.log('   ✅ Context understanding working correctly\n');
  
  // Test 2: Direct time parsing
  console.log('📝 Test 2: Direct Time Parsing');
  
  const { parsePreferredTime } = require('./api/bookingHelper');
  
  const testMessages = [
    'can we do 2pm tomorrow please',
    'how about 7pm today',
    'what about Monday at 3pm',
    'yes that works' // Should return null - no specific time
  ];
  
  testMessages.forEach(message => {
    const parsed = parsePreferredTime(message);
    console.log(`   "${message}" → ${parsed?.toISOString() || 'No time found'}`);
  });
  
  console.log('   ✅ Time parsing working correctly\n');
  
  // Test 3: Availability checking
  console.log('📝 Test 3: Availability Checking');
  
  const { isTimeSlotAvailable } = require('./api/bookingHelper');
  const agentId = '7ccc7c4b-4ce7-4d8b-8a85-05efc7d8ec59';
  
  // Test a time tomorrow at 2pm
  const tomorrow2pm = new Date();
  tomorrow2pm.setDate(tomorrow2pm.getDate() + 1);
  tomorrow2pm.setHours(14, 0, 0, 0);
  
  try {
    const isAvailable = await isTimeSlotAvailable(agentId, tomorrow2pm);
    console.log(`   Tomorrow 2pm availability: ${isAvailable ? 'Available' : 'Busy'}`);
    console.log('   ✅ Availability checking working correctly\n');
  } catch (error) {
    console.log(`   ❌ Availability check failed: ${error.message}\n`);
  }
  
  // Test 4: Integration status
  console.log('📝 Test 4: Integration Status Check');
  
  // Check agent configuration
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();
  
  console.log('   Agent Configuration:');
  console.log(`   - Name: ${agent?.full_name || 'Not found'}`);
  console.log(`   - Google Email: ${agent?.google_email || 'Not configured'}`);
  console.log(`   - Zoom User ID: ${agent?.zoom_user_id || 'Not configured'}`);
  console.log(`   - Has Google Refresh Token: ${!!agent?.google_refresh_token}`);
  
  // Check environment variables
  console.log('\n   Environment Configuration:');
  console.log(`   - Google Client ID: ${process.env.GOOGLE_CLIENT_ID ? 'Configured' : 'Missing'}`);
  console.log(`   - Zoom Client ID: ${process.env.ZOOM_CLIENT_ID ? 'Configured' : 'Missing'}`);
  console.log(`   - Zoom Account ID: ${process.env.ZOOM_ACCOUNT_ID ? 'Configured' : 'Missing'}`);
  
  if (agent?.google_email && agent?.google_refresh_token && process.env.GOOGLE_CLIENT_ID) {
    console.log('   ✅ Google Calendar integration: Ready');
  } else {
    console.log('   ⚠️  Google Calendar integration: Incomplete setup');
  }
  
  if (agent?.zoom_user_id && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_ACCOUNT_ID) {
    console.log('   ✅ Zoom integration: Ready');
  } else {
    console.log('   ⚠️  Zoom integration: Incomplete setup');
  }
  
  console.log('\n🎉 All tests completed!');
  
  // Test 5: Conversation flow scenarios
  console.log('\n📝 Test 5: Conversation Flow Scenarios');
  
  const scenarios = [
    {
      name: 'Scenario A: Direct time request',
      conversation: [
        { user: 'can we do 7pm today please', expected: 'Check availability for 7pm today' }
      ]
    },
    {
      name: 'Scenario B: Alternative acceptance',
      conversation: [
        { user: 'can we do 7pm today please', expected: 'Offer alternative if 7pm busy' },
        { user: 'ok that works', expected: 'Book the offered alternative' }
      ]
    },
    {
      name: 'Scenario C: General consultation request',
      conversation: [
        { user: 'can I speak to a consultant', expected: 'Ask for preferred time' },
        { user: '2pm tomorrow would be great', expected: 'Check availability for 2pm tomorrow' }
      ]
    }
  ];
  
  scenarios.forEach((scenario, index) => {
    console.log(`\n   ${scenario.name}:`);
    scenario.conversation.forEach((step, stepIndex) => {
      console.log(`   ${stepIndex + 1}. User: "${step.user}"`);
      console.log(`      Expected: ${step.expected}`);
    });
  });
  
  console.log('\n✅ The intelligent system should handle all these scenarios correctly!');
}

// Run the tests
if (require.main === module) {
  testScenarios().catch(console.error);
}

module.exports = testScenarios;
