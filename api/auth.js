const express = require('express');
const { google } = require('googleapis');
const router = express.Router();
const supabase = require('../supabaseClient');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');

const algorithm = 'aes-256-gcm';
const encryptionKey = Buffer.from(config.REFRESH_TOKEN_ENCRYPTION_KEY, 'hex');

if (encryptionKey.length !== 32) {
    logger.error({ keyLength: encryptionKey.length }, 'SECURITY ALERT: REFRESH_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 characters).');
    if (config.NODE_ENV === 'production') process.exit(1);
}

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        tag: tag.toString('hex')
    };
}

function decrypt(encryptedData, iv, tag) {
    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

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

router.get('/google', (req, res) => {
  const agentId = req.query.agentId;
  if (!agentId) {
    return res.status(400).send('Agent ID is required to initiate Google Calendar connection.');
  }
  const statePayload = { agentId: agentId, timestamp: Date.now() };
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: Buffer.from(JSON.stringify(statePayload)).toString('base64')
  });
  res.redirect(url);
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
    const encryptedTokenData = encrypt(refreshToken);

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

    const { error } = await supabase.from('agents')
        .update({
            google_refresh_token_encrypted: encryptedTokenData.encryptedData,
            google_token_iv: encryptedTokenData.iv,
            google_token_tag: encryptedTokenData.tag,
            google_email: googleEmail,
            google_connected_at: new Date().toISOString()
        })
        .eq('id', agentId);

    if (error) {
        logger.error({ err: error, agentId }, 'Supabase error saving refresh token');
        throw new Error('Failed to save Google refresh token to database.');
    }

    logger.info({ agentId }, 'Google refresh token saved successfully.');
    res.send('<h1>Success!</h1><p>Your Google Calendar has been connected. You can close this tab.</p>');

  } catch (error) {
    next(error); // Pass error to the centralized handler
  }
});

router.decryptRefreshToken = decrypt;
module.exports = router;