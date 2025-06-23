// api/test.js

const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');
const { sendTemplateMessage } = require('../sendTemplateMessage'); // Import the template sender

// =================================================================
//  ROUTE 1: Simulate an INBOUND message from an existing lead
// =================================================================
router.post('/simulate-inbound', async (req, res) => {
  try {
    const { from, text } = req.body;
    if (!from || !text) {
      return res.status(400).json({ error: 'Request must include "from" (phone number) and "text" (message).' });
    }
    const senderWaId = from;
    const userText = text;
    const senderName = 'Test Lead';
    console.log(`[SIMULATION] simulates: 👤 ${senderName} (${senderWaId}) said: "${userText}"`);
    let { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('phone_number', senderWaId).limit(1).maybeSingle();
    if (leadError) throw new Error(`Supabase lookup error: ${leadError.message}`);
    if (!lead) {
      console.log('[SIMULATION] 🆕 Lead not found, creating new one...');
      const { data: newLead, error: insertError } = await supabase.from('leads').insert([{ full_name: senderName, phone_number: senderWaId, source: 'WA Simulation', status: 'new' }]).select().single();
      if (insertError) throw new Error(`Failed to insert new lead: ${insertError.message}`);
      lead = newLead;
    }
    await supabase.from('messages').insert({ lead_id: lead.id, sender: 'lead', message: userText });
    const { data: history } = await supabase.from('messages').select('sender, message').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
    const previousMessages = history ? history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : [];
    const aiReply = await generateAiMessage({ lead, previousMessages, leadStage: lead.status || 'new', leadType: 'general' });
    console.log('[SIMULATION] 🤖 AI reply:', aiReply.messages);
    const fullReply = aiReply.messages.filter(msg => msg).join('\n\n');
    if (fullReply) {
      await sendWhatsAppMessage({ to: senderWaId, message: fullReply });
      const messagesToSave = aiReply.messages.filter(msg => msg).map(msg => ({ lead_id: lead.id, sender: 'assistant', message: msg }));
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
    
    // UPDATED: Now expects a template_id
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
    // Use the provided template ID, or default to your lead_intro_1 template ID.
    const templateId = template_id || 'c60dee92-5426-4890-96e4-65469620ac7e';
    // Use the provided params, or create default ones that match your template.
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
