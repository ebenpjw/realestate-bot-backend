// api/gupshup.js

const express = require('express');
const router = express.Router();
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');
const { findOrCreateLead } = require('./leadManager');
const { findNextAvailableSlots } = require('./bookingHelper');
const { createEvent } = require('./googleCalendarService');

async function processMessage({ senderWaId, userText, senderName }) {
  try {
    logger.info({ senderWaId, senderName }, `Received message: "${userText}"`);

    let lead = await findOrCreateLead({
      phoneNumber: senderWaId,
      fullName: senderName,
      source: 'WA Direct'
    });

    await supabase.from('messages').insert({ lead_id: lead.id, sender: 'lead', message: userText });

    const { data: history } = await supabase.from('messages').select('sender, message').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
    const previousMessages = history ? history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : [];
    
    const aiResponse = await generateAiMessage({ lead, previousMessages });
    logger.info({ leadId: lead.id, action: aiResponse.action }, 'AI response received.');

    if (aiResponse.lead_updates && Object.keys(aiResponse.lead_updates).length > 0) {
      const { data: updatedLead, error: updateError } = await supabase
        .from('leads')
        .update(aiResponse.lead_updates)
        .eq('id', lead.id)
        .select()
        .single();
      if (updateError) {
        logger.error({ err: updateError, leadId: lead.id }, 'Failed to update lead memory.');
      } else {
        lead = updatedLead;
      }
    }
    
    const messagesToSend = aiResponse.messages.filter(msg => msg);
    if (messagesToSend.length > 0) {
        const fullReply = messagesToSend.join('\n\n');
        await sendWhatsAppMessage({ to: senderWaId, message: fullReply });

        const messagesToSave = messagesToSend.map(part => ({
            lead_id: lead.id,
            sender: 'assistant',
            message: part
        }));
        await supabase.from('messages').insert(messagesToSave);
    }
    
    if (aiResponse.action === 'initiate_booking') {
        logger.info({ leadId: lead.id }, 'AI requested to initiate booking flow.');
        
        const agentId = lead.agent_id;
        if (!agentId) {
            logger.error({ leadId: lead.id }, 'Cannot initiate booking, lead is not assigned to an agent.');
            const noAgentMessage = "Apologies, I can't book a meeting right now as I can't find an available consultant. Please try again shortly.";
            await sendWhatsAppMessage({ to: senderWaId, message: noAgentMessage });
            return;
        }

        const availableSlots = await findNextAvailableSlots(agentId);
        if (availableSlots.length > 0) {
            const bookingTime = new Date(availableSlots[0]);
            const bookingEndTime = new Date(bookingTime.getTime() + 20 * 60 * 1000);

            const newEvent = await createEvent(agentId, {
                summary: `Zoom Consult: ${lead.full_name}`,
                description: `Property discussion with lead from WhatsApp. Lead ID: ${lead.id}. Phone: ${lead.phone_number}`,
                startTimeISO: bookingTime.toISOString(),
                endTimeISO: bookingEndTime.toISOString(),
            });
            
            let confirmationMessage;
            if (newEvent && newEvent.hangoutLink) {
                logger.info({ leadId: lead.id, link: newEvent.hangoutLink }, 'Google Meet link generated successfully.');
                confirmationMessage = `Great! I've booked you in for a call on ${bookingTime.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${bookingTime.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}.\n\nHere is your Google Meet link:\n${newEvent.hangoutLink}`;
            } else {
                logger.warn({ eventId: newEvent?.id }, 'Calendar event was created, but no hangoutLink was found. Sending fallback message.');
                confirmationMessage = `Great! I've booked you in for a call on ${bookingTime.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${bookingTime.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}. The consultant will send you the meeting link directly from their calendar.`;
            }

            await sendWhatsAppMessage({ to: senderWaId, message: confirmationMessage });
            await supabase.from('messages').insert({ lead_id: lead.id, sender: 'assistant', message: confirmationMessage });
            await supabase.from('leads').update({ status: 'booked' }).eq('id', lead.id);

        } else {
            const noSlotsMessage = "It looks like the consultant's calendar is full for the next few days. I'll have them reach out to you directly to arrange a time!";
            await sendWhatsAppMessage({ to: senderWaId, message: noSlotsMessage });
            await supabase.from('leads').update({ status: 'needs_human_handoff' }).eq('id', lead.id);
        }
    }
  } catch (err) {
    logger.error({ err }, 'Error during message processing');
  }
}

// Handler for Gupshup's URL verification GET request
router.get('/webhook', (req, res) => {
    logger.info('Received GET request for Gupshup webhook verification.');
    res.status(200).send('Webhook endpoint is active and ready for POST requests.');
});

// Handler for incoming messages
router.post('/webhook', (req, res) => {
  res.sendStatus(200);

  if (req.query.token !== config.WEBHOOK_SECRET_TOKEN) {
      logger.warn('Invalid or missing webhook token. Request ignored.');
      return;
  }

  // UPDATED LOGIC TO PARSE GUPSHUP V2 FORMAT
  const body = req.body;
  if (body && body.type === 'message' && body.payload?.type === 'text') {
    const messageData = {
      senderWaId: body.payload.source,
      userText: body.payload.payload.text,
      senderName: body.payload.sender.name || 'There'
    };
    
    processMessage(messageData).catch(err => {
        logger.error({ err }, 'Unhandled exception in async processMessage from Gupshup webhook.');
    });
  } else {
    logger.info({ payload: req.body }, 'Received a status update or non-text message. Acknowledging.');
  }
});

module.exports = router;