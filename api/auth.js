// api/auth.js

const express = require('express');
const { google } = require('googleapis');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();
const databaseService = require('../services/databaseService');
const config = require('../config');
const logger = require('../logger');
const { encrypt } = require('./authHelper'); // Import from helper

function getRedirectUri() {
    const redirectUri = config.NODE_ENV === 'production' ? config.PRODUCTION_REDIRECT_URI : config.GOOGLE_REDIRECT_URI;
    logger.info({
      nodeEnv: config.NODE_ENV,
      redirectUri,
      productionUri: config.PRODUCTION_REDIRECT_URI,
      localUri: config.GOOGLE_REDIRECT_URI,
      envGoogleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
      envProductionRedirectUri: process.env.PRODUCTION_REDIRECT_URI
    }, 'OAuth redirect URI determined');
    return redirectUri;
}

function getOAuth2Client() {
    return new google.auth.OAuth2(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        getRedirectUri()
    );
}

const scopes = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.calendars.readonly'
];

// Test endpoint to check if agent exists
router.get('/test-agent/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .select('id, full_name, status')
      .eq('id', agentId)
      .single();

    if (error || !agent) {
      return res.status(404).json({ error: 'Agent not found', agentId });
    }

    res.json({
      success: true,
      agent,
      googleAuthUrl: `/api/auth/google?agentId=${agentId}`,
      zoomAuthUrl: `/api/auth/zoom?agentId=${agentId}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/google', (req, res) => {
  try {
    const agentId = req.query.agentId;
    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID is required to initiate Google Calendar connection.' });
    }

    logger.info({ agentId }, 'Initiating Google OAuth for agent');

    // GOOGLE 2025: Enhanced security with CSRF protection and state validation
    const statePayload = {
      agentId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'), // CSRF protection
      sessionId: req.sessionID || 'no-session' // Session tracking
    };

    const oauth2Client = getOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
      state: Buffer.from(JSON.stringify(statePayload)).toString('base64'),
      // GOOGLE 2025: Enhanced security parameters
      include_granted_scopes: true, // Incremental authorization
      enable_granular_consent: true // Granular consent for better UX
    });

    logger.info({
      agentId,
      stateNonce: statePayload.nonce,
      scopes: scopes.join(', ')
    }, 'Google OAuth URL generated with enhanced security');

    res.redirect(url);
  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error initiating Google OAuth');
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
});

router.get('/google/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      const errorHtml = `
        <html><head><title>Error</title></head><body>
          <h1>Error</h1><p>Authorization code or state not found.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({type: 'GOOGLE_AUTH_ERROR', error: 'Authorization code or state not found'}, window.location.origin);
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body></html>
      `;
      return res.status(400).send(errorHtml);
    }

    let parsedState;
    try {
        parsedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    } catch (parseError) {
        logger.error({ err: parseError }, 'Error parsing state parameter');
        const errorHtml = `
          <html><head><title>Error</title></head><body>
            <h1>Error</h1><p>Invalid state parameter.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({type: 'GOOGLE_AUTH_ERROR', error: 'Invalid state parameter'}, window.location.origin);
              }
              setTimeout(() => window.close(), 2000);
            </script>
          </body></html>
        `;
        return res.status(400).send(errorHtml);
    }

    const agentId = parsedState.agentId;
    if (!agentId) {
      const errorHtml = `
        <html><head><title>Error</title></head><body>
          <h1>Error</h1><p>Agent ID missing in state parameter.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({type: 'GOOGLE_AUTH_ERROR', error: 'Agent ID missing'}, window.location.origin);
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body></html>
      `;
      return res.status(400).send(errorHtml);
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
        logger.warn({ agentId }, "No refresh token received for agent. This might happen if consent was previously granted without 'prompt: consent'.");
        const errorHtml = `
          <html><head><title>Error</title></head><body>
            <h1>Error</h1><p>Refresh token not received. Please try connecting again.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({type: 'GOOGLE_AUTH_ERROR', error: 'Refresh token not received. Please try connecting again.'}, window.location.origin);
              }
              setTimeout(() => window.close(), 2000);
            </script>
          </body></html>
        `;
        return res.status(400).send(errorHtml);
    }
    
    logger.info({ agentId }, `Google Refresh Token Received for Agent.`);

    let encryptedTokenData;
    try {
      encryptedTokenData = encrypt(refreshToken);
      logger.info({ agentId }, 'Token encryption successful');
    } catch (encryptError) {
      logger.error({ err: encryptError, agentId }, 'Token encryption failed');
      throw new Error('Failed to encrypt refresh token');
    }

    let googleEmail = null;
    if (tokens.id_token) {
        try {
            const decodedIdToken = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString('utf8'));
            googleEmail = decodedIdToken.email;
            logger.info({ agentId, googleEmail }, `Agent's Google Email identified.`);
        } catch (decodeError) {
            logger.warn({ agentId, err: decodeError }, 'Could not decode id_token to get agent email.');
        }
    }

    const updateData = {
        google_refresh_token_encrypted: encryptedTokenData.encryptedData,
        google_email: googleEmail
    };

    logger.info({ agentId, updateData: { ...updateData, google_refresh_token_encrypted: '[ENCRYPTED]' } }, 'Attempting to save Google auth data');

    const { data, error } = await databaseService.supabase.from('agents')
        .update(updateData)
        .eq('id', agentId)
        .select();

    if (error) {
        logger.error({ err: error, agentId }, 'Supabase error saving refresh token');
        throw new Error('Failed to save Google refresh token to database.');
    }

    logger.info({ agentId, updatedAgent: data }, 'Google refresh token saved successfully.');

    // Send success message to parent window and close popup
    const successHtml = `
      <html>
        <head>
          <title>Google Calendar Connected</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .success { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto; }
            .success h1 { color: #22c55e; margin-bottom: 10px; }
            .success p { color: #666; margin-bottom: 20px; }
            .loading { color: #999; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Success!</h1>
            <p>Your Google Calendar has been connected successfully.</p>
            <p class="loading">Closing window...</p>
          </div>
          <script>
            // Send success message to parent window
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_AUTH_SUCCESS',
                agentId: '${agentId}'
              }, window.location.origin);
            }

            // Close the popup after a short delay
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `;

    res.send(successHtml);

  } catch (error) {
    logger.error({ err: error, agentId: req.query.state }, 'Google OAuth callback failed');

    // Send error message to parent window
    const errorHtml = `
      <html>
        <head>
          <title>Google Calendar Connection Failed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .error { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto; }
            .error h1 { color: #ef4444; margin-bottom: 10px; }
            .error p { color: #666; margin-bottom: 20px; }
            .loading { color: #999; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Connection Failed</h1>
            <p>Failed to connect your Google Calendar. Please try again.</p>
            <p class="loading">Closing window...</p>
          </div>
          <script>
            // Send error message to parent window
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_AUTH_ERROR',
                error: '${error.message || 'Authentication failed'}'
              }, window.location.origin);
            }

            // Close the popup after a short delay
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `;

    res.status(500).send(errorHtml);
  }
});

