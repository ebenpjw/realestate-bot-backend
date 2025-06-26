// test-zoom-debug.js
// Debug test for Zoom Server-to-Server OAuth - detailed error analysis

require('dotenv').config();
const { getServerAccessToken } = require('./api/zoomServerService');
const axios = require('axios');
const config = require('./config');

async function debugZoomIntegration() {
    console.log('🔍 Zoom Server-to-Server OAuth Debug Test\n');

    try {
        // Get access token
        console.log('🔑 Getting Server Access Token...');
        const accessToken = await getServerAccessToken();
        console.log('✅ Access token obtained successfully');
        console.log('Token preview:', accessToken.substring(0, 50) + '...\n');

        // Test different API endpoints to understand the issue
        const testEndpoints = [
            { name: 'Account Info', url: 'https://api.zoom.us/v2/accounts/me' },
            { name: 'User List', url: 'https://api.zoom.us/v2/users' },
            { name: 'User Profile', url: 'https://api.zoom.us/v2/users/me' },
            { name: 'Account Settings', url: 'https://api.zoom.us/v2/accounts/me/settings' }
        ];

        for (const endpoint of testEndpoints) {
            console.log(`🧪 Testing: ${endpoint.name}`);
            try {
                const response = await axios.get(endpoint.url, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: config.ZOOM_TIMEOUT
                });

                console.log(`✅ ${endpoint.name}: Success`);
                if (endpoint.name === 'User List' && response.data.users) {
                    console.log(`   Found ${response.data.users.length} users`);
                    response.data.users.forEach((user, index) => {
                        console.log(`   ${index + 1}. ${user.first_name} ${user.last_name} (${user.email})`);
                    });
                } else if (endpoint.name === 'Account Info') {
                    console.log(`   Account: ${response.data.account_name}`);
                    console.log(`   Plan: ${response.data.plan_type}`);
                    console.log(`   Owner: ${response.data.owner_email}`);
                }
                console.log();

            } catch (error) {
                console.log(`❌ ${endpoint.name}: Failed`);
                console.log(`   Status: ${error.response?.status}`);
                console.log(`   Error: ${error.response?.data?.message || error.message}`);
                console.log(`   Code: ${error.response?.data?.code}`);
                
                // Detailed error analysis
                if (error.response?.data) {
                    console.log(`   Full Error:`, JSON.stringify(error.response.data, null, 2));
                }
                console.log();
            }
        }

        // Test meeting creation with your email directly
        console.log('📅 Testing Meeting Creation with Your Email');
        try {
            const meetingPayload = {
                topic: 'Test Meeting - Server OAuth Debug',
                type: 2, // Scheduled meeting
                start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                duration: 30,
                timezone: 'Asia/Singapore',
                agenda: 'Debug test meeting for Server-to-Server OAuth',
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

            const meetingResponse = await axios.post(`https://api.zoom.us/v2/users/nezpjw@gmail.com/meetings`, meetingPayload, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: config.ZOOM_TIMEOUT
            });

            console.log('✅ Meeting created successfully!');
            console.log('   Meeting ID:', meetingResponse.data.id);
            console.log('   Join URL:', meetingResponse.data.join_url);
            console.log('   Host Email:', meetingResponse.data.host_email);
            console.log();

            console.log('🎉 SUCCESS! Your Server-to-Server OAuth is working perfectly!');
            console.log('The integration is ready for production use.');

        } catch (meetingError) {
            console.log('❌ Meeting creation failed');
            console.log('   Status:', meetingError.response?.status);
            console.log('   Error:', meetingError.response?.data?.message || meetingError.message);
            console.log('   Code:', meetingError.response?.data?.code);
            
            if (meetingError.response?.data) {
                console.log('   Full Error:', JSON.stringify(meetingError.response.data, null, 2));
            }
        }

    } catch (tokenError) {
        console.log('❌ Failed to get access token:', tokenError.message);
        console.log('This indicates a fundamental authentication issue.');
    }
}

// Run the debug test
debugZoomIntegration().catch(console.error);
