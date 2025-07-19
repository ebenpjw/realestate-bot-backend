#!/usr/bin/env node

/**
 * Test App Token for Template Creation
 * 
 * This script tests using the app-specific token instead of partner token
 * for template creation, as per Gupshup Partner API documentation
 */

require('dotenv').config();
const axios = require('axios');
const logger = require('./logger');

async function testAppTokenTemplates() {
  try {
    console.log('🧪 Testing App Token for Template Creation\n');

    const appId = '74099ef2-87bf-47ac-b104-b6c1e550c8ad';

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

    const partnerToken = loginResponse.data.token;
    console.log('✅ Partner token obtained');

    // Step 2: Get App-Specific Token
    console.log('🎫 Getting App-Specific Token...');
    
    try {
      const appTokenResponse = await axios.get(`https://partner.gupshup.io/partner/app/${appId}/token`, {
        headers: {
          'Authorization': partnerToken
        }
      });

      if (appTokenResponse.data && appTokenResponse.data.token) {
        const appToken = appTokenResponse.data.token;
        console.log('✅ App token obtained successfully');
        console.log(`🎫 App Token: ${appToken.substring(0, 20)}...`);

        // Step 3: Test Template Access with App Token
        console.log('\n📋 Testing template access with app token...');
        
        try {
          const templatesResponse = await axios.get(`https://partner.gupshup.io/partner/app/${appId}/templates`, {
            headers: {
              'Authorization': appToken
            }
          });
          
          console.log('✅ Can access templates with app token!');
          console.log(`📋 Found ${templatesResponse.data?.templates?.length || 0} existing templates`);
          
          // Step 4: Test Template Creation with App Token
          console.log('\n🧪 Testing template creation with app token...');
          
          const testTemplate = new URLSearchParams();
          testTemplate.append('elementName', `test_template_${Date.now()}`);
          testTemplate.append('languageCode', 'en');
          testTemplate.append('category', 'UTILITY');
          testTemplate.append('content', 'Hi {{1}}, this is a test template for follow-up.');
          testTemplate.append('example', 'Hi John Doe, this is a test template for follow-up.');
          testTemplate.append('enableSample', 'true');
          testTemplate.append('allowTemplateCategoryChange', 'false');

          const createResponse = await axios.post(`https://partner.gupshup.io/partner/app/${appId}/templates`, testTemplate, {
            headers: {
              'Authorization': appToken,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });

          if (createResponse.data && createResponse.data.status === 'success') {
            console.log('🎉 Template creation successful with app token!');
            console.log(`📝 Template ID: ${createResponse.data.template?.id}`);
            console.log(`📊 Status: ${createResponse.data.template?.status}`);
            console.log('\n✅ Solution found: Use app token instead of partner token for template operations');
          } else {
            console.log('❌ Template creation failed');
            console.log(`Response: ${JSON.stringify(createResponse.data, null, 2)}`);
          }

        } catch (templateError) {
          console.log('❌ Template access failed with app token');
          console.log(`Error: ${templateError.response?.status} - ${templateError.response?.statusText}`);
          
          if (templateError.response?.data) {
            console.log(`Response: ${JSON.stringify(templateError.response.data, null, 2)}`);
          }
        }

      } else {
        console.log('❌ Failed to get app token');
        console.log(`Response: ${JSON.stringify(appTokenResponse.data, null, 2)}`);
      }

    } catch (appTokenError) {
      console.log('❌ Failed to get app token');
      console.log(`Error: ${appTokenError.response?.status} - ${appTokenError.response?.statusText}`);
      
      if (appTokenError.response?.data) {
        console.log(`Response: ${JSON.stringify(appTokenError.response.data, null, 2)}`);
      }
    }

    // Step 5: Alternative - Test with different header format
    console.log('\n🔄 Testing alternative authentication methods...');
    
    // Try with 'token' header instead of 'Authorization'
    try {
      const altTemplatesResponse = await axios.get(`https://partner.gupshup.io/partner/app/${appId}/templates`, {
        headers: {
          'token': partnerToken
        }
      });
      
      console.log('✅ Templates accessible with "token" header!');
      console.log(`📋 Found ${altTemplatesResponse.data?.templates?.length || 0} existing templates`);
      
    } catch (altError) {
      console.log('❌ Alternative authentication also failed');
      console.log(`Error: ${altError.response?.status} - ${altError.response?.statusText}`);
    }

  } catch (error) {
    console.error('❌ Error testing app token:', error.message);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAppTokenTemplates();
}

module.exports = { testAppTokenTemplates };
