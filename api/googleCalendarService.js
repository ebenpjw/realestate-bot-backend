// api/googleCalendarService.js
const { google } = require('googleapis');
const databaseService = require('../services/databaseService');
const config = require('../config');
const logger = require('../logger');
const { decrypt } = require('./authHelper'); // Correctly import from helper

async function getAgentWithToken(agentId) {
    logger.info({ agentId }, 'Looking up agent with Google credentials');

    const { data: agent, error } = await databaseService.supabase
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
    }, `Agent lookup result - AGENT ID: ${agentId}`);

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

                await databaseService.supabase.from('agents').update({
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

    // Pre-emptively refresh access token to ensure it's valid
    try {
        await oauth2Client.getAccessToken();
        logger.info({ agentId }, 'Google OAuth access token refreshed successfully');
    } catch (tokenError) {
        logger.warn({
            err: tokenError,
            agentId,
            errorMessage: tokenError.message,
            errorCode: tokenError.code
        }, 'Failed to refresh Google OAuth access token');
        // Don't fail here - let the actual API call handle the error
    }

    return { authClient: oauth2Client, agent };
}

async function checkAvailability(agentId, startTimeISO, endTimeISO, retryCount = 0) {
    try {
        logger.info({
            agentId,
            startTimeISO,
            endTimeISO,
            retryCount,
            startTimeParsed: new Date(startTimeISO).toISOString(),
            endTimeParsed: new Date(endTimeISO).toISOString()
        }, 'Checking Google Calendar availability with date format validation');

        const { authClient } = await getAuthenticatedClient(agentId);
        if (!authClient) {
            logger.warn({ agentId }, 'Could not authenticate with Google Calendar - proceeding without calendar check');
            return [];
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
        // Handle specific authentication errors with retry logic
        if ((error.message?.includes('invalid_grant') || error.code === 400) && retryCount === 0) {
            logger.warn({
                agentId,
                errorMessage: error.message,
                errorCode: error.code,
                retryCount
            }, 'Google Calendar authentication failed - attempting retry after token refresh');

            // Mark agent's Google token as needing refresh
            try {
                await databaseService.supabase.from('agents').update({
                    google_token_status: 'needs_refresh',
                    google_token_last_error: error.message,
                    google_token_error_at: new Date().toISOString()
                }).eq('id', agentId);
            } catch (updateError) {
                logger.error({ err: updateError, agentId }, 'Failed to update agent token status');
            }

            // Retry once after marking token for refresh
            logger.info({ agentId }, 'Retrying calendar availability check after token refresh');
            return await checkAvailability(agentId, startTimeISO, endTimeISO, retryCount + 1);
        } else if (error.message?.includes('invalid_grant') || error.code === 400) {
            logger.error({
                agentId,
                errorMessage: error.message,
                errorCode: error.code,
                retryCount
            }, 'Google Calendar authentication failed after retry - proceeding without calendar check');
        } else {
            logger.error({
                err: error,
                agentId,
                startTimeISO,
                endTimeISO,
                errorMessage: error.message,
                errorCode: error.code,
                retryCount
            }, 'Error checking Google Calendar availability');
        }

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
                // timeZone removed since we're using RFC3339 format with timezone offset
            },
            end: {
                dateTime: eventDetails.endTimeISO
                // timeZone removed since we're using RFC3339 format with timezone offset
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
            eventPayload: JSON.stringify(event, null, 2),
            startTimeRFC3339: eventDetails.startTimeISO,
            endTimeRFC3339: eventDetails.endTimeISO
        }, 'Attempting to create Google Calendar event with RFC3339 payload');

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            // No conferenceDataVersion needed since we're not using Google Meet
        });

        logger.info({
            agentId,
            eventId: response.data.id,
            eventLink: response.data.htmlLink,
            eventStart: response.data.start,
            eventEnd: response.data.end,
            responseStatus: response.status
        }, 'Successfully created calendar event for agent.');

        return response.data;
    } catch (error) {
        // Handle specific authentication errors
        if (error.message?.includes('invalid_grant') || error.code === 400) {
            logger.warn({
                agentId,
                errorMessage: error.message,
                errorCode: error.code
            }, 'Google Calendar authentication failed during event creation - token may be expired');

            // Mark agent's Google token as needing refresh
            try {
                await databaseService.supabase.from('agents').update({
                    google_token_status: 'needs_refresh',
                    google_token_last_error: error.message,
                    google_token_error_at: new Date().toISOString()
                }).eq('id', agentId);
            } catch (updateError) {
                logger.error({ err: updateError, agentId }, 'Failed to update agent token status');
            }
        } else {
            logger.error({
                err: error,
                agentId,
                eventDetails,
                errorMessage: error.message,
                errorCode: error.code,
                errorStatus: error.status,
                errorResponse: error.response?.data,
                errorConfig: error.config ? {
                    method: error.config.method,
                    url: error.config.url,
                    data: error.config.data
                } : null
            }, 'Failed to create Google Calendar event - DETAILED ERROR');
        }
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
            busySlots
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

/**
 * Delete a Google Calendar event
 * @param {string} agentId - Agent ID
 * @param {string} eventId - Calendar event ID to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteEvent(agentId, eventId) {
    try {
        logger.info({
            agentId,
            eventId
        }, 'Starting Google Calendar event deletion');

        const { authClient, agent } = await getAuthenticatedClient(agentId);
        if (!authClient || !agent) {
            const error = 'Could not authenticate or retrieve agent details to delete Google Calendar event.';
            logger.error({ agentId, eventId }, error);
            throw new Error(error);
        }

        const calendar = google.calendar({ version: 'v3', auth: authClient });

        await calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId
        });

        logger.info({
            agentId,
            eventId,
            agentEmail: agent.google_email
        }, 'Successfully deleted calendar event');

        return true;
    } catch (error) {
        // Handle specific errors
        if (error.code === 404) {
            logger.warn({
                agentId,
                eventId,
                errorMessage: error.message
            }, 'Calendar event not found (may have been already deleted)');
            return true; // Consider this a success since the event is gone
        }

        if (error.message?.includes('invalid_grant') || error.code === 400) {
            logger.warn({
                agentId,
                eventId,
                errorMessage: error.message,
                errorCode: error.code
            }, 'Google Calendar authentication failed during event deletion - token may be expired');

            // Mark agent's Google token as needing refresh
            try {
                await databaseService.supabase.from('agents').update({
                    google_token_status: 'needs_refresh',
                    google_token_last_error: error.message,
                    google_token_error_at: new Date().toISOString()
                }).eq('id', agentId);
            } catch (updateError) {
                logger.error({ err: updateError, agentId }, 'Failed to update agent token status');
            }
        }

        logger.error({
            err: error,
            agentId,
            eventId,
            responseData: error.response?.data,
            responseStatus: error.response?.status
        }, 'Failed to delete calendar event');

        throw error;
    }
}

/**
 * Update a Google Calendar event
 * @param {string} agentId - Agent ID
 * @param {string} eventId - Calendar event ID to update
 * @param {Object} eventDetails - Updated event details
 * @returns {Promise<Object>} Updated event data
 */
async function updateEvent(agentId, eventId, eventDetails) {
    try {
        logger.info({
            agentId,
            eventId,
            eventDetails: {
                summary: eventDetails.summary,
                startTime: eventDetails.startTimeISO,
                endTime: eventDetails.endTimeISO
            }
        }, 'Starting Google Calendar event update');

        const { authClient, agent } = await getAuthenticatedClient(agentId);
        if (!authClient || !agent) {
            const error = 'Could not authenticate or retrieve agent details to update Google Calendar event.';
            logger.error({ agentId, eventId }, error);
            throw new Error(error);
        }

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
                { email: agent.google_email }
            ],
            reminders: {
                useDefault: true,
            },
        };

        const response = await calendar.events.update({
            calendarId: 'primary',
            eventId: eventId,
            resource: event
        });

        logger.info({
            agentId,
            eventId,
            eventLink: response.data.htmlLink,
            responseStatus: response.status
        }, 'Successfully updated calendar event');

        return response.data;
    } catch (error) {
        logger.error({
            err: error,
            agentId,
            eventId,
            responseData: error.response?.data,
            responseStatus: error.response?.status
        }, 'Failed to update calendar event');

        throw error;
    }
}

