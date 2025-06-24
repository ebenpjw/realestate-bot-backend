const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const logger = require('../logger');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');
const { sendTemplateMessage } = require('../sendTemplateMessage');
const { findOrCreateLead } = require('./leadManager');

router.post('/simulate-inbound', async (req, res, next) => {
  try {
    const { from, text, name } = req.body;
    if (!from || !text) {
      return res.status(400).json({ error: 'Request must include "from" (phone number) and "text" (message).' });
    }
    const senderWaId = from;
    const userText = text;
    const senderName = name || 'Test Lead';
    logger.info({ senderWaId, senderName, userText }, '[SIMULATION] Simulating inbound message.');

    const lead = await findOrCreateLead({
      phoneNumber: senderWaId,
      fullName: senderName,
      source: 'WA Simulation'
    });

    await supabase.from('messages').insert({ lead_id: lead.id, sender: 'lead', message: userText });
    
    const { data: history } = await supabase.from('messages').select('sender, message').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
    const previousMessages = history ? history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : [];
    
    const aiResponse = await generateAiMessage({ lead, previousMessages });
    logger.info({ leadId: lead.id, aiResponse }, '[SIMULATION] AI response object.');

    if (aiResponse.lead_updates && Object.keys(aiResponse.lead_updates).length > 0) {
      logger.info({ leadId: lead.id, updates: aiResponse.lead_updates }, `[SIM-Memory] Updating lead.`);
      const { error: updateError } = await supabase.from('leads').update(aiResponse.lead_updates).eq('id', lead.id);
      if (updateError) {
        logger.error({ err: updateError, leadId: lead.id }, `[SIM-Memory] Failed to update lead.`);
      } else {
        logger.info({ leadId: lead.id }, `[SIM-Memory] Lead updated successfully.`);
      }
    }

    const fullReply = aiResponse.messages.filter(msg => msg).join('\n\n');
    if (fullReply) {
      await sendWhatsAppMessage({ to: senderWaId, message: fullReply });
      const messagesToSave = aiResponse.messages.filter(msg => msg).map(msg => ({ lead_id: lead.id, sender: 'assistant', message: msg }));
      await supabase.from('messages').insert(messagesToSave);
    }
    // *** BUG FIX: Corrected aiReply to aiResponse ***
    res.status(200).json({ message: "Simulation successful. AI response sent via WhatsApp.", ai_response: aiResponse.messages });
  } catch (err) {
    next(err); // Pass error to the centralized handler
  }
});

router.post('/simulate-new-lead', async (req, res, next) => {
  try {
    if (!req.body) return res.status(400).json({ error: 'Request body is missing.' });
    const { full_name, phone_number, template_id, template_params } = req.body;

    if (!full_name || !phone_number) {
      return res.status(400).json({ error: 'Request must include "full_name" and "phone_number".' });
    }
    logger.info({ full_name, phone_number }, '[SIMULATION] Creating new lead.');

    const { data: lead, error: insertError } = await supabase.from('leads').insert({
        full_name: full_name,
        phone_number: phone_number,
        source: 'New Lead Simulation',
        status: 'new'
      }).select().single();

    if (insertError) {
      if (insertError.code === '23505') { 
        logger.warn({ phone_number }, 'Lead with this phone number already exists.');
        return res.status(409).json({ message: 'Lead with this phone number already exists.' });
      }
      throw insertError;
    }
    logger.info({ leadId: lead.id }, `Lead created successfully.`);

    const templateId = template_id || 'c60dee92-5426-4890-96e4-65469620ac7e';
    const params = template_params || [lead.full_name, "your property enquiry"]; 

    logger.info({ templateId, phone_number }, `Sending template message.`);
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
    next(err); // Pass error to the centralized handler
  }
});

module.exports = router;
