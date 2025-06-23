// api/meta.js

const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { sendTemplateMessage } = require('../sendTemplateMessage');
// Note: We might need generateAiMessage later, but for now, we send a template.

// --- Meta Webhook Verification --------------------------------
// Meta uses this to verify the endpoint is valid.
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      console.log('✅ Meta webhook verified!');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// --- Meta Webhook for Receiving Leads -------------------------
// This endpoint receives the actual lead data from a Facebook Lead Ad.
router.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];

    if (!change || change.field !== 'leadgen') {
      return res.sendStatus(400); // Not a leadgen event
    }

    const { leadgen_id, form_id, page_id } = change.value;
    console.log(`📝 New lead from Meta! Page ID: ${page_id}, Form ID: ${form_id}, Lead ID: ${leadgen_id}`);

    // --- 1. Find the agent associated with this Facebook Page ---
    const { data: page, error: pageError } = await supabase
      .from('pages')
      .select('agent_id, page_name')
      .eq('page_id', page_id)
      .eq('form_id', form_id)
      .single();

    if (pageError || !page) {
      console.error('❌ Could not find matching page/form in Supabase:', page_id, form_id);
      return res.sendStatus(404); // Acknowledge receipt but indicate not found
    }
    console.log(`✅ Page found for "${page.page_name}", associated with agent: ${page.agent_id}`);

    // --- 2. Create a placeholder lead in Supabase ---
    // We will fetch the actual lead details (name, phone) later.
    const { data: lead, error: leadInsertError } = await supabase
      .from('leads')
      .insert({
        agent_id: page.agent_id,
        source: 'Facebook Lead Ad',
        status: 'new',
        meta_page_id: page_id,
        meta_form_id: form_id,
        meta_lead_id: leadgen_id,
      })
      .select('id')
      .single();

    if (leadInsertError) {
      console.error('❌ Error inserting placeholder lead:', leadInsertError);
      return res.sendStatus(500);
    }

    // --- 3. Send Initial Template Message ---
    // This part requires fetching the lead's actual phone number first.
    // For now, we are assuming this happens in a separate step.
    // The sendTemplateMessage function would be called here once you have the number.
    console.log(`💡 Placeholder lead ${lead.id} created. Next step would be to fetch lead details from Meta Graph API and send a WhatsApp template.`);

    res.sendStatus(200);
  } catch (error) {
    console.error('🔥 Meta webhook error:', error);
    res.sendStatus(500);
  }
});

module.exports = router;