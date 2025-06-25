// test-api-endpoint.js - Test the actual API endpoint
const axios = require('axios');
const logger = require('./logger');

async function testApiEndpoint() {
  const baseUrl = 'https://realestate-bot-backend-production.up.railway.app';
  const agentId = '4d1c54b9-71b5-4f89-828b-ffe179fcab08';
  
  try {
    logger.info('🧪 Testing API endpoints...');
    
    // Test 1: Health check
    logger.info('❤️ Testing health endpoint...');
    try {
      const healthResponse = await axios.get(`${baseUrl}/health`, { timeout: 10000 });
      logger.info({ 
        status: healthResponse.status,
        data: healthResponse.data 
      }, '✅ Health endpoint working');
    } catch (healthError) {
      logger.error({ 
        err: healthError.response?.data || healthError.message,
        status: healthError.response?.status 
      }, '❌ Health endpoint failed');
    }
    
    // Test 2: Test agent endpoint
    logger.info({ agentId }, '🎯 Testing agent endpoint...');
    try {
      const agentResponse = await axios.get(`${baseUrl}/api/auth/test-agent/${agentId}`, { 
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'test-script'
        }
      });
      
      logger.info({ 
        status: agentResponse.status,
        data: agentResponse.data 
      }, '✅ Agent endpoint working');
      
      return true;
      
    } catch (agentError) {
      logger.error({ 
        err: agentError.response?.data || agentError.message,
        status: agentError.response?.status,
        headers: agentError.response?.headers,
        config: {
          url: agentError.config?.url,
          method: agentError.config?.method
        }
      }, '❌ Agent endpoint failed');
      
      // If it's a 400 error, let's see the exact response
      if (agentError.response?.status === 400) {
        logger.error('🔍 This is the 400 error you encountered');
      }
      
      return false;
    }
    
  } catch (error) {
    logger.error({ err: error }, '💥 API endpoint test failed');
    return false;
  }
}

// Test Google OAuth endpoint
async function testGoogleOAuth() {
  const baseUrl = 'https://realestate-bot-backend-production.up.railway.app';
  const agentId = '4d1c54b9-71b5-4f89-828b-ffe179fcab08';
  
  try {
    logger.info('🔐 Testing Google OAuth endpoint...');
    
    const response = await axios.get(`${baseUrl}/api/auth/google?agentId=${agentId}`, { 
      timeout: 10000,
      maxRedirects: 0, // Don't follow redirects
      validateStatus: function (status) {
        return status < 400; // Accept redirects as success
      }
    });
    
    logger.info({ 
      status: response.status,
      location: response.headers.location 
    }, '✅ Google OAuth redirect working');
    
    return true;
    
  } catch (error) {
    if (error.response?.status === 302 || error.response?.status === 301) {
      logger.info({ 
        status: error.response.status,
        location: error.response.headers.location 
      }, '✅ Google OAuth redirect working (caught redirect)');
      return true;
    }
    
    logger.error({ 
      err: error.response?.data || error.message,
      status: error.response?.status 
    }, '❌ Google OAuth endpoint failed');
    
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  Promise.all([
    testApiEndpoint(),
    testGoogleOAuth()
  ])
    .then(([apiSuccess, oauthSuccess]) => {
      const overallSuccess = apiSuccess && oauthSuccess;
      if (overallSuccess) {
        logger.info('🎉 All API endpoint tests completed successfully');
      } else {
        logger.error('❌ Some API endpoint tests failed');
      }
      process.exit(overallSuccess ? 0 : 1);
    })
    .catch(error => {
      logger.error({ err: error }, '💥 API endpoint test execution failed');
      process.exit(1);
    });
}

module.exports = { testApiEndpoint, testGoogleOAuth };
