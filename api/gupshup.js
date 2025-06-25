// api/gupshup.js

const express = require('express');
const router = express.Router();
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');
const generateAiMessage = require('../generateAiMessage');
const { sendWhatsAppMessage } = require('../sendWhatsAppMessage');
const { findOrCreateLead } = require('./leadManager');
const appointmentService = require('../services/appointmentService');

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
    
    // Handle appointment-related actions
    if (['initiate_booking', 'reschedule_appointment', 'cancel_appointment', 'select_alternative'].includes(aiResponse.action)) {
        await handleAppointmentAction({
            action: aiResponse.action,
            lead,
            senderWaId,
            userMessage: aiResponse.user_message || userText
        });
    }
  } catch (err) {
    logger.error({ err }, 'Error during message processing');
  }
}

async function handleAppointmentAction({ action, lead, senderWaId, userMessage }) {
  try {
    const agentId = lead.agent_id;
    if (!agentId) {
      logger.error({ leadId: lead.id }, 'Cannot handle appointment action, lead is not assigned to an agent.');
      const noAgentMessage = "Apologies, I can't manage appointments right now as I can't find an available consultant. Please try again shortly.";
      await sendWhatsAppMessage({ to: senderWaId, message: noAgentMessage });
      return;
    }

    switch (action) {
      case 'initiate_booking':
        await handleInitialBooking({ lead, agentId, senderWaId, userMessage });
        break;

      case 'reschedule_appointment':
        await handleRescheduleAppointment({ lead, agentId, senderWaId, userMessage });
        break;

      case 'cancel_appointment':
        await handleCancelAppointment({ lead, senderWaId });
        break;

      case 'select_alternative':
        await handleAlternativeSelection({ lead, agentId, senderWaId, userMessage });
        break;

      default:
        logger.warn({ action, leadId: lead.id }, 'Unknown appointment action');
    }
  } catch (err) {
    logger.error({ err, action, leadId: lead.id }, 'Error handling appointment action');
    const errorMessage = "Sorry, I had an issue processing your appointment request. Please try again or let me know if you need help.";
    await sendWhatsAppMessage({ to: senderWaId, message: errorMessage });
  }
}

async function handleInitialBooking({ lead, agentId, senderWaId, userMessage }) {
  try {
    logger.info({ leadId: lead.id }, 'Initiating appointment booking with intelligent slot matching');

    const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

    const result = await appointmentService.findAndBookAppointment({
      leadId: lead.id,
      agentId,
      userMessage,
      leadName: lead.full_name,
      leadPhone: lead.phone_number,
      consultationNotes
    });

    await sendWhatsAppMessage({ to: senderWaId, message: result.message });
    await supabase.from('messages').insert({
      lead_id: lead.id,
      sender: 'assistant',
      message: result.message
    });

    if (result.success) {
      logger.info({
        leadId: lead.id,
        appointmentId: result.appointment.id,
        type: result.type
      }, 'Appointment booked successfully');
    } else if (result.type === 'alternatives_offered') {
      // Store alternatives in lead memory for later selection
      await supabase.from('leads').update({
        status: 'booking_alternatives_offered',
        booking_alternatives: JSON.stringify(result.alternatives)
      }).eq('id', lead.id);
    } else {
      await supabase.from('leads').update({ status: 'needs_human_handoff' }).eq('id', lead.id);
    }
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Error in initial booking');
    throw err;
  }
}

async function handleRescheduleAppointment({ lead, agentId, senderWaId, userMessage }) {
  try {
    logger.info({ leadId: lead.id }, 'Handling appointment reschedule request');

    // Find existing appointment
    const { data: existingAppointment } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('status', 'scheduled')
      .single();

    if (!existingAppointment) {
      const noAppointmentMessage = "I couldn't find an existing appointment to reschedule. Would you like to book a new consultation instead?";
      await sendWhatsAppMessage({ to: senderWaId, message: noAppointmentMessage });
      return;
    }

    const result = await appointmentService.rescheduleAppointment({
      appointmentId: existingAppointment.id,
      newTimePreference: userMessage,
      leadName: lead.full_name,
      leadPhone: lead.phone_number
    });

    await sendWhatsAppMessage({ to: senderWaId, message: result.message });
    await supabase.from('messages').insert({
      lead_id: lead.id,
      sender: 'assistant',
      message: result.message
    });

    logger.info({
      leadId: lead.id,
      appointmentId: existingAppointment.id,
      success: result.success
    }, 'Reschedule request processed');
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Error in reschedule appointment');
    throw err;
  }
}

async function handleCancelAppointment({ lead, senderWaId }) {
  try {
    logger.info({ leadId: lead.id }, 'Handling appointment cancellation request');

    // Find existing appointment
    const { data: existingAppointment } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('status', 'scheduled')
      .single();

    if (!existingAppointment) {
      const noAppointmentMessage = "I couldn't find an existing appointment to cancel. Is there anything else I can help you with?";
      await sendWhatsAppMessage({ to: senderWaId, message: noAppointmentMessage });
      return;
    }

    const result = await appointmentService.cancelAppointment({
      appointmentId: existingAppointment.id
    });

    await sendWhatsAppMessage({ to: senderWaId, message: result.message });
    await supabase.from('messages').insert({
      lead_id: lead.id,
      sender: 'assistant',
      message: result.message
    });

    // Update lead status
    await supabase.from('leads').update({ status: 'appointment_cancelled' }).eq('id', lead.id);

    logger.info({
      leadId: lead.id,
      appointmentId: existingAppointment.id,
      success: result.success
    }, 'Cancellation request processed');
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Error in cancel appointment');
    throw err;
  }
}

