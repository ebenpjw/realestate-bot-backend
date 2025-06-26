// api/googleCalendarService.js
const { google } = require('googleapis');
const supabase = require('../supabaseClient');
const config = require('../config');
const logger = require('../logger');
const { decrypt } = require('./authHelper'); // Correctly import from helper

async function getAgentWithToken(agentId) {
    logger.info({ agentId }, 'Looking up agent with Google credentials');

    const { data: agent, error } = await supabase
        .from('agents')
        .select('id, google_email, google_refresh_token_encrypted, google_token_iv, google_token_tag')
        .eq('id', agentId)
        .single();

    logger.info({
        agentId,
        hasData: !!agent,
        hasError: !!error,
        errorCode: error?.code,
        errorMessage: error?.message
    }, 'Agent lookup result');

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
    if (!agent || !agent.decrypted_refresh_token) return { authClient: null, agent: null };

    const redirectUri = config.NODE_ENV === 'production' ? config.PRODUCTION_REDIRECT_URI : config.GOOGLE_REDIRECT_URI;

    const oauth2Client = new google.auth.OAuth2(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        redirectUri
    );

    oauth2Client.setCredentials({
        refresh_token: agent.decrypted_refresh_token
    });

    // GOOGLE 2025: Enhanced token management with automatic refresh
    oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
            // Store new refresh token if provided
            logger.info({ agentId }, 'New Google refresh token received, updating database');
            try {
                const { encrypt } = require('./authHelper');
                const encryptedToken = encrypt(tokens.refresh_token);

                await supabase.from('agents').update({
                    google_refresh_token_encrypted: encryptedToken.encryptedData,
                    google_token_iv: encryptedToken.iv,
                    google_token_tag: encryptedToken.tag,
                    google_token_updated_at: new Date().toISOString()
                }).eq('id', agentId);

                logger.info({ agentId }, 'Google refresh token updated successfully');
            } catch (error) {
                logger.error({ err: error, agentId }, 'Failed to update Google refresh token');
            }
        }
    });

    return { authClient: oauth2Client, agent };
}

async function checkAvailability(agentId, startTimeISO, endTimeISO) {
    try {
        logger.info({
            agentId,
            startTimeISO,
            endTimeISO
        }, 'Checking Google Calendar availability');

        const { authClient } = await getAuthenticatedClient(agentId);
        if (!authClient) {
            throw new Error('Could not authenticate with Google Calendar.');
        }

        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const response = await calendar.freebusy.query({
            requestBody: {
                timeMin: startTimeISO,
                timeMax: endTimeISO,
                items: [{ id: 'primary' }],
                timeZone: 'Asia/Singapore',
            },
        });

        logger.info({
            agentId,
            response: response.data,
            calendars: Object.keys(response.data.calendars || {})
        }, 'Google Calendar freebusy response');

        // Handle case where calendar data might be missing
        if (!response.data.calendars || !response.data.calendars.primary) {
            logger.warn({ agentId }, 'No primary calendar found in response, assuming no busy slots');
            return [];
        }

        const busySlots = response.data.calendars.primary.busy || [];
        logger.info({ agentId, busySlotsCount: busySlots.length }, 'Checked calendar for busy slots.');
        return busySlots;

    } catch (error) {
        logger.error({
            err: error,
            agentId,
            startTimeISO,
            endTimeISO,
            errorMessage: error.message,
            errorCode: error.code
        }, 'Error checking Google Calendar availability');

        // Return empty array so appointment booking can continue
        // This allows the system to show all slots as available if calendar check fails
        return [];
    }
}

async function createEvent(agentId, eventDetails) {
    const { authClient, agent } = await getAuthenticatedClient(agentId);
    if (!authClient || !agent) {
        throw new Error('Could not authenticate or retrieve agent details to create Google Calendar event.');
    }

    const calendar = google.calendar({ version: 'v3', auth: authClient });
    
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