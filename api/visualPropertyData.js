const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../logger');
const supabase = require('../supabaseClient');
const VisualPropertyScrapingService = require('../services/visualPropertyScrapingService');
const VisualAnalysisService = require('../services/visualAnalysisService');
const ScheduledDataCollectionService = require('../services/scheduledDataCollectionService');

const router = express.Router();

// Initialize services
const scrapingService = new VisualPropertyScrapingService();
const analysisService = new VisualAnalysisService();
const scheduledService = new ScheduledDataCollectionService();

/**
 * Get all property projects with visual data
 */
router.get('/projects', [
  query('district').optional().isString(),
  query('property_type').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { district, property_type, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('project_summary')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (district) {
      query = query.eq('district', district);
    }

    if (property_type) {
      query = query.eq('property_type', property_type);
    }

    const { data: projects, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    res.json({
      success: true,
      data: projects,
      pagination: {
        limit,
        offset,
        count: projects.length
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch property projects');
    res.status(500).json({ error: 'Failed to fetch property projects' });
  }
});

/**
 * Get specific property project with all visual assets
 */
router.get('/projects/:projectId', [
  param('projectId').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { projectId } = req.params;

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('property_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Property project not found' });
    }

    // Get visual assets
    const { data: visualAssets, error: assetsError } = await supabase
      .from('visual_assets')
      .select(`
        *,
        ai_visual_analysis(*)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (assetsError) {
      logger.error({ err: assetsError }, 'Failed to fetch visual assets');
    }

    // Get property units
    const { data: units, error: unitsError } = await supabase
      .from('property_units')
      .select('*')
      .eq('project_id', projectId)
      .order('bedrooms', { ascending: true });

    if (unitsError) {
      logger.error({ err: unitsError }, 'Failed to fetch property units');
    }

    res.json({
      success: true,
      data: {
        project,
        visualAssets: visualAssets || [],
        units: units || []
      }
    });

  } catch (error) {
    logger.error({ err: error, projectId: req.params.projectId }, 'Failed to fetch property details');
    res.status(500).json({ error: 'Failed to fetch property details' });
  }
});

/**
 * Search properties by criteria
 */
router.get('/search', [
  query('q').optional().isString(),
  query('bedrooms').optional().isInt({ min: 1, max: 10 }),
  query('min_price').optional().isFloat({ min: 0 }),
  query('max_price').optional().isFloat({ min: 0 }),
  query('district').optional().isString(),
  query('amenities').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { 
      q, 
      bedrooms, 
      min_price, 
      max_price, 
      district, 
      amenities, 
      limit = 20 
    } = req.query;

    let query = supabase
      .from('property_projects')
      .select(`
        *,
        property_units(*),
        property_search_index(*)
      `)
      .limit(limit);

    // Apply filters
    if (district) {
      query = query.eq('district', district);
    }

    if (min_price || max_price) {
      if (min_price) query = query.gte('price_range_min', min_price);
      if (max_price) query = query.lte('price_range_max', max_price);
    }

    if (bedrooms) {
      query = query.eq('property_units.bedrooms', bedrooms);
    }

    const { data: results, error } = await query;

    if (error) {
      throw new Error(`Search query failed: ${error.message}`);
    }

    // Filter by amenities if specified
    let filteredResults = results;
    if (amenities) {
      const amenityList = amenities.split(',').map(a => a.trim().toLowerCase());
      filteredResults = results.filter(project => {
        const projectAmenities = project.property_search_index?.[0]?.amenities || [];
        return amenityList.some(amenity => 
          projectAmenities.some(pa => pa.toLowerCase().includes(amenity))
        );
      });
    }

    // Text search if query provided
    if (q) {
      const searchTerm = q.toLowerCase();
      filteredResults = filteredResults.filter(project => 
        project.project_name.toLowerCase().includes(searchTerm) ||
        project.developer?.toLowerCase().includes(searchTerm) ||
        project.address?.toLowerCase().includes(searchTerm)
      );
    }

    res.json({
      success: true,
      data: filteredResults,
      query: req.query,
      count: filteredResults.length
    });

  } catch (error) {
    logger.error({ err: error }, 'Property search failed');
    res.status(500).json({ error: 'Property search failed' });
  }
});

/**
 * Trigger manual scraping
 */
router.post('/scrape', async (req, res) => {
  try {
    logger.info('Manual scraping triggered via API');

    // Check if scraping is already running
    const { data: runningSessions } = await supabase
      .from('scraping_sessions')
      .select('*')
      .eq('status', 'running')
      .limit(1);

    if (runningSessions && runningSessions.length > 0) {
      return res.status(409).json({ 
        error: 'Scraping is already in progress',
        sessionId: runningSessions[0].id
      });
    }

    // Start scraping in background
    scrapingService.scrapePropertyData()
      .then(result => {
        logger.info({ result }, 'Manual scraping completed');
      })
      .catch(error => {
        logger.error({ err: error }, 'Manual scraping failed');
      });

    res.json({
      success: true,
      message: 'Scraping started in background',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to trigger scraping');
    res.status(500).json({ error: 'Failed to trigger scraping' });
  }
});

/**
 * Trigger AI analysis for pending assets
 */
router.post('/analyze', async (req, res) => {
  try {
    logger.info('Manual AI analysis triggered via API');

    const result = await analysisService.processAllPendingAssets();

    res.json({
      success: true,
      message: 'AI analysis completed',
      result: {
        processed: result.processed,
        errors: result.errors
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to trigger AI analysis');
    res.status(500).json({ error: 'Failed to trigger AI analysis' });
  }
});

/**
 * Get scraping sessions status
 */
router.get('/sessions', [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['running', 'completed', 'failed', 'cancelled'])
], async (req, res) => {
  try {
    const { limit = 10, status } = req.query;

    let query = supabase
      .from('scraping_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sessions, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    res.json({
      success: true,
      data: sessions
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch scraping sessions');
    res.status(500).json({ error: 'Failed to fetch scraping sessions' });
  }
});

/**
 * Get system statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Get various statistics
    const [
      projectsResult,
      assetsResult,
      analysisResult,
      sessionsResult
    ] = await Promise.all([
      supabase.from('property_projects').select('id', { count: 'exact', head: true }),
      supabase.from('visual_assets').select('id', { count: 'exact', head: true }),
      supabase.from('ai_visual_analysis').select('id', { count: 'exact', head: true }),
      supabase.from('scraping_sessions').select('*').eq('status', 'completed').order('started_at', { ascending: false }).limit(1)
    ]);

    const stats = {
      totalProjects: projectsResult.count || 0,
      totalVisualAssets: assetsResult.count || 0,
      totalAIAnalyses: analysisResult.count || 0,
      lastSuccessfulScraping: sessionsResult.data?.[0]?.completed_at || null,
      scheduledServiceStatus: scheduledService.getStatus()
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch system statistics');
    res.status(500).json({ error: 'Failed to fetch system statistics' });
  }
});

/**
 * Get property recommendations for a lead
 */
router.get('/recommendations/:leadId', [
  param('leadId').isUUID(),
  query('limit').optional().isInt({ min: 1, max: 20 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid lead ID' });
    }

    const { leadId } = req.params;
    const { limit = 5 } = req.query;

    // Get lead information
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Build recommendation query based on lead preferences
    let query = supabase
      .from('property_projects')
      .select(`
        *,
        property_units(*),
        property_search_index(*),
        visual_assets(id, asset_type, public_url)
      `)
      .eq('sales_status', 'Available')
      .limit(limit);

    // Apply lead-specific filters
    if (lead.budget) {
      const budgetValue = parseFloat(lead.budget.replace(/[^\d.]/g, ''));
      if (budgetValue > 0) {
        query = query.lte('price_range_min', budgetValue * 1.2); // 20% buffer
      }
    }

    if (lead.location_preference) {
      // Simple location matching - could be enhanced
      query = query.ilike('address', `%${lead.location_preference}%`);
    }

    const { data: recommendations, error } = await query;

    if (error) {
      throw new Error(`Recommendation query failed: ${error.message}`);
    }

    // Score and rank recommendations
    const scoredRecommendations = recommendations.map(project => {
      let score = 0.5; // Base score

      // Boost score based on lead intent and project features
      if (lead.intent === 'own-stay' && project.property_search_index?.[0]?.family_friendly_score) {
        score += project.property_search_index[0].family_friendly_score * 0.3;
      }

      if (lead.intent === 'investment' && project.property_search_index?.[0]?.investment_potential_score) {
        score += project.property_search_index[0].investment_potential_score * 0.3;
      }

      // Boost if has visual assets
      if (project.visual_assets && project.visual_assets.length > 0) {
        score += 0.1;
      }

      return {
        ...project,
        recommendationScore: Math.min(1.0, score),
        matchReasons: this.generateMatchReasons(lead, project)
      };
    });

    // Sort by score
    scoredRecommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);

    res.json({
      success: true,
      data: {
        lead: {
          id: lead.id,
          intent: lead.intent,
          budget: lead.budget,
          location_preference: lead.location_preference
        },
        recommendations: scoredRecommendations
      }
    });

  } catch (error) {
    logger.error({ err: error, leadId: req.params.leadId }, 'Failed to generate recommendations');
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

/**
 * Generate match reasons for recommendations
 */
function generateMatchReasons(lead, project) {
  const reasons = [];

  if (lead.budget && project.price_range_min) {
    const budgetValue = parseFloat(lead.budget.replace(/[^\d.]/g, ''));
    if (budgetValue >= project.price_range_min) {
      reasons.push('Within budget range');
    }
  }

  if (lead.location_preference && project.address?.toLowerCase().includes(lead.location_preference.toLowerCase())) {
    reasons.push('Matches location preference');
  }

  if (project.visual_assets && project.visual_assets.length > 0) {
    reasons.push('Floor plans and brochures available');
  }

  if (project.property_search_index?.[0]?.family_friendly_score > 0.7) {
    reasons.push('Family-friendly amenities');
  }

  return reasons;
}

module.exports = router;
