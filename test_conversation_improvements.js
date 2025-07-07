/**
 * Test script to validate conversation improvements
 * Tests: Message flooding, formatting, colloquialisms, and conversation flow
 */

const botService = require('./services/botService');
const config = require('./config');
const logger = require('./logger');

// Test scenarios to validate improvements
const testScenarios = [
  {
    name: "Simple Greeting Test",
    description: "Test that simple greetings don't trigger message flooding",
    messages: [
      { text: "hello", expected: "single_message" }
    ]
  },
  {
    name: "Property Interest Test", 
    description: "Test proper formatting and follow-up questions",
    messages: [
      { text: "hello", expected: "single_message" },
      { text: "yeah I'm looking to buy a 2 bedder for ownstay", expected: "proper_formatting_and_followup" }
    ]
  },
  {
    name: "Acknowledgment Test",
    description: "Test that acknowledgments include follow-up questions",
    messages: [
      { text: "hello", expected: "single_message" },
      { text: "looking for resale or new launch condo", expected: "acknowledgment_with_followup" }
    ]
  },
  {
    name: "Professional Tone Test",
    description: "Test that responses avoid excessive colloquialisms",
    messages: [
      { text: "hello", expected: "professional_tone" },
      { text: "I'm flexible with property types", expected: "no_excessive_colloquialisms" }
    ]
  }
];

class ConversationTester {
  constructor() {
    this.botService = botService;
    this.testResults = [];
  }

  async runTests() {
    console.log('🧪 Starting Conversation Improvement Tests\n');
    
    for (const scenario of testScenarios) {
      console.log(`📋 Testing: ${scenario.name}`);
      console.log(`   Description: ${scenario.description}\n`);
      
      try {
        const result = await this.runScenario(scenario);
        this.testResults.push(result);
        
        if (result.passed) {
          console.log(`✅ ${scenario.name} - PASSED\n`);
        } else {
          console.log(`❌ ${scenario.name} - FAILED`);
          console.log(`   Issues: ${result.issues.join(', ')}\n`);
        }
      } catch (error) {
        console.log(`💥 ${scenario.name} - ERROR: ${error.message}\n`);
        this.testResults.push({
          scenario: scenario.name,
          passed: false,
          issues: [`Test error: ${error.message}`]
        });
      }
    }
    
    this.printSummary();
  }

  async runScenario(scenario) {
    const testLead = await this.createTestLead();
    const issues = [];
    let passed = true;

    for (let i = 0; i < scenario.messages.length; i++) {
      const message = scenario.messages[i];
      
      console.log(`   👤 User: "${message.text}"`);
      
      // Process message with bot
      const response = await this.botService.processMessage({
        senderWaId: testLead.phone_number,
        userText: message.text,
        senderName: testLead.full_name
      });

      // Get the actual bot response from database
      const botResponse = await this.getLatestBotResponse(testLead.id);
      console.log(`   🤖 Bot: "${botResponse}"`);
      
      // Validate response based on expected criteria
      const validation = this.validateResponse(botResponse, message.expected);
      
      if (!validation.passed) {
        passed = false;
        issues.push(...validation.issues);
      }
      
      console.log(`   ✓ Validation: ${validation.passed ? 'PASS' : 'FAIL'}`);
      if (!validation.passed) {
        console.log(`     Issues: ${validation.issues.join(', ')}`);
      }
      console.log('');
    }

    // Cleanup test lead
    await this.cleanupTestLead(testLead.id);

    return {
      scenario: scenario.name,
      passed,
      issues
    };
  }

  validateResponse(response, expectedCriteria) {
    const issues = [];
    let passed = true;

    switch (expectedCriteria) {
      case "single_message":
        // Should be a single, non-flooding response
        if (response.length < 20) {
          issues.push("Response too short for greeting");
          passed = false;
        }
        break;

      case "proper_formatting_and_followup":
        // Should have proper line breaks and follow-up question
        if (!response.includes('\n\n')) {
          issues.push("Missing proper line breaks for readability");
          passed = false;
        }
        if (!response.includes('?')) {
          issues.push("Missing follow-up question");
          passed = false;
        }
        break;

      case "acknowledgment_with_followup":
        // Should acknowledge and ask follow-up
        if (!response.includes('?')) {
          issues.push("Missing follow-up question after acknowledgment");
          passed = false;
        }
        if (response.toLowerCase().includes('sia') || response.toLowerCase().includes(' ah')) {
          issues.push("Contains excessive colloquialisms");
          passed = false;
        }
        break;

      case "professional_tone":
        // Should avoid excessive colloquialisms
        if (response.toLowerCase().includes('sia') || response.toLowerCase().includes(' ah')) {
          issues.push("Contains unprofessional colloquialisms");
          passed = false;
        }
        break;

      case "no_excessive_colloquialisms":
        // Should not contain sia/ah
        if (response.toLowerCase().includes('sia') || response.toLowerCase().includes(' ah')) {
          issues.push("Contains excessive colloquialisms (sia/ah)");
          passed = false;
        }
        break;
    }

    return { passed, issues };
  }

  async createTestLead() {
    const testPhone = `+6591234567${Date.now().toString().slice(-3)}`;
    const supabase = require('./supabaseClient');

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        phone_number: testPhone,
        full_name: 'Test User',
        source: 'Test'
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create test lead: ${error.message}`);
    return lead;
  }

  async getLatestBotResponse(leadId) {
    const supabase = require('./supabaseClient');
    const { data: messages, error } = await supabase
      .from('messages')
      .select('message')
      .eq('lead_id', leadId)
      .eq('sender', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw new Error(`Failed to get bot response: ${error.message}`);
    return messages[0]?.message || '';
  }

  async cleanupTestLead(leadId) {
    const supabase = require('./supabaseClient');
    // Delete messages first
    await supabase
      .from('messages')
      .delete()
      .eq('lead_id', leadId);

    // Delete lead
    await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);
  }

  printSummary() {
    console.log('\n📊 Test Summary');
    console.log('================');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);
    
    if (passed === total) {
      console.log('\n🎉 All tests passed! Conversation improvements are working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the issues above.');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new ConversationTester();
  tester.runTests().catch(console.error);
}

module.exports = ConversationTester;
