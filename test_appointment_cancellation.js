// test_appointment_cancellation.js
// Test the appointment service cancellation functionality

require('dotenv').config();
const appointmentService = require('./services/appointmentService');

async function testCancellation() {
  console.log('\n🧪 TESTING APPOINTMENT SERVICE CANCELLATION\n');
  
  const appointmentId = '9c4fb2f3-6414-462d-9f01-908604b862da';
  const reason = 'Testing cancellation functionality - automated test';
  
  try {
    console.log(`📋 Cancelling appointment: ${appointmentId}`);
    console.log(`📝 Reason: ${reason}`);
    
    const result = await appointmentService.cancelAppointment({
      appointmentId: appointmentId,
      reason: reason,
      notifyLead: true
    });
    
    if (result.success) {
      console.log('\n✅ APPOINTMENT CANCELLATION SUCCESSFUL!');
      console.log(`📋 Appointment ID: ${result.appointmentId}`);
      console.log('🗓️ Calendar event should be deleted');
      console.log('📹 Zoom meeting should be deleted');
      console.log('📧 WhatsApp notification should be sent');
    } else {
      console.log('\n❌ APPOINTMENT CANCELLATION FAILED!');
      console.log(`Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Cancellation test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
async function main() {
  await testCancellation();
  process.exit(0);
}

main().catch(console.error);
