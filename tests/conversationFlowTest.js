/**
 * Conversation Flow Test
 * Tests the improved AI conversation logic to ensure:
 * 1. Natural conversation flow and context awareness
 * 2. Prevention of repetitive responses
 * 3. Proper acknowledgment of user messages
 * 4. Adherence to Doro's personality guidelines
 */

const MultiLayerAI = require('../services/multiLayerAI');
const logger = require('../logger');

class ConversationFlowTest {
  constructor() {
    this.multiLayerAI = new MultiLayerAI();
    this.testResults = [];
  }

  /**
   * Run all conversation flow tests
   */
  async runAllTests() {
    logger.info('Starting Conversation Flow Tests...');
    
    try {
      // Test 1: Context Awareness
      await this.testContextAwareness();

      // Test 2: Consultation-First Strategy
      await this.testConsultationFirstStrategy();

      // Test 3: Repetition Prevention
      await this.testRepetitionPrevention();
      
      // Test 4: Natural Conversation Flow
      await this.testNaturalConversationFlow();

      // Test 5: Doro Personality Adherence
      await this.testPersonalityAdherence();

      // Test 6: Response to Specific User Messages
      await this.testSpecificResponseHandling();
      
      this.printResults();
      
    } catch (error) {
      logger.error({ err: error }, 'Conversation flow test failed');
      throw error;
    }
  }

  /**
   * Test 1: Context Awareness - Bot should acknowledge what user just said
   */
  async testContextAwareness() {
    logger.info('Testing context awareness...');
    
    const conversationHistory = [
      { sender: 'bot', message: 'Hi! What brings you to the property market today?' },
      { sender: 'lead', message: 'Looking for a 3-bedroom condo in District 10' },
      { sender: 'bot', message: 'Nice! District 10 has some great options. What\'s your budget looking like?' },
      { sender: 'lead', message: 'Around 2.5 million' }
    ];

    const leadData = {
      id: 'test-lead-1',
      source: 'Facebook',
      status: 'new',
      budget: null,
      intent: null
    };

    const result = await this.multiLayerAI.processMessage({
      leadId: 'test-lead-1',
      senderWaId: '+6591234567',
      userText: 'Around 2.5 million',
      senderName: 'Test User',
      conversationHistory,
      leadData
    });

    // Check if response acknowledges the budget mentioned
    const acknowledgesBudget = result.response && (
      result.response.toLowerCase().includes('2.5') ||
      result.response.toLowerCase().includes('budget') ||
      result.response.toLowerCase().includes('million')
    );

    this.testResults.push({
      test: 'Context Awareness',
      passed: acknowledgesBudget,
      response: result.response,
      reason: acknowledgesBudget ? 'Bot acknowledged user\'s budget' : 'Bot did not acknowledge user\'s budget'
    });
  }

  /**
   * Test 2: Consultation-First Strategy - Bot should drive toward consultation, not offer alternatives
   */
  async testConsultationFirstStrategy() {
    logger.info('Testing consultation-first strategy...');

    const conversationHistory = [
      { sender: 'bot', message: 'Hi! What brings you to the property market today?' },
      { sender: 'lead', message: 'Looking for a 3-bedroom condo in District 10' },
      { sender: 'bot', message: 'Nice! District 10 has some great options. What\'s your budget looking like?' },
      { sender: 'lead', message: 'Around 2.5 million' }
    ];

    const leadData = {
      id: 'test-lead-consultation',
      source: 'Facebook',
      status: 'qualified',
      budget: '2500000',
      intent: 'own_stay'
    };

    const result = await this.multiLayerAI.processMessage({
      leadId: 'test-lead-consultation',
      senderWaId: '+6591234567',
      userText: 'Around 2.5 million',
      senderName: 'Test User',
      conversationHistory,
      leadData
    });

    // Check if response drives toward consultation instead of offering alternatives
    const drivesToConsultation = result.response && (
      result.response.toLowerCase().includes('chat') ||
      result.response.toLowerCase().includes('consultation') ||
      result.response.toLowerCase().includes('speak') ||
      result.response.toLowerCase().includes('call')
    );

    const avoidsAlternatives = result.response && !(
      result.response.toLowerCase().includes('shortlist') ||
      result.response.toLowerCase().includes('send you') ||
      result.response.toLowerCase().includes('let me know if') ||
      result.response.toLowerCase().includes('think about it') ||
      result.response.toLowerCase().includes('no pressure')
    );

    const createsUrgency = result.response && (
      result.response.toLowerCase().includes('moving fast') ||
      result.response.toLowerCase().includes('limited') ||
      result.response.toLowerCase().includes('popular') ||
      result.response.toLowerCase().includes('attention')
    );

    const passed = drivesToConsultation && avoidsAlternatives;

    this.testResults.push({
      test: 'Consultation-First Strategy',
      passed: passed,
      response: result.response,
      reason: passed ? 'Bot drives toward consultation without offering alternatives' : 'Bot offers alternatives instead of driving to consultation',
      details: {
        drivesToConsultation,
        avoidsAlternatives,
        createsUrgency
      }
    });
  }

  /**
   * Test 3: Repetition Prevention - Bot should not repeat similar information
   */
  async testRepetitionPrevention() {
    logger.info('Testing repetition prevention...');
    
    const conversationHistory = [
      { sender: 'bot', message: 'Hi! I work with a network of top agents from PropNex, ERA, and OrangeTee to help you find the perfect property.' },
      { sender: 'lead', message: 'That sounds good' },
      { sender: 'bot', message: 'Great! Our network includes agents from PropNex, ERA, OrangeTee and more, so you get access to the best market insights.' },
      { sender: 'lead', message: 'I\'m looking for a condo' }
    ];

    const leadData = {
      id: 'test-lead-2',
      source: 'Instagram',
      status: 'new',
      budget: null,
      intent: null
    };

    const result = await this.multiLayerAI.processMessage({
      leadId: 'test-lead-2',
      senderWaId: '+6591234568',
      userText: 'I\'m looking for a condo',
      senderName: 'Test User 2',
      conversationHistory,
      leadData
    });

    // Check if response avoids repeating company network information
    const avoidsRepetition = result.response && !(
      result.response.toLowerCase().includes('propnex') &&
      result.response.toLowerCase().includes('era') &&
      result.response.toLowerCase().includes('orangetee')
    );

    this.testResults.push({
      test: 'Repetition Prevention',
      passed: avoidsRepetition,
      response: result.response,
      reason: avoidsRepetition ? 'Bot avoided repeating company network info' : 'Bot repeated company network information'
    });
  }

  /**
   * Test 4: Natural Conversation Flow - Response should build on previous exchange
   */
  async testNaturalConversationFlow() {
    logger.info('Testing natural conversation flow...');
    
    const conversationHistory = [
      { sender: 'bot', message: 'What\'s driving your search for a property right now?' },
      { sender: 'lead', message: 'My family is growing and we need more space' }
    ];

    const leadData = {
      id: 'test-lead-3',
      source: 'WhatsApp',
      status: 'new',
      budget: null,
      intent: 'own_stay'
    };

    const result = await this.multiLayerAI.processMessage({
      leadId: 'test-lead-3',
      senderWaId: '+6591234569',
      userText: 'My family is growing and we need more space',
      senderName: 'Test User 3',
      conversationHistory,
      leadData
    });

    // Check if response naturally builds on family/space context
    const buildsOnContext = result.response && (
      result.response.toLowerCase().includes('family') ||
      result.response.toLowerCase().includes('space') ||
      result.response.toLowerCase().includes('growing') ||
      result.response.toLowerCase().includes('congrat')
    );

    this.testResults.push({
      test: 'Natural Conversation Flow',
      passed: buildsOnContext,
      response: result.response,
      reason: buildsOnContext ? 'Bot built naturally on family context' : 'Bot did not build on family context'
    });
  }

  /**
   * Test 5: Doro Personality Adherence - Should use casual Singaporean style
   */
  async testPersonalityAdherence() {
    logger.info('Testing Doro personality adherence...');
    
    const conversationHistory = [
      { sender: 'bot', message: 'Hey! What brings you to the property market?' },
      { sender: 'lead', message: 'Just browsing for now' }
    ];

    const leadData = {
      id: 'test-lead-4',
      source: 'Facebook',
      status: 'new',
      budget: null,
      intent: 'browsing'
    };

    const result = await this.multiLayerAI.processMessage({
      leadId: 'test-lead-4',
      senderWaId: '+6591234570',
      userText: 'Just browsing for now',
      senderName: 'Test User 4',
      conversationHistory,
      leadData
    });

    // Check for casual tone and avoid corporate language
    const isCasual = result.response && !(
      result.response.includes('I understand your concern') ||
      result.response.includes('Thank you so much') ||
      result.response.includes('I would be delighted') ||
      result.response.includes('I appreciate')
    );

    const avoidsFormalLanguage = result.response && !result.response.includes('—'); // No em dashes

    this.testResults.push({
      test: 'Doro Personality Adherence',
      passed: isCasual && avoidsFormalLanguage,
      response: result.response,
      reason: (isCasual && avoidsFormalLanguage) ? 'Bot used casual, non-corporate language' : 'Bot used formal/corporate language'
    });
  }

  /**
   * Test 6: Specific Response Handling - Bot should respond to what user actually said
   */
  async testSpecificResponseHandling() {
    logger.info('Testing specific response handling...');
    
    const conversationHistory = [
      { sender: 'bot', message: 'Would you like to schedule a quick consultation to explore your options?' },
      { sender: 'lead', message: 'yes sure' }
    ];

    const leadData = {
      id: 'test-lead-5',
      source: 'Instagram',
      status: 'qualified',
      budget: '2000000',
      intent: 'own_stay'
    };

    const result = await this.multiLayerAI.processMessage({
      leadId: 'test-lead-5',
      senderWaId: '+6591234571',
      userText: 'yes sure',
      senderName: 'Test User 5',
      conversationHistory,
      leadData
    });

    // Check if response handles the positive consultation response
    const handlesConsultationResponse = result.response && (
      result.response.toLowerCase().includes('great') ||
      result.response.toLowerCase().includes('perfect') ||
      result.response.toLowerCase().includes('awesome') ||
      result.response.toLowerCase().includes('connect you') ||
      result.response.toLowerCase().includes('consultant')
    );

    this.testResults.push({
      test: 'Specific Response Handling',
      passed: handlesConsultationResponse,
      response: result.response,
      reason: handlesConsultationResponse ? 'Bot handled consultation acceptance appropriately' : 'Bot did not handle consultation acceptance'
    });
  }

  /**
   * Print test results
   */
  printResults() {
    logger.info('\n=== CONVERSATION FLOW TEST RESULTS ===');
    
    let passedTests = 0;
    const totalTests = this.testResults.length;

    this.testResults.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      logger.info(`\nTest ${index + 1}: ${result.test} - ${status}`);
      logger.info(`Reason: ${result.reason}`);
      logger.info(`Response: "${result.response}"`);
      
      if (result.passed) passedTests++;
    });

    logger.info(`\n=== SUMMARY ===`);
    logger.info(`Passed: ${passedTests}/${totalTests} tests`);
    logger.info(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
      logger.info('🎉 All conversation flow tests passed!');
    } else {
      logger.warn('⚠️  Some conversation flow tests failed. Review the responses above.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new ConversationFlowTest();
  test.runAllTests().catch(error => {
    logger.error({ err: error }, 'Test execution failed');
    process.exit(1);
  });
}

module.exports = ConversationFlowTest;
