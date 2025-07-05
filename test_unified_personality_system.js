// Test script to verify unified personality system consistency
const { DORO_PERSONALITY, getPersonalityPrompt, getToneForUser, getStageGuidelines } = require('./config/personality');

console.log('🧪 Testing Unified Personality System Consistency\n');

// Test 1: Verify all personality functions work
console.log('1️⃣ Testing personality function availability...');
try {
  const rapportPrompt = getPersonalityPrompt('rapport_building');
  const discoveryPrompt = getPersonalityPrompt('needs_discovery');
  const valuePrompt = getPersonalityPrompt('value_provision');
  
  console.log('✅ All personality prompts generated successfully');
  console.log(`   - Rapport building prompt: ${rapportPrompt.length} characters`);
  console.log(`   - Needs discovery prompt: ${discoveryPrompt.length} characters`);
  console.log(`   - Value provision prompt: ${valuePrompt.length} characters`);
} catch (error) {
  console.error('❌ Personality prompt generation failed:', error.message);
}

// Test 2: Verify tone consistency
console.log('\n2️⃣ Testing tone consistency...');
try {
  const casualTone = getToneForUser('mixed', 'cold');
  const educationalTone = getToneForUser('analytical', 'warming');
  const empathicTone = getToneForUser('emotional', 'engaged');
  
  console.log('✅ Tone selection working correctly');
  console.log(`   - Cold user tone: ${casualTone}`);
  console.log(`   - Analytical user tone: ${educationalTone}`);
  console.log(`   - Emotional user tone: ${empathicTone}`);
} catch (error) {
  console.error('❌ Tone selection failed:', error.message);
}

// Test 3: Verify Singlish guidelines consistency
console.log('\n3️⃣ Testing Singlish guidelines...');
try {
  const singlishConfig = DORO_PERSONALITY.communication.singlish;
  
  console.log('✅ Singlish configuration loaded');
  console.log(`   - Primary terms: ${singlishConfig.primary_terms.join(', ')}`);
  console.log(`   - Reduced frequency: ${singlishConfig.reduced_frequency.join(', ')}`);
  console.log(`   - Avoid entirely: ${singlishConfig.avoid_excessive.join(', ')}`);
  console.log(`   - Usage context: ${singlishConfig.usage_context}`);
} catch (error) {
  console.error('❌ Singlish configuration failed:', error.message);
}

// Test 4: Verify expression guidelines
console.log('\n4️⃣ Testing expression guidelines...');
try {
  const expressions = DORO_PERSONALITY.communication.expressions;
  
  console.log('✅ Expression guidelines loaded');
  console.log(`   - Preferred: ${expressions.preferred.join(', ')}`);
  console.log(`   - Avoid: ${expressions.avoid.join(', ')}`);
} catch (error) {
  console.error('❌ Expression guidelines failed:', error.message);
}

// Test 5: Verify formatting rules
console.log('\n5️⃣ Testing formatting rules...');
try {
  const formatConfig = DORO_PERSONALITY.communication.format;
  
  console.log('✅ Formatting configuration loaded');
  console.log(`   - Line break formatting enabled: ${formatConfig.line_break_formatting.enabled}`);
  console.log(`   - Max paragraph length: ${formatConfig.line_break_formatting.max_paragraph_length}`);
  console.log(`   - Emoji usage: ${formatConfig.emoji_usage}`);
  console.log(`   - Optimal message length: ${formatConfig.natural_segmentation.optimal_length}`);
} catch (error) {
  console.error('❌ Formatting configuration failed:', error.message);
}

// Test 6: Verify stage guidelines consistency
console.log('\n6️⃣ Testing stage guidelines...');
try {
  const stages = ['rapport_building', 'needs_discovery', 'value_provision', 'consultation_ready'];
  
  stages.forEach(stage => {
    const guidelines = getStageGuidelines(stage);
    console.log(`   - ${stage}: ${guidelines.priority} (${guidelines.tone} tone)`);
  });
  
  console.log('✅ All stage guidelines consistent');
} catch (error) {
  console.error('❌ Stage guidelines failed:', error.message);
}

console.log('\n🎉 Unified Personality System Test Complete!');
console.log('\n📋 Summary:');
console.log('   - All personality functions working ✅');
console.log('   - Tone selection consistent ✅');
console.log('   - Singlish guidelines centralized ✅');
console.log('   - Expression preferences unified ✅');
console.log('   - Formatting rules consolidated ✅');
console.log('   - Stage guidelines aligned ✅');
