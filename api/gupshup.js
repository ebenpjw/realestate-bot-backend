// api/gupshup.js

const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient'); // Note the ../
const generateAiMessage = require('../generateAiMessage'); // Note the ../
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage'); // Note the ../

// This handles POST requests to /api/gupshup/webhook
router.post('/webhook', async (req, res) => {
  try {
    console.log('📩 Incoming Gupshup message:', JSON.stringify(req.body, null, 2));

    const message = req.body?.payload; // Gupshup's inbound message payload
    if (!message || message.type !== 'text') {
      return res.sendStatus(200); // Not a text message, acknowledge and ignore
    }

    const senderWaId = message.sender.phone;
    const userText = message.payload.text;
    const senderName = message.sender.name || 'there';

    console.log(`👤 ${senderName} (${senderWaId}) said: "${userText}"`);

    // --- 1. Find or Create the Lead (Consolidated Logic) ---
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

    // If lead doesn't exist, create a new one
    if (!lead) {
      console.log('🆕 Lead not found, creating new one...');
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert([{
          full_name: senderName,
          phone: senderWaId,
          source: 'WA Direct',
          status: 'new'
        }])
        .select()
        .single(); // Use .single() to get the created object back

      if (insertError) {
        console.error('❌ Failed to insert new lead:', insertError.message);
        return res.status(500).json({ error: 'Failed to create lead' });
      }
      lead = newLead;
      console.log('✅ New lead inserted for:', senderWaId);
    }

    // --- 2. Log Incoming Message ---
    await supabase.from('messages').insert({
      lead_id: lead.id,
      sender: 'lead',
      message: userText
    });

    // --- 3. Get Message History for Context ---
    const { data: history } = await supabase
      .from('messages')
      .select('sender, message')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false }) // Get the most recent messages
      .limit(10);

    const previousMessages = history ? history.map(entry => `${entry.sender === 'lead' ? 'Lead' : 'Doro'}: ${entry.message}`).reverse() : [];

    // --- 4. Generate AI Reply ---
    const aiReply = await generateAiMessage({
      lead: {
        full_name: lead.full_name,
        phone_number: lead.phone,
        message: userText
      },
      previousMessages,
      leadStage: lead.status || 'new', // Use the lead's actual status
      leadType: 'general' // We can enhance this later
    });
    console.log('🤖 AI reply:', aiReply.messages);

    // --- 5. Send WhatsApp Reply (Centralized & Corrected) ---
    const fullReply = aiReply.messages.filter(msg => msg).join('\n\n');
    if (fullReply) {
      await sendWhatsAppMessage({ to: senderWaId, message: fullReply });

      // --- 6. Log Assistant's Reply ---
      const messagesToSave = aiReply.messages.filter(msg => msg).map(msg => ({
        lead_id: lead.id,
        sender: 'assistant',
        message: msg
      }));
      await supabase.from('messages').insert(messagesToSave);
    }

    res.sendStatus(200); // Acknowledge receipt to Gupshup
  } catch (err) {
    console.error('🔥 Top-level webhook error:', err.message, err.stack);
    res.sendStatus(500);
  }
});

module.exports = router;