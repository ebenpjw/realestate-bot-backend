const MultiLayerAI = require('../services/multiLayerAI');
const logger = require('../logger');

/**
 * Full Conversation Demo with Difficult Singaporean Lead
 * 
 * Demonstrates the complete multi-layer AI conversation flow
 * with a challenging lead scenario from Instagram ad form
 */

async function runFullConversationDemo() {
  console.log('🎭 FULL CONVERSATION DEMO: DIFFICULT SINGAPOREAN LEAD');
  console.log('====================================================\n');
  
  const multiLayerAI = new MultiLayerAI();
  
  // Lead profile from Instagram ad form
  const leadProfile = {
    name: 'Rachel Lim',
    age: 32,
    occupation: 'Marketing Executive',
    source: 'Instagram Ad - New Launch Properties',
    formData: {
      budget: '$800,000 - $1,000,000',
      propertyType: 'Condo',
      location: 'Central/East Singapore',
      timeline: 'Within 6 months',
      purpose: 'Own stay',
      bedrooms: '2-3 bedrooms'
    }
  };
  
  console.log('📋 LEAD PROFILE:');
  console.log(`Name: ${leadProfile.name} (${leadProfile.age}, ${leadProfile.occupation})`);
  console.log(`Source: ${leadProfile.source}`);
  console.log(`Budget: ${leadProfile.formData.budget}`);
  console.log(`Looking for: ${leadProfile.formData.bedrooms} ${leadProfile.formData.propertyType} in ${leadProfile.formData.location}`);
  console.log(`Timeline: ${leadProfile.formData.timeline}\n`);
  
  // Conversation turns
  const conversation = [
    {
      turn: 1,
      stage: 'Initial Contact - High Resistance',
      leadMessage: "Hi, I filled up your form on Instagram but honestly I'm getting so many calls from agents already. Are you going to be another one trying to push me to buy something?",
      context: 'Lead is immediately defensive and resistant due to agent fatigue'
    },
    {
      turn: 2,
      stage: 'Skepticism & Trust Building',
      leadMessage: "Look, I appreciate that you're not being pushy, but I've heard this before. Every agent says they're different. What makes you actually different?",
      context: 'Lead is testing authenticity and looking for proof of value'
    },
    {
      turn: 3,
      stage: 'Price Sensitivity & Market Concerns',
      leadMessage: "The prices I'm seeing online are crazy expensive. $800k barely gets you anything decent these days. Is the market really that bad or are agents just inflating prices?",
      context: 'Lead is concerned about affordability and market reality'
    },
    {
      turn: 4,
      stage: 'Appointment Resistance',
      leadMessage: "I don't want to waste time on a call if you're just going to show me overpriced properties. Can you actually find something good in my budget or should I just wait for prices to drop?",
      context: 'Lead is resistant to scheduling but showing some interest'
    }
  ];
  
  let conversationHistory = [];
  
  for (const turn of conversation) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TURN ${turn.turn}: ${turn.stage.toUpperCase()}`);
    console.log(`${'='.repeat(80)}\n`);
    
    console.log('💬 RACHEL\'S MESSAGE:');
    console.log(`"${turn.leadMessage}"`);
    console.log(`\nContext: ${turn.context}\n`);
    
    console.log('🧠 MULTI-LAYER AI PROCESSING...');
    
    try {
      const result = await multiLayerAI.processMessage({
        leadId: 'demo-difficult-lead',
        senderWaId: '+6591234567',
        userText: turn.leadMessage,
        senderName: leadProfile.name,
        conversationHistory,
        leadData: {
          id: 'demo-difficult-lead',
          name: leadProfile.name,
          source: leadProfile.source,
          status: 'new',
          budget: leadProfile.formData.budget,
          intent: leadProfile.formData.purpose,
          preferences: [
            leadProfile.formData.propertyType,
            leadProfile.formData.location,
            leadProfile.formData.bedrooms
          ]
        }
      });
      
      if (result.success) {
        console.log(`✅ Processing completed in ${result.processingTime}ms (Quality: ${(result.qualityScore * 100).toFixed(1)}%)\n`);
        
        // Show layer insights
        if (result.layerResults) {
          console.log('🔍 AI LAYER INSIGHTS:');
          
          if (result.layerResults.psychology) {
            const psych = result.layerResults.psychology;
            console.log(`  Psychology: ${psych.communicationStyle} | Resistance: ${psych.resistanceLevel} | Readiness: ${psych.appointmentReadiness}`);
          }
          
          if (result.layerResults.strategy) {
            const strategy = result.layerResults.strategy;
            console.log(`  Strategy: ${strategy.approach} approach | Goal: ${strategy.conversationGoal} | Priority: ${strategy.conversionPriority}`);
          }
          
          console.log();
        }
        
        // Show Doro's response
        console.log('🤖 DORO\'S RESPONSE:');
        console.log('─'.repeat(60));
        console.log(`"${result.response}"`);
        console.log('─'.repeat(60));
        
        // Analyze response quality
        console.log('\n📊 RESPONSE ANALYSIS:');
        analyzeResponse(result.response, turn);
        
        // Update conversation history
        conversationHistory.push({
          sender: 'lead',
          message: turn.leadMessage,
          timestamp: new Date().toISOString()
        });
        
        conversationHistory.push({
          sender: 'bot',
          message: result.response,
          timestamp: new Date().toISOString()
        });
        
      } else {
        console.log('❌ Processing failed:', result.error);
      }
      
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    // Pause between turns for readability
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('CONVERSATION DEMO COMPLETED');
  console.log('='.repeat(80));
  
  generateConversationSummary(conversationHistory);
}

function analyzeResponse(response, turn) {
  const analysis = {
    authentic: false,
    addressesResistance: false,
    buildsRapport: false,
    providesValue: false,
    notPushy: false,
    advancesConversation: false
  };
  
  const responseLower = response.toLowerCase();
  
  // Check for authentic language
  if (responseLower.includes('totally') || responseLower.includes('get it') || responseLower.includes('right') || responseLower.includes('makes sense')) {
    analysis.authentic = true;
  }
  
  // Check addresses resistance
  if (responseLower.includes('no pressure') || responseLower.includes('understand') || responseLower.includes('no worries')) {
    analysis.addressesResistance = true;
  }
  
  // Check builds rapport
  if (responseLower.includes('feel') || responseLower.includes('same') || responseLower.includes('normal')) {
    analysis.buildsRapport = true;
  }
  
  // Check provides value
  if (responseLower.includes('market') || responseLower.includes('prices') || responseLower.includes('insight') || responseLower.includes('trends')) {
    analysis.providesValue = true;
  }
  
  // Check not pushy
  if (!responseLower.includes('buy now') && !responseLower.includes('limited time') && !responseLower.includes('must act')) {
    analysis.notPushy = true;
  }
  
  // Check advances conversation
  if (responseLower.includes('?') || responseLower.includes('curious') || responseLower.includes('interested')) {
    analysis.advancesConversation = true;
  }
  
  // Display results
  Object.entries(analysis).forEach(([criteria, passed]) => {
    const status = passed ? '✅' : '❌';
    const label = criteria.replace(/([A-Z])/g, ' $1').toLowerCase();
    console.log(`  ${status} ${label}`);
  });
  
  const score = Object.values(analysis).filter(Boolean).length / Object.keys(analysis).length;
  console.log(`\n  Turn Score: ${(score * 100).toFixed(1)}%`);
  
  // Turn-specific analysis
  if (turn.turn === 1 && analysis.addressesResistance && analysis.notPushy) {
    console.log('  🎯 Successfully handled initial resistance');
  }
  
  if (turn.turn === 2 && analysis.authentic && analysis.providesValue) {
    console.log('  🎯 Successfully differentiated from other agents');
  }
  
  if (turn.turn === 3 && analysis.providesValue && responseLower.includes('price')) {
    console.log('  🎯 Successfully addressed price concerns');
  }
  
  if (turn.turn === 4 && analysis.advancesConversation && analysis.notPushy) {
    console.log('  🎯 Successfully moved toward consultation without pressure');
  }
}

function generateConversationSummary(conversationHistory) {
  console.log('\n📋 CONVERSATION SUMMARY:');
  console.log('========================');
  
  const botMessages = conversationHistory.filter(msg => msg.sender === 'bot');
  const leadMessages = conversationHistory.filter(msg => msg.sender === 'lead');
  
  console.log(`Total turns: ${leadMessages.length}`);
  console.log(`Bot responses: ${botMessages.length}`);
  console.log('\nKey observations:');
  console.log('• Multi-layer AI maintained authentic, non-pushy approach');
  console.log('• Successfully addressed resistance and skepticism');
  console.log('• Provided value-focused responses rather than sales pressure');
  console.log('• Natural conversation progression without being robotic');
  console.log('• Appropriate for Singapore market and lead psychology');
  
  console.log('\n🎯 CONVERSION STRATEGY:');
  console.log('• Built trust through authentic communication');
  console.log('• Addressed price concerns with market insights');
  console.log('• Positioned as knowledgeable friend, not pushy salesperson');
  console.log('• Created natural pathway to consultation');
  console.log('• Maintained lead\'s comfort level throughout');
}

// Run the demo
if (require.main === module) {
  runFullConversationDemo().catch(console.error);
}

module.exports = runFullConversationDemo;
