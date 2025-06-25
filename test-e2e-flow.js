// test-e2e-flow.js - End-to-end flow testing
const logger = require('./logger');
const supabase = require('./supabaseClient');
const aiService = require('./services/aiService');
const whatsappService = require('./services/whatsappService');
const { findOrCreateLead } = require('./api/leadManager');

async function testEndToEndFlow() {
  logger.info('🧪 Starting end-to-end flow test...');
  
  const testResults = {
    database: false,
    leadCreation: false,
    aiService: false,
    whatsappService: false,
    messageFlow: false
  };
  
  try {
    // Test 1: Database connectivity
    logger.info('1️⃣ Testing database connectivity...');
    const { data: dbTest, error: dbError } = await supabase
      .from('leads')
      .select('count')
      .limit(1);
    
    if (dbError) {
      logger.error({ err: dbError }, '❌ Database test failed');
    } else {
      logger.info('✅ Database connectivity successful');
      testResults.database = true;
    }
    
    // Test 2: Lead creation/retrieval
    logger.info('2️⃣ Testing lead creation...');
    const testLead = await findOrCreateLead({
      phoneNumber: '6512345678',
      fullName: 'Test User E2E',
      source: 'E2E Test'
    });
    
    if (testLead && testLead.id) {
      logger.info({ leadId: testLead.id }, '✅ Lead creation successful');
      testResults.leadCreation = true;
    } else {
      logger.error('❌ Lead creation failed');
    }
    
    // Test 3: AI Service
    logger.info('3️⃣ Testing AI service...');
    const aiHealthCheck = await aiService.healthCheck();
    
    if (aiHealthCheck.status === 'healthy') {
      logger.info('✅ AI service healthy');
      testResults.aiService = true;
      
      // Test AI response generation
      const aiResponse = await aiService.generateResponse({
        lead: testLead,
        previousMessages: [
          { sender: 'lead', message: 'Hello' }
        ]
      });
      
      if (aiResponse && aiResponse.messages && aiResponse.messages.length > 0) {
        logger.info({ 
          messages: aiResponse.messages.length,
          action: aiResponse.action 
        }, '✅ AI response generation successful');
      } else {
        logger.error('❌ AI response generation failed');
        testResults.aiService = false;
      }
    } else {
      logger.error({ healthCheck: aiHealthCheck }, '❌ AI service unhealthy');
    }
    
    // Test 4: WhatsApp Service
    logger.info('4️⃣ Testing WhatsApp service...');
    const whatsappHealthCheck = await whatsappService.healthCheck();
    
    if (whatsappHealthCheck.status === 'healthy') {
      logger.info('✅ WhatsApp service configuration valid');
      testResults.whatsappService = true;
    } else {
      logger.error({ healthCheck: whatsappHealthCheck }, '❌ WhatsApp service configuration invalid');
    }
    
    // Test 5: Message flow simulation
    logger.info('5️⃣ Testing message flow...');
    if (testResults.database && testResults.leadCreation && testResults.aiService) {
      // Simulate message processing
      const messageData = {
        senderWaId: testLead.phone_number,
        userText: 'I want to buy a property',
        senderName: testLead.full_name
      };
      
      // Get conversation history
      const { data: history } = await supabase
        .from('messages')
        .select('sender, message')
        .eq('lead_id', testLead.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      const previousMessages = history ? 
        history.map(entry => ({ sender: entry.sender, message: entry.message })).reverse() : 
        [];
      
      // Generate AI response
      const aiResponse = await aiService.generateResponse({ 
        lead: testLead, 
        previousMessages 
      });
      
      // Save test message
      await supabase.from('messages').insert({
        lead_id: testLead.id,
        sender: 'lead',
        message: messageData.userText
      });
      
      if (aiResponse.messages && aiResponse.messages.length > 0) {
        // Save AI response messages
        const messagesToSave = aiResponse.messages.map(part => ({
          lead_id: testLead.id,
          sender: 'assistant',
          message: part
        }));
        await supabase.from('messages').insert(messagesToSave);
        
        logger.info({ 
          leadId: testLead.id,
          aiMessages: aiResponse.messages.length,
          action: aiResponse.action
        }, '✅ Message flow simulation successful');
        testResults.messageFlow = true;
      } else {
        logger.error('❌ Message flow simulation failed');
      }
    } else {
      logger.warn('⚠️ Skipping message flow test due to previous failures');
    }
    
  } catch (error) {
    logger.error({ err: error }, '💥 End-to-end test failed with error');
  }
  
  // Summary
  const passedTests = Object.values(testResults).filter(Boolean).length;
  const totalTests = Object.keys(testResults).length;
  
  logger.info({
    results: testResults,
    passed: passedTests,
    total: totalTests,
    success: passedTests === totalTests
  }, `🏁 End-to-end test completed: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    logger.info('🎉 All tests passed! Your bot is ready for production.');
  } else {
    logger.error('💥 Some tests failed. Please check the logs above for details.');
  }
  
  return {
    success: passedTests === totalTests,
    results: testResults,
    passed: passedTests,
    total: totalTests
  };
}

// Run test if called directly
if (require.main === module) {
  testEndToEndFlow()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      logger.error({ err: error }, '💥 Test execution failed');
      process.exit(1);
    });
}

module.exports = { testEndToEndFlow };
