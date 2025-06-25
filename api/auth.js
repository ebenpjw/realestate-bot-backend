// api/auth.js

const express = require('express');
const { google } = require('googleapis');
const axios = require('axios');
const router = express.Router();
const supabase = require('../supabaseClient');
const config = require('../config');
const logger = require('../logger');
const { encrypt } = require('./authHelper'); // Import from helper

function getRedirectUri() {
    return config.NODE_ENV === 'production' ? config.PRODUCTION_REDIRECT_URI : config.GOOGLE_REDIRECT_URI;
}

const oauth2Client = new google.auth.OAuth2(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  getRedirectUri()
);

const scopes = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy'
];

// Test endpoint to check if agent exists
router.get('/test-agent/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { data: agent, error } = await supabase
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

    const statePayload = { agentId: agentId, timestamp: Date.now() };
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: Buffer.from(JSON.stringify(statePayload)).toString('base64')
    });

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
      return res.status(400).send('Authorization code or state not found.');
    }

    let parsedState;
    try {
        parsedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    } catch (parseError) {
        logger.error({ err: parseError }, 'Error parsing state parameter');
        return res.status(400).send('Invalid state parameter.');
    }

    const agentId = parsedState.agentId;
    if (!agentId) return res.status(400).send('Agent ID missing in state parameter.');

    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
        logger.warn({ agentId }, "No refresh token received for agent. This might happen if consent was previously granted without 'prompt: consent'.");
        return res.status(400).send('Refresh token not received. Please try connecting again.');
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
        google_token_iv: encryptedTokenData.iv,
        google_token_tag: encryptedTokenData.tag,
        google_email: googleEmail,
        google_connected_at: new Date().toISOString()
    };

    logger.info({ agentId, updateData: { ...updateData, google_refresh_token_encrypted: '[ENCRYPTED]' } }, 'Attempting to save Google auth data');

    const { data, error } = await supabase.from('agents')
        .update(updateData)
        .eq('id', agentId)
        .select();

    if (error) {
        logger.error({ err: error, agentId }, 'Supabase error saving refresh token');
        throw new Error('Failed to save Google refresh token to database.');
    }

    logger.info({ agentId, updatedAgent: data }, 'Google refresh token saved successfully.');
    res.send('<h1>Success!</h1><p>Your Google Calendar has been connected. You can close this tab.</p>');

  } catch (error) {
    next(error); // Pass error to the centralized handler
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

    logger.info({ agentId }, 'Initiating Zoom OAuth for agent');

    const statePayload = { agentId: agentId, timestamp: Date.now() };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');

    const zoomAuthUrl = `https://zoom.us/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${config.ZOOM_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(config.ZOOM_REDIRECT_URI)}&` +
      `state=${state}`;

    res.redirect(zoomAuthUrl);
  } catch (error) {
    logger.error({ err: error, agentId: req.query.agentId }, 'Error initiating Zoom OAuth');
    res.status(500).json({ error: 'Failed to initiate Zoom authentication' });
  }
});

router.get('/zoom/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send('Missing authorization code or state parameter.');
    }

    const parsedState = JSON.parse(Buffer.from(state, 'base64').toString());
    const agentId = parsedState.agentId;
    if (!agentId) return res.status(400).send('Agent ID missing in state parameter.');

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://zoom.us/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.ZOOM_REDIRECT_URI
      },
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.ZOOM_CLIENT_ID}:${config.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token } = tokenResponse.data;
    if (!refresh_token) {
      return res.status(400).send('No refresh token received from Zoom. Please ensure your Zoom app has the correct scopes.');
    }

    // Get user info to store email
    const userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const zoomEmail = userResponse.data.email;
    logger.info({ agentId, zoomEmail }, 'Retrieved Zoom user information.');

    // Encrypt and store refresh token
    const encryptedTokenData = encrypt(refresh_token);

    const { error } = await supabase.from('agents')
        .update({
            zoom_refresh_token_encrypted: encryptedTokenData.encryptedData,
            zoom_refresh_token_iv: encryptedTokenData.iv,
            zoom_refresh_token_tag: encryptedTokenData.tag,
            zoom_email: zoomEmail,
            zoom_connected_at: new Date().toISOString()
        })
        .eq('id', agentId);

    if (error) {
        logger.error({ err: error, agentId }, 'Supabase error saving Zoom refresh token');
        throw new Error('Failed to save Zoom refresh token to database.');
    }

    logger.info({ agentId }, 'Zoom refresh token saved successfully.');
    res.send('<h1>Success!</h1><p>Your Zoom account has been connected. You can close this tab.</p>');

  } catch (error) {
    next(error); // Pass error to the centralized handler
  }
});

module.exports = router;