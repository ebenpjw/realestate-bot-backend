// api/gupshup.js

const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');

router.post('/webhook', async (req, res) => {
  try {
    console.log('📩 Incoming Gupshup message:', JSON.stringify(req.body, null, 2));

    // --- Start of The Fix ---
    // The actual message data is nested deep inside the object.
    const messageValue = req.body?.entry?.[0]?.changes?.[0]?.value;

    // Check if it's a user message and not a status update.
    if (!messageValue?.messages?.[0]) {
      console.log('ℹ️ Received a status update or non-message event. Acknowledging.');
      return res.sendStatus(200);
    }
    
    const messageDetails = messageValue.messages[0];

    // Ignore anything that isn't a text message.
    if (messageDetails.type !== 'text') {
      console.log('ℹ️ Received a non-text message. Acknowledging.');
      return res.sendStatus(200);
    }

    // Correctly extract the sender's number and the message text.
    const senderWaId = messageDetails.from;
    const userText = messageDetails.text.body;

    // Get the sender's name from the contact profile.
    const senderName = messageValue.contacts?.[0]?.profile?.name || 'there';
    // --- End of The Fix ---

    console.log(`👤 ${senderName} (${senderWaId}) said: "${userText}"`);

    // --- The rest of the logic remains exactly the same ---
    
    // 1. Find or Create the Lead
    let { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', senderWaId)
      .limit(1)
      .maybeSingle();

    if (leadError) {
      console.error('❌ Supabase lookup error:', leadError.message);
      return res.status(500).json({ error: 'Database lookup failed' });
    }

    if (!lead) {
      console.log('🆕 Lead not found, creating new one...');
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert([{ full_name: senderName, phone: senderWaId, source: 'WA Direct', status: 'new' }])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Failed to insert new lead:', insertError.message);
        return res.status(500).json({ error: 'Failed to create lead' });
      }
      lead = newLead;
      console.log('✅ New lead inserted for:', senderWaId);
    }

    // 2. Log Incoming Message
    await supabase.from('messages').insert({ lead_id: lead.id, sender: 'lead', message: userText });

    // 3. Get Message History for Context
    const { data: history } = await supabase
      .from('messages')
      .select('sender, message')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const previousMessages = history ? history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : [];

    // 4. Generate AI Reply
    const aiReply = await generateAiMessage({
      lead: { full_name: lead.full_name, phone: lead.phone, message: userText },
      previousMessages,
      leadStage: lead.status || 'new',
      leadType: 'general'
    });
    console.log('🤖 AI reply:', aiReply.messages);

    // 5. Send WhatsApp Reply
    const fullReply = aiReply.messages.filter(msg => msg).join('\n\n');
    if (fullReply) {
      await sendWhatsAppMessage({ to: senderWaId, message: fullReply });
      // 6. Log Assistant's Reply
      const messagesToSave = aiReply.messages.filter(msg => msg).map(msg => ({ lead_id: lead.id, sender: 'assistant', message: msg }));
      await supabase.from('messages').insert(messagesToSave);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('🔥 Top-level webhook error:', err.message, err.stack);
    res.sendStatus(500);
  }
});

module.exports = router;
