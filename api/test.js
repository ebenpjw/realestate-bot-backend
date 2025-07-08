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
      source: 'WA Direct'
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

// Complete flow testing endpoint - simulates entire lead-to-appointment journey
router.post('/complete-flow', async (req, res, next) => {
  try {
    const { scenario, options = {} } = req.body;

    if (!scenario) {
      return res.status(400).json({ error: 'Scenario is required' });
    }

    console.log('\n🎭 STARTING COMPLETE FLOW TEST');
    console.log(`📋 Scenario: ${scenario}`);
    console.log('================================\n');

    const flowTester = new CompleteFlowTester();
    const result = await flowTester.runScenario(scenario, options);

    res.status(200).json(result);
  } catch (err) {
    console.error('❌ Complete flow test failed:', err.message);
    next(err);
  }
});

// Conversation flow simulation endpoint
router.post('/conversation-flow', async (req, res, next) => {
  try {
    const { messages, leadProfile = {}, options = {} } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    console.log('\n💬 STARTING CONVERSATION FLOW SIMULATION');
    console.log(`📝 Messages: ${messages.length}`);
    console.log('==========================================\n');

    const conversationSimulator = new ConversationFlowSimulator();
    const result = await conversationSimulator.simulateConversation(messages, leadProfile, options);

    res.status(200).json(result);
  } catch (err) {
    console.error('❌ Conversation flow simulation failed:', err.message);
    next(err);
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

/**
 * Complete Flow Testing Class
 * Tests entire lead-to-appointment journey without sending WhatsApp messages
 */
class CompleteFlowTester {
  constructor() {
    this.testResults = [];
    this.testLeadId = null;
    this.testPhoneNumber = `+65${Date.now().toString().slice(-8)}`;
  }

  async runScenario(scenario, options = {}) {
    const startTime = Date.now();
    console.log(`🎬 Running scenario: ${scenario}`);

    try {
      let result;

      switch (scenario) {
        case 'basic_qualification_to_booking':
          result = await this._runBasicQualificationToBooking(options);
          break;
        case 'conflict_resolution':
          result = await this._runConflictResolution(options);
          break;
        case 'edge_cases':
          result = await this._runEdgeCases(options);
          break;
        case 'full_journey':
          result = await this._runFullJourney(options);
          break;
        default:
          throw new Error(`Unknown scenario: ${scenario}`);
      }

      const totalTime = Date.now() - startTime;

      return {
        success: true,
        scenario,
        totalTime,
        testResults: this.testResults,
        leadId: this.testLeadId,
        summary: this._generateSummary(),
        ...result
      };

    } catch (error) {
      return {
        success: false,
        scenario,
        error: error.message,
        testResults: this.testResults,
        totalTime: Date.now() - startTime
      };
    }
  }

  async _runBasicQualificationToBooking(options) {
    console.log('📋 Testing: Basic Qualification to Booking Flow');

    const conversationFlow = [
      { message: "Hi, I'm interested in buying a property", delay: 0 },
      { message: "I'm looking for a 2-bedroom condo", delay: 2000 },
      { message: "My budget is around $800k", delay: 1500 },
      { message: "I prefer the CBD area", delay: 1000 },
      { message: "I'm looking to buy within the next 3 months", delay: 2000 },
      { message: "Yes, I'd like to schedule a consultation", delay: 1000 },
      { message: "Tomorrow 2pm works for me", delay: 1500 }
    ];

    return await this._simulateConversationFlow(conversationFlow, {
      leadName: 'Test Buyer Basic',
      expectedOutcome: 'appointment_booked'
    });
  }

  async _runConflictResolution(options) {
    console.log('⚔️ Testing: Conflict Resolution Flow');

    // First create a conflicting appointment
    const conflictTime = new Date();
    conflictTime.setDate(conflictTime.getDate() + 1);
    conflictTime.setHours(14, 0, 0, 0);

    const conversationFlow = [
      { message: "I need to schedule a property consultation", delay: 0 },
      { message: "Tomorrow 2pm please", delay: 1000 },
      { message: "Ok, what other times are available?", delay: 2000 },
      { message: "3pm tomorrow sounds good", delay: 1500 }
    ];

    return await this._simulateConversationFlow(conversationFlow, {
      leadName: 'Test Conflict Resolution',
      expectedOutcome: 'alternative_booking',
      preSetupConflict: conflictTime
    });
  }

  async _simulateConversationFlow(messages, options = {}) {
    const results = [];
    let currentLead = null;

    try {
      // Create or get test lead
      currentLead = await databaseService.findOrCreateLead({
        phoneNumber: this.testPhoneNumber,
        fullName: options.leadName || 'Test Lead',
        source: 'WA Direct'
      });

      this.testLeadId = currentLead.id;
      console.log(`👤 Created test lead: ${currentLead.full_name} (${currentLead.id})`);

      // Setup conflict if needed
      if (options.preSetupConflict) {
        await this._createConflictingAppointment(options.preSetupConflict);
      }

      // Process each message in the conversation
      for (let i = 0; i < messages.length; i++) {
        const { message, delay } = messages[i];

        if (delay > 0) {
          console.log(`⏳ Waiting ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        console.log(`\n📨 Message ${i + 1}/${messages.length}: "${message}"`);

        const messageResult = await this._processTestMessage(message, currentLead);
        results.push(messageResult);

        // Check if appointment was booked
        if (messageResult.appointmentBooked) {
          console.log('✅ Appointment successfully booked!');
          break;
        }
      }

      // Validate final state
      const finalValidation = await this._validateFinalState(currentLead, options.expectedOutcome);

      return {
        conversationResults: results,
        finalValidation,
        leadFinalState: await this._getLeadCurrentState(currentLead.id)
      };

    } catch (error) {
      console.error(`❌ Conversation flow failed: ${error.message}`);
      throw error;
    }
  }

  async _processTestMessage(message, lead) {
    const startTime = Date.now();

    try {
      // Save user message
      await supabase.from('messages').insert({
        lead_id: lead.id,
        sender: 'lead',
        message: message
      });

      // Process with bot service (this will NOT send WhatsApp messages in test mode)
      await botService.processMessage({
        senderWaId: this.testPhoneNumber,
        userText: message,
        senderName: lead.full_name
      });

      // Get AI responses from database
      const { data: aiResponses } = await supabase
        .from('messages')
        .select('message, created_at')
        .eq('lead_id', lead.id)
        .eq('sender', 'assistant')
        .order('created_at', { ascending: false })
        .limit(5);

      // Check if appointment was created
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const processingTime = Date.now() - startTime;

      const result = {
        userMessage: message,
        aiResponses: aiResponses?.map(r => r.message) || [],
        appointmentBooked: appointments && appointments.length > 0,
        appointmentDetails: appointments?.[0] || null,
        processingTime,
        timestamp: new Date().toISOString()
      };

      console.log(`🤖 AI Responses (${result.aiResponses.length}):`);
      result.aiResponses.forEach((resp, i) => {
        console.log(`   ${i + 1}. "${resp.substring(0, 100)}${resp.length > 100 ? '...' : ''}"`);
      });

      if (result.appointmentBooked) {
        console.log(`📅 Appointment: ${result.appointmentDetails.appointment_time}`);
      }

      this.testResults.push(result);
      return result;

    } catch (error) {
      console.error(`❌ Message processing failed: ${error.message}`);
      throw error;
    }
  }

  _generateSummary() {
    const totalMessages = this.testResults.length;
    const totalAiResponses = this.testResults.reduce((sum, r) => sum + r.aiResponses.length, 0);
    const appointmentsBooked = this.testResults.filter(r => r.appointmentBooked).length;
    const avgProcessingTime = this.testResults.reduce((sum, r) => sum + r.processingTime, 0) / totalMessages;

    return {
      totalMessages,
      totalAiResponses,
      appointmentsBooked,
      avgProcessingTime: Math.round(avgProcessingTime),
      conversationCompleted: appointmentsBooked > 0
    };
  }

  async _createConflictingAppointment(conflictTime) {
    // Get default agent for testing
    const { data: agents } = await supabase
      .from('agents')
      .select('id')
      .limit(1);

    if (agents && agents.length > 0) {
      const appointmentService = require('../services/appointmentService');
      await appointmentService.createAppointment({
        leadId: this.testLeadId,
        agentId: agents[0].id,
        appointmentTime: conflictTime,
        leadName: 'Conflict Test Lead',
        consultationNotes: 'Test conflict appointment'
      });
      console.log(`⚔️ Created conflicting appointment at ${conflictTime}`);
    }
  }

  async _validateFinalState(lead, expectedOutcome) {
    const { data: finalLead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead.id)
      .single();

    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', lead.id);

    const validation = {
      leadStatus: finalLead?.status,
      appointmentCount: appointments?.length || 0,
      expectedOutcome,
      outcomeMatched: false
    };

    switch (expectedOutcome) {
      case 'appointment_booked':
        validation.outcomeMatched = validation.appointmentCount > 0;
        break;
      case 'alternative_booking':
        validation.outcomeMatched = validation.appointmentCount > 0;
        break;
      default:
        validation.outcomeMatched = true;
    }

    console.log(`🎯 Final validation: ${validation.outcomeMatched ? '✅ PASSED' : '❌ FAILED'}`);
    return validation;
  }

  async _getLeadCurrentState(leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', leadId);

    return {
      lead,
      messageCount: messages?.length || 0,
      appointmentCount: appointments?.length || 0,
      lastAppointment: appointments?.[appointments.length - 1] || null
    };
  }
}

/**
 * Conversation Flow Simulator Class
 * Simulates realistic conversation patterns and timing
 */
class ConversationFlowSimulator {
  constructor() {
    this.predefinedScenarios = {
      'eager_buyer': [
        "Hi! I saw your property listing and I'm very interested",
        "I have $1M budget and looking in Orchard area",
        "Can we meet this week? I'm ready to buy",
        "Tomorrow 3pm works perfectly for me"
      ],
      'cautious_buyer': [
        "Hello, I'm exploring property options",
        "I'm not sure about my budget yet, maybe $600-800k",
        "I need to think about the location",
        "Let me check my schedule and get back to you",
        "Actually, can we meet next week?",
        "Tuesday 2pm would be good"
      ],
      'investor': [
        "I'm looking for investment properties",
        "What's the rental yield in the CBD area?",
        "I'm interested in 1-2 bedroom units",
        "My budget is flexible, up to $1.5M",
        "Can you show me some options this week?",
        "Friday afternoon works for me"
      ]
    };
  }

  async simulateConversation(messages, leadProfile = {}, options = {}) {
    console.log('💬 Starting conversation simulation...');

    const testPhoneNumber = `+65${Date.now().toString().slice(-8)}`;
    const results = [];

    try {
      // Create test lead
      const lead = await databaseService.findOrCreateLead({
        phoneNumber: testPhoneNumber,
        fullName: leadProfile.name || 'Conversation Test Lead',
        source: 'WA Direct'
      });

      console.log(`👤 Created simulation lead: ${lead.full_name}`);

      // Process each message
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const delay = options.naturalTiming ? this._calculateNaturalDelay(message) : 0;

        if (delay > 0) {
          console.log(`⏳ Natural delay: ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        console.log(`\n📨 Processing: "${message}"`);

        const result = await this._processSimulationMessage(message, lead, testPhoneNumber);
        results.push(result);
      }

      // Generate conversation analysis
      const analysis = this._analyzeConversation(results);

      return {
        success: true,
        leadId: lead.id,
        conversationResults: results,
        analysis,
        summary: this._generateConversationSummary(results, analysis)
      };

    } catch (error) {
      console.error(`❌ Conversation simulation failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }

  async _processSimulationMessage(message, lead, phoneNumber) {
    const startTime = Date.now();

    try {
      // Save user message
      await supabase.from('messages').insert({
        lead_id: lead.id,
        sender: 'lead',
        message: message
      });

      // Process with bot service
      await botService.processMessage({
        senderWaId: phoneNumber,
        userText: message,
        senderName: lead.full_name
      });

      // Get AI responses
      const { data: aiResponses } = await supabase
        .from('messages')
        .select('message, created_at')
        .eq('lead_id', lead.id)
        .eq('sender', 'assistant')
        .order('created_at', { ascending: false })
        .limit(3);

      const processingTime = Date.now() - startTime;

      const result = {
        userMessage: message,
        aiResponses: aiResponses?.map(r => r.message) || [],
        processingTime,
        timestamp: new Date().toISOString()
      };

      console.log(`🤖 AI responded with ${result.aiResponses.length} messages`);
      result.aiResponses.forEach((resp, i) => {
        console.log(`   ${i + 1}. "${resp.substring(0, 80)}${resp.length > 80 ? '...' : ''}"`);
      });

      return result;

    } catch (error) {
      console.error(`❌ Simulation message failed: ${error.message}`);
      throw error;
    }
  }

  _calculateNaturalDelay(message) {
    // Simulate natural human typing speed and thinking time
    const baseDelay = 1000; // 1 second base
    const typingSpeed = 50; // ms per character
    const thinkingTime = message.includes('?') ? 2000 : 500;

    return baseDelay + (message.length * typingSpeed) + thinkingTime;
  }

  _analyzeConversation(results) {
    const totalMessages = results.length;
    const totalAiResponses = results.reduce((sum, r) => sum + r.aiResponses.length, 0);
    const avgResponseTime = results.reduce((sum, r) => sum + r.processingTime, 0) / totalMessages;

    // Analyze conversation patterns
    const userMessages = results.map(r => r.userMessage.toLowerCase());
    const hasTimeReferences = userMessages.some(msg =>
      msg.includes('tomorrow') || msg.includes('today') || msg.includes('pm') || msg.includes('am')
    );
    const hasBudgetMention = userMessages.some(msg =>
      msg.includes('$') || msg.includes('budget') || msg.includes('price')
    );
    const hasLocationMention = userMessages.some(msg =>
      msg.includes('area') || msg.includes('district') || msg.includes('location')
    );

    return {
      totalMessages,
      totalAiResponses,
      avgResponseTime: Math.round(avgResponseTime),
      conversationQuality: {
        hasTimeReferences,
        hasBudgetMention,
        hasLocationMention,
        qualificationScore: [hasTimeReferences, hasBudgetMention, hasLocationMention].filter(Boolean).length
      }
    };
  }

  _generateConversationSummary(results, analysis) {
    return {
      conversationLength: results.length,
      totalProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0),
      averageResponseTime: analysis.avgResponseTime,
      qualificationLevel: analysis.conversationQuality.qualificationScore >= 2 ? 'High' :
                         analysis.conversationQuality.qualificationScore === 1 ? 'Medium' : 'Low',
      recommendedNextStep: analysis.conversationQuality.qualificationScore >= 2 ?
                          'Ready for appointment booking' : 'Continue qualification'
    };
  }
}

module.exports = router;
