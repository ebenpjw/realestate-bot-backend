// Test appointment creation
require('dotenv').config();
const appointmentService = require('./services/appointmentService');

async function testAppointmentCreation() {
  try {
    console.log('🧪 Testing appointment creation...');
    
    const testLeadId = 'f33260ae-ab5d-450f-a112-7621c2ee8bdb'; // Existing lead
    const testAgentId = '7035246f-5f51-42d2-9031-577a3ab7a410'; // Existing agent
    const appointmentTime = new Date('2025-06-26T15:00:00.000Z'); // 3 PM today
    
    console.log('Parameters:');
    console.log('- Lead ID:', testLeadId);
    console.log('- Agent ID:', testAgentId);
    console.log('- Appointment Time:', appointmentTime.toISOString());
    
    const result = await appointmentService.createAppointment({
      leadId: testLeadId,
      agentId: testAgentId,
      appointmentTime: appointmentTime.toISOString(),
      leadName: 'Ebenezer Poon',
      leadPhone: '6596799123',
      consultationNotes: 'Test appointment creation'
    });
    
    console.log('✅ Appointment created successfully!');
    console.log('- Appointment ID:', result.appointment.id);
    console.log('- Status:', result.appointment.status);
    console.log('- Zoom Meeting ID:', result.zoomMeeting?.id || 'None');
    console.log('- Calendar Event ID:', result.calendarEvent?.id || 'None');
    console.log('- Zoom Join URL:', result.zoomMeeting?.joinUrl || 'None');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testAppointmentCreation();
