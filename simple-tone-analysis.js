// Simple Tone Analysis - Analyzes the current bot prompt and provides recommendations

const fs = require('fs');
const path = require('path');

// Extract the current bot prompt from botService.js
function extractCurrentPrompt() {
  try {
    const botServicePath = path.join(__dirname, 'services', 'botService.js');
    const content = fs.readFileSync(botServicePath, 'utf8');
    
    // Find the _buildPrompt method
    const promptStart = content.indexOf('return `');
    const promptEnd = content.indexOf('`;', promptStart);
    
    if (promptStart === -1 || promptEnd === -1) {
      throw new Error('Could not find prompt in botService.js');
    }
    
    const promptContent = content.substring(promptStart + 8, promptEnd);
    return promptContent;
  } catch (error) {
    console.error('Error extracting prompt:', error.message);
    return null;
  }
}

// Analyze the tone characteristics of the prompt
function analyzePromptTone(prompt) {
  const analysis = {
    personality_traits: [],
    tone_indicators: [],
    language_style: [],
    potential_issues: [],
    strengths: []
  };

  // Check for personality traits
  if (prompt.includes('28-year-old Singaporean Chinese girl')) {
    analysis.personality_traits.push('Specific age and cultural background defined');
  }
  if (prompt.includes('naturally curious')) {
    analysis.personality_traits.push('Curiosity emphasized');
  }
  if (prompt.includes('genuinely interested in people')) {
    analysis.personality_traits.push('People-focused approach');
  }
  if (prompt.includes('not a sales bot')) {
    analysis.personality_traits.push('Anti-sales positioning');
  }

  // Check for tone indicators
  if (prompt.includes('casual but professional')) {
    analysis.tone_indicators.push('Balanced casual-professional tone');
  }
  if (prompt.includes('Cool", "Nice", "Got it"')) {
    analysis.tone_indicators.push('Specific casual language examples provided');
  }
  if (prompt.includes('helpful without being pushy')) {
    analysis.tone_indicators.push('Non-pushy helpfulness');
  }

  // Check language style
  if (prompt.includes('simple, everyday language')) {
    analysis.language_style.push('Emphasis on simplicity');
  }
  if (prompt.includes('sounds natural')) {
    analysis.language_style.push('Naturalness prioritized');
  }
  if (prompt.includes('Singaporean')) {
    analysis.language_style.push('Local cultural context');
  }

  // Identify potential issues
  if (prompt.includes('builds rapport before suggesting')) {
    analysis.strengths.push('Rapport-building prioritized');
  } else {
    analysis.potential_issues.push('No explicit rapport-building guidance');
  }

  if (!prompt.includes('empathy') && !prompt.includes('understanding')) {
    analysis.potential_issues.push('Limited empathy guidance');
  }

  if (!prompt.includes('emoji') && !prompt.includes('😊')) {
    analysis.potential_issues.push('No emoji usage guidance');
  }

  if (prompt.includes('temperature: 0.5')) {
    analysis.potential_issues.push('Moderate temperature may limit personality expression');
  }

  return analysis;
}

// Generate tone improvement recommendations
function generateToneRecommendations(analysis) {
  const recommendations = {
    immediate_improvements: [],
    personality_enhancements: [],
    language_refinements: [],
    engagement_boosters: []
  };

  // Immediate improvements
  if (analysis.potential_issues.includes('No emoji usage guidance')) {
    recommendations.immediate_improvements.push({
      issue: 'No emoji guidance',
      solution: 'Add specific emoji usage instructions for warmth and friendliness',
      example: 'Use emojis sparingly but effectively: 😊 for warmth, 🏠 for property topics'
    });
  }

  if (analysis.potential_issues.includes('Limited empathy guidance')) {
    recommendations.immediate_improvements.push({
      issue: 'Limited empathy instructions',
      solution: 'Add empathy and emotional intelligence guidelines',
      example: 'Acknowledge emotions: "I understand that can feel overwhelming" or "That\'s exciting!"'
    });
  }

  // Personality enhancements
  recommendations.personality_enhancements.push({
    area: 'Authenticity',
    suggestion: 'Add more specific Singaporean context and local knowledge',
    example: 'Reference local areas, property types (HDB, condo), and market conditions'
  });

  recommendations.personality_enhancements.push({
    area: 'Conversational flow',
    suggestion: 'Add guidance for natural conversation transitions',
    example: 'Use bridging phrases like "Speaking of which..." or "That reminds me..."'
  });

  // Language refinements
  recommendations.language_refinements.push({
    area: 'Casual expressions',
    suggestion: 'Expand the list of casual expressions with more Singaporean flavor',
    example: 'Add: "Sounds good!", "No worries!", "That works!", "Perfect!"'
  });

  recommendations.language_refinements.push({
    area: 'Question variety',
    suggestion: 'Provide more varied ways to ask questions',
    example: 'Instead of just "What are you looking for?", use "What\'s your dream place like?" or "Tell me about your ideal home"'
  });

  // Engagement boosters
  recommendations.engagement_boosters.push({
    area: 'Enthusiasm',
    suggestion: 'Add more enthusiasm and excitement expressions',
    example: 'Use phrases like "That\'s so exciting!", "I love helping with that!", "Perfect timing!"'
  });

  recommendations.engagement_boosters.push({
    area: 'Personal touch',
    suggestion: 'Add guidance for personalizing responses based on user context',
    example: 'Reference previous conversation points and show you remember details'
  });

  return recommendations;
}

