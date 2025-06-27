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
        .select('id, google_email, google_refresh_token_encrypted')
        .eq('id', agentId)
        .single();

    logger.info({
        agentId,
        hasData: !!agent,
        hasError: !!error,
        errorCode: error?.code,
        errorMessage: error?.message,
        agentEmail: agent?.google_email,
        hasRefreshToken: !!agent?.google_refresh_token_encrypted
    }, 'Agent lookup result - AGENT ID: ' + agentId);

    if (error || !agent) {
        logger.error({ err: error, agentId }, 'Could not find agent or their Google credentials.');
        return null;
    }

    if (!agent.google_refresh_token_encrypted) {
        logger.warn({ agentId }, "Agent has no Google refresh token stored.");
        return null;
    }

    try {
        // Use new simplified decryption (handles both old and new formats)
        agent.decrypted_refresh_token = decrypt(agent.google_refresh_token_encrypted);
        return agent;
    } catch (decryptError) {
        if (decryptError.message.includes('Legacy encrypted data format')) {
            logger.warn({ agentId }, "Agent has legacy encrypted token - requires re-authentication with Google Calendar");
        } else {
            logger.error({ err: decryptError, agentId }, "Failed to decrypt agent's refresh token.");
        }
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
                items: [{ id: 'primary' }]
            },
        });

        // Enhanced logging for debugging calendar issues
        logger.info({
            agentId,
            calendars: Object.keys(response.data.calendars || {}),
            primaryCalendarExists: !!(response.data.calendars && response.data.calendars.primary),
            fullResponse: JSON.stringify(response.data, null, 2),
            requestTimeRange: `${startTimeISO} to ${endTimeISO}`
        }, 'Google Calendar freebusy response - DETAILED DEBUG');

        // Handle case where calendar data might be missing
        if (!response.data.calendars || !response.data.calendars.primary) {
            logger.warn({
                agentId,
                responseData: JSON.stringify(response.data, null, 2)
            }, 'No primary calendar found in response, assuming no busy slots');
            return [];
        }

        const busySlots = response.data.calendars.primary.busy || [];

        // Enhanced logging for busy slots
        logger.info({
            agentId,
            busySlotsCount: busySlots.length,
            busySlots: busySlots.map(slot =>
                `${new Date(slot.start).toISOString()} - ${new Date(slot.end).toISOString()}`
            ),
            rawBusySlots: JSON.stringify(busySlots, null, 2),
            searchTimeRange: `${new Date(startTimeISO).toISOString()} - ${new Date(endTimeISO).toISOString()}`
        }, 'Checked calendar for busy slots - DETAILED DEBUG');
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
    try {
        logger.info({
            agentId,
            eventDetails: {
                summary: eventDetails.summary,
                startTime: eventDetails.startTimeISO,
                endTime: eventDetails.endTimeISO
            }
        }, 'Starting Google Calendar event creation');

        const { authClient, agent } = await getAuthenticatedClient(agentId);
        if (!authClient || !agent) {
            const error = 'Could not authenticate or retrieve agent details to create Google Calendar event.';
            logger.error({ agentId }, error);
            throw new Error(error);
        }

        logger.info({
            agentId,
            agentEmail: agent.google_email,
            hasAuthClient: !!authClient
        }, 'Authentication successful for calendar event creation');

        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const event = {
            summary: eventDetails.summary,
            description: eventDetails.description,
            start: {
                dateTime: eventDetails.startTimeISO
            },
            end: {
                dateTime: eventDetails.endTimeISO
            },
            attendees: [
                { email: agent.google_email } // Only add the agent to the event
            ],
            // No conferenceData - we only use Zoom meetings, not Google Meet
            reminders: {
                useDefault: true,
            },
        };

        logger.info({
            agentId,
            eventPayload: JSON.stringify(event, null, 2)
        }, 'Attempting to create Google Calendar event with payload');

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            // No conferenceDataVersion needed since we're not using Google Meet
        });

        logger.info({
            agentId,
            eventId: response.data.id,
            eventLink: response.data.htmlLink
        }, 'Successfully created calendar event for agent.');

        return response.data;
    } catch (error) {
        logger.error({
            err: error,
            agentId,
            eventDetails,
            errorMessage: error.message,
            errorCode: error.code,
            errorStatus: error.status
        }, 'Failed to create Google Calendar event - DETAILED ERROR');
        throw error;
    }
}

/**
 * Test function to debug Google Calendar integration
 * @param {string} agentId - Agent ID to test
 * @returns {Promise<Object>} Test results
 */
async function testCalendarIntegration(agentId) {
    try {
        logger.info({ agentId }, 'Starting Google Calendar integration test');

        // Test 1: Check authentication
        const { authClient, agent } = await getAuthenticatedClient(agentId);
        if (!authClient || !agent) {
            return {
                success: false,
                error: 'Authentication failed',
                details: { hasAuthClient: !!authClient, hasAgent: !!agent }
            };
        }

        // Test 2: List calendars
        const calendar = google.calendar({ version: 'v3', auth: authClient });
        const calendarList = await calendar.calendarList.list();

        // Test 3: Check today's events
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const events = await calendar.events.list({
            calendarId: 'primary',
            timeMin: today.toISOString(),
            timeMax: tomorrow.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        // Test 4: Check freebusy for today
        const busySlots = await checkAvailability(agentId, today.toISOString(), tomorrow.toISOString());

        return {
            success: true,
            agent: {
                id: agent.id,
                email: agent.google_email
            },
            calendars: calendarList.data.items?.map(cal => ({
                id: cal.id,
                summary: cal.summary,
                primary: cal.primary
            })) || [],
            todaysEvents: events.data.items?.map(event => ({
                summary: event.summary,
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date
            })) || [],
            busySlots: busySlots
        };
    } catch (error) {
        logger.error({ err: error, agentId }, 'Google Calendar integration test failed');
        return {
            success: false,
            error: error.message,
            details: {
                code: error.code,
                status: error.status
            }
        };
    }
}

module.exports = {
    getAuthenticatedClient,
    checkAvailability,
    createEvent,
    testCalendarIntegration,
};