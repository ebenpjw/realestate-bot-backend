// api/meta.js

const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// This is the background processing function for Meta leads
async function processMetaLead(changeValue) {
    try {
        const { leadgen_id, form_id, page_id } = changeValue;
        console.log(`📝 New lead from Meta! Page ID: ${page_id}, Form ID: ${form_id}, Lead ID: ${leadgen_id}`);

        // 1. Find the agent associated with this Facebook Page
        const { data: page, error: pageError } = await supabase
            .from('pages')
            .select('agent_id, page_name')
            .eq('page_id', page_id)
            .eq('form_id', form_id)
            .single();

        if (pageError || !page) {
            return console.error('❌ Could not find matching page/form in Supabase:', page_id, form_id);
        }
        console.log(`✅ Page found for "${page.page_name}", associated with agent: ${page.agent_id}`);

        // 2. Create a placeholder lead in Supabase
        // Note: The actual phone number will be fetched in a later step.
        const { data: lead, error: leadInsertError } = await supabase
            .from('leads')
            .insert({
                agent_id: page.agent_id,
                source: 'Facebook Lead Ad',
                status: 'new',
                meta_page_id: page_id,
                meta_form_id: form_id,
                meta_lead_id: leadgen_id,
                // phone_number is intentionally left null until we fetch it from Meta
            })
            .select('id')
            .single();

        if (leadInsertError) {
            return console.error('❌ Error inserting placeholder lead:', leadInsertError);
        }

        console.log(`💡 Placeholder lead ${lead.id} created. Next step is to fetch lead details from Meta Graph API.`);

    } catch (error) {
        console.error('🔥 Meta webhook processing error:', error);
    }
}


// --- Meta Webhook Handler ---

// Verification endpoint (handles GET requests from Meta)
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log('✅ Meta webhook verified!');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Lead receiving endpoint (handles POST requests from Meta)
router.post('/webhook', (req, res) => {
    console.log('📩 Incoming Meta webhook:', JSON.stringify(req.body, null, 2));
    
    // Acknowledge the request immediately
    res.sendStatus(200);

    // Process the lead data in the background
    const changeValue = req.body?.entry?.[0]?.changes?.[0]?.value;
    if (changeValue && req.body?.entry?.[0]?.changes?.[0]?.field === 'leadgen') {
        processMetaLead(changeValue);
    } else {
        console.log('ℹ️ Received a non-leadgen event from Meta. Acknowledging.');
    }
});

module.exports = router;
