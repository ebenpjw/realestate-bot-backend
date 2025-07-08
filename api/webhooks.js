const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../logger');
const supabase = require('../supabaseClient');

const router = express.Router();

// Initialize VisualAnalysisService only when needed to avoid startup errors
let analysisService = null;
const getAnalysisService = () => {
  if (!analysisService) {
    try {
      const VisualAnalysisService = require('../services/visualAnalysisService');
      analysisService = new VisualAnalysisService();
    } catch (error) {
      logger.warn('VisualAnalysisService not available, visual analysis will be skipped');
      analysisService = { analyzePropertyAssets: () => Promise.resolve() }; // Mock service
    }
  }
  return analysisService;
};

/**
 * Webhook to receive property data from external scrapers
 */
router.post('/property-data', [
  body('properties').isArray().withMessage('Properties must be an array'),
  body('properties.*.name').notEmpty().withMessage('Property name is required'),
  body('properties.*.developer').optional().isString(),
  body('properties.*.address').optional().isString(),
  body('properties.*.district').optional().isString(),
  body('properties.*.propertyType').optional().isString(),
  body('properties.*.tenure').optional().isString(),
  body('properties.*.description').optional().isString(),
  body('properties.*.units').optional().isString(),
  body('properties.*.completion').optional().isString(),
  body('properties.*.blocks').optional().isString(),
  body('properties.*.sizeRange').optional().isString(),
  body('properties.*.priceRange').optional().isObject(),
  body('properties.*.floorPlans').optional().isArray(),
  body('properties.*.unitMix').optional().isArray(),
  body('properties.*.visualAssets').optional().isArray(),
  body('properties.*.extractedData').optional().isObject(),
  body('source').notEmpty().withMessage('Source is required'),
  body('timestamp').isISO8601().withMessage('Valid timestamp required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { properties, source, timestamp, metadata } = req.body;

    logger.info({
      propertiesCount: properties.length,
      source,
      timestamp
    }, 'Received property data via webhook');

    // Create webhook session
    const { data: session, error: sessionError } = await supabase
      .from('scraping_sessions')
      .insert({
        session_type: 'manual_trigger',
        status: 'running',
        triggered_by: source,
        started_at: timestamp
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }

    let processed = 0;
    let updated = 0;
    let errorCount = 0;

    // Process each property
    for (const propertyData of properties) {
      try {
        const saved = await savePropertyFromWebhook(propertyData, source);
        if (saved) {
          updated++;
          
          // Trigger AI analysis for visual assets
          if (propertyData.visualAssets && propertyData.visualAssets.length > 0) {
            setTimeout(() => {
              analyzePropertyAssets(saved.id);
            }, 1000);
          }
        }
        processed++;

      } catch (error) {
        logger.error({
          err: error,
          property: propertyData.name,
          errorMessage: error.message,
          errorStack: error.stack,
          propertyDataKeys: Object.keys(propertyData || {})
        }, 'Failed to process property from webhook');
        errorCount++;
      }
    }

    // Update session
    await supabase
      .from('scraping_sessions')
      .update({
        status: 'completed',
        projects_processed: processed,
        projects_updated: updated,
        errors_encountered: errorCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', session.id);

    res.json({
      success: true,
      message: 'Property data processed successfully',
      sessionId: session.id,
      results: {
        processed,
        updated,
        errors: errorCount
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Webhook property data processing failed');
    res.status(500).json({ 
      error: 'Failed to process property data',
      message: error.message 
    });
  }
});

/**
 * Webhook for scraping completion notifications
 */
router.post('/scraping-completed', [
  body('status').isIn(['success', 'failure']).withMessage('Valid status required'),
  body('run_id').notEmpty().withMessage('Run ID required'),
  body('timestamp').isISO8601().withMessage('Valid timestamp required')
], async (req, res) => {
  try {
    const { status, run_id, timestamp, details } = req.body;

    logger.info({
      status,
      run_id,
      timestamp,
      details
    }, 'Received scraping completion notification');

    // Log the completion
    await supabase
      .from('scraping_sessions')
      .insert({
        session_type: 'external_notification',
        status: status === 'success' ? 'completed' : 'failed',
        triggered_by: 'github_actions',
        started_at: timestamp,
        completed_at: timestamp,
        error_log: status === 'failure' ? [{ error: details, timestamp }] : []
      });

    // If successful, trigger AI analysis for any pending assets
    if (status === 'success') {
      setTimeout(() => {
        getAnalysisService().processAllPendingAssets().catch(error => {
          logger.error({ err: error }, 'Failed to process pending assets after scraping completion');
        });
      }, 5000);
    }

    res.json({
      success: true,
      message: 'Scraping completion notification received'
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to process scraping completion notification');
    res.status(500).json({ 
      error: 'Failed to process notification' 
    });
  }
});

/**
 * Webhook to receive manual property submissions
 */
router.post('/manual-property', [
  body('name').notEmpty().withMessage('Property name is required'),
  body('developer').optional().isString(),
  body('address').optional().isString(),
  body('district').optional().isString(),
  body('propertyType').optional().isString(),
  body('priceRange').optional().isObject(),
  body('visualAssets').optional().isArray(),
  body('submittedBy').notEmpty().withMessage('Submitter identification required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const propertyData = req.body;

    logger.info({
      property: propertyData.name,
      submittedBy: propertyData.submittedBy
    }, 'Received manual property submission');

    const saved = await savePropertyFromWebhook(propertyData, 'manual_submission');

    res.json({
      success: true,
      message: 'Property submitted successfully',
      propertyId: saved?.id
    });

  } catch (error) {
    logger.error({ err: error }, 'Manual property submission failed');
    res.status(500).json({ 
      error: 'Failed to submit property' 
    });
  }
});

/**
 * Save property data from webhook (Enhanced for new scraper format)
 */
async function savePropertyFromWebhook(propertyData, source) {
  try {
    // Parse price range from raw format
    const parsePriceRange = (priceRaw) => {
      if (!priceRaw) return { min: null, max: null };

      const matches = priceRaw.match(/\$?([\d,]+(?:\.\d+)?)[KMk]?\s*-\s*\$?([\d,]+(?:\.\d+)?)[KMk]?/);
      if (!matches) return { min: null, max: null };

      let min = parseFloat(matches[1].replace(/,/g, ''));
      let max = parseFloat(matches[2].replace(/,/g, ''));

      // Handle K/M suffixes
      if (priceRaw.includes('M') || priceRaw.includes('m')) {
        min *= 1000000;
        max *= 1000000;
      } else if (priceRaw.includes('K') || priceRaw.includes('k')) {
        min *= 1000;
        max *= 1000;
      }

      return { min, max };
    };

    const priceRange = parsePriceRange(propertyData.priceRange?.raw);

    // Map property type to allowed values
    const mapPropertyType = (type) => {
      if (!type) return 'Private Condo';

      const typeMap = {
        'Residential Lowrise': 'Private Condo',
        'Residential Highrise': 'Private Condo',
        'Residential': 'Private Condo',
        'Condo': 'Private Condo',
        'Condominium': 'Private Condo',
        'Executive Condo': 'Executive Condo',
        'EC': 'Executive Condo',
        'Landed': 'Landed House',
        'Landed House': 'Landed House',
        'Terrace': 'Landed House',
        'Semi-Detached': 'Landed House',
        'Detached': 'Landed House',
        'Bungalow': 'Landed House',
        'Townhouse': 'Landed House',
        'Commercial': 'Business Space',
        'Business': 'Business Space',
        'Office': 'Business Space',
        'Retail': 'Business Space',
        'Mixed Development': 'Mixed',
        'Mixed Use': 'Mixed'
      };

      // Direct match
      if (typeMap[type]) return typeMap[type];

      // Partial match
      const lowerType = type.toLowerCase();
      for (const [key, value] of Object.entries(typeMap)) {
        if (lowerType.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerType)) {
          return value;
        }
      }

      // Default fallback
      return 'Private Condo';
    };

    const mappedPropertyType = mapPropertyType(propertyData.propertyType);

    // Check if property already exists
    const { data: existingProject } = await supabase
      .from('property_projects')
      .select('*')
      .eq('project_name', propertyData.name)
      .single();

    let project;
    if (existingProject) {
      // Update existing property
      const { data: updatedProject, error: updateError } = await supabase
        .from('property_projects')
        .update({
          developer: propertyData.developer || existingProject.developer || 'Unknown Developer',
          address: propertyData.address || existingProject.address || 'Singapore',
          district: propertyData.district || existingProject.district || 'Unknown',
          property_type: mappedPropertyType || existingProject.property_type || 'Private Condo',
          tenure: propertyData.tenure || existingProject.tenure,
          price_range_min: priceRange.min || existingProject.price_range_min,
          price_range_max: priceRange.max || existingProject.price_range_max,
          price_range_raw: propertyData.priceRange?.raw || existingProject.price_range_raw,
          description: propertyData.description || existingProject.description,
          units_count: propertyData.units ? parseInt(propertyData.units) : existingProject.units_count,
          blocks_info: propertyData.blocks || existingProject.blocks_info,
          size_range_sqft: propertyData.sizeRange || existingProject.size_range_sqft,
          source_url: propertyData.sourceUrl || existingProject.source_url || `webhook://${source}`,
          scraped_at: propertyData.scrapedAt || new Date().toISOString(),
          extracted_data: propertyData.extractedData || existingProject.extracted_data || {},
          last_scraped: new Date().toISOString(),
          scraping_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProject.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update property: ${updateError.message}`);
      }
      project = updatedProject;
    } else {
      // Insert new property
      const { data: newProject, error: insertError } = await supabase
        .from('property_projects')
        .insert({
          project_name: propertyData.name,
          developer: propertyData.developer || 'Unknown Developer',
          address: propertyData.address || 'Singapore',
          district: propertyData.district || 'Unknown',
          property_type: mappedPropertyType,
          tenure: propertyData.tenure || null,
          price_range_min: priceRange.min,
          price_range_max: priceRange.max,
          price_range_raw: propertyData.priceRange?.raw,
          description: propertyData.description,
          units_count: propertyData.units ? parseInt(propertyData.units) : null,
          blocks_info: propertyData.blocks,
          size_range_sqft: propertyData.sizeRange,
          source_url: propertyData.sourceUrl || `webhook://${source}`,
          scraped_at: propertyData.scrapedAt || new Date().toISOString(),
          extracted_data: propertyData.extractedData || {},
          last_scraped: new Date().toISOString(),
          scraping_status: 'completed'
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to insert property: ${insertError.message}`);
      }
      project = newProject;
    }



    // Save floor plans if provided (enhanced format)
    if (propertyData.floorPlans && propertyData.floorPlans.length > 0) {
      for (const floorPlan of propertyData.floorPlans) {
        const fileName = floorPlan.filename || floorPlan.name || 'floor_plan.jpg';

        // Check if floor plan already exists
        const { data: existingAsset } = await supabase
          .from('visual_assets')
          .select('*')
          .eq('project_id', project.id)
          .eq('file_name', fileName)
          .single();

        if (existingAsset) {
          // Update existing floor plan
          await supabase
            .from('visual_assets')
            .update({
              public_url: floorPlan.url,
              original_url: floorPlan.url,
              alt_text: floorPlan.alt || floorPlan.name || '',
              bedroom_type: floorPlan.bedroomType,
              bedroom_count: floorPlan.bedroomCount ? parseInt(floorPlan.bedroomCount) : null,
              image_width: floorPlan.imageWidth,
              image_height: floorPlan.imageHeight,
              has_image: floorPlan.hasImage !== false,
              source_filename: floorPlan.filename,
              extraction_metadata: {
                type: floorPlan.type,
                name: floorPlan.name,
                extractedAt: new Date().toISOString()
              },
              processing_status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingAsset.id);
        } else {
          // Insert new floor plan
          await supabase
            .from('visual_assets')
            .insert({
              project_id: project.id,
              asset_type: 'floor_plan',
              file_name: fileName,
              storage_path: `floor-plans/${project.id}/${fileName}`,
              public_url: floorPlan.url,
              original_url: floorPlan.url,
              alt_text: floorPlan.alt || floorPlan.name || '',
              bedroom_type: floorPlan.bedroomType,
              bedroom_count: floorPlan.bedroomCount ? parseInt(floorPlan.bedroomCount) : null,
              image_width: floorPlan.imageWidth,
              image_height: floorPlan.imageHeight,
              has_image: floorPlan.hasImage !== false,
              source_filename: floorPlan.filename,
              extraction_metadata: {
                type: floorPlan.type,
                name: floorPlan.name,
                extractedAt: new Date().toISOString()
              },
              processing_status: 'completed'
            });
        }
      }
    }

    // Save unit mix data if provided (new format)
    if (propertyData.unitMix && propertyData.unitMix.length > 0) {
      // First, remove existing unit mix for this project to avoid duplicates
      await supabase
        .from('property_unit_mix')
        .delete()
        .eq('project_id', project.id);

      // Insert new unit mix data
      for (const unitType of propertyData.unitMix) {
        await supabase
          .from('property_unit_mix')
          .insert({
            project_id: project.id,
            unit_type: unitType.type,
            size_range_raw: unitType.sizeRange?.raw,
            size_min_sqft: unitType.sizeRange?.min,
            size_max_sqft: unitType.sizeRange?.max,
            size_unit: unitType.sizeRange?.unit || 'sqft',
            price_range_raw: unitType.priceRange?.raw,
            price_min: unitType.priceRange?.min,
            price_max: unitType.priceRange?.max,
            price_currency: unitType.priceRange?.currency || 'SGD',
            availability_raw: unitType.availability?.raw,
            units_available: unitType.availability?.available,
            units_total: unitType.availability?.total,
            availability_percentage: unitType.availability?.percentage
          });
      }
    }

    // Legacy visual assets support (for backward compatibility)
    if (propertyData.visualAssets && propertyData.visualAssets.length > 0) {
      for (const asset of propertyData.visualAssets) {
        const fileName = asset.filename || 'unknown.jpg';

        // Check if asset already exists
        const { data: existingAsset } = await supabase
          .from('visual_assets')
          .select('*')
          .eq('project_id', project.id)
          .eq('file_name', fileName)
          .single();

        if (!existingAsset) {
          // Only insert if it doesn't exist (ignoreDuplicates: true behavior)
          await supabase
            .from('visual_assets')
            .insert({
              project_id: project.id,
              asset_type: asset.type || 'property_image',
              file_name: fileName,
              storage_path: `legacy-assets/${project.id}/${fileName}`,
              public_url: asset.url,
              original_url: asset.url,
              alt_text: asset.alt || '',
              processing_status: 'completed'
            });
        }
      }
    }

    logger.info({
      projectId: project.id,
      propertyName: project.project_name,
      source
    }, 'Property saved from webhook');

    return project;

  } catch (error) {
    logger.error({
      err: error,
      propertyName: propertyData?.name,
      errorMessage: error.message,
      errorStack: error.stack,
      propertyData: JSON.stringify(propertyData, null, 2)
    }, 'Failed to save property from webhook');
    throw error;
  }
}

/**
 * Analyze property assets asynchronously
 */
async function analyzePropertyAssets(projectId) {
  try {
    const { data: assets } = await supabase
      .from('visual_assets')
      .select('*')
      .eq('project_id', projectId)
      .eq('processing_status', 'pending');

    for (const asset of assets || []) {
      try {
        const service = getAnalysisService();
        if (asset.asset_type === 'floor_plan') {
          await service.analyzeFloorPlan(asset.id, asset.public_url);
        } else if (asset.asset_type === 'brochure') {
          await service.analyzeBrochure(asset.id, asset.public_url);
        }
      } catch (error) {
        logger.error({
          err: error,
          assetId: asset.id
        }, 'Failed to analyze asset');
      }
    }

  } catch (error) {
    logger.error({ err: error, projectId }, 'Failed to analyze property assets');
  }
}

module.exports = router;
