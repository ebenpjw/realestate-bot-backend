// Test the personality fix for insufficient data mode
const { BotService } = require('./services/botService');
const { DORO_PERSONALITY, getPersonalityPrompt, getStageGuidelines } = require('./config/personality');

console.log('🧪 Testing Personality Fix for Insufficient Data Mode\n');

// Test 1: Verify personality configuration is working
console.log('1️⃣ Testing personality configuration...');
try {
  const stageGuidelines = getStageGuidelines('rapport_building');
  const personalityPrompt = getPersonalityPrompt('rapport_building');
  
  console.log('✅ Stage guidelines loaded:', {
    priority: stageGuidelines.priority,
    tone: stageGuidelines.tone,
    examplesCount: stageGuidelines.examples?.length
  });
  
  console.log('✅ Personality prompt length:', personalityPrompt.length);
  console.log('✅ Conversation rules count:', Object.values(DORO_PERSONALITY.conversation.rules).length);
} catch (error) {
  console.error('❌ Personality configuration error:', error.message);
}

// Test 2: Test OpenAI call with new max_tokens setting
console.log('\n2️⃣ Testing OpenAI call with increased max_tokens...');

async function testOpenAICall() {
  try {
    const botService = new BotService();
    
    // Simulate the insufficient data mode prompt
    const stageGuidelines = getStageGuidelines('rapport_building');
    const personalityPrompt = getPersonalityPrompt('rapport_building');
    const userText = 'hello';
    const conversationHistory = '';

    const naturalPrompt = `
${personalityPrompt}

SITUATION: This is early conversation with insufficient data for strategic assumptions.
GOAL: ${stageGuidelines.priority}

CONVERSATION SO FAR:
${conversationHistory}

CURRENT MESSAGE: "${userText}"

APPROACH: ${stageGuidelines.approach}
AVOID: ${stageGuidelines.avoid}

EXAMPLES OF NATURAL RESPONSES:
${stageGuidelines.examples.map(ex => `- "${ex}"`).join('\n')}

CONVERSATION RULES:
${Object.values(DORO_PERSONALITY.conversation.rules).map(rule => `- ${rule}`).join('\n')}

Respond naturally and conversationally:`;

    console.log('📝 Prompt length:', naturalPrompt.length);
    console.log('🤖 Making OpenAI call with max_tokens: 400...');
    
    const response = await botService.openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: naturalPrompt }],
      temperature: 0.7,
      max_tokens: 400  // This is the key fix!
    });

    const aiResponse = response.choices[0].message.content;
    console.log('✅ OpenAI Response received!');
    console.log('📊 Response length:', aiResponse.length);
    console.log('💬 Response:', aiResponse);
    
    // Analyze the response quality
    const hasPersonality = aiResponse.includes('lah') || aiResponse.includes('eh') || aiResponse.includes('right') || aiResponse.includes('quite');
    const isNatural = aiResponse.length > 50 && !aiResponse.includes('I am an AI');
    const hasWarmth = aiResponse.includes('😊') || aiResponse.toLowerCase().includes('great') || aiResponse.toLowerCase().includes('nice');
    
    console.log('\n📈 Response Quality Analysis:');
    console.log('- Has Singlish/personality:', hasPersonality ? '✅' : '❌');
    console.log('- Natural length (>50 chars):', isNatural ? '✅' : '❌');
    console.log('- Shows warmth:', hasWarmth ? '✅' : '❌');
    
    if (isNatural && (hasPersonality || hasWarmth)) {
      console.log('\n🎉 SUCCESS: Response shows natural personality!');
    } else {
      console.log('\n⚠️ CONCERN: Response may still be too robotic');
    }
    
  } catch (error) {
    console.error('❌ OpenAI call failed:', error.message);
  }
}

// Test 3: Compare token limits
console.log('\n3️⃣ Token limit comparison:');
console.log('- OLD max_tokens: 150 (~100-120 words) - VERY CONSTRAINING');
console.log('- NEW max_tokens: 400 (~300-320 words) - ALLOWS NATURAL CONVERSATION');
console.log('- Strategic mode: 1200 tokens - FULL RESPONSES');

// Run the test
testOpenAICall().then(() => {
  console.log('\n✅ Personality fix test completed!');
}).catch(err => {
  console.error('\n❌ Test failed:', err.message);
});
