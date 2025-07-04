const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const logger = require('../logger');
const botService = require('../services/botService');
const whatsappService = require('../services/whatsappService');
const databaseService = require('../services/databaseService');

router.post('/simulate-inbound', async (req, res, next) => {
  try {
    const { from, text, name, reset_conversation } = req.body;
    if (!from || !text) {
      return res.status(400).json({ error: 'Request must include "from" (phone number) and "text" (message).' });
    }
    const senderWaId = from;
    const userText = text;
    const senderName = name || 'Test Lead';

    console.log('\n=== TESTING MESSAGE ===');
    console.log(`From: ${senderName} (${senderWaId})`);
    console.log(`Message: "${userText}"`);
    console.log('========================\n');

    const lead = await databaseService.findOrCreateLead({
      phoneNumber: senderWaId,
      fullName: senderName,
      source: 'WA Simulation'
    });

    // Option to reset conversation for clean testing
    if (reset_conversation) {
      await supabase.from('messages').delete().eq('lead_id', lead.id);
      await supabase.from('leads').update({
        status: 'new',
        intent: null,
        budget: null,
        tentative_booking_time: null
      }).eq('id', lead.id);
      console.log('🔄 Conversation reset for clean testing\n');
    }

    // Get conversation history BEFORE processing
    const { data: beforeHistory } = await supabase
      .from('messages')
      .select('sender, message, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true });

    console.log('📝 Conversation History BEFORE:');
    if (beforeHistory && beforeHistory.length > 0) {
      beforeHistory.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.sender === 'lead' ? '👤 User' : '🤖 Doro'}: ${msg.message}`);
      });
    } else {
      console.log('  (No previous messages)');
    }
    console.log('');

    await supabase.from('messages').insert({ lead_id: lead.id, sender: 'lead', message: userText });

    const startTime = Date.now();
    console.log('🧠 Processing with AI...\n');

    // Process with bot service
    await botService.processMessage({
      senderWaId,
      userText,
      senderName
    });

    const processingTime = Date.now() - startTime;

    // Get the latest response from the database
    const { data: afterHistory } = await supabase
      .from('messages')
      .select('sender, message, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true });

    const aiResponses = afterHistory
      ?.filter(m => m.sender === 'assistant')
      ?.slice(beforeHistory?.filter(m => m.sender === 'assistant').length || 0)
      ?.map(m => m.message) || [];

    console.log('🤖 AI Response:');
    if (aiResponses.length > 0) {
      aiResponses.forEach((response, i) => {
        console.log(`  ${i + 1}. "${response}"`);
      });
    } else {
      console.log('  (No AI response generated)');
    }
    console.log(`\n⏱️  Processing time: ${processingTime}ms`);
    console.log('=========================\n');

    res.status(200).json({
      success: true,
      message: "Simulation completed successfully",
      ai_responses: aiResponses,
      lead_id: lead.id,
      processing_time_ms: processingTime,
      conversation_length: afterHistory?.length || 0,
      test_info: {
        from: senderWaId,
        name: senderName,
        message: userText,
        reset: reset_conversation || false
      }
    });
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    next(err);
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
