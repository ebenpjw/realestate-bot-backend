// test-zoom-basic.js
// Basic test for Zoom integration - works with any Zoom account type

require('dotenv').config();
const { getServerAccessToken } = require('./api/zoomServerService');
const axios = require('axios');
const config = require('./config');

async function testZoomBasic() {
    console.log('🚀 Basic Zoom Integration Test\n');

    // Test 1: Check if we have the right credentials
    console.log('📋 Test 1: Environment Variables');
    console.log('ZOOM_ACCOUNT_ID:', process.env.ZOOM_ACCOUNT_ID ? '✅ Set' : '❌ Missing');
    console.log('ZOOM_CLIENT_ID:', process.env.ZOOM_CLIENT_ID ? '✅ Set' : '❌ Missing');
    console.log('ZOOM_CLIENT_SECRET:', process.env.ZOOM_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
    
    if (!process.env.ZOOM_ACCOUNT_ID || !process.env.ZOOM_CLIENT_ID || !process.env.ZOOM_CLIENT_SECRET) {
        console.log('❌ Missing required environment variables.\n');
        return;
    }
    console.log('✅ All environment variables are set\n');

    // Test 2: Try to get access token
    console.log('🔑 Test 2: Server Access Token Generation');
    try {
        const accessToken = await getServerAccessToken();
        console.log('✅ Successfully obtained server access token');
        console.log('Token length:', accessToken.length, 'characters\n');

        // Test 3: Check account info
        console.log('🏢 Test 3: Account Information');
        try {
            const accountResponse = await axios.get('https://api.zoom.us/v2/accounts/me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: config.ZOOM_TIMEOUT
            });

            const account = accountResponse.data;
            console.log('✅ Account Details:');
            console.log('   - Account Name:', account.account_name);
            console.log('   - Account Type:', account.account_type);
            console.log('   - Plan Type:', account.plan_type);
            console.log('   - Owner Email:', account.owner_email);
            console.log();

            // Check if it's a business account
            if (account.plan_type === 'Basic') {
                console.log('⚠️  IMPORTANT: You have a Basic Zoom account');
                console.log('   - Server-to-Server OAuth requires Zoom Pro or higher');
                console.log('   - You need to upgrade to Zoom Pro/Business/Enterprise');
                console.log('   - Current integration will use legacy OAuth method');
                console.log();
            } else {
                console.log('✅ You have a business Zoom account - Server-to-Server OAuth supported');
                console.log();
            }

        } catch (accountError) {
            console.log('❌ Failed to get account info:', accountError.message);
            if (accountError.response?.status === 403) {
                console.log('   This might indicate a Basic account or insufficient permissions');
            }
            console.log();
        }

        // Test 4: List users (if possible)
        console.log('👥 Test 4: User List Check');
        try {
            const usersResponse = await axios.get('https://api.zoom.us/v2/users', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: config.ZOOM_TIMEOUT
            });

            console.log('✅ Found', usersResponse.data.users.length, 'users in your Zoom account:');
            usersResponse.data.users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.first_name} ${user.last_name} (${user.email})`);
                console.log(`   - Status: ${user.status}`);
                console.log(`   - Type: ${user.type === 1 ? 'Basic' : user.type === 2 ? 'Licensed' : 'On-prem'}`);
            });
            console.log();

            console.log('📝 Next Steps:');
            console.log('1. Upgrade to Zoom Pro if you have a Basic account');
            console.log('2. Make sure your agent zoom_email matches an existing user');
            console.log('3. Test creating appointments through your bot');

        } catch (usersError) {
            console.log('❌ Failed to list users:', usersError.message);
            if (usersError.response?.status === 403) {
                console.log('   This confirms you need a Zoom Pro or higher account');
            }
            console.log();
        }

    } catch (tokenError) {
        console.log('❌ Failed to get access token:', tokenError.message);
        console.log('Error details:', tokenError.response?.data || tokenError);
        console.log();
        console.log('🔧 Possible issues:');
        console.log('1. Check your Zoom app credentials');
        console.log('2. Ensure your Zoom app has Server-to-Server OAuth enabled');
        console.log('3. Verify the scopes are correctly set');
    }
}

// Run the test
testZoomBasic().catch(console.error);
