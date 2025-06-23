// api/test.js

const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');
const { sendTemplateMessage } = require('../sendTemplateMessage');
const { findOrCreateLead } = require('./leadManager'); // <-- CORRECT PATH

// =================================================================
//  ROUTE 1: Simulate an INBOUND message from an existing lead
// =================================================================
router.post('/simulate-inbound', async (req, res) => {
  try {
    const { from, text, name } = req.body;
    if (!from || !text) {
      return res.status(400).json({ error: 'Request must include "from" (phone number) and "text" (message).' });
    }
    const senderWaId = from;
    const userText = text;
    const senderName = name || 'Test Lead'; // Allow providing a name in the request body
    console.log(`[SIMULATION] simulates: 👤 ${senderName} (${senderWaId}) said: "${userText}"`);

    // Use the refactored findOrCreateLead function
    const lead = await findOrCreateLead({
      phoneNumber: senderWaId,
      fullName: senderName,
      source: 'WA Simulation'
    });

    // Log incoming message
    await supabase.from('messages').insert({ lead_id: lead.id, sender: 'lead', message: userText });
    
    // Get message history
    const { data: history } = await supabase.from('messages').select('sender, message').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
    const previousMessages = history ? history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : [];
    
    // Generate AI reply
    const aiResponse = await generateAiMessage({ lead, previousMessages });
    console.log('[SIMULATION] 🤖 AI response object:', aiResponse);

    // --- NEW: LOGIC TO UPDATE LEAD MEMORY ---
    if (aiResponse.lead_updates && Object.keys(aiResponse.lead_updates).length > 0) {
      console.log(`[SIM-Memory] Updating lead ${lead.id} with new data:`, aiResponse.lead_updates);
      const { error: updateError } = await supabase
        .from('leads')
        .update(aiResponse.lead_updates)
        .eq('id', lead.id);

      if (updateError) {
        console.error(`🔥 [SIM-Memory] Failed to update lead ${lead.id}:`, updateError.message);
      } else {
        console.log(`✅ [SIM-Memory] Lead ${lead.id} updated successfully.`);
      }
    }
    // --- END NEW LOGIC ---

    const fullReply = aiResponse.messages.filter(msg => msg).join('\n\n');
    if (fullReply) {
      await sendWhatsAppMessage({ to: senderWaId, message: fullReply });
      const messagesToSave = aiResponse.messages.filter(msg => msg).map(msg => ({ lead_id: lead.id, sender: 'assistant', message: msg }));
      await supabase.from('messages').insert(messagesToSave);
    }
    res.status(200).json({ message: "Simulation successful. AI response sent via WhatsApp.", ai_response: aiReply.messages });
  } catch (err) {
    console.error('🔥 [SIMULATION] Top-level error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});


// =================================================================
//  ROUTE 2: Simulate a brand NEW lead (e.g., from a Facebook Ad)
// =================================================================
router.post('/simulate-new-lead', async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: 'Request body is missing.' });
    }
    
    const { full_name, phone_number, template_id, template_params } = req.body;

    if (!full_name || !phone_number) {
      return res.status(400).json({ error: 'Request must include "full_name" and "phone_number".' });
    }

    console.log(`[SIMULATION] Creating new lead: ${full_name} (${phone_number})`);

    // 1. Insert the new lead into Supabase
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert({
        full_name: full_name,
        phone_number: phone_number,
        source: 'New Lead Simulation',
        status: 'new'
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { 
        console.warn(`⚠️ Lead with phone number ${phone_number} already exists.`);
        return res.status(409).json({ message: 'Lead with this phone number already exists.' });
      }
      throw new Error(`Failed to insert new lead: ${insertError.message}`);
    }
    
    console.log(`✅ Lead ${lead.id} created successfully.`);

    // 2. Send an initial TEMPLATE message
    const templateId = template_id || 'c60dee92-5426-4890-96e4-65469620ac7e';
    const params = template_params || [lead.full_name, "your property enquiry"]; 

    console.log(`⏳ Sending template ID '${templateId}' to ${phone_number}`);
    await sendTemplateMessage({
      to: phone_number,
      templateId: templateId,
      params: params
    });

    res.status(200).json({
      message: `Successfully created lead and sent template message using ID '${templateId}' to ${full_name}.`,
      lead: lead
    });

  } catch (err) {
    console.error('🔥 [NEW LEAD SIMULATION] Error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;