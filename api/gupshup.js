// api/gupshup.js

const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');

// This is an async function to handle the actual processing
async function processMessage(messageValue) {
  try {
    const messageDetails = messageValue.messages[0];

    // --- NEW: Check if the message is recent ---
    const messageTimestamp = parseInt(messageDetails.timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const messageAgeInSeconds = currentTimestamp - messageTimestamp;

    // If the message is older than 2 minutes (120 seconds), ignore it.
    if (messageAgeInSeconds > 120) {
      console.log(`- Stale message (ID: ${messageDetails.id}) ignored. Age: ${messageAgeInSeconds}s.`);
      return;
    }
    // --- END NEW ---

    const senderWaId = messageDetails.from;
    const userText = messageDetails.text.body;
    const senderName = messageValue.contacts?.[0]?.profile?.name || 'there';

    console.log(`👤 ${senderName} (${senderWaId}) said: "${userText}" (ID: ${messageDetails.id})`);

    // 1. Find or Create the Lead
    let { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone_number', senderWaId)
      .limit(1)
      .maybeSingle();

    if (leadError) throw new Error(`Supabase lookup error: ${leadError.message}`);

    if (!lead) {
      console.log('🆕 Lead not found, creating new one...');
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert([{ full_name: senderName, phone_number: senderWaId, source: 'WA Direct', status: 'new' }])
        .select()
        .single();
      if (insertError) throw new Error(`Failed to insert new lead: ${insertError.message}`);
      lead = newLead;
    }

    // 2. Log Incoming Message
    await supabase.from('messages').insert({ lead_id: lead.id, sender: 'lead', message: userText });

    // 3. Get Message History
    const { data: history } = await supabase
      .from('messages')
      .select('sender, message')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(10);
    const previousMessages = history ? history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : [];
    
    // 4. Generate AI Reply
    const aiReply = await generateAiMessage({
      lead: { full_name: lead.full_name, phone_number: lead.phone_number, message: userText },
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
  } catch (err) {
    console.error('🔥 Error during message processing:', err.message, err.stack);
  }
}

// --- Main Webhook Handler ---
router.post('/webhook', (req, res) => {
  console.log('📩 Incoming Gupshup message');
  
  const messageValue = req.body?.entry?.[0]?.changes?.[0]?.value;

  if (messageValue?.messages?.[0]?.type === 'text') {
    res.sendStatus(200);
    processMessage(messageValue);
  } else {
    console.log('ℹ️ Received a status update or non-text message. Acknowledging.');
    res.sendStatus(200);
  }
});

module.exports = router;
