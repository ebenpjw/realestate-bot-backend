// api/auth.js

const express = require('express');
const { google } = require('googleapis');
const router = express.Router();
const supabase = require('../supabaseClient'); //
const crypto = require('crypto');

// --- Encryption Configuration ---
const algorithm = 'aes-256-gcm';
const encryptionKey = Buffer.from(process.env.REFRESH_TOKEN_ENCRYPTION_KEY, 'hex');

if (encryptionKey.length !== 32) {
    console.error('🚫 SECURITY ALERT: REFRESH_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 characters). Current length:', encryptionKey.length);
    // In a real production app, you might want to throw an error here to prevent startup
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

// Function to decrypt text (defined here for completeness, though used later)
function decrypt(encryptedData, iv, tag) {
    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const productionRedirectUri = 'https://realestate-bot-backend-production.up.railway.app/api/auth/google/callback';

function getRedirectUri() { //
    if (process.env.NODE_ENV === 'production') { //
        return productionRedirectUri; //
    }
    return process.env.GOOGLE_REDIRECT_URI; //
}

const oauth2Client = new google.auth.OAuth2( //
  process.env.GOOGLE_CLIENT_ID, //
  process.env.GOOGLE_CLIENT_SECRET, //
  getRedirectUri() //
);

const scopes = [ //
  'https://www.googleapis.com/auth/calendar.events', //
  'https://www.googleapis.com/auth/calendar.freebusy' //
];


// === Route 1: Start the Authentication Process ===
router.get('/google', (req, res) => {
  const agentId = req.query.agentId; 

  if (!agentId) {
    return res.status(400).send('Agent ID is required to initiate Google Calendar connection.');
  }

  const statePayload = {
    agentId: agentId,
    timestamp: Date.now()
  };

  const url = oauth2Client.generateAuthUrl({ //
    access_type: 'offline', //
    scope: scopes, //
    prompt: 'consent', //
    state: Buffer.from(JSON.stringify(statePayload)).toString('base64')
  });
  res.redirect(url);
});


// === Route 2: Handle the Callback from Google ===
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).send('Authorization code not found.');
    }

    if (!state) {
      return res.status(400).send('State parameter not found, potential CSRF attack.');
    }

    let parsedState;
    try {
        parsedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    } catch (parseError) {
        console.error('🔥 Error parsing state parameter:', parseError.message);
        return res.status(400).send('Invalid state parameter.');
    }

    const agentId = parsedState.agentId;
    if (!agentId) {
        return res.status(400).send('Agent ID missing in state parameter.');
    }

    const { tokens } = await oauth2Client.getToken(code); //
    const refreshToken = tokens.refresh_token; //

    if (!refreshToken) {
        console.warn(`No refresh token received for agent ID: ${agentId}. This might happen if consent was previously granted without 'prompt: consent'.`); //
        return res.status(400).send('Refresh token not received from Google. Please try connecting again or check if you already granted consent.'); //
    }
    
    console.log(`--- GOOGLE REFRESH TOKEN RECEIVED for Agent ID: ${agentId} ---`);
    console.log('------------------------------------');

    const encryptedTokenData = encrypt(refreshToken);

    // Get agent's Google email from id_token (optional but recommended)
    let googleEmail = null;
    if (tokens.id_token) {
        try {
            const decodedIdToken = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString('utf8'));
            googleEmail = decodedIdToken.email;
            console.log(`Agent's Google Email: ${googleEmail}`);
        } catch (decodeError) {
            console.warn('Could not decode id_token to get agent email:', decodeError.message);
        }
    }

    // Save the encrypted token data to the 'agents' table for that agent in Supabase.
    try {
        const { data, error } = await supabase.from('agents') //
            .update({
                google_refresh_token_encrypted: encryptedTokenData.encryptedData,
                google_token_iv: encryptedTokenData.iv,
                google_token_tag: encryptedTokenData.tag,
                google_email: googleEmail, // Save the agent's Google email
                google_connected_at: new Date().toISOString() // Timestamp of connection
            })
            .eq('id', agentId);

        if (error) {
            console.error('🔥 Supabase error saving refresh token:', error.message);
            throw new Error('Failed to save Google refresh token to database.');
        }

        console.log(`✅ Google refresh token saved for agent ID: ${agentId}`);

    } catch (dbError) {
        console.error('🔥 Database operation failed:', dbError.message);
        res.status(500).send('An error occurred while saving your Google connection. Please try again.');
        return;
    }

    res.send('<h1>Success!</h1><p>Your Google Calendar has been connected. You can close this tab.</p>');

  } catch (error) {
    console.error('🔥 Error during Google OAuth callback:', error.message, error.stack); //
    res.status(500).send('An error occurred during authentication.'); //
  }
});

// Make the decrypt function available if needed elsewhere (e.g., in a calendar utility)
router.decryptRefreshToken = decrypt;

module.exports = router;