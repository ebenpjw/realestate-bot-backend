// api/test.js

const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');

/**
 * This route simulates a message coming from a user via WhatsApp.
 * It triggers the exact same logic as the real gupshup webhook.
 * This is incredibly useful for fast, repeatable testing.
 * To use it, send a POST request to /api/test/simulate-inbound
 * with a JSON body like: { "from": "6591234567", "text": "Hello world" }
 */
router.post('/simulate-inbound', async (req, res) => {
  try {
    const { from, text } = req.body;

    if (!from || !text) {
      return res.status(400).json({ error: 'Request must include "from" (phone number) and "text" (message).' });
    }

    const senderWaId = from;
    const userText = text;
    const senderName = 'Test Lead'; // We can just use a placeholder name for simulations

    console.log(`[SIMULATION]  simulates: 👤 ${senderName} (${senderWaId}) said: "${userText}"`);

    // --- 1. Find or Create the Lead ---
    let { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', senderWaId)
      .limit(1)
      .maybeSingle();

    if (leadError) throw new Error(`Supabase lookup error: ${leadError.message}`);

    if (!lead) {
      console.log('[SIMULATION] 🆕 Lead not found, creating new one...');
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert([{ full_name: senderName, phone: senderWaId, source: 'WA Simulation', status: 'new' }])
        .select()
        .single();
      if (insertError) throw new Error(`Failed to insert new lead: ${insertError.message}`);
      lead = newLead;
    }

    // --- 2. Log Incoming Message ---
    await supabase.from('messages').insert({ lead_id: lead.id, sender: 'lead', message: userText });

    // --- 3. Get Message History for Context ---
    // The history needs to be in the format the AI prompt expects: an array of objects
    const { data: history } = await supabase
      .from('messages')
      .select('sender, message')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(10);
      
    const previousMessages = history ? history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : [];
    
    // --- 4. Generate AI Reply ---
    const aiReply = await generateAiMessage({
      lead: { full_name: lead.full_name, phone: lead.phone, message: userText },
      previousMessages,
      leadStage: lead.status || 'new',
      leadType: 'general'
    });
    console.log('[SIMULATION] 🤖 AI reply:', aiReply.messages);

    // --- 5. Send WhatsApp Reply ---
    const fullReply = aiReply.messages.filter(msg => msg).join('\n\n');
    if (fullReply) {
      await sendWhatsAppMessage({ to: senderWaId, message: fullReply });
      // --- 6. Log Assistant's Reply ---
      const messagesToSave = aiReply.messages.filter(msg => msg).map(msg => ({ lead_id: lead.id, sender: 'assistant', message: msg }));
      await supabase.from('messages').insert(messagesToSave);
    }
    
    // Respond with success and the AI's generated messages
    res.status(200).json({
        message: "Simulation successful. AI response has been triggered and sent via WhatsApp.",
        ai_response: aiReply.messages
    });

  } catch (err) {
    console.error('🔥 [SIMULATION] Top-level error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
