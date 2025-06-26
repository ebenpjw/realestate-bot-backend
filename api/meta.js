// api/meta.js

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');

// This is the background processing function for Meta leads
// It now also fetches the agent's page-specific access token.
async function processMetaLead(changeValue) {
    try {
        const { leadgen_id, form_id, page_id } = changeValue;
        logger.info({ leadgen_id, form_id, page_id }, 'New lead from Meta!');

        // 1. Find the agent and page details associated with this Facebook Page
        // We now also select the page_access_token, which is required by the
        // Graph API to fetch lead details. This token should be stored in your `pages` table.
        const { data: page, error: pageError } = await supabase
            .from('pages')
            .select('agent_id, page_name, page_access_token, welcome_template_id') // Added page_access_token and template_id
            .eq('page_id', page_id)
            .eq('form_id', form_id)
            .single();

        if (pageError || !page) {
            logger.error({ page_id, form_id, err: pageError }, 'Could not find matching page/form in Supabase.');
            return;
        }
        logger.info({ pageName: page.page_name, agentId: page.agent_id }, `Page found, associated with agent.`);

        if (!page.page_access_token) {
            logger.error({ page_id, form_id }, 'FATAL: page_access_token is missing for this page in Supabase. Cannot fetch lead details.');
            return;
        }

        // 2. Create a placeholder lead in Supabase.
        // The phone number and name will be filled in by a subsequent process (e.g., Supabase Edge Function).
        // We now pass the page_access_token to the new lead record.
        const { data: lead, error: leadInsertError } = await supabase
            .from('leads')
            .insert({
                agent_id: page.agent_id,
                source: 'Facebook Lead Ad',
                status: 'new', // Status indicates it's fresh
                meta_page_id: page_id,
                meta_form_id: form_id,
                meta_lead_id: leadgen_id,
                meta_page_access_token: page.page_access_token, // Store the token for the Edge Function to use
                welcome_template_id: page.welcome_template_id, // Store the template for the Edge Function to use
            })
            .select('id')
            .single();

        if (leadInsertError) {
            logger.error({ err: leadInsertError }, 'Error inserting placeholder lead.');
            return;
        }

        logger.info({ leadId: lead.id }, 'Placeholder lead created. Awaiting details fetch from Meta Graph API (via Edge Function).');

    } catch (error) {
        logger.error({ err: error }, 'Meta webhook processing error.');
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
