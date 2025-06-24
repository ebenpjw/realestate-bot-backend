// api/gupshup.js

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');
const { findOrCreateLead } = require('./leadManager');
const { findNextAvailableSlots } = require('./bookingHelper');
const { createEvent } = require('./googleCalendarService');

// --- Main message processing logic ---
async function processMessage(messageValue) {
  try {
    const messageDetails = messageValue.messages[0];
    const senderWaId = messageDetails.from;
    const userText = messageDetails.text.body;
    const senderName = messageValue.contacts?.[0]?.profile?.name || 'There';

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
        
        const availableSlots = await findNextAvailableSlots(lead.agent_id);
        if (availableSlots.length > 0) {
            const bookingTime = new Date(availableSlots[0]);
            const bookingEndTime = new Date(bookingTime.getTime() + 20 * 60 * 1000);

            const newEvent = await createEvent(lead.agent_id, {
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

// --- Webhook Router & Signature Verification ---
router.post('/webhook', (req, res, next) => {
  // ADD THIS LINE TO DEBUG THE HEADERS
  logger.info({ headers: req.headers }, 'Incoming webhook headers');

  if (!verifyGupshupSignature(req)) {
      return res.status(403).send('Invalid signature');
  }
  res.sendStatus(200);

  const messageValue = req.body?.entry?.[0]?.changes?.[0]?.value;
  if (messageValue?.messages?.[0]?.type === 'text') {
    processMessage(messageValue).catch(err => {
        logger.error({ err }, 'Unhandled exception in async processMessage from Gupshup webhook.');
    });
  } else {
    logger.info({ payload: req.body }, 'Received a status update or non-text message. Acknowledging.');
  }
});

function verifyGupshupSignature(req) {
  const secret = config.GUPSHUP_API_SECRET;
  if (!secret) {
    logger.warn('GUPSHUP_API_SECRET is not set. Verification skipped.');
    return config.NODE_ENV !== 'production';
  }
  const signature = req.headers['x-gupshup-signature'];
  if (!signature) {
    logger.error('Missing Gupshup signature header.');
    return false;
  }
  if (!req.rawBody) {
    logger.error('Raw request body not available.');
    return false;
  }
  const hash = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  const isVerified = (hash === signature);
  if (!isVerified) {
      logger.error('Invalid Gupshup signature.');
  }
  return isVerified;
}

module.exports = router;