// api/gupshup.js

const express = require('express');
const router = express.Router();
const crypto = require('crypto'); // <-- ADD THIS
const supabase = require('../supabaseClient');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');
const { findOrCreateLead } = require('./leadManager'); // <-- CORRECT PATH

// --- SECURITY FUNCTION ---
// This function verifies that incoming webhooks are genuinely from Gupshup.
function verifyGupshupSignature(req) {
  const secret = process.env.GUPSHUP_API_SECRET;
  if (!secret) {
    console.warn('⚠️ GUPSHUP_API_SECRET is not set. Skipping verification. THIS IS NOT SECURE.');
    return true; 
  }

  const signature = req.headers['x-gupshup-signature']; 
  if (!signature) {
    console.error('❌ Missing Gupshup signature header.');
    return false;
  }

  if (!req.rawBody) {
    console.error('❌ Raw request body not available. Ensure the special JSON parser is used in index.js.');
    return false;
  }

  const hash = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  
  if (hash !== signature) {
    console.error('❌ Invalid Gupshup signature.');
    return false;
  }
  return true;
}

// This is an async function to handle the actual processing
async function processMessage(messageValue) {
  // ... (the rest of your processMessage function remains the same)
  try {
    const messageDetails = messageValue.messages[0];

    const messageTimestamp = parseInt(messageDetails.timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);

    if (currentTimestamp - messageTimestamp > 120) {
      console.log(`- Stale message (ID: ${messageDetails.id}) ignored. Age: ${currentTimestamp - messageTimestamp}s.`);
      return;
    }

    const senderWaId = messageDetails.from;
    const userText = messageDetails.text.body;
    const senderName = messageValue.contacts?.[0]?.profile?.name || 'There';

    console.log(`👤 ${senderName} (${senderWaId}) said: "${userText}" (ID: ${messageDetails.id})`);

    const lead = await findOrCreateLead({
      phoneNumber: senderWaId,
      fullName: senderName,
      source: 'WA Direct'
    });

    await supabase.from('messages').insert({ lead_id: lead.id, sender: 'lead', message: userText });

    const { data: history } = await supabase
      .from('messages')
      .select('sender, message')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(10);
    const previousMessages = history ? history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : [];
    
    const aiReply = await generateAiMessage({
      lead,
      previousMessages,
    });
    console.log('🤖 AI reply:', aiReply.messages);
    
    const fullReply = aiReply.messages.filter(msg => msg).join('\n\n');
    if (fullReply) {
      await sendWhatsAppMessage({ to: senderWaId, message: fullReply });
      const messagesToSave = aiReply.messages.filter(msg => msg).map(msg => ({ lead_id: lead.id, sender: 'assistant', message: msg }));
      await supabase.from('messages').insert(messagesToSave);
    }
  } catch (err) {
    console.error('🔥 Error during message processing:', err.message, err.stack);
  }
}

// --- Main Webhook Handler ---
router.post('/webhook', (req, res) => {

  res.sendStatus(200);

  const messageValue = req.body?.entry?.[0]?.changes?.[0]?.value;

  if (messageValue?.messages?.[0]?.type === 'text') {
    processMessage(messageValue);
  } else {
    console.log('ℹ️ Received a status update or non-text message. Acknowledging.');
  }
});

module.exports = router;