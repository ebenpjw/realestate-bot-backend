const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');
const supabase = require('../supabaseClient');

class VisualAnalysisService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      timeout: 60000, // 60 seconds for vision analysis
      maxRetries: 2
    });
  }

  /**
   * Analyze floor plan image using GPT-4 Vision
   */
  async analyzeFloorPlan(visualAssetId, imageUrl) {
    try {
      logger.info({ visualAssetId, imageUrl }, 'Starting floor plan analysis');

      const prompt = `Analyze this floor plan image and extract the following information:

1. Room count and types (bedrooms, bathrooms, living areas, kitchen, etc.)
2. Layout type (open concept, traditional, split level, etc.)
3. Approximate square footage if visible
4. Key features (balcony, study room, storage, etc.)
5. Overall layout description
6. Suitability for different family types

Please provide a structured response with:
- Room count breakdown
- Layout classification
- Key features list
- Natural language description
- Family suitability assessment

Be specific and detailed in your analysis.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      const analysisText = response.choices[0].message.content;
      const tokensUsed = response.usage?.total_tokens || 0;

      // Parse the analysis to extract structured data
      const structuredData = this.parseFloorPlanAnalysis(analysisText);

      // Save analysis to database
      const { data: analysis, error } = await supabase
        .from('ai_visual_analysis')
        .insert({
          visual_asset_id: visualAssetId,
          analysis_type: 'floor_plan_analysis',
          ai_model: 'gpt-4-vision-preview',
          confidence_score: structuredData.confidence || 0.8,
          extracted_data: structuredData,
          room_count: structuredData.totalRooms,
          layout_type: structuredData.layoutType,
          square_footage: structuredData.squareFootage,
          key_features: structuredData.keyFeatures,
          description: analysisText,
          summary: structuredData.summary,
          tokens_used: tokensUsed,
          processing_time_ms: Date.now() - Date.now() // Will be calculated properly
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save analysis: ${error.message}`);
      }

      logger.info({
        visualAssetId,
        analysisId: analysis.id,
        roomCount: structuredData.totalRooms,
        layoutType: structuredData.layoutType
      }, 'Floor plan analysis completed');

      return analysis;

    } catch (error) {
      logger.error({
        err: error,
        visualAssetId,
        imageUrl
      }, 'Floor plan analysis failed');
      throw error;
    }
  }

  /**
   * Analyze brochure or document using GPT-4 Vision
   */
  async analyzeBrochure(visualAssetId, imageUrl) {
    try {
      logger.info({ visualAssetId, imageUrl }, 'Starting brochure analysis');

      const prompt = `Analyze this property brochure/document and extract key information:

1. Property details (name, developer, location)
2. Unit types and pricing information
3. Amenities and facilities mentioned
4. Key selling points and features
5. Timeline information (launch date, TOP, etc.)
6. Contact information or sales details

Please provide structured information that would be useful for a real estate agent to discuss with potential buyers.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1200,
        temperature: 0.3
      });

      const analysisText = response.choices[0].message.content;
      const tokensUsed = response.usage?.total_tokens || 0;

      // Parse brochure analysis
      const structuredData = this.parseBrochureAnalysis(analysisText);

      // Save analysis to database
      const { data: analysis, error } = await supabase
        .from('ai_visual_analysis')
        .insert({
          visual_asset_id: visualAssetId,
          analysis_type: 'brochure_text_extraction',
          ai_model: 'gpt-4-vision-preview',
          confidence_score: structuredData.confidence || 0.8,
          extracted_data: structuredData,
          key_features: structuredData.keyFeatures,
          description: analysisText,
          summary: structuredData.summary,
          tokens_used: tokensUsed
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save brochure analysis: ${error.message}`);
      }

      logger.info({
        visualAssetId,
        analysisId: analysis.id,
        featuresFound: structuredData.keyFeatures?.length || 0
      }, 'Brochure analysis completed');

      return analysis;

    } catch (error) {
      logger.error({
        err: error,
        visualAssetId,
        imageUrl
      }, 'Brochure analysis failed');
      throw error;
    }
  }

  /**
   * Parse floor plan analysis text into structured data
   */
  parseFloorPlanAnalysis(analysisText) {
    const data = {
      totalRooms: 0,
      bedrooms: 0,
      bathrooms: 0,
      layoutType: 'Unknown',
      keyFeatures: [],
      squareFootage: null,
      summary: '',
      confidence: 0.8
    };

    try {
      // Extract room counts using regex patterns
      const bedroomMatch = analysisText.match(/(\d+)\s*bedroom/i);
      if (bedroomMatch) data.bedrooms = parseInt(bedroomMatch[1]);

      const bathroomMatch = analysisText.match(/(\d+)\s*bathroom/i);
      if (bathroomMatch) data.bathrooms = parseInt(bathroomMatch[1]);

      // Extract layout type
      const layoutPatterns = [
        /open\s+concept/i,
        /traditional/i,
        /split\s+level/i,
        /studio/i,
        /loft/i
      ];

      for (const pattern of layoutPatterns) {
        const match = analysisText.match(pattern);
        if (match) {
          data.layoutType = match[0];
          break;
        }
      }

      // Extract square footage
      const sqftMatch = analysisText.match(/(\d+)\s*(?:sq\s*ft|sqft|square\s*feet)/i);
      if (sqftMatch) data.squareFootage = parseInt(sqftMatch[1]);

      // Extract key features
      const featureKeywords = [
        'balcony', 'study', 'storage', 'walk-in', 'ensuite', 'kitchen island',
        'dining area', 'living room', 'master bedroom', 'utility room'
      ];

      data.keyFeatures = featureKeywords.filter(feature => 
        new RegExp(feature, 'i').test(analysisText)
      );

      // Calculate total rooms
      data.totalRooms = data.bedrooms + data.bathrooms + 
        (analysisText.toLowerCase().includes('living') ? 1 : 0) +
        (analysisText.toLowerCase().includes('kitchen') ? 1 : 0);

      // Generate summary
      data.summary = `${data.bedrooms}BR ${data.bathrooms}BA ${data.layoutType} layout`;
      if (data.squareFootage) {
        data.summary += ` (${data.squareFootage} sqft)`;
      }

    } catch (error) {
      logger.error({ err: error }, 'Error parsing floor plan analysis');
    }

    return data;
  }

  /**
   * Parse brochure analysis text into structured data
   */
  parseBrochureAnalysis(analysisText) {
    const data = {
      propertyName: '',
      developer: '',
      location: '',
      unitTypes: [],
      amenities: [],
      keyFeatures: [],
      priceRange: {},
      timeline: {},
      summary: '',
      confidence: 0.8
    };

    try {
      // Extract property name (usually in quotes or title case)
      const nameMatch = analysisText.match(/"([^"]+)"|([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      if (nameMatch) data.propertyName = nameMatch[1] || nameMatch[2];

      // Extract developer
      const devMatch = analysisText.match(/developer[:\s]+([^\n,]+)/i);
      if (devMatch) data.developer = devMatch[1].trim();

      // Extract amenities
      const amenityKeywords = [
        'swimming pool', 'gym', 'playground', 'bbq', 'function room',
        'tennis court', 'basketball court', 'jogging track', 'garden',
        'clubhouse', 'security', 'parking', 'lift'
      ];

      data.amenities = amenityKeywords.filter(amenity => 
        new RegExp(amenity, 'i').test(analysisText)
      );

      // Extract key features from common real estate terms
      const featureKeywords = [
        'freehold', '99 years', 'leasehold', 'new launch', 'TOP',
        'near MRT', 'city fringe', 'good investment', 'family-friendly'
      ];

      data.keyFeatures = featureKeywords.filter(feature => 
        new RegExp(feature, 'i').test(analysisText)
      );

      // Generate summary
      data.summary = `Property brochure analysis: ${data.amenities.length} amenities identified, ${data.keyFeatures.length} key features found`;

    } catch (error) {
      logger.error({ err: error }, 'Error parsing brochure analysis');
    }

    return data;
  }

  /**
   * Process all pending visual assets for analysis
   */
  async processAllPendingAssets() {
    try {
      logger.info('Processing all pending visual assets for AI analysis');

      // Get all visual assets that haven't been analyzed yet
      const { data: assets, error } = await supabase
        .from('visual_assets')
        .select('*')
        .eq('processing_status', 'completed')
        .not('id', 'in', 
          supabase.from('ai_visual_analysis').select('visual_asset_id')
        )
        .limit(50); // Process in batches

      if (error) {
        throw new Error(`Failed to fetch pending assets: ${error.message}`);
      }

      if (!assets || assets.length === 0) {
        logger.info('No pending assets found for analysis');
        return { processed: 0, errors: 0 };
      }

      let processed = 0;
      let errors = 0;

      for (const asset of assets) {
        try {
          logger.info({ assetId: asset.id, type: asset.asset_type }, 'Processing asset');

          if (asset.asset_type === 'floor_plan') {
            await this.analyzeFloorPlan(asset.id, asset.public_url);
          } else if (asset.asset_type === 'brochure') {
            await this.analyzeBrochure(asset.id, asset.public_url);
          }

          processed++;

          // Rate limiting - wait between API calls
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          logger.error({
            err: error,
            assetId: asset.id
          }, 'Failed to process asset');
          errors++;
        }
      }

      logger.info({
        processed,
        errors,
        total: assets.length
      }, 'Batch processing completed');

      return { processed, errors };

    } catch (error) {
      logger.error({ err: error }, 'Failed to process pending assets');
      throw error;
    }
  }
}

module.exports = VisualAnalysisService;
