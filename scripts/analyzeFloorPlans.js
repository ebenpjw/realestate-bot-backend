/**
 * Analyze Floor Plans with AI
 * Processes scraped property data and adds AI analysis to floor plans
 */

require('dotenv').config();
const fs = require('fs').promises;
const FloorPlanAnalyzer = require('./floorPlanAnalyzer');

async function analyzeFloorPlans() {
  try {
    console.log('🤖 Starting AI Floor Plan Analysis...\n');

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not found in environment variables');
      console.log('Please add your OpenAI API key to the .env file:');
      console.log('OPENAI_API_KEY=your_api_key_here');
      return;
    }

    // Load scraped property data
    console.log('📂 Loading scraped property data...');
    const scrapedData = await fs.readFile('scraped-properties.json', 'utf8');
    const properties = JSON.parse(scrapedData);
    
    console.log(`✅ Loaded ${properties.length} properties\n`);

    // Initialize AI analyzer
    const analyzer = new FloorPlanAnalyzer();

    // Process each property
    const analyzedProperties = [];
    
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      
      console.log(`🏠 Processing ${property.name} (${i + 1}/${properties.length})`);
      console.log(`   📐 ${property.floorPlans?.length || 0} floor plans to analyze`);
      
      if (!property.floorPlans || property.floorPlans.length === 0) {
        console.log('   ⚠️ No floor plans found, skipping...\n');
        analyzedProperties.push(property);
        continue;
      }

      try {
        // Analyze floor plans for this property
        const analyzedProperty = await analyzer.analyzePropertyFloorPlans(property);
        analyzedProperties.push(analyzedProperty);
        
        console.log(`   ✅ Analysis complete for ${property.name}\n`);
        
      } catch (error) {
        console.log(`   ❌ Failed to analyze ${property.name}: ${error.message}\n`);
        analyzedProperties.push(property);
      }
    }

    // Save analyzed data
    console.log('💾 Saving analyzed data...');
    const outputFile = 'analyzed-properties.json';
    await fs.writeFile(outputFile, JSON.stringify(analyzedProperties, null, 2));
    console.log(`✅ Saved to ${outputFile}`);

    // Generate summary report
    console.log('\n📊 Analysis Summary:');
    console.log('===================');
    
    let totalFloorPlans = 0;
    let analyzedFloorPlans = 0;
    let helperRooms = 0;
    let studyRooms = 0;
    let outdoorSpaces = 0;
    let penthouses = 0;

    analyzedProperties.forEach(property => {
      if (property.floorPlans) {
        totalFloorPlans += property.floorPlans.length;
        
        property.floorPlans.forEach(fp => {
          if (fp.aiAnalysis) {
            analyzedFloorPlans++;
            if (fp.aiAnalysis.helper_room) helperRooms++;
            if (fp.aiAnalysis.study) studyRooms++;
            if (fp.aiAnalysis.yard || fp.aiAnalysis.patio || fp.aiAnalysis.balcony) outdoorSpaces++;
            if (fp.aiAnalysis.penthouse_features) penthouses++;
          }
        });
      }
    });

    console.log(`📋 Total Properties: ${analyzedProperties.length}`);
    console.log(`📐 Total Floor Plans: ${totalFloorPlans}`);
    console.log(`🤖 AI Analyzed: ${analyzedFloorPlans}`);
    console.log(`🏠 Helper Rooms Found: ${helperRooms}`);
    console.log(`📚 Study Rooms Found: ${studyRooms}`);
    console.log(`🌿 Outdoor Spaces Found: ${outdoorSpaces}`);
    console.log(`🏆 Penthouse Features: ${penthouses}`);

    // Generate search examples
    console.log('\n🔍 Search Examples:');
    console.log('==================');
    console.log('Bot can now handle queries like:');
    console.log('• "Show me 2-bedroom units with helper room"');
    console.log('• "I need a study room for working from home"');
    console.log('• "Do you have units with outdoor space?"');
    console.log('• "Show me penthouse options"');
    console.log('• "I don\'t want a study room, just bedrooms"');

    console.log('\n🎉 AI Floor Plan Analysis Complete!');

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    console.error(error.stack);
  }
}

// Run if called directly
if (require.main === module) {
  analyzeFloorPlans();
}

module.exports = { analyzeFloorPlans };