// Analyze current fallback messages
function analyzeFallbackMessages() {
  const fallbacks = [
    "Sorry, I had a slight issue there. Could you say that again?",
    "Eh sorry, can you try again?"
  ];

  const analysis = {
    current_fallbacks: fallbacks,
    tone_assessment: {
      friendliness: 6, // out of 10
      naturalness: 7,
      professionalism: 5,
      local_flavor: 8 // "Eh sorry" is very Singaporean
    },
    recommendations: [
      "Add more variety to fallback messages",
      "Include more warm and apologetic tone",
      "Consider context-specific fallbacks"
    ],
    suggested_alternatives: [
      "Oops, I got a bit confused there! Could you say that again?",
      "Sorry about that! Can you help me understand what you meant?",
      "My bad! Let me try to help you better - could you rephrase that?",
      "Hmm, I didn't quite catch that. Mind saying it differently?"
    ]
  };

  return analysis;
}

// Main analysis function
function runToneAnalysis() {
  console.log('🎭 BOT TONE ANALYSIS REPORT');
  console.log('============================\n');

  // Extract and analyze current prompt
  const prompt = extractCurrentPrompt();
  if (!prompt) {
    console.log('❌ Could not extract prompt for analysis');
    return;
  }

  console.log('📝 CURRENT PROMPT ANALYSIS');
  console.log('---------------------------');
  
  const promptAnalysis = analyzePromptTone(prompt);
  
  console.log('\n✅ STRENGTHS:');
  promptAnalysis.strengths.forEach(strength => {
    console.log(`   • ${strength}`);
  });
  
  console.log('\n⚠️  POTENTIAL ISSUES:');
  promptAnalysis.potential_issues.forEach(issue => {
    console.log(`   • ${issue}`);
  });

  console.log('\n🎯 PERSONALITY TRAITS:');
  promptAnalysis.personality_traits.forEach(trait => {
    console.log(`   • ${trait}`);
  });

  console.log('\n🗣️  TONE INDICATORS:');
  promptAnalysis.tone_indicators.forEach(indicator => {
    console.log(`   • ${indicator}`);
  });

  console.log('\n📖 LANGUAGE STYLE:');
  promptAnalysis.language_style.forEach(style => {
    console.log(`   • ${style}`);
  });

  // Generate recommendations
  const recommendations = generateToneRecommendations(promptAnalysis);

  console.log('\n\n💡 IMPROVEMENT RECOMMENDATIONS');
  console.log('================================\n');

  console.log('🚀 IMMEDIATE IMPROVEMENTS:');
  recommendations.immediate_improvements.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.issue}`);
    console.log(`   Solution: ${rec.solution}`);
    console.log(`   Example: ${rec.example}\n`);
  });

  console.log('👤 PERSONALITY ENHANCEMENTS:');
  recommendations.personality_enhancements.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.area}`);
    console.log(`   Suggestion: ${rec.suggestion}`);
    console.log(`   Example: ${rec.example}\n`);
  });

  console.log('🗣️  LANGUAGE REFINEMENTS:');
  recommendations.language_refinements.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.area}`);
    console.log(`   Suggestion: ${rec.suggestion}`);
    console.log(`   Example: ${rec.example}\n`);
  });

  console.log('🎉 ENGAGEMENT BOOSTERS:');
  recommendations.engagement_boosters.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.area}`);
    console.log(`   Suggestion: ${rec.suggestion}`);
    console.log(`   Example: ${rec.example}\n`);
  });

  // Analyze fallback messages
  console.log('\n📱 FALLBACK MESSAGE ANALYSIS');
  console.log('-----------------------------');
  
  const fallbackAnalysis = analyzeFallbackMessages();
  
  console.log('\nCurrent fallback messages:');
  fallbackAnalysis.current_fallbacks.forEach((msg, index) => {
    console.log(`${index + 1}. "${msg}"`);
  });

  console.log('\nTone Assessment:');
  Object.entries(fallbackAnalysis.tone_assessment).forEach(([aspect, score]) => {
    if (typeof score === 'number') {
      console.log(`   ${aspect}: ${score}/10`);
    } else {
      console.log(`   ${aspect}: ${score}`);
    }
  });

  console.log('\nSuggested alternatives:');
  fallbackAnalysis.suggested_alternatives.forEach((msg, index) => {
    console.log(`${index + 1}. "${msg}"`);
  });

  console.log('\n\n🎯 OVERALL ASSESSMENT');
  console.log('======================');
  console.log('The bot has a solid foundation with:');
  console.log('✅ Clear personality definition (28-year-old Singaporean)');
  console.log('✅ Anti-sales positioning');
  console.log('✅ Local cultural context');
  console.log('✅ Casual but professional tone');
  
  console.log('\nKey areas for improvement:');
  console.log('🔧 Add more emotional intelligence and empathy');
  console.log('🔧 Include emoji usage guidelines');
  console.log('🔧 Expand casual expression vocabulary');
  console.log('🔧 Add more enthusiasm and excitement');
  console.log('🔧 Improve conversation flow and transitions');

  return {
    promptAnalysis,
    recommendations,
    fallbackAnalysis
  };
}

// Run analysis if called directly
if (require.main === module) {
  runToneAnalysis();
}

module.exports = {
  runToneAnalysis,
  analyzePromptTone,
  generateToneRecommendations,
  analyzeFallbackMessages
};
