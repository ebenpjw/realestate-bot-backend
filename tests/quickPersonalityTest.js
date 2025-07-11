const MultiLayerAI = require('../services/multiLayerAI');
const logger = require('../logger');

/**
 * Quick Personality Test
 * Tests if the multi-layer AI now uses Doro's authentic voice
 */

async function testDoroPersonality() {
  console.log('🎭 TESTING DORO\'S AUTHENTIC PERSONALITY');
  console.log('=====================================\n');
  
  const multiLayerAI = new MultiLayerAI();
  
  // Test scenario: Difficult lead from Instagram ad
  const testScenario = {
    leadData: {
      id: 'test-personality',
      name: 'Rachel Lim',
      source: 'Instagram Ad',
      status: 'new',
      budget: '$800,000',
      intent: 'own_stay'
    },
    userMessage: "Hi, I filled up your form on Instagram but honestly I'm getting so many calls from agents already. Are you going to be another one trying to push me to buy something?",
    conversationHistory: []
  };
  
  console.log('📋 TEST SCENARIO:');
  console.log(`Lead: ${testScenario.leadData.name} (${testScenario.leadData.source})`);
  console.log(`Message: "${testScenario.userMessage}"`);
  console.log(`Challenge: High resistance, agent fatigue, trust issues\n`);
  
  console.log('🧠 PROCESSING THROUGH MULTI-LAYER AI...\n');
  
  try {
    const result = await multiLayerAI.processMessage({
      leadId: testScenario.leadData.id,
      senderWaId: '+6591234567',
      userText: testScenario.userMessage,
      senderName: testScenario.leadData.name,
      conversationHistory: testScenario.conversationHistory,
      leadData: testScenario.leadData
    });
    
    if (result.success) {
      console.log('✅ PROCESSING SUCCESSFUL');
      console.log(`Processing Time: ${result.processingTime}ms`);
      console.log(`Quality Score: ${(result.qualityScore * 100).toFixed(1)}%\n`);
      
      console.log('🤖 DORO\'S RESPONSE:');
      console.log('─'.repeat(60));
      console.log(`"${result.response}"`);
      console.log('─'.repeat(60));
      
      // Analyze the response
      console.log('\n📊 PERSONALITY ANALYSIS:');
      analyzePersonality(result.response);
      
    } else {
      console.log('❌ PROCESSING FAILED');
      console.log(`Error: ${result.error}`);
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
}

function analyzePersonality(response) {
  const analysis = {
    authentic: false,
    notRobotic: false,
    notOverPolite: false,
    naturalTone: false,
    addressesResistance: false,
    buildsRapport: false,
    singaporeanContext: false,
    notSalesy: false
  };
  
  const responseLower = response.toLowerCase();
  
  // Check for authentic language
  if (responseLower.includes('hey') || responseLower.includes('got it') || responseLower.includes('makes sense')) {
    analysis.authentic = true;
  }
  
  // Check it's not robotic
  if (!responseLower.includes('i understand your concern') && !responseLower.includes('i appreciate')) {
    analysis.notRobotic = true;
  }
  
  // Check it's not over-polite
  if (!responseLower.includes('thank you so much') && !responseLower.includes('i would be delighted')) {
    analysis.notOverPolite = true;
  }
  
  // Check for natural tone
  if (responseLower.includes('totally') || responseLower.includes('honestly') || responseLower.includes('right')) {
    analysis.naturalTone = true;
  }
  
  // Check addresses resistance
  if (responseLower.includes('no pressure') || responseLower.includes('different') || responseLower.includes('understand')) {
    analysis.addressesResistance = true;
  }
  
  // Check builds rapport
  if (responseLower.includes('feel') || responseLower.includes('same') || responseLower.includes('get it')) {
    analysis.buildsRapport = true;
  }
  
  // Check Singaporean context
  if (responseLower.includes('lah') || responseLower.includes('singapore') || responseLower.includes('here')) {
    analysis.singaporeanContext = true;
  }
  
  // Check not salesy
  if (!responseLower.includes('amazing opportunity') && !responseLower.includes('don\'t miss out') && !responseLower.includes('limited time')) {
    analysis.notSalesy = true;
  }
  
  // Display results
  Object.entries(analysis).forEach(([criteria, passed]) => {
    const status = passed ? '✅' : '❌';
    const label = criteria.replace(/([A-Z])/g, ' $1').toLowerCase();
    console.log(`  ${status} ${label}`);
  });
  
  const score = Object.values(analysis).filter(Boolean).length / Object.keys(analysis).length;
  console.log(`\n  Personality Score: ${(score * 100).toFixed(1)}%`);
  
  if (score >= 0.8) {
    console.log('  🎉 EXCELLENT - Doro\'s authentic personality is working!');
  } else if (score >= 0.6) {
    console.log('  👍 GOOD - Some personality improvements needed');
  } else {
    console.log('  ⚠️  NEEDS WORK - Personality still too robotic');
  }
}

// Run the test
if (require.main === module) {
  testDoroPersonality().catch(console.error);
}

module.exports = testDoroPersonality;
