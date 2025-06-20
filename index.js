// ---🧠 Imports & Config --------------------------------------
require('dotenv').config();
const express = require('express');
const supabase = require('./supabaseClient');
const { generateAiMessage } = require('./generateAiMessage');
const axios = require('axios');
const qs = require('qs');
const { sendWhatsAppMessage } = require('./sendWhatsAppMessage');



// ---🚀 App Init ----------------------------------------------
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
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

    // Save incoming message into 'messages' table
const { data: leadRecord } = await supabase
  .from('leads')
  .select('id')
  .eq('phone', senderWaId)
  .limit(1)
  .maybeSingle();

if (leadRecord) {
  await supabase.from('messages').insert({
    lead_id: leadRecord.id,
    sender: 'lead',
    message: userText
  });
}

    console.log(`👤 ${senderName} (${senderWaId}) said: "${userText}"`);


    // 🧠 Check if sender already exists in Supabase
    const { data: existing, error: lookupError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', senderWaId)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error('❌ Supabase lookup error:', lookupError.message);
    }

    
if (existing) {
  const { error: updateError } = await supabase
    .from('leads')
    .update({ status: 'replied' })
    .eq('id', existing.id);

  if (updateError) {
    console.error('❌ Failed to update lead status:', updateError.message);
  } else {
    console.log(`🔄 Lead ${senderWaId} marked as 'replied'`);
  }
}

if (!existing) {
      const { error: insertError } = await supabase.from('leads').insert([{
        full_name: senderName || 'Unknown',
        phone: senderWaId,
        project: 'WhatsApp Inquiry',
        source: 'WA Direct',
        status: 'new'
      }]);

      if (insertError) {
        console.error('❌ Failed to insert lead:', insertError.message);
      } else {
        console.log('🆕 New lead inserted for:', senderWaId);
      }
    }


    // Generate AI message
// Fetch previous messages for memory
let previousMessages = [];

if (leadRecord) {
  const { data: history, error: historyError } = await supabase
    .from('messages')
    .select('sender, message')
    .eq('lead_id', leadRecord.id)
    .order('created_at', { ascending: true })
    .limit(10); // You can adjust this to 5–15 if you like

  if (history && !historyError) {
    previousMessages = history.map(entry =>
      `${entry.sender === 'lead' ? 'Lead' : 'Doro'}: ${entry.message}`
    );
  }
}

// Now pass memory into AI
const aiReply = await generateAiMessage({
  lead: {
    full_name: senderName,
    phone_number: senderWaId,
    message: userText
  },
  previousMessages,
  leadStage: 'new',
  leadType: 'general'
});

console.log('🤖 AI reply:', aiReply.messages);


const payload1 = qs.stringify({
  channel: 'whatsapp',
  source: process.env.WABA_NUMBER,
  destination: senderWaId,
  'src.name': 'SmartGuide Doro',
  message: JSON.stringify({
    type: 'text',
    text: aiReply.messages[0]
  })
});

await axios.post(
  'https://api.gupshup.io/sm/api/v1/msg',
  payload1,
  {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': process.env.GUPSHUP_API_KEY
    }
  }
);

// Optional delay to simulate typing
await delay(4000);

// 2nd message
const payload2 = qs.stringify({
  channel: 'whatsapp',
  source: process.env.WABA_NUMBER,
  destination: senderWaId,
  'src.name': 'SmartGuide Doro',
  message: JSON.stringify({
    type: 'text',
    text: aiReply.messages[1]
  })
});

await axios.post(
  'https://api.gupshup.io/sm/api/v1/msg',
  payload2,
  {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': process.env.GUPSHUP_API_KEY
    }
  }
);

// Log both replies into Supabase
if (leadRecord) {
  await supabase.from('messages').insert([
    { lead_id: leadRecord.id, sender: 'assistant', message: aiReply.messages[0] },
    { lead_id: leadRecord.id, sender: 'assistant', message: aiReply.messages[1] }
  ]);
}
  })

});


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
const { data: insertedLead, error: insertError } = await supabase
  .from('leads')
  .insert([{
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
  }])
  .select()
  .maybeSingle();


    // AI-generated WhatsApp message
    const aiMessage = await generateAiMessage({
      name: 'there',
      project: pages.page_name,
      form_id: formId,
      entry_type: 'first_touch',
      persona: 'general'
    });

    console.log('💬 AI-generated message:', aiMessage);
if (!pages.phone_number) {
  console.warn('⚠️ No phone number found for page:', pageId);
  return res.status(200).json({ message: 'Missing phone number. No message sent.' });
}

const template = pages.template_name || 'lead_intro_1';
if (!pages.template_name) {
  console.warn('⚠️ Using fallback template for page:', pageId);
}

await sendTemplateMessage({
  to: pages.phone_number,
  templateName: template,
params: [insertedLead?.full_name || 'there', pages.page_name]
});

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
    const { data: pages, error } = await supabase
      .from('pages')
      .select('*')
      .eq('fb_page_id', page_id)
      .eq('form_id', form_id)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!pages) return res.status(404).json({ error: 'Page/form mapping not found' });

const { data: insertedLead } = await supabase
  .from('leads')
  .insert([{
    full_name: null,
    phone: null,
    email: null,
    project: pages.page_name || 'Unknown Project',
    source: `Meta - ${form_id}`,
    status: 'new',
    page_id: pages.id
  }])
  .select()
  .maybeSingle();

    const aiMessage = await generateAiMessage({
      name: 'there',
      project: pages.page_name,
      form_id,
      entry_type: 'first_touch',
      persona: 'general'
    });

    console.log('💬 AI-generated message:', aiMessage);
if (!pages.phone_number) {
  console.warn('⚠️ No phone number found for page:', pageId);
  return res.status(200).json({ message: 'Missing phone number. No message sent.' });
}

const template = pages.template_name || 'lead_intro_1';
if (!pages.template_name) {
  console.warn('⚠️ Using fallback template for page:', pageId);
}

await sendTemplateMessage({
  to: pages.phone_number,
  templateName: template,
params: [insertedLead?.full_name || 'there', pages.page_name]
});

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
