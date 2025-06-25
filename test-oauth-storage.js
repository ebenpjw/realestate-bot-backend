// test-oauth-storage.js - Test OAuth token storage
const supabase = require('./supabaseClient');
const logger = require('./logger');
const { encrypt } = require('./api/authHelper');

async function testOAuthStorage() {
  const testAgentId = '4d1c54b9-71b5-4f89-828b-ffe179fcab08';
  
  try {
    logger.info('🔐 Testing OAuth token storage...');
    
    // Test 1: Try to update agent with Google OAuth tokens
    logger.info('📝 Testing Google OAuth token storage...');
    
    const testRefreshToken = 'test_refresh_token_12345';
    const testEmail = 'test@example.com';
    
    // Encrypt the test token
    const { encryptedData, iv, tag } = encrypt(testRefreshToken);
    
    const { data: updatedAgent, error: updateError } = await supabase
      .from('agents')
      .update({
        google_email: testEmail,
        google_refresh_token_encrypted: encryptedData,
        google_token_iv: iv,
        google_token_tag: tag,
        google_connected_at: new Date().toISOString()
      })
      .eq('id', testAgentId)
      .select()
      .single();
    
    if (updateError) {
      logger.error({ 
        err: updateError,
        agentId: testAgentId,
        errorCode: updateError.code,
        errorMessage: updateError.message
      }, '❌ Google OAuth token storage failed');
      return false;
    }
    
    logger.info({ 
      agentId: testAgentId,
      googleEmail: updatedAgent.google_email,
      hasEncryptedToken: !!updatedAgent.google_refresh_token_encrypted,
      connectedAt: updatedAgent.google_connected_at
    }, '✅ Google OAuth token storage successful');
    
    // Test 2: Try to update agent with Zoom OAuth tokens
    logger.info('📹 Testing Zoom OAuth token storage...');
    
    const testZoomAccessToken = 'test_zoom_access_token_12345';
    const testZoomRefreshToken = 'test_zoom_refresh_token_12345';
    
    // Encrypt the Zoom tokens
    const { encryptedData: encryptedAccess, iv: accessIv, tag: accessTag } = encrypt(testZoomAccessToken);
    const { encryptedData: encryptedRefresh, iv: refreshIv, tag: refreshTag } = encrypt(testZoomRefreshToken);
    
    const { data: zoomUpdatedAgent, error: zoomUpdateError } = await supabase
      .from('agents')
      .update({
        zoom_access_token_encrypted: encryptedAccess,
        zoom_access_token_iv: accessIv,
        zoom_access_token_tag: accessTag,
        zoom_refresh_token_encrypted: encryptedRefresh,
        zoom_refresh_token_iv: refreshIv,
        zoom_refresh_token_tag: refreshTag,
        zoom_connected_at: new Date().toISOString()
      })
      .eq('id', testAgentId)
      .select()
      .single();
    
    if (zoomUpdateError) {
      logger.error({ 
        err: zoomUpdateError,
        agentId: testAgentId,
        errorCode: zoomUpdateError.code,
        errorMessage: zoomUpdateError.message
      }, '❌ Zoom OAuth token storage failed');
      return false;
    }
    
    logger.info({ 
      agentId: testAgentId,
      hasZoomAccessToken: !!zoomUpdatedAgent.zoom_access_token_encrypted,
      hasZoomRefreshToken: !!zoomUpdatedAgent.zoom_refresh_token_encrypted,
      zoomConnectedAt: zoomUpdatedAgent.zoom_connected_at
    }, '✅ Zoom OAuth token storage successful');
    
    // Test 3: Verify we can read the tokens back
    logger.info('🔍 Testing token retrieval...');
    
    const { data: retrievedAgent, error: retrieveError } = await supabase
      .from('agents')
      .select('id, full_name, google_email, google_refresh_token_encrypted, google_token_iv, google_token_tag, zoom_access_token_encrypted, zoom_refresh_token_encrypted')
      .eq('id', testAgentId)
      .single();
    
    if (retrieveError) {
      logger.error({ err: retrieveError }, '❌ Token retrieval failed');
      return false;
    }
    
    logger.info({ 
      agentId: testAgentId,
      hasGoogleTokens: !!(retrievedAgent.google_refresh_token_encrypted && retrievedAgent.google_token_iv && retrievedAgent.google_token_tag),
      hasZoomTokens: !!(retrievedAgent.zoom_access_token_encrypted && retrievedAgent.zoom_refresh_token_encrypted),
      googleEmail: retrievedAgent.google_email
    }, '✅ Token retrieval successful');
    
    return true;
    
  } catch (error) {
    logger.error({ 
      err: error,
      agentId: testAgentId 
    }, '💥 OAuth storage test failed with exception');
    
    return false;
  }
}

// Run test if called directly
if (require.main === module) {
  testOAuthStorage()
    .then(success => {
      if (success) {
        logger.info('🎉 OAuth storage test completed successfully');
      } else {
        logger.error('❌ OAuth storage test failed');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error({ err: error }, '💥 OAuth storage test execution failed');
      process.exit(1);
    });
}

module.exports = { testOAuthStorage };
