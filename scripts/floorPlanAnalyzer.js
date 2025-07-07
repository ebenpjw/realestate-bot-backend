/**
 * AI Floor Plan Analyzer
 * Uses GPT-4 Vision to analyze floor plans and extract detailed information
 */

const OpenAI = require('openai');
const fs = require('fs').promises;

class FloorPlanAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Analyze a single floor plan image
   */
  async analyzeFloorPlan(floorPlan, propertyName, propertyDetails = {}) {
    try {
      console.log(`🔍 Analyzing floor plan: ${floorPlan.name} for ${propertyName}`);

      const propertyContext = propertyDetails ? `
Property Details:
- Developer: ${propertyDetails.developer || 'Unknown'}
- Property Type: ${propertyDetails.propertyType || 'Private Condo'}
- District: ${propertyDetails.district || 'Unknown'}
- Tenure: ${propertyDetails.tenure || 'Unknown'}
- Size Range: ${propertyDetails.sizeRange || 'Unknown'}
- Units: ${propertyDetails.units || 'Unknown'}
- Completion: ${propertyDetails.completion || 'Unknown'}
` : '';

      const prompt = `Analyze this floor plan image and provide detailed information in JSON format.

Property: ${propertyName}
Floor Plan: ${floorPlan.name}
Stated Type: ${floorPlan.bedroomType}
${propertyContext}

Please analyze and return JSON with this exact structure:
{
  "bedrooms": number,
  "bathrooms": number,
  "study": boolean,
  "helper_room": boolean,
  "yard": boolean,
  "balcony": boolean,
  "patio": boolean,
  "penthouse_features": boolean,
  "kitchen_type": "open/closed/galley",
  "living_areas": number,
  "storage_rooms": number,
  "size_sqft": number (if visible on plan),
  "size_sqm": number (if visible on plan),
  "layout_type": "compact/spacious/linear/L-shaped/rectangular",
  "special_features": ["list", "of", "special", "features"],
  "description": "Detailed description for real estate bot",
  "tags": ["helper_room", "study", "yard", "penthouse", "etc"]
}

Focus on:
- Count actual bedrooms (not just stated type)
- Look for helper/maid rooms (usually small rooms near kitchen/service area)
- Identify study rooms (small rooms that could be office/den)
- Check for outdoor spaces (balconies, patios, yards)
- Note penthouse features (multiple levels, large terraces, premium finishes)
- Look for size annotations on the plan (sqft/sqm numbers)
- Assess layout efficiency and flow

Be precise and only mark features you can clearly see in the floor plan.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: floorPlan.url,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      });

      const analysisText = response.choices[0].message.content;
      
      // Extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Add metadata
      analysis.analyzed_at = new Date().toISOString();
      analysis.original_name = floorPlan.name;
      analysis.original_type = floorPlan.bedroomType;
      analysis.property_name = propertyName;
      analysis.ai_model = "gpt-4.1";

      console.log(`   ✅ Analysis complete: ${analysis.bedrooms}BR/${analysis.bathrooms}BA`);
      if (analysis.helper_room) console.log(`      🏠 Helper room detected`);
      if (analysis.study) console.log(`      📚 Study room detected`);
      if (analysis.yard || analysis.patio) console.log(`      🌿 Outdoor space detected`);

      return analysis;

    } catch (error) {
      console.log(`   ❌ Analysis failed for ${floorPlan.name}: ${error.message}`);
      
      // Return basic analysis based on existing data
      return {
        bedrooms: this.extractBedroomCount(floorPlan.bedroomType),
        bathrooms: 1, // Default assumption
        study: false,
        helper_room: false,
        yard: false,
        balcony: false,
        patio: false,
        penthouse_features: floorPlan.name.toLowerCase().includes('ph'),
        kitchen_type: "unknown",
        living_areas: 1,
        storage_rooms: 0,
        size_sqft: null,
        size_sqm: null,
        layout_type: "unknown",
        special_features: [],
        description: `${floorPlan.bedroomType} layout`,
        tags: [floorPlan.bedroomCount + "br"],
        analyzed_at: new Date().toISOString(),
        original_name: floorPlan.name,
        original_type: floorPlan.bedroomType,
        property_name: propertyName,
        ai_model: "fallback",
        error: error.message
      };
    }
  }

  /**
   * Analyze all floor plans for a property
   */
  async analyzePropertyFloorPlans(property) {
    console.log(`🏠 Analyzing ${property.floorPlans.length} floor plans for ${property.name}`);

    const analyzedFloorPlans = [];

    // Analyze ALL floor plans (no limit)
    const floorPlansToAnalyze = property.floorPlans;

    for (let i = 0; i < floorPlansToAnalyze.length; i++) {
      const floorPlan = floorPlansToAnalyze[i];

      console.log(`   🔍 Analyzing ${floorPlan.name} (${i + 1}/${floorPlansToAnalyze.length})`);

      try {
        const analysis = await this.analyzeFloorPlan(floorPlan, property.name, property);

        analyzedFloorPlans.push({
          ...floorPlan,
          aiAnalysis: analysis
        });

        // Small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.log(`   ⚠️ Skipping ${floorPlan.name}: ${error.message}`);

        // Add floor plan without AI analysis
        analyzedFloorPlans.push({
          ...floorPlan,
          aiAnalysis: null
        });
      }
    }

    console.log(`✅ Completed analysis for ${property.name}: ${analyzedFloorPlans.length} floor plans processed`);

    return {
      ...property,
      floorPlans: analyzedFloorPlans,
      aiAnalysisComplete: true,
      aiAnalysisDate: new Date().toISOString()
    };
  }

  /**
   * Extract bedroom count from text
   */
  extractBedroomCount(bedroomType) {
    if (!bedroomType) return 0;
    
    const text = bedroomType.toLowerCase();
    
    if (text.includes('studio')) return 0;
    if (text.includes('1 bedroom') || text.includes('1br')) return 1;
    if (text.includes('2 bedroom') || text.includes('2br')) return 2;
    if (text.includes('3 bedroom') || text.includes('3br')) return 3;
    if (text.includes('4 bedroom') || text.includes('4br')) return 4;
    if (text.includes('5 bedroom') || text.includes('5br')) return 5;
    
    // Try to extract number
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Generate smart search tags for a floor plan
   */
  generateSearchTags(analysis) {
    const tags = [];
    
    // Basic bedroom/bathroom tags
    tags.push(`${analysis.bedrooms}br`);
    tags.push(`${analysis.bathrooms}ba`);
    
    // Special features
    if (analysis.helper_room) tags.push('helper_room', 'maid_room');
    if (analysis.study) tags.push('study', 'office', 'den');
    if (analysis.yard) tags.push('yard', 'garden');
    if (analysis.patio) tags.push('patio', 'outdoor');
    if (analysis.balcony) tags.push('balcony');
    if (analysis.penthouse_features) tags.push('penthouse', 'luxury');
    
    // Layout tags
    if (analysis.layout_type !== 'unknown') tags.push(analysis.layout_type);
    
    // Size tags
    if (analysis.size_sqft) {
      if (analysis.size_sqft < 600) tags.push('compact');
      else if (analysis.size_sqft > 1200) tags.push('spacious');
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }
}

module.exports = FloorPlanAnalyzer;
