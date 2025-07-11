// api/meta.js

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');

const facebookLeadService = require('../services/facebookLeadService');

// Enhanced Meta lead processing with full Facebook/Instagram integration
async function processMetaLead(changeValue) {
    const operationId = `meta-lead-${changeValue.leadgen_id}-${Date.now()}`;

    try {
        const { leadgen_id, form_id, page_id, ad_id, campaign_id, adset_id } = changeValue;

        logger.info({
            operationId,
            leadgen_id,
            form_id,
            page_id,
            ad_id,
            campaign_id
        }, 'Processing new lead from Meta');

        // Determine source type (Facebook vs Instagram)
        const sourceType = changeValue.source_type || 'facebook'; // Default to facebook if not specified

        // Prepare webhook data for processing
        const webhookData = {
            leadgen_id,
            form_id,
            page_id,
            ad_id,
            campaign_id,
            adset_id,
            source_type: sourceType,
            campaign_data: {
                ad_id,
                campaign_id,
                adset_id,
                form_id
            }
        };

        // TODO: Fetch actual lead data from Facebook API using leadgen_id
        // For now, we'll need to make an API call to Facebook to get the lead details
        // This requires the page access token and the leadgen_id

        // Get page access token
        const accessToken = await facebookLeadService.getPageAccessToken(page_id);
        if (!accessToken) {
            logger.error({ operationId, page_id }, 'No access token found for Facebook page');
            return;
        }

        // Fetch lead data from Facebook API
        const leadData = await fetchFacebookLeadData(leadgen_id, accessToken, operationId);
        if (!leadData) {
            logger.error({ operationId, leadgen_id }, 'Failed to fetch lead data from Facebook');
            return;
        }

        // Add lead data to webhook data
        webhookData.phone_number = leadData.phone_number;
        webhookData.full_name = leadData.full_name;
        webhookData.email = leadData.email;

        // Process the lead through our service
        const result = await facebookLeadService.processFacebookLead(webhookData);

        if (result.success) {
            logger.info({
                operationId,
                leadId: result.leadId,
                agentId: result.agentId,
                isNewLead: result.isNewLead,
                hasDuplicates: result.duplicateInfo?.hasDuplicates
            }, 'Meta lead processed successfully');

            // TODO: Trigger WhatsApp conversation initiation if this is a new lead
            // This would integrate with your existing bot service
            if (result.isNewLead && result.leadId) {
                logger.info({ operationId, leadId: result.leadId }, 'New Facebook lead - ready for WhatsApp initiation');
                // await initiateWhatsAppConversation(result.leadId);
            }

        } else {
            logger.error({
                operationId,
                error: result.error
            }, 'Failed to process Meta lead');
        }

    } catch (error) {
        logger.error({ err: error, operationId }, 'Meta webhook processing error');
    }
}

// Helper function to fetch lead data from Facebook API
async function fetchFacebookLeadData(leadgenId, accessToken, operationId) {
    try {
        const axios = require('axios');

        const response = await axios.get(`https://graph.facebook.com/v18.0/${leadgenId}`, {
            params: {
                access_token: accessToken,
                fields: 'field_data'
            },
            timeout: 10000
        });

        if (!response.data || !response.data.field_data) {
            logger.error({ operationId, leadgenId }, 'Invalid response from Facebook API');
            return null;
        }

        // Parse field data into structured format
        const fieldData = response.data.field_data;
        const leadData = {};

        fieldData.forEach(field => {
            const fieldName = field.name.toLowerCase();
            const fieldValue = field.values && field.values[0];

            if (fieldName.includes('phone') || fieldName.includes('mobile')) {
                leadData.phone_number = fieldValue;
            } else if (fieldName.includes('name') || fieldName === 'full_name') {
                leadData.full_name = fieldValue;
            } else if (fieldName.includes('email')) {
                leadData.email = fieldValue;
            }
        });

        logger.info({
            operationId,
            leadgenId,
            hasPhone: !!leadData.phone_number,
            hasName: !!leadData.full_name,
            hasEmail: !!leadData.email
        }, 'Facebook lead data fetched successfully');

        return leadData;

    } catch (error) {
        logger.error({ err: error, operationId, leadgenId }, 'Error fetching Facebook lead data');
        return null;
    }
}

// --- Meta Webhook Handler ---

// Verification endpoint (handles GET requests from Meta)
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe' && token === config.META_VERIFY_TOKEN) {
        logger.info('Meta webhook verified!');
        res.status(200).send(challenge);
    } else {
        logger.warn('Failed Meta webhook verification attempt.');
        res.sendStatus(403);
    }
});

// Lead receiving endpoint (handles POST requests from Meta) - Enhanced for 2025
router.post('/webhook', (req, res) => {
    // META 2025: Enhanced signature verification with timing attack protection
    const signature = req.headers['x-hub-signature-256'];
    const timestamp = req.headers['x-hub-timestamp'];

    if (config.NODE_ENV === 'production') {
        if (!signature) {
            logger.error({ ip: req.ip, userAgent: req.get('User-Agent') }, 'Missing x-hub-signature-256 header from Meta');
            return res.status(403).json({ error: 'Missing signature' });
        }

        // META 2025: Validate timestamp to prevent replay attacks
        if (timestamp) {
            const requestTime = parseInt(timestamp) * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            const timeDiff = Math.abs(currentTime - requestTime);
            const maxTimeDiff = 5 * 60 * 1000; // 5 minutes

            if (timeDiff > maxTimeDiff) {
                logger.error({
                    ip: req.ip,
                    timeDiff,
                    maxTimeDiff
                }, 'Meta webhook timestamp too old - possible replay attack');
                return res.status(403).json({ error: 'Request too old' });
            }
        }

        // META 2025: Enhanced signature verification with timing-safe comparison
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
        const expectedHash = crypto.createHmac('sha256', config.META_APP_SECRET)
                                  .update(rawBody)
                                  .digest('hex');
        const expectedSignature = `sha256=${expectedHash}`;

        // Use timing-safe comparison to prevent timing attacks
        const signatureBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (signatureBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
            logger.error({
                ip: req.ip,
                signature: `${signature.substring(0, 10)}...`,
                userAgent: req.get('User-Agent')
            }, 'Invalid Meta webhook signature');
            return res.status(403).json({ error: 'Invalid signature' });
        }

        logger.debug({ ip: req.ip }, 'Meta webhook signature verified successfully');
    }
    
    logger.debug({ body: req.body }, 'Incoming Meta webhook');
    
    // Acknowledge the request immediately
    res.sendStatus(200);

    // Process the lead data in the background
    const changeValue = req.body?.entry?.[0]?.changes?.[0]?.value;
    if (changeValue && req.body?.entry?.[0]?.changes?.[0]?.field === 'leadgen') {
        processMetaLead(changeValue).catch(err => {
            logger.error({ err }, 'Unhandled exception in async processMetaLead from Meta webhook.');
        });
    } else {
        logger.info({ payload: req.body },'Received a non-leadgen event from Meta. Acknowledging.');
    }
});

module.exports = router;
