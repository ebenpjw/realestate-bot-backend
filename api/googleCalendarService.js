// api/googleCalendarService.js
// Purpose: A dedicated service to handle all Google Calendar API interactions.

const { google } = require('googleapis');
const supabase = require('../supabaseClient');
const config = require('../config');
const logger = require('../logger');
const { decrypt } = require('./authHelper');

async function getAgentWithToken(agentId) { /* ... (no changes here) ... */ }
async function getAuthenticatedClient(agentId) { /* ... (no changes here) ... */ }
async function checkAvailability(agentId, startTimeISO, endTimeISO) { /* ... (no changes here) ... */ }

/**
 * Creates a new event in the agent's Google Calendar.
 * This version does NOT invite the lead, as we don't collect their email.
 * @param {string} agentId - The agent for whom to book the event.
 * @param {object} eventDetails - Details for the event.
 * @returns {object} The created event object from the Google API.
 */
async function createEvent(agentId, eventDetails) {
    const auth = await getAuthenticatedClient(agentId);
    if (!auth) throw new Error('Could not authenticate to create Google Calendar event.');

    const calendar = google.calendar({ version: 'v3', auth });
    
    const agent = await getAgentWithToken(agentId);
    if (!agent) throw new Error('Could not retrieve agent details for booking.');

    const event = {
        summary: eventDetails.summary,
        description: eventDetails.description,
        start: {
            dateTime: eventDetails.startTimeISO,
            timeZone: 'Asia/Singapore',
        },
        end: {
            dateTime: eventDetails.endTimeISO,
            timeZone: 'Asia/Singapore',
        },
        attendees: [
            { email: agent.google_email } // Only add the agent to the event
        ],
        conferenceData: {
            createRequest: {
                requestId: `zoom-consult-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
        },
        reminders: {
            useDefault: true,
        },
    };

    const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1,
    });

    logger.info({ agentId, eventId: response.data.id }, 'Successfully created calendar event for agent.');
    return response.data;
}


module.exports = {
    getAuthenticatedClient,
    checkAvailability,
    createEvent,
};

// --- Functions below this line are copied from the previous turn and have no changes ---

async function getAgentWithToken(agentId) {
    const { data: agent, error } = await supabase
        .from('agents')
        .select('id, google_email, google_refresh_token_encrypted, google_token_iv, google_token_tag')
        .eq('id', agentId)
        .single();

    if (error || !agent) {
        logger.error({ err: error, agentId }, 'Could not find agent or their Google credentials.');
        return null;
    }

    if (!agent.google_refresh_token_encrypted) {
        logger.warn({ agentId }, "Agent has no Google refresh token stored.");
        return null;
    }

    try {
        agent.decrypted_refresh_token = decrypt(
            agent.google_refresh_token_encrypted,
            agent.google_token_iv,
            agent.google_token_tag
        );
        return agent;
    } catch (decryptError) {
        logger.error({ err: decryptError, agentId }, "Failed to decrypt agent's refresh token.");
        return null;
    }
}

async function getAuthenticatedClient(agentId) {
    const agent = await getAgentWithToken(agentId);
    if (!agent || !agent.decrypted_refresh_token) return null;

    function getRedirectUri() {
        return config.NODE_ENV === 'production' ? config.PRODUCTION_REDIRECT_URI : config.GOOGLE_REDIRECT_URI;
    }

    const oauth2Client = new google.auth.OAuth2(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        getRedirectUri()
    );

    oauth2Client.setCredentials({
        refresh_token: agent.decrypted_refresh_token
    });

    return oauth2Client;
}

async function checkAvailability(agentId, startTimeISO, endTimeISO) {
    const auth = await getAuthenticatedClient(agentId);
    if (!auth) throw new Error('Could not authenticate with Google Calendar.');

    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.freebusy.query({
        requestBody: {
            timeMin: startTimeISO,
            timeMax: endTimeISO,
            items: [{ id: 'primary' }],
            timeZone: 'Asia/Singapore',
        },
    });
    
    const busySlots = response.data.calendars.primary.busy;
    logger.info({ agentId, busySlotsCount: busySlots.length }, 'Checked calendar for busy slots.');
    return busySlots;
}
