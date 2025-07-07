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
  body('properties.*.visualAssets').optional().isArray(),
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
          property: propertyData.name
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
 * Save property data from webhook
 */
async function savePropertyFromWebhook(propertyData, source) {
  try {
    // Insert or update property project
    const { data: project, error: projectError } = await supabase
      .from('property_projects')
      .upsert({
        project_name: propertyData.name,
        developer: propertyData.developer || 'Unknown Developer',
        address: propertyData.address || 'Singapore',
        district: propertyData.district || 'Unknown',
        property_type: propertyData.propertyType || 'Private Condo',
        tenure: propertyData.tenure || '99 Years',
        price_range_min: propertyData.priceRange?.min,
        price_range_max: propertyData.priceRange?.max,
        source_url: propertyData.sourceUrl || `webhook://${source}`,
        last_scraped: new Date().toISOString(),
        scraping_status: 'completed'
      }, {
        onConflict: 'project_name',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (projectError) {
      throw new Error(`Failed to save property: ${projectError.message}`);
    }

    // Save visual assets if provided
    if (propertyData.visualAssets && propertyData.visualAssets.length > 0) {
      for (const asset of propertyData.visualAssets) {
        await supabase
          .from('visual_assets')
          .insert({
            project_id: project.id,
            asset_type: asset.type || 'floor_plan',
            file_name: asset.filename || 'unknown.jpg',
            storage_path: `webhook-assets/${project.id}/${asset.filename}`,
            public_url: asset.url,
            original_url: asset.url,
            alt_text: asset.alt || '',
            processing_status: 'pending'
          });
      }
    }

    // Save property units if provided
    if (propertyData.units && propertyData.units.length > 0) {
      for (const unit of propertyData.units) {
        await supabase
          .from('property_units')
          .insert({
            project_id: project.id,
            unit_type: unit.type,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            size_sqft: unit.size_sqft,
            unit_price: unit.price
          });
      }
    }

    logger.info({
      projectId: project.id,
      propertyName: project.project_name,
      source
    }, 'Property saved from webhook');

    return project;

  } catch (error) {
    logger.error({ err: error }, 'Failed to save property from webhook');
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
