// api/gupshup.js

const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');

// This is an async function to handle the actual processing
// We move the logic here so we can call it after responding to Gupshup.
async function processMessage(messageValue) {
  try {
    const messageDetails = messageValue.messages[0];
    const senderWaId = messageDetails.from;
    const userText = messageDetails.text.body;
    const senderName = messageValue.contacts?.[0]?.profile?.name || 'there';

    console.log(`👤 ${senderName} (${senderWaId}) said: "${userText}"`);

    // 1. Find or Create the Lead
    let { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone_number', senderWaId) // Corrected column name
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
    // We catch errors here so they don't crash the main server thread.
    console.error('🔥 Error during message processing:', err.message, err.stack);
  }
}

// --- Main Webhook Handler ---
router.post('/webhook', (req, res) => {
  console.log('📩 Incoming Gupshup message:', JSON.stringify(req.body, null, 2));
  
  const messageValue = req.body?.entry?.[0]?.changes?.[0]?.value;

  // Check if it's a valid user message
  if (messageValue?.messages?.[0]?.type === 'text') {
    // --- THE FIX ---
    // 1. Immediately send 200 OK to Gupshup to prevent retries.
    res.sendStatus(200);

    // 2. Process the message in the background.
    // We call our async function but don't wait for it to finish.
    processMessage(messageValue);

  } else {
    // If it's not a text message or a status update, just acknowledge it.
    console.log('ℹ️ Received a status update or non-text message. Acknowledging.');
    res.sendStatus(200);
  }
});

module.exports = router;
