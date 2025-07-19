#!/usr/bin/env node

/**
 * Check Partner Apps and Permissions
 * 
 * This script checks what apps are available to the partner account
 * and their permissions for template creation
 */

require('dotenv').config();
const axios = require('axios');
const logger = require('./logger');

async function checkPartnerApps() {
  try {
    console.log('🔍 Checking Partner Apps and Permissions\n');

    // Step 1: Get Partner Token
    console.log('🔐 Getting Partner Token...');
    
    const loginData = new URLSearchParams();
    loginData.append('email', process.env.GUPSHUP_PARTNER_EMAIL);
    loginData.append('password', process.env.GUPSHUP_PARTNER_CLIENT_SECRET);

    const loginResponse = await axios.post('https://partner.gupshup.io/partner/account/login', loginData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!loginResponse.data || !loginResponse.data.token) {
      throw new Error('Failed to get partner token');
    }

    const token = loginResponse.data.token;
    console.log('✅ Partner token obtained successfully');
    console.log(`👤 Partner ID: ${loginResponse.data.id}`);
    console.log(`📧 Email: ${loginResponse.data.email}`);
    console.log(`🏢 Admin: ${loginResponse.data.admin}`);
    console.log('');

    // Step 2: Get Partner Apps
    console.log('📱 Getting Partner Apps...');
    
    const appsResponse = await axios.get('https://partner.gupshup.io/partner/account/api/partnerApps', {
      headers: {
        'Authorization': token
      }
    });

    if (!appsResponse.data || appsResponse.data.status !== 'success') {
      throw new Error('Failed to get partner apps');
    }

    const apps = appsResponse.data.partnerAppsList;
    console.log(`✅ Found ${apps.length} partner apps\n`);

    // Step 3: Display App Details
    apps.forEach((app, index) => {
      console.log(`📱 App ${index + 1}: ${app.name}`);
      console.log(`   ID: ${app.id}`);
      console.log(`   Status: ${app.live ? 'Live' : 'Sandbox'}`);
      console.log(`   Healthy: ${app.healthy}`);
      console.log(`   Phone: ${app.phone || 'Not set'}`);
      console.log(`   Created: ${new Date(app.createdOn).toLocaleDateString()}`);
      console.log('');
    });

    // Step 4: Check Current Agent App ID
    console.log('🔍 Checking Current Agent Configuration...');
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, full_name, gupshup_app_id')
      .eq('status', 'active');

    if (error) throw error;

    if (agents && agents.length > 0) {
      agents.forEach(agent => {
        console.log(`👤 Agent: ${agent.full_name}`);
        console.log(`   ID: ${agent.id}`);
        console.log(`   App ID: ${agent.gupshup_app_id || 'Not configured'}`);
        
        // Check if agent's app ID matches any partner app
        const matchingApp = apps.find(app => app.id === agent.gupshup_app_id);
        if (matchingApp) {
          console.log(`   ✅ App found in partner apps: ${matchingApp.name}`);
        } else if (agent.gupshup_app_id) {
          console.log(`   ❌ App ID not found in partner apps`);
        } else {
          console.log(`   ⚠️  No app ID configured`);
        }
        console.log('');
      });
    }

    // Step 5: Test Template Creation Permission
    console.log('🧪 Testing Template Creation Permission...');
    
    if (apps.length > 0) {
      const testApp = apps[0];
      console.log(`Testing with app: ${testApp.name} (${testApp.id})`);
      
      try {
        // Try to get existing templates first
        const templatesResponse = await axios.get(`https://partner.gupshup.io/partner/app/${testApp.id}/templates`, {
          headers: {
            'Authorization': token
          }
        });
        
        console.log('✅ Can access templates endpoint');
        console.log(`📋 Found ${templatesResponse.data?.templates?.length || 0} existing templates`);
        
      } catch (error) {
        console.log('❌ Cannot access templates endpoint');
        console.log(`   Error: ${error.response?.status} - ${error.response?.statusText}`);
        
        if (error.response?.data) {
          console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
    }

    // Step 6: Recommendations
    console.log('\n💡 Recommendations:');
    
    if (apps.length === 0) {
      console.log('❌ No partner apps found. You need to:');
      console.log('   1. Create an app in the Partner Portal');
      console.log('   2. Link it to your partner account');
    } else {
      console.log('✅ Partner apps found. Next steps:');
      console.log('   1. Ensure your agent\'s gupshup_app_id matches a partner app ID');
      console.log('   2. Verify the app has template creation permissions');
      console.log('   3. Check if the app is properly configured for WhatsApp Business');
    }

  } catch (error) {
    console.error('❌ Error checking partner apps:', error.message);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    process.exit(1);
  }
}

// Run the check
if (require.main === module) {
  checkPartnerApps();
}

module.exports = { checkPartnerApps };
