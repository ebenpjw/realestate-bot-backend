// api/zoomServerService.js
// Purpose: Server-to-Server OAuth integration for Zoom
// This allows creating meetings for multiple agents using a single Zoom Business account
// without requiring individual agent authorization

const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Get Server-to-Server access token using account credentials grant type
 * @returns {Promise<string>} Access token
 */
async function getServerAccessToken() {
    try {
        const response = await axios.post('https://zoom.us/oauth/token', null, {
            params: {
                grant_type: 'account_credentials',
                account_id: config.ZOOM_ACCOUNT_ID
            },
            headers: {
                'Authorization': `Basic ${Buffer.from(`${config.ZOOM_CLIENT_ID}:${config.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: config.ZOOM_TIMEOUT
        });

        logger.info({ 
            accountId: config.ZOOM_ACCOUNT_ID,
            tokenType: response.data.token_type,
            expiresIn: response.data.expires_in 
        }, 'Successfully obtained Zoom server access token');

        return response.data.access_token;
    } catch (error) {
        logger.error({ 
            err: error,
            accountId: config.ZOOM_ACCOUNT_ID,
            responseData: error.response?.data,
            responseStatus: error.response?.status
        }, 'Failed to get Zoom server access token');
        throw new Error('Failed to authenticate with Zoom Server-to-Server OAuth');
    }
}

/**
 * Check if a Zoom user exists in the account
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User details if exists, null if not found
 */
async function getZoomUser(email) {
    try {
        const accessToken = await getServerAccessToken();

        const userResponse = await axios.get(`https://api.zoom.us/v2/users/${encodeURIComponent(email)}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: config.ZOOM_TIMEOUT
        });

        logger.info({
            email,
            userId: userResponse.data.id,
            status: userResponse.data.status
        }, 'Found existing Zoom user');

        return userResponse.data;
    } catch (getUserError) {
        if (getUserError.response?.status === 404) {
            logger.warn({ email }, 'Zoom user not found in account - user must be manually created in Zoom admin panel');
            return null;
        } else {
            logger.error({
                err: getUserError,
                email,
                responseData: getUserError.response?.data,
                responseStatus: getUserError.response?.status
            }, 'Failed to get Zoom user');
            throw getUserError;
        }
    }
}

/**
 * Create a Zoom meeting for a specific user by email
 * @param {string} userEmail - Email of the user who will host the meeting
 * @param {Object} meetingDetails - Meeting details
 * @returns {Promise<Object>} Created meeting details
 */
async function createZoomMeetingForUser(userEmail, meetingDetails) {
    try {
        logger.info({ 
            userEmail, 
            topic: meetingDetails.topic,
            startTime: meetingDetails.startTime 
        }, 'Creating Zoom meeting for user');

        const accessToken = await getServerAccessToken();

        // Check if user exists in our Zoom account
        const zoomUser = await getZoomUser(userEmail);
        if (!zoomUser) {
            throw new Error(`Zoom user ${userEmail} not found in account. Please create this user in your Zoom admin panel first.`);
        }

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

        const response = await axios.post(`https://api.zoom.us/v2/users/${encodeURIComponent(userEmail)}/meetings`, meetingPayload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: config.ZOOM_TIMEOUT
        });

        const meeting = response.data;
        
        logger.info({ 
            userEmail,
            meetingId: meeting.id,
            joinUrl: meeting.join_url,
            topic: meeting.topic
        }, 'Successfully created Zoom meeting for user');

        return {
            id: meeting.id,
            topic: meeting.topic,
            startTime: meeting.start_time,
            duration: meeting.duration,
            joinUrl: meeting.join_url,
            password: meeting.password,
            hostEmail: userEmail
        };
    } catch (error) {
        logger.error({ 
            err: error,
            userEmail,
            meetingDetails,
            responseData: error.response?.data,
            responseStatus: error.response?.status
        }, 'Failed to create Zoom meeting for user');
        throw error;
    }
}

/**
 * Update a Zoom meeting for a specific user
 * @param {string} userEmail - Email of the user who hosts the meeting
 * @param {string} meetingId - Zoom meeting ID
 * @param {Object} updateDetails - Updated meeting details
 * @returns {Promise<Object>} Updated meeting details
 */
async function updateZoomMeetingForUser(userEmail, meetingId, updateDetails) {
    try {
        logger.info({ 
            userEmail, 
            meetingId,
            topic: updateDetails.topic 
        }, 'Updating Zoom meeting for user');

        const accessToken = await getServerAccessToken();

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
            },
            timeout: config.ZOOM_TIMEOUT
        });

        logger.info({ 
            userEmail,
            meetingId,
            topic: updateDetails.topic
        }, 'Successfully updated Zoom meeting for user');

        return {
            id: meetingId,
            topic: updateDetails.topic,
            startTime: updateDetails.startTime,
            duration: updateDetails.duration,
            hostEmail: userEmail
        };
    } catch (error) {
        logger.error({ 
            err: error,
            userEmail,
            meetingId,
            updateDetails,
            responseData: error.response?.data,
            responseStatus: error.response?.status
        }, 'Failed to update Zoom meeting for user');
        throw error;
    }
}

/**
 * Delete a Zoom meeting for a specific user
 * @param {string} userEmail - Email of the user who hosts the meeting
 * @param {string} meetingId - Zoom meeting ID
 * @returns {Promise<void>}
 */
async function deleteZoomMeetingForUser(userEmail, meetingId) {
    try {
        logger.info({ 
            userEmail, 
            meetingId 
        }, 'Deleting Zoom meeting for user');

        const accessToken = await getServerAccessToken();

        await axios.delete(`https://api.zoom.us/v2/meetings/${meetingId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: config.ZOOM_TIMEOUT
        });

        logger.info({ 
            userEmail,
            meetingId
        }, 'Successfully deleted Zoom meeting for user');
    } catch (error) {
        logger.error({ 
            err: error,
            userEmail,
            meetingId,
            responseData: error.response?.data,
            responseStatus: error.response?.status
        }, 'Failed to delete Zoom meeting for user');
        throw error;
    }
}

module.exports = {
    getServerAccessToken,
    getZoomUser,
    createZoomMeetingForUser,
    updateZoomMeetingForUser,
    deleteZoomMeetingForUser
};
