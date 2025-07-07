/**
 * Test AI Floor Plan Analysis with one floor plan
 */

require('dotenv').config();
const FloorPlanAnalyzer = require('./floorPlanAnalyzer');

async function testAIAnalysis() {
  try {
    console.log('🤖 Testing AI Floor Plan Analysis...\n');

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not found in environment variables');
      return;
    }

    // Initialize AI analyzer
    const analyzer = new FloorPlanAnalyzer();

    // Test with one floor plan from 10 Evelyn
    const testFloorPlan = {
      name: 'A4',
      bedroomType: '1 Bedroom',
      bedroomCount: '1',
      url: 'https://img.singmap.com/upload/broke/77bca671819a4ee69063f560fa734361/b4323957827046808662cfed12d9b211/floorPlanImg/A4.jpg',
      type: 'floor_plan'
    };

    console.log('🔍 Testing with floor plan:', testFloorPlan.name);
    console.log('📐 Type:', testFloorPlan.bedroomType);
    console.log('🔗 URL:', testFloorPlan.url);
    console.log('');

    // Analyze the floor plan
    const analysis = await analyzer.analyzeFloorPlan(testFloorPlan, '10 Evelyn');

    console.log('\n📊 AI Analysis Results:');
    console.log('======================');
    console.log(`🏠 Property: ${analysis.property_name}`);
    console.log(`📐 Floor Plan: ${analysis.original_name} (${analysis.original_type})`);
    console.log(`🛏️ Bedrooms: ${analysis.bedrooms}`);
    console.log(`🚿 Bathrooms: ${analysis.bathrooms}`);
    console.log(`📚 Study Room: ${analysis.study ? 'Yes' : 'No'}`);
    console.log(`🏠 Helper Room: ${analysis.helper_room ? 'Yes' : 'No'}`);
    console.log(`🌿 Outdoor Space: ${analysis.yard || analysis.patio || analysis.balcony ? 'Yes' : 'No'}`);
    console.log(`🏆 Penthouse Features: ${analysis.penthouse_features ? 'Yes' : 'No'}`);
    console.log(`📏 Layout Type: ${analysis.layout_type}`);
    console.log(`🍳 Kitchen Type: ${analysis.kitchen_type}`);
    
    if (analysis.size_sqft) {
      console.log(`📐 Size: ${analysis.size_sqft} sqft`);
    }
    if (analysis.size_sqm) {
      console.log(`📐 Size: ${analysis.size_sqm} sqm`);
    }

    console.log(`\n📝 Description: ${analysis.description}`);
    console.log(`🏷️ Tags: ${analysis.tags.join(', ')}`);
    console.log(`🤖 AI Model: ${analysis.ai_model}`);

    // Generate search tags
    const searchTags = analyzer.generateSearchTags(analysis);
    console.log(`\n🔍 Search Tags: ${searchTags.join(', ')}`);

    // Save result
    const fs = require('fs').promises;
    await fs.writeFile('test-ai-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\n💾 Analysis saved to test-ai-analysis.json');

    console.log('\n🎉 AI Analysis Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testAIAnalysis();
