#!/usr/bin/env node

const gupshupPartnerService = require('../services/gupshupPartnerService');

async function checkMessageStatus() {
  try {
    console.log('🔍 Checking message delivery status...');
    
    const messageId = '237c29a9-ed0b-45b3-a712-2b9999927114'; // From our test
    const appId = '74099ef2-87bf-47ac-b104-b6c1e550c8ad';
    
    const appToken = await gupshupPartnerService.getAppAccessToken(appId);
    console.log('✅ Got app token');
    
    // Try to get message status
    try {
      const response = await gupshupPartnerService.axios.get(`/app/${appId}/message/${messageId}`, {
        headers: {
          'Authorization': appToken
        }
      });
      
      console.log('\n📊 Message Status:');
      console.log('ID:', response.data.id);
      console.log('Status:', response.data.status);
      console.log('Delivered:', response.data.delivered);
      console.log('Error:', response.data.error);
      console.log('\n📋 Full response:');
      console.log(JSON.stringify(response.data, null, 2));
      
    } catch (statusError) {
      console.log('❌ Could not get message status:', statusError.message);
      if (statusError.response) {
        console.log('Status API Response:', JSON.stringify(statusError.response.data, null, 2));
      }
      
      // Try alternative endpoint
      console.log('\n🔄 Trying alternative message tracking...');
      try {
        const altResponse = await gupshupPartnerService.axios.get(`/app/${appId}/messages`, {
          headers: {
            'Authorization': appToken
          },
          params: {
            limit: 10
          }
        });
        
        console.log('Recent messages:');
        altResponse.data.messages.forEach(msg => {
          console.log(`- ${msg.id}: ${msg.status} (${msg.timestamp})`);
          if (msg.id === messageId) {
            console.log('  *** THIS IS OUR TEST MESSAGE ***');
          }
        });
        
      } catch (altError) {
        console.log('❌ Alternative endpoint also failed:', altError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMessageStatus();