/**
 * Get calendar events for a specific date range
 * @param {string} agentId - Agent ID
 * @param {string} startTimeISO - Start time in ISO format
 * @param {string} endTimeISO - End time in ISO format
 * @returns {Promise<Array>} Array of calendar events
 */
async function getCalendarEvents(agentId, startTimeISO, endTimeISO) {
    try {
        logger.info({
            agentId,
            startTimeISO,
            endTimeISO
        }, 'Fetching Google Calendar events');

        const { authClient } = await getAuthenticatedClient(agentId);
        if (!authClient) {
            logger.warn({ agentId }, 'Could not authenticate with Google Calendar - returning empty events');
            return [];
        }

        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: startTimeISO,
            timeMax: endTimeISO,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 250 // Get up to 250 events
        });

        const events = response.data.items || [];

        logger.info({
            agentId,
            eventCount: events.length,
            dateRange: `${startTimeISO} to ${endTimeISO}`
        }, 'Successfully fetched Google Calendar events');

        // Transform events to match frontend expectations
        return events.map(event => ({
            id: event.id,
            title: event.summary || 'Untitled Event',
            description: event.description || '',
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            location: event.location || '',
            attendees: event.attendees?.map(attendee => attendee.email) || [],
            htmlLink: event.htmlLink,
            status: event.status,
            created: event.created,
            updated: event.updated,
            creator: event.creator?.email,
            organizer: event.organizer?.email,
            isAllDay: !event.start?.dateTime, // If no dateTime, it's an all-day event
            source: 'google_calendar'
        }));

    } catch (error) {
        logger.error({
            err: error,
            agentId,
            startTimeISO,
            endTimeISO
        }, 'Error fetching Google Calendar events');

        // Return empty array on error to prevent calendar from breaking
        return [];
    }
}

module.exports = {
    getAuthenticatedClient,
    checkAvailability,
    createEvent,
    deleteEvent,
    updateEvent,
    testCalendarIntegration,
    getCalendarEvents
};