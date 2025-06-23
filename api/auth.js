// api/auth.js

const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// This is the redirect URI for your production environment on Railway
const productionRedirectUri = 'https://realestate-bot-backend-production.up.railway.app/api/auth/google/callback';

// This function determines which redirect URI to use based on the environment
function getRedirectUri() {
    // If the NODE_ENV is 'production' (like on Railway), use the production URI
    if (process.env.NODE_ENV === 'production') {
        return productionRedirectUri;
    }
    // Otherwise, use the localhost URI for local development
    return process.env.GOOGLE_REDIRECT_URI;
}

// Initialize the OAuth2 client with your credentials
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  getRedirectUri() // Use our dynamic function here
);

// Define the permissions your app requires
const scopes = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy'
];


// === Route 1: Start the Authentication Process ===
// An agent would be directed here when they click "Connect Google Calendar".
router.get('/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get a refresh token
    scope: scopes,
    prompt: 'consent' // Ensures the user is always asked for consent and gets a refresh token
  });
  res.redirect(url);
});


// === Route 2: Handle the Callback from Google ===
// This is the route that Google redirects to after the user grants consent.
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Authorization code not found.');
    }

    // Exchange the authorization code for access and refresh tokens
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
        // This can happen if the user has already granted consent before.
        // The 'prompt: consent' in the auth URL above helps prevent this.
        return res.status(400).send('Refresh token not received from Google. Please try connecting again.');
    }
    
    console.log('--- GOOGLE REFRESH TOKEN RECEIVED ---');
    console.log(refreshToken);
    console.log('------------------------------------');

    // TODO in the next step:
    // 1. Get the ID of the agent who initiated this request (we'll need a way to track this).
    // 2. Encrypt the refreshToken.
    // 3. Save the encrypted token to the 'agents' table for that agent in Supabase.

    res.send('<h1>Success!</h1><p>Your Google Calendar has been connected. You can close this tab.</p>');

  } catch (error) {
    console.error('🔥 Error during Google OAuth callback:', error.message);
    res.status(500).send('An error occurred during authentication.');
  }
});

module.exports = router;