// api/zoomService.js

const axios = require('axios');
const supabase = require('../supabaseClient');
const config = require('../config');
const logger = require('../logger');
const { decrypt } = require('./authHelper');

/**
 * Get agent with decrypted Zoom credentials
 * @param {string} agentId - Agent ID
 * @returns {Promise<Object|null>} Agent with decrypted tokens
 */
async function getAgentWithZoomToken(agentId) {
    const { data: agent, error } = await supabase
        .from('agents')
        .select('id, zoom_email, zoom_refresh_token_encrypted, zoom_token_iv, zoom_token_tag')
        .eq('id', agentId)
        .single();

    if (error || !agent) {
        logger.error({ err: error, agentId }, 'Could not find agent or their Zoom credentials.');
        return null;
    }

    if (!agent.zoom_refresh_token_encrypted) {
        logger.warn({ agentId }, "Agent has no Zoom refresh token stored.");
        return null;
    }

    try {
        const decrypted_refresh_token = decrypt(
            agent.zoom_refresh_token_encrypted,
            agent.zoom_token_iv,
            agent.zoom_token_tag
        );
        return { ...agent, decrypted_refresh_token };
    } catch (decryptError) {
        logger.error({ err: decryptError, agentId }, 'Failed to decrypt Zoom refresh token.');
        return null;
    }
}

/**
 * Get fresh Zoom access token using refresh token
 * @param {string} refreshToken - Zoom refresh token
 * @returns {Promise<string>} Access token
 */
async function getZoomAccessToken(refreshToken) {
    try {
        const response = await axios.post('https://zoom.us/oauth/token', null, {
            params: {
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            },
            headers: {
                'Authorization': `Basic ${Buffer.from(`${config.ZOOM_CLIENT_ID}:${config.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data.access_token;
    } catch (error) {
        logger.error({ err: error }, 'Failed to refresh Zoom access token');
        throw new Error('Failed to authenticate with Zoom');
    }
}

/**
 * Create a Zoom meeting
 * @param {string} agentId - Agent ID
 * @param {Object} meetingDetails - Meeting details
 * @returns {Promise<Object>} Created meeting details
 */
async function createZoomMeeting(agentId, meetingDetails) {
    try {
        const agent = await getAgentWithZoomToken(agentId);
        if (!agent || !agent.decrypted_refresh_token) {
            throw new Error('Could not authenticate agent with Zoom');
        }

        const accessToken = await getZoomAccessToken(agent.decrypted_refresh_token);

        const meetingPayload = {
            topic: meetingDetails.topic,
            type: 2, // Scheduled meeting
            start_time: meetingDetails.startTime, // ISO 8601 format
            duration: meetingDetails.duration || 60, // Duration in minutes
            timezone: 'Asia/Singapore',
            agenda: meetingDetails.agenda || '',
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: false,
                mute_upon_entry: true,
                waiting_room: true,
                audio: 'both',
                auto_recording: 'none',
                approval_type: 0 // Automatically approve
            }
        };

        const response = await axios.post('https://api.zoom.us/v2/users/me/meetings', meetingPayload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const meeting = response.data;
        
        logger.info({ 
            agentId, 
            meetingId: meeting.id,
            joinUrl: meeting.join_url 
        }, 'Successfully created Zoom meeting');

        return {
            id: meeting.id,
            topic: meeting.topic,
            startTime: meeting.start_time,
            duration: meeting.duration,
            joinUrl: meeting.join_url,
            password: meeting.password,
            hostEmail: agent.zoom_email
        };
    } catch (error) {
        logger.error({ err: error, agentId }, 'Failed to create Zoom meeting');
        throw error;
    }
}

/**
 * Update a Zoom meeting
 * @param {string} agentId - Agent ID
 * @param {string} meetingId - Zoom meeting ID
 * @param {Object} updateDetails - Updated meeting details
 * @returns {Promise<Object>} Updated meeting details
 */
async function updateZoomMeeting(agentId, meetingId, updateDetails) {
    try {
        const agent = await getAgentWithZoomToken(agentId);
        if (!agent || !agent.decrypted_refresh_token) {
            throw new Error('Could not authenticate agent with Zoom');
        }

        const accessToken = await getZoomAccessToken(agent.decrypted_refresh_token);

        const updatePayload = {
            topic: updateDetails.topic,
            start_time: updateDetails.startTime,
            duration: updateDetails.duration || 60,
            agenda: updateDetails.agenda || ''
        };

        await axios.patch(`https://api.zoom.us/v2/meetings/${meetingId}`, updatePayload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        logger.info({ agentId, meetingId }, 'Successfully updated Zoom meeting');
        
        // Return updated meeting details (you might want to fetch the updated meeting)
        return { meetingId, ...updateDetails };
    } catch (error) {
        logger.error({ err: error, agentId, meetingId }, 'Failed to update Zoom meeting');
        throw error;
    }
}

/**
 * Delete a Zoom meeting
 * @param {string} agentId - Agent ID
 * @param {string} meetingId - Zoom meeting ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteZoomMeeting(agentId, meetingId) {
    try {
        const agent = await getAgentWithZoomToken(agentId);
        if (!agent || !agent.decrypted_refresh_token) {
            throw new Error('Could not authenticate agent with Zoom');
        }

        const accessToken = await getZoomAccessToken(agent.decrypted_refresh_token);

        await axios.delete(`https://api.zoom.us/v2/meetings/${meetingId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        logger.info({ agentId, meetingId }, 'Successfully deleted Zoom meeting');
        return true;
    } catch (error) {
        logger.error({ err: error, agentId, meetingId }, 'Failed to delete Zoom meeting');
        throw error;
    }
}

module.exports = {
    getAgentWithZoomToken,
    createZoomMeeting,
    updateZoomMeeting,
    deleteZoomMeeting
};
