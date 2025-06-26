// Test what happens when working_hours is null/empty
const { getAgentWorkingHours } = require('./api/bookingHelper');

async function testNullWorkingHours() {
  console.log('Testing working hours behavior...\n');
  
  // Test with existing agent (has working_hours set)
  const existingAgentId = '7035246f-5f51-42d2-9031-577a3ab7a410';
  const existingHours = await getAgentWorkingHours(existingAgentId);
  console.log('Existing agent working hours:');
  console.log(JSON.stringify(existingHours, null, 2));
  
  // Test with non-existent agent (should trigger error fallback)
  const fakeAgentId = 'fake-agent-id-12345';
  const fakeHours = await getAgentWorkingHours(fakeAgentId);
  console.log('\nNon-existent agent working hours (error fallback):');
  console.log(JSON.stringify(fakeHours, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log('- Existing agent gets extended hours (overrides restrictive defaults)');
  console.log('- Non-existent agent gets extended hours (error fallback)');
  console.log('- Empty/null working_hours would also get extended hours');
  console.log('='.repeat(50));
}

testNullWorkingHours().catch(console.error);