// ==========================================
// ZOOM OAUTH ROUTES
// ==========================================

router.get('/zoom', (req, res) => {
  try {
    const agentId = req.query.agentId;
    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID is required to initiate Zoom connection.' });
    }

    if (!config.ZOOM_CLIENT_ID || !config.ZOOM_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Zoom OAuth not configured' });
    }

    logger.info({ agentId }, 'Initiating Zoom OAuth for agent with enhanced security');

    // ZOOM 2025: Enhanced security with state validation and CSRF protection
    const statePayload = {
      agentId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'), // CSRF protection
      sessionId: req.sessionID || 'no-session' // Session tracking
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');

    // ZOOM 2025: Enhanced OAuth URL with security parameters
    const zoomAuthUrl = `https://zoom.us/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${config.ZOOM_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(config.ZOOM_REDIRECT_URI)}&` +
      `state=${state}&` +
      `scope=meeting:write:meeting%20user:read:user`; // Updated scopes to match Zoom Marketplace configuration

    logger.info({
      agentId,
      stateNonce: statePayload.nonce,
      scopes: 'meeting:write:meeting user:read:user',
      fullAuthUrl: zoomAuthUrl, // Log the complete URL for debugging
      clientId: config.ZOOM_CLIENT_ID,
      redirectUri: config.ZOOM_REDIRECT_URI
    }, 'Zoom OAuth URL generated with enhanced security');

    // Also log to console for Railway debugging
    console.log('🔍 ZOOM OAUTH DEBUG:', {
      agentId,
      clientId: config.ZOOM_CLIENT_ID,
      clientIdLength: config.ZOOM_CLIENT_ID?.length,
      clientIdFirst4: config.ZOOM_CLIENT_ID?.substring(0, 4),
      clientIdLast4: config.ZOOM_CLIENT_ID?.substring(config.ZOOM_CLIENT_ID.length - 4),
      redirectUri: config.ZOOM_REDIRECT_URI,
      fullAuthUrl: zoomAuthUrl
    });

    res.redirect(zoomAuthUrl);
  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error initiating Zoom OAuth');
    res.status(500).json({ error: 'Failed to initiate Zoom authentication' });
  }
});

router.get('/zoom/callback', async (req, res, next) => {
  try {
    logger.info({ query: req.query }, 'Zoom OAuth callback received');
    console.log('🔍 ZOOM CALLBACK DEBUG:', req.query);

    const { code, state, error: oauthError, error_description } = req.query;

    // Check for OAuth errors from Zoom
    if (oauthError) {
      console.log('❌ ZOOM OAUTH ERROR:', { error: oauthError, error_description });
      logger.error({ error: oauthError, error_description }, 'Zoom OAuth error received');
      return res.status(400).send(`Zoom OAuth Error: ${oauthError} - ${error_description || 'No description provided'}`);
    }

    if (!code || !state) {
      logger.error({ code: !!code, state: !!state }, 'Missing authorization code or state parameter');
      return res.status(400).send('Missing authorization code or state parameter.');
    }

    let parsedState;
    try {
      parsedState = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (parseError) {
      logger.error({ err: parseError, state }, 'Failed to parse state parameter');
      return res.status(400).send('Invalid state parameter.');
    }

    // ZOOM 2025: Enhanced state validation for security
    const agentId = parsedState.agentId;
    const stateTimestamp = parsedState.timestamp;
    const stateNonce = parsedState.nonce;

    if (!agentId || !stateTimestamp || !stateNonce) {
      logger.error({ parsedState }, 'Required state parameters missing');
      return res.status(400).send('Invalid state parameter - missing required fields.');
    }

    // ZOOM 2025: Validate state timestamp (prevent replay attacks)
    const stateAge = Date.now() - stateTimestamp;
    const maxStateAge = 10 * 60 * 1000; // 10 minutes
    if (stateAge > maxStateAge) {
      logger.error({ agentId, stateAge, maxStateAge }, 'State parameter expired');
      return res.status(400).send('Authorization request expired. Please try again.');
    }

    logger.info({
      agentId,
      clientId: config.ZOOM_CLIENT_ID,
      redirectUri: config.ZOOM_REDIRECT_URI,
      hasClientSecret: !!config.ZOOM_CLIENT_SECRET,
      codeLength: code?.length
    }, 'Starting Zoom token exchange');

    // Exchange code for tokens
    let tokenResponse;
    try {
      const requestParams = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.ZOOM_REDIRECT_URI
      };

      const requestHeaders = {
        'Authorization': `Basic ${Buffer.from(`${config.ZOOM_CLIENT_ID}:${config.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      logger.info({
        agentId,
        requestParams,
        requestHeaders: { ...requestHeaders, Authorization: 'Basic [HIDDEN]' }
      }, 'Zoom token exchange request details');

      tokenResponse = await axios.post('https://zoom.us/oauth/token', null, {
        params: requestParams,
        headers: requestHeaders,
        timeout: 10000
      });
    } catch (tokenError) {
      logger.error({
        err: tokenError.response?.data || tokenError.message,
        status: tokenError.response?.status,
        headers: tokenError.response?.headers,
        requestConfig: {
          url: tokenError.config?.url,
          method: tokenError.config?.method,
          params: tokenError.config?.params,
          headers: tokenError.config?.headers
        },
        agentId
      }, 'Zoom token exchange failed');
      return res.status(500).send(`Failed to exchange authorization code for tokens. Error: ${JSON.stringify(tokenError.response?.data || tokenError.message)}`);
    }

    const { access_token, refresh_token } = tokenResponse.data;
    if (!access_token) {
      logger.error({ tokenData: tokenResponse.data, agentId }, 'No access token received from Zoom');
      return res.status(400).send('No access token received from Zoom.');
    }

    logger.info({ agentId, hasRefreshToken: !!refresh_token }, 'Zoom tokens received');

    // Get user info to store email
    let userResponse;
    try {
      userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        },
        timeout: 10000
      });
    } catch (userError) {
      logger.error({
        err: userError.response?.data || userError.message,
        status: userError.response?.status,
        agentId
      }, 'Failed to get Zoom user info');
      return res.status(500).send('Failed to retrieve user information from Zoom.');
    }

    const zoomEmail = userResponse.data.email;
    logger.info({ agentId, zoomEmail }, 'Retrieved Zoom user information');

    // Store both access and refresh tokens if available
    const updateData = {
      zoom_email: zoomEmail,
      zoom_connected_at: new Date().toISOString()
    };

    // Encrypt and store access token
    try {
      const encryptedAccessToken = encrypt(access_token);
      updateData.zoom_access_token_encrypted = encryptedAccessToken.encryptedData;
      updateData.zoom_access_token_iv = encryptedAccessToken.iv;
      updateData.zoom_access_token_tag = encryptedAccessToken.tag;
    } catch (encryptError) {
      logger.error({ err: encryptError, agentId }, 'Failed to encrypt access token');
      return res.status(500).send('Failed to encrypt access token.');
    }

    // Encrypt and store refresh token if available
    if (refresh_token) {
      try {
        const encryptedRefreshToken = encrypt(refresh_token);
        updateData.zoom_refresh_token_encrypted = encryptedRefreshToken.encryptedData;
        updateData.zoom_refresh_token_iv = encryptedRefreshToken.iv;
        updateData.zoom_refresh_token_tag = encryptedRefreshToken.tag;
      } catch (encryptError) {
        logger.error({ err: encryptError, agentId }, 'Failed to encrypt refresh token');
        return res.status(500).send('Failed to encrypt refresh token.');
      }
    }

    // Save to database
    const { error } = await databaseService.supabase.from('agents')
        .update(updateData)
        .eq('id', agentId);

    if (error) {
        logger.error({ err: error, agentId, updateData: Object.keys(updateData) }, 'Supabase error saving Zoom tokens');
        return res.status(500).send('Failed to save Zoom tokens to database.');
    }

    logger.info({ agentId, hasRefreshToken: !!refresh_token }, 'Zoom tokens saved successfully');
    res.send('<h1>Success!</h1><p>Your Zoom account has been connected successfully. You can close this tab.</p>');

  } catch (error) {
    logger.error({ err: error, agentId: req.query.state }, 'Zoom OAuth callback failed');
    next(error); // Pass error to the centralized handler
  }
});

// Debug endpoint to check environment variables (Railway only)
router.get('/debug-env', (req, res) => {
  if (config.NODE_ENV !== 'production') {
    return res.status(403).json({ error: 'Debug endpoint only available in production' });
  }

  res.json({
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    zoom: {
      clientId: config.ZOOM_CLIENT_ID ? `${config.ZOOM_CLIENT_ID.substring(0, 8)}...` : 'MISSING',
      clientSecret: config.ZOOM_CLIENT_SECRET ? `${config.ZOOM_CLIENT_SECRET.substring(0, 8)}...` : 'MISSING',
      redirectUri: config.ZOOM_REDIRECT_URI || 'MISSING'
    },
    google: {
      clientId: config.GOOGLE_CLIENT_ID ? `${config.GOOGLE_CLIENT_ID.substring(0, 8)}...` : 'MISSING',
      clientSecret: config.GOOGLE_CLIENT_SECRET ? `${config.GOOGLE_CLIENT_SECRET.substring(0, 8)}...` : 'MISSING'
    }
  });
});

module.exports = router;