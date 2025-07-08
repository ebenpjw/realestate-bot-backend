#!/usr/bin/env node

/**
 * Real Estate Bot Conversation Scenario Testing
 * Tests various conversation patterns and lead qualification scenarios
 * 
 * Usage:
 *   node test_conversation_scenarios.js [scenario_type]
 * 
 * Scenario Types:
 *   - eager: Eager buyer scenarios
 *   - cautious: Cautious buyer scenarios  
 *   - investor: Investor scenarios
 *   - difficult: Difficult/edge case scenarios
 *   - all: Run all scenario types
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.RAILWAY_URL || 'http://localhost:3000';

const CONVERSATION_SCENARIOS = {
  eager_buyer: {
    name: 'Eager Buyer',
    description: 'Highly motivated buyer ready to purchase quickly',
    messages: [
      "Hi! I saw your property listing and I'm very interested",
      "I have $1M budget and looking in Orchard area", 
      "Can we meet this week? I'm ready to buy",
      "Tomorrow 3pm works perfectly for me"
    ],
    expectedOutcome: 'quick_booking',
    leadProfile: {
      name: 'Eager Test Buyer',
      motivation: 'high',
      timeline: 'immediate'
    }
  },
  
  cautious_buyer: {
    name: 'Cautious Buyer', 
    description: 'Careful buyer who needs more information and time',
    messages: [
      "Hello, I'm exploring property options",
      "I'm not sure about my budget yet, maybe $600-800k",
      "I need to think about the location",
      "What areas would you recommend for families?",
      "Let me check my schedule and get back to you",
      "Actually, can we meet next week?",
      "Tuesday 2pm would be good"
    ],
    expectedOutcome: 'gradual_qualification',
    leadProfile: {
      name: 'Cautious Test Buyer',
      motivation: 'medium',
      timeline: 'flexible'
    }
  },

  investor: {
    name: 'Property Investor',
    description: 'Investment-focused buyer looking for rental yield',
    messages: [
      "I'm looking for investment properties",
      "What's the rental yield in the CBD area?", 
      "I'm interested in 1-2 bedroom units",
      "My budget is flexible, up to $1.5M",
      "Can you show me some options this week?",
      "Friday afternoon works for me"
    ],
    expectedOutcome: 'investment_consultation',
    leadProfile: {
      name: 'Investor Test Lead',
      motivation: 'high',
      timeline: 'business_focused'
    }
  },

  difficult_lead: {
    name: 'Difficult Lead',
    description: 'Challenging scenarios with unclear requirements',
    messages: [
      "Hi",
      "Maybe",
      "I don't know my budget",
      "Anywhere is fine",
      "When are you free?",
      "I guess tomorrow is ok"
    ],
    expectedOutcome: 'qualification_challenge',
    leadProfile: {
      name: 'Difficult Test Lead',
      motivation: 'low',
      timeline: 'unclear'
    }
  },

  price_sensitive: {
    name: 'Price Sensitive Buyer',
    description: 'Budget-conscious buyer with specific price constraints',
    messages: [
      "I'm looking for affordable properties",
      "My budget is quite tight, around $400-500k",
      "Are there any good deals available?",
      "I need something move-in ready",
      "Can you show me the cheapest options first?",
      "When can we meet to discuss budget options?"
    ],
    expectedOutcome: 'budget_focused_consultation',
    leadProfile: {
      name: 'Budget Conscious Buyer',
      motivation: 'medium',
      timeline: 'price_dependent'
    }
  },

  first_time_buyer: {
    name: 'First Time Buyer',
    description: 'New to property buying, needs guidance',
    messages: [
      "Hi, I'm looking to buy my first property",
      "I don't really know where to start",
      "What should I be looking for?",
      "How much deposit do I need?",
      "Can you help guide me through the process?",
      "I'd like to meet and learn more"
    ],
    expectedOutcome: 'educational_consultation',
    leadProfile: {
      name: 'First Time Buyer',
      motivation: 'medium',
      timeline: 'learning_phase'
    }
  }
};

class ConversationScenarioTester {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async runScenarios(scenarioType = 'all') {
    console.log('💬 Real Estate Bot Conversation Scenario Testing');
    console.log('===============================================\n');
    
    try {
      if (scenarioType === 'all') {
        await this.runAllScenarios();
      } else if (CONVERSATION_SCENARIOS[scenarioType]) {
        await this.runSingleScenario(scenarioType);
      } else {
        console.error(`❌ Unknown scenario type: ${scenarioType}`);
        this.showUsage();
        return;
      }

      this.printFinalReport();
      
    } catch (error) {
      console.error(`❌ Scenario testing failed: ${error.message}`);
      process.exit(1);
    }
  }

  async runAllScenarios() {
    console.log('🎭 Running all conversation scenarios...\n');
    
    for (const [key, scenario] of Object.entries(CONVERSATION_SCENARIOS)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`💬 SCENARIO: ${scenario.name.toUpperCase()}`);
      console.log(`📝 ${scenario.description}`);
      console.log(`${'='.repeat(60)}\n`);
      
      await this.runSingleScenario(key);
      
      // Brief pause between scenarios
      await this.delay(3000);
    }
  }

  async runSingleScenario(scenarioKey) {
    const scenario = CONVERSATION_SCENARIOS[scenarioKey];
    
    try {
      console.log(`🎬 Testing: ${scenario.name}`);
      console.log(`📋 Description: ${scenario.description}`);
      console.log(`💬 Messages: ${scenario.messages.length}`);
      console.log(`🎯 Expected: ${scenario.expectedOutcome}\n`);
      
      const response = await axios.post(`${BASE_URL}/api/test/conversation-flow`, {
        messages: scenario.messages,
        leadProfile: scenario.leadProfile,
        options: {
          naturalTiming: true,
          validateQualification: true,
          trackConversionPath: true
        }
      }, {
        timeout: 180000 // 3 minute timeout for longer conversations
      });

      const result = response.data;
      this.results.push({ 
        scenarioKey, 
        scenarioName: scenario.name,
        expectedOutcome: scenario.expectedOutcome,
        ...result 
      });
      
      this.printScenarioResult(scenario, result);
      
    } catch (error) {
      console.error(`❌ Scenario ${scenarioKey} failed:`, error.response?.data || error.message);
      this.results.push({ 
        scenarioKey,
        scenarioName: scenario.name,
        success: false, 
        error: error.response?.data || error.message 
      });
    }
  }

  printScenarioResult(scenario, result) {
    console.log(`\n📊 RESULTS: ${scenario.name}`);
    console.log('-'.repeat(50));
    
    if (result.success) {
      console.log('✅ Status: PASSED');
      console.log(`👤 Lead ID: ${result.leadId}`);
      
      if (result.analysis) {
        console.log(`💬 Total Messages: ${result.analysis.totalMessages}`);
        console.log(`🤖 AI Responses: ${result.analysis.totalAiResponses}`);
        console.log(`⚡ Avg Response Time: ${result.analysis.avgResponseTime}ms`);
        console.log(`🎯 Qualification Score: ${result.analysis.conversationQuality.qualificationScore}/3`);
        
        const quality = result.analysis.conversationQuality;
        console.log(`📍 Has Location: ${quality.hasLocationMention ? '✅' : '❌'}`);
        console.log(`💰 Has Budget: ${quality.hasBudgetMention ? '✅' : '❌'}`);
        console.log(`⏰ Has Timeline: ${quality.hasTimeReferences ? '✅' : '❌'}`);
      }
      
      if (result.summary) {
        console.log(`📈 Qualification Level: ${result.summary.qualificationLevel}`);
        console.log(`🎯 Next Step: ${result.summary.recommendedNextStep}`);
      }
      
      // Show conversation flow
      if (result.conversationResults && result.conversationResults.length > 0) {
        console.log('\n💭 Conversation Flow:');
        result.conversationResults.forEach((conv, i) => {
          console.log(`  ${i + 1}. 👤 "${conv.userMessage}"`);
          if (conv.aiResponses && conv.aiResponses.length > 0) {
            conv.aiResponses.forEach((resp, j) => {
              const preview = resp.length > 60 ? resp.substring(0, 60) + '...' : resp;
              console.log(`     🤖 "${preview}"`);
            });
          }
        });
      }
      
    } else {
      console.log('❌ Status: FAILED');
      console.log(`💥 Error: ${result.error}`);
    }
    
    console.log('-'.repeat(50));
  }

  printFinalReport() {
    const totalTime = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 CONVERSATION SCENARIO TEST REPORT');
    console.log('='.repeat(60));
    
    console.log(`🎯 Overall Result: ${passedTests === totalTests ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
    console.log(`📊 Success Rate: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
    console.log(`⏱️  Total Testing Time: ${Math.round(totalTime/1000)}s`);
    
    console.log('\n📈 Scenario Results:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${result.scenarioName}`);
      if (result.analysis && result.success) {
        console.log(`     Qualification: ${result.analysis.conversationQuality.qualificationScore}/3`);
        console.log(`     Avg Response: ${result.analysis.avgResponseTime}ms`);
      }
    });
    
    if (passedTests < totalTests) {
      console.log('\n🔍 Failed Scenarios:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`  ❌ ${result.scenarioName}: ${result.error}`);
      });
    }
    
    console.log('\n🎉 Conversation Testing Complete!');
    console.log('='.repeat(60));
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showUsage() {
    console.log('\nUsage: node test_conversation_scenarios.js [scenario_type]');
    console.log('\nAvailable scenario types:');
    Object.keys(CONVERSATION_SCENARIOS).forEach(key => {
      console.log(`  ${key}: ${CONVERSATION_SCENARIOS[key].name}`);
    });
    console.log('  all: Run all scenarios');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const scenarioType = args[0] || 'all';
  
  const tester = new ConversationScenarioTester();
  await tester.runScenarios(scenarioType);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { ConversationScenarioTester, CONVERSATION_SCENARIOS };
