// api/meta.js

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');

// Meta lead processing is currently disabled
// TODO: Re-implement when Facebook Lead Ads integration is needed

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
