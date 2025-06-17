// ---🧠 Imports & Config --------------------------------------
require('dotenv').config();
const express = require('express');
const supabase = require('./supabaseClient');
const { generateAiMessage } = require('./generateAiMessage');
const axios = require('axios');
const qs = require('qs');


// ---🚀 App Init ----------------------------------------------
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8880;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ---💓 Healthcheck -------------------------------------------
app.get('/health', (req, res) => {
  res.send('✅ Bot backend is alive');
});

// ---📥 Insert Lead (Manual) ----------------------------------
app.post('/lead', async (req, res) => {
  const { full_name, phone, email, project, source } = req.body;

  const { data, error } = await supabase
    .from('leads')
    .insert([{ full_name, phone, email, project, source }])
    .select();

  if (error) {
    console.error('❌ Supabase insert failed:', error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log('✅ New lead inserted:', data);
  res.status(200).json({ message: 'Lead stored', data });
});

// ---📨 Gupshup Webhook Handler -------------------------------
app.get('/gupshup/webhook', (req, res) => {
  res.status(200).send('Webhook is live!');
});

app.post('/gupshup/webhook', async (req, res) => {
  try {
    console.log('📩 Incoming message:', JSON.stringify(req.body, null, 2));
    
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    const contact = change?.value?.contacts?.[0];

    if (!message || message.type !== 'text') return res.sendStatus(200);

    const senderWaId = message.from;
    const userText = message.text.body;
    const senderName = contact?.profile?.name || 'there';

    console.log(`👤 ${senderName} (${senderWaId}) said: "${userText}"`);

    // Generate AI message
    const aiMessage = await generateAiMessage({
      name: senderName,
      project: null,
      entry_type: 'whatsapp_text',
      persona: 'general',
      user_input: userText
    });

    console.log('🤖 AI reply:', aiMessage);

const payload = qs.stringify({
  channel: 'whatsapp',
  source: process.env.WABA_NUMBER,
  destination: senderWaId,
  'src.name': 'SmartHousing Guide', // or your approved display name
  message: JSON.stringify({
    type: 'text',
    text: aiMessage
  })
});

try {
  const response = await axios.post(
    'https://api.gupshup.io/wa/api/v1/msg',
    payload,
    {
      headers: {
        'apikey': process.env.GUPSHUP_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  console.log('✅ WhatsApp reply sent! Gupshup response:', response.data);
} catch (err) {
  console.error('❌ Gupshup send error:', err.response?.data || err.message);
}

    res.sendStatus(200);
  } catch (err) {
    console.error('🔥 Webhook error:', err.message);
    res.sendStatus(500);
  }
});

// ---🌐 Meta Webhook Handler ----------------------------------
app.post('/meta-webhook', async (req, res) => {
  try {
    const body = req.body;
    const changes = body?.entry?.[0]?.changes?.[0];
    const pageId = changes?.value?.page_id;
    const formId = changes?.value?.form_id;
    const leadgenId = changes?.value?.leadgen_id;

    if (!pageId || !formId || !leadgenId) {
      console.error('❌ Missing Meta fields:', { pageId, formId, leadgenId });
      return res.status(400).json({ error: 'Missing page_id, form_id, or leadgen_id' });
    }

    console.log('🧾 Incoming values from Meta:', { pageId, formId, leadgenId });

    const { data: pages, error } = await supabase
      .from('pages')
      .select('*')
      .eq('fb_page_id', pageId)
      .eq('form_id', formId)
      .limit(1)
      .maybeSingle();

    console.log('🔍 Lookup result:', { pages, error });
    if (error) throw error;
    if (!pages) {
      console.warn('⚠️ Unknown page_id/form_id:', { pageId, formId });
      return res.status(200).json({ message: 'Unmapped lead received' }); // Prevent Meta retries
    }

    console.log('✅ Mapped lead to:', pages);

    // Save placeholder lead
await supabase.from('leads').insert([{
  full_name: null,
  phone: null,
  email: null,
  project: pages.page_name || 'Unknown Project',
  source: `Meta - ${formId}`,
  status: 'new',
  page_id: pages.id,
  form_data: {
    budget: '1.5M',
    move_in: '2025 Q1',
    bedroom_pref: '2BR'
  }
}]);


    // AI-generated WhatsApp message
    const aiMessage = await generateAiMessage({
      name: 'there',
      project: pages.page_name,
      form_id: formId,
      entry_type: 'first_touch',
      persona: 'general'
    });

    console.log('💬 AI-generated message:', aiMessage);
    sendWhatsAppMessageMock(null, aiMessage);

    res.status(200).json({ message: 'Lead stored (placeholder)' });
  } catch (err) {
    console.error('🔥 Webhook error:', err.message);
    res.status(500).json({ error: 'Internal webhook error' });
  }
});

// ---🧪 Simulate Meta Lead -------------------------------------
app.post('/simulate-lead', async (req, res) => {
  const { page_id, form_id } = req.body;

  if (!page_id || !form_id) {
    return res.status(400).json({ error: 'Missing page_id or form_id' });
  }

  try {
    const { data: page, error } = await supabase
      .from('pages')
      .select('*')
      .eq('fb_page_id', page_id)
      .eq('form_id', form_id)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!page) return res.status(404).json({ error: 'Page/form mapping not found' });

await supabase.from('leads').insert([{
  full_name: null,
  phone: null,
  email: null,
  project: page.page_name || 'Unknown Project',
  source: `Meta - ${form_id}`,  // use `form_id` from the route input
  status: 'new',
  page_id: page.id  // ✅ correct variable
}]);

    const aiMessage = await generateAiMessage({
      name: 'there',
      project: page.page_name,
      form_id,
      entry_type: 'first_touch',
      persona: 'general'
    });

    console.log('💬 AI-generated message:', aiMessage);
    sendWhatsAppMessageMock(null, aiMessage);

    res.status(200).json({ message: aiMessage });
  } catch (err) {
    console.error('🔥 Simulate error:', err.message);
    res.status(500).json({ error: 'Simulate failed' });
  }
});

// ---📲 WhatsApp Mock Sender -----------------------------------
function sendWhatsAppMessageMock(phone, message) {
  console.log(`📲 [MOCK SEND] Sending WhatsApp message to ${phone || '[no number yet]'}:\n${message}\n`);
}
