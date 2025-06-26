// test-zoom-integration.js
// Test script for Zoom Server-to-Server OAuth integration

require('dotenv').config();
const { getServerAccessToken, getOrCreateZoomUser, createZoomMeetingForUser } = require('./api/zoomServerService');
const supabase = require('./supabaseClient');
const logger = require('./logger');

async function testZoomIntegration() {
    console.log('🚀 Starting Zoom Server-to-Server OAuth Integration Test\n');

    // Test 1: Check environment variables
    console.log('📋 Test 1: Environment Variables');
    console.log('ZOOM_ACCOUNT_ID:', process.env.ZOOM_ACCOUNT_ID ? '✅ Set' : '❌ Missing');
    console.log('ZOOM_CLIENT_ID:', process.env.ZOOM_CLIENT_ID ? '✅ Set' : '❌ Missing');
    console.log('ZOOM_CLIENT_SECRET:', process.env.ZOOM_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
    
    if (!process.env.ZOOM_ACCOUNT_ID || !process.env.ZOOM_CLIENT_ID || !process.env.ZOOM_CLIENT_SECRET) {
        console.log('❌ Missing required environment variables. Please set them first.\n');
        return;
    }
    console.log('✅ All environment variables are set\n');

    // Test 2: Server Access Token
    console.log('🔑 Test 2: Server Access Token Generation');
    try {
        const accessToken = await getServerAccessToken();
        console.log('✅ Successfully obtained server access token');
        console.log('Token length:', accessToken.length, 'characters\n');
    } catch (error) {
        console.log('❌ Failed to get server access token:', error.message);
        console.log('Error details:', error.response?.data || error);
        return;
    }

    // Test 3: Get current agents
    console.log('👥 Test 3: Current Agents in Database');
    try {
        const { data: agents, error } = await supabase
            .from('agents')
            .select('id, full_name, email, zoom_email, status')
            .limit(5);

        if (error) {
            console.log('❌ Failed to fetch agents:', error.message);
            return;
        }

        console.log('Found', agents.length, 'agents:');
        agents.forEach((agent, index) => {
            console.log(`${index + 1}. ${agent.full_name} (${agent.email})`);
            console.log(`   - ID: ${agent.id}`);
            console.log(`   - Zoom Email: ${agent.zoom_email || 'Not set'}`);
            console.log(`   - Status: ${agent.status}`);
        });
        console.log();

        // Test 4: Test user creation with the actual agent email
        console.log('👤 Test 4: Zoom User Creation');
        const testEmail = agents[0].zoom_email || 'doro@marketingwithdoro.com';
        try {
            const zoomUser = await getOrCreateZoomUser(testEmail, 'Test', 'Agent');
            console.log('✅ Successfully created/found Zoom user:');
            console.log('   - User ID:', zoomUser.id);
            console.log('   - Email:', zoomUser.email);
            console.log('   - Status:', zoomUser.status);
            console.log();

            // Test 5: Test meeting creation
            console.log('📅 Test 5: Zoom Meeting Creation');
            const meetingDetails = {
                topic: 'Test Property Consultation',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                duration: 60,
                agenda: 'This is a test meeting created by the integration test script.'
            };

            const meeting = await createZoomMeetingForUser(testEmail, meetingDetails);
            console.log('✅ Successfully created Zoom meeting:');
            console.log('   - Meeting ID:', meeting.id);
            console.log('   - Topic:', meeting.topic);
            console.log('   - Join URL:', meeting.joinUrl);
            console.log('   - Host Email:', meeting.hostEmail);
            console.log();

            console.log('🎉 All tests passed! Your Zoom Server-to-Server OAuth integration is working correctly.');
            console.log('\n📝 Next Steps:');
            console.log('1. Update your agents with zoom_email addresses');
            console.log('2. Test creating appointments through your WhatsApp bot');
            console.log('3. Monitor logs for any issues');

        } catch (error) {
            console.log('❌ Failed to create Zoom user or meeting:', error.message);
            console.log('Error details:', error.response?.data || error);
        }

    } catch (error) {
        console.log('❌ Database connection failed:', error.message);
    }
}

// Run the test
testZoomIntegration().catch(console.error);
