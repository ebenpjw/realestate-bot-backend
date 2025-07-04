const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const logger = require('../logger');
const botService = require('../services/botService');
const whatsappService = require('../services/whatsappService');
const databaseService = require('../services/databaseService');

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

    const lead = await databaseService.findOrCreateLead({
      phoneNumber: senderWaId,
      fullName: senderName,
      source: 'WA Simulation'
    });

    await supabase.from('messages').insert({ lead_id: lead.id, sender: 'lead', message: userText });
    
    // Get conversation history for context (not used in this test endpoint)
    // const { data: history } = await supabase.from('messages').select('sender, message').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
    // const previousMessages = history ? history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : [];
    
    // Use the unified bot service for simulation (but don't actually send WhatsApp messages)
    logger.info({ leadId: lead.id, userText }, '[SIMULATION] Processing with bot service');

    // For simulation, we'll call the bot service but intercept the WhatsApp sending
    await botService.processMessage({
      senderWaId,
      userText,
      senderName
    });

    // Get the latest response from the database to show what was generated
    const { data: latestMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(2);

    const aiResponse = {
      messages: latestMessages?.filter(m => m.sender === 'assistant').map(m => m.message) || [],
      action: 'simulated'
    };
    logger.info({ leadId: lead.id, aiResponse }, '[SIMULATION] Bot service processing completed.');

    // Show what messages were generated (they're already saved by botService)
    if (aiResponse.messages.length > 0) {
      const fullReply = aiResponse.messages.join('\n\n');
      logger.info({ leadId: lead.id, message: fullReply }, `[SIMULATION] Bot generated: "${fullReply}"`);
    }

    res.status(200).json({
      message: "Simulation successful. Bot service processed the message.",
      ai_response: aiResponse.messages,
      lead_id: lead.id
    });
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
        full_name,
        phone_number,
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
    await whatsappService.sendTemplateMessage({
      to: phone_number,
      templateId,
      params
    });

    res.status(200).json({
      message: `Successfully created lead and sent template message using ID '${templateId}' to ${full_name}.`,
      lead
    });
  } catch (err) {
    next(err); // Pass error to the centralized handler
  }
});

// Database diagnostic endpoint
router.get('/db-diagnostic', async (req, res) => {
  try {
    logger.info('Running database diagnostic...');

    const diagnostics = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test 1: Basic connection
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('count')
        .limit(1);

      diagnostics.tests.push({
        name: 'Basic Connection',
        status: error ? 'FAILED' : 'PASSED',
        error: error?.message,
        result: data
      });
    } catch (err) {
      diagnostics.tests.push({
        name: 'Basic Connection',
        status: 'FAILED',
        error: err.message
      });
    }

    // Test 2: Agent lookup
    try {
      const { data: agents, error } = await supabase
        .from('agents')
        .select('id, full_name, status')
        .eq('status', 'active')
        .limit(1);

      diagnostics.tests.push({
        name: 'Agent Lookup',
        status: error ? 'FAILED' : 'PASSED',
        error: error?.message,
        result: agents
      });
    } catch (err) {
      diagnostics.tests.push({
        name: 'Agent Lookup',
        status: 'FAILED',
        error: err.message
      });
    }

    // Test 3: Lead creation test
    try {
      const testPhoneNumber = `+65${Date.now().toString().slice(-8)}`;
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          phone_number: testPhoneNumber,
          full_name: 'Test Diagnostic Lead',
          source: 'Diagnostic Test',
          status: 'new'
        })
        .select()
        .single();

      if (!error && newLead) {
        // Clean up test lead
        await supabase.from('leads').delete().eq('id', newLead.id);
      }

      diagnostics.tests.push({
        name: 'Lead Creation Test',
        status: error ? 'FAILED' : 'PASSED',
        error: error?.message,
        result: newLead ? { id: newLead.id, created: true, cleaned: true } : null
      });
    } catch (err) {
      diagnostics.tests.push({
        name: 'Lead Creation Test',
        status: 'FAILED',
        error: err.message
      });
    }

    const allPassed = diagnostics.tests.every(test => test.status === 'PASSED');

    res.status(allPassed ? 200 : 500).json({
      status: allPassed ? 'HEALTHY' : 'UNHEALTHY',
      ...diagnostics
    });

  } catch (error) {
    logger.error({ err: error }, 'Database diagnostic failed');
    res.status(500).json({
      status: 'FAILED',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint for checking appointment booking results
router.get('/appointments', async (req, res) => {
  try {
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        *,
        leads (
          phone_number,
          full_name,
          status,
          booking_alternatives,
          tentative_booking_time
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (appointmentsError) throw appointmentsError;

    const { data: testLeads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .in('phone_number', ['+6591234567', '+6591234568', '+6591234569', '+6591234570', '+6591234571'])
      .order('created_at', { ascending: false });

    if (leadsError) throw leadsError;

    res.json({
      success: true,
      appointments,
      testLeads,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in appointments test endpoint');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
