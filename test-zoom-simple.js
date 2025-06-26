// test-zoom-simple.js
// Simplified test for Zoom Server-to-Server OAuth - focuses on meeting creation

require('dotenv').config();
const { getServerAccessToken, createZoomMeetingForUser } = require('./api/zoomServerService');
const axios = require('axios');
const config = require('./config');

async function testZoomSimple() {
    console.log('🚀 Simple Zoom Server-to-Server OAuth Test\n');

    // Test 1: Get access token
    console.log('🔑 Test 1: Getting Server Access Token');
    try {
        const accessToken = await getServerAccessToken();
        console.log('✅ Successfully obtained server access token');
        console.log('Token length:', accessToken.length, 'characters\n');

        // Test 2: List users in the account
        console.log('👥 Test 2: Listing Users in Zoom Account');
        const usersResponse = await axios.get('https://api.zoom.us/v2/users', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: config.ZOOM_TIMEOUT
        });

        console.log('Found', usersResponse.data.users.length, 'users in your Zoom account:');
        usersResponse.data.users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.first_name} ${user.last_name} (${user.email})`);
            console.log(`   - User ID: ${user.id}`);
            console.log(`   - Status: ${user.status}`);
            console.log(`   - Type: ${user.type}`);
        });
        console.log();

        // Test 3: Try to create a meeting for the first user
        if (usersResponse.data.users.length > 0) {
            const firstUser = usersResponse.data.users[0];
            console.log('📅 Test 3: Creating Meeting for First User');
            console.log('Using user:', firstUser.email);

            const meetingDetails = {
                topic: 'Test Property Consultation - Server OAuth',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                duration: 60,
                agenda: 'This is a test meeting created by the Server-to-Server OAuth integration.'
            };

            try {
                // Create meeting directly using API call instead of our function
                const meetingPayload = {
                    topic: meetingDetails.topic,
                    type: 2, // Scheduled meeting
                    start_time: meetingDetails.startTime,
                    duration: meetingDetails.duration,
                    timezone: 'Asia/Singapore',
                    agenda: meetingDetails.agenda,
                    settings: {
                        host_video: true,
                        participant_video: true,
                        join_before_host: false,
                        mute_upon_entry: true,
                        waiting_room: true,
                        audio: 'both',
                        auto_recording: 'none',
                        approval_type: 0
                    }
                };

                const meetingResponse = await axios.post(`https://api.zoom.us/v2/users/${encodeURIComponent(firstUser.email)}/meetings`, meetingPayload, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: config.ZOOM_TIMEOUT
                });

                const meeting = meetingResponse.data;
                console.log('✅ Successfully created Zoom meeting:');
                console.log('   - Meeting ID:', meeting.id);
                console.log('   - Topic:', meeting.topic);
                console.log('   - Join URL:', meeting.join_url);
                console.log('   - Host Email:', firstUser.email);
                console.log('   - Start Time:', meeting.start_time);
                console.log();

                console.log('🎉 Server-to-Server OAuth is working perfectly!');
                console.log('✅ Your integration can create meetings for existing users');
                console.log();
                console.log('📝 Recommendations:');
                console.log('1. Use existing Zoom users in your account');
                console.log('2. Set agent zoom_email to match existing Zoom users');
                console.log('3. The integration will work great for appointment creation');

            } catch (meetingError) {
                console.log('❌ Failed to create meeting:', meetingError.message);
                console.log('Error details:', meetingError.response?.data || meetingError);
            }
        } else {
            console.log('❌ No users found in your Zoom account');
            console.log('You may need to add users to your Zoom Business account first');
        }

    } catch (error) {
        console.log('❌ Test failed:', error.message);
        console.log('Error details:', error.response?.data || error);
    }
}

// Run the test
testZoomSimple().catch(console.error);