async function handleAlternativeSelection({ lead, agentId, senderWaId, userMessage }) {
  try {
    logger.info({ leadId: lead.id }, 'Handling alternative slot selection');

    // Get stored alternatives from lead
    const storedAlternatives = lead.booking_alternatives ? JSON.parse(lead.booking_alternatives) : [];

    if (storedAlternatives.length === 0) {
      const noAlternativesMessage = "I don't have any alternative slots stored. Let me find some available times for you.";
      await sendWhatsAppMessage({ to: senderWaId, message: noAlternativesMessage });
      // Fall back to initial booking
      await handleInitialBooking({ lead, agentId, senderWaId, userMessage });
      return;
    }

    // Parse user selection (could be "1", "option 1", "the first one", etc.)
    const selectedSlot = parseAlternativeSelection(userMessage, storedAlternatives);

    if (selectedSlot) {
      const consultationNotes = `Intent: ${lead.intent || 'Not specified'}, Budget: ${lead.budget || 'Not specified'}`;

      const result = await appointmentService.createAppointment({
        leadId: lead.id,
        agentId,
        appointmentTime: selectedSlot,
        leadName: lead.full_name,
        leadPhone: lead.phone_number,
        consultationNotes
      });

      const confirmationMessage = `Perfect! I've booked your consultation for ${selectedSlot.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long'})} at ${selectedSlot.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}.\n\nZoom Link: ${result.zoomMeeting.joinUrl}\n\nI'll send you a reminder before the meeting!`;

      await sendWhatsAppMessage({ to: senderWaId, message: confirmationMessage });
      await supabase.from('messages').insert({
        lead_id: lead.id,
        sender: 'assistant',
        message: confirmationMessage
      });

      // Clear alternatives and update status
      await supabase.from('leads').update({
        status: 'booked',
        booking_alternatives: null
      }).eq('id', lead.id);

      logger.info({
        leadId: lead.id,
        appointmentId: result.appointment.id
      }, 'Alternative slot booked successfully');
    } else {
      const clarificationMessage = "I'm not sure which time slot you'd prefer. Could you please specify by saying something like 'option 1' or 'the Monday slot'?";
      await sendWhatsAppMessage({ to: senderWaId, message: clarificationMessage });
    }
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Error in alternative selection');
    throw err;
  }
}

function parseAlternativeSelection(userMessage, alternatives) {
  const lowerMessage = userMessage.toLowerCase();

  // Check for numeric selection (1, 2, 3, etc.)
  const numericMatch = lowerMessage.match(/(?:option\s*)?(\d+)/);
  if (numericMatch) {
    const index = parseInt(numericMatch[1]) - 1;
    if (index >= 0 && index < alternatives.length) {
      return new Date(alternatives[index]);
    }
  }

  // Check for day-based selection
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    if (lowerMessage.includes(day)) {
      const matchingSlot = alternatives.find(slot => {
        const slotDay = new Date(slot).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return slotDay === day;
      });
      if (matchingSlot) {
        return new Date(matchingSlot);
      }
    }
  }

  return null;
}

// Handler for Gupshup's URL verification GET request
router.get('/webhook', (req, res) => {
    logger.info({ query: req.query, headers: req.headers }, 'Received GET request for Gupshup webhook verification.');
    res.status(200).send('Webhook endpoint is active and ready for POST requests.');
});

// Handler for incoming messages
router.post('/webhook', (req, res) => {
  logger.info({
    query: req.query,
    headers: req.headers,
    body: req.body
  }, 'Received POST request to Gupshup webhook');

  res.sendStatus(200);

  // Note: Gupshup 2025 documentation indicates no authentication is required for webhooks
  // Removed token validation as per latest Gupshup guidelines

  // Optional: Add IP-based validation if needed for security
  // const allowedIPs = ['gupshup-ip-ranges']; // Can be configured later if needed

  // UPDATED LOGIC TO PARSE GUPSHUP V2 FORMAT
  const body = req.body;
  if (body && body.type === 'message' && body.payload?.type === 'text') {
    const messageData = {
      senderWaId: body.payload.source,
      userText: body.payload.payload.text,
      senderName: body.payload.sender.name || 'There'
    };

    logger.info({ messageData }, 'Processing valid Gupshup message');
    processMessage(messageData).catch(err => {
        logger.error({ err }, 'Unhandled exception in async processMessage from Gupshup webhook.');
    });
  } else {
    logger.info({ payload: req.body }, 'Received a status update or non-text message. Acknowledging.');
  }
});

module.exports = router;
module.exports.handleAppointmentAction = handleAppointmentAction;