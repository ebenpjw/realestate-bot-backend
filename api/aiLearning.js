/**
 * AI Learning API - Endpoints for managing the AI learning system
 * Provides access to performance metrics, simulations, A/B testing, and optimization controls
 */

const express = require('express');
const router = express.Router();
const logger = require('../logger');
const supabase = require('../supabaseClient');
const aiLearningService = require('../services/aiLearningService');
const aiLearningManager = require('../services/aiLearningManager');

/**
 * GET /api/ai-learning/dashboard
 * Get comprehensive performance dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboard = await aiLearningManager.getPerformanceDashboard();
    
    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting AI learning dashboard');
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
});

/**
 * GET /api/ai-learning/strategy-analysis
 * Get detailed strategy effectiveness analysis
 */
router.get('/strategy-analysis', async (req, res) => {
  try {
    const analysis = await aiLearningService.analyzeStrategyEffectiveness();
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No analysis data available'
      });
    }

    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting strategy analysis');
    res.status(500).json({
      success: false,
      error: 'Failed to analyze strategy effectiveness'
    });
  }
});

/**
 * POST /api/ai-learning/run-simulations
 * Run conversation simulations for strategy testing
 */
router.post('/run-simulations', async (req, res) => {
  try {
    const { strategy, simulation_count = 100 } = req.body;

    if (!strategy) {
      return res.status(400).json({
        success: false,
        error: 'Strategy configuration is required'
      });
    }

    // Validate simulation count
    const count = Math.min(Math.max(simulation_count, 10), 1000); // Between 10 and 1000

    logger.info({ strategy, count }, 'Starting simulation run via API');

    const results = await aiLearningService.runConversationSimulations(strategy, count);

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, 'Error running simulations');
    res.status(500).json({
      success: false,
      error: 'Failed to run simulations'
    });
  }
});

/**
 * POST /api/ai-learning/start-ab-test
 * Start a new A/B test
 */
router.post('/start-ab-test', async (req, res) => {
  try {
    const testConfig = req.body;

    // Validate required fields
    const requiredFields = ['name', 'description', 'control_strategy', 'variant_strategy'];
    const missingFields = requiredFields.filter(field => !testConfig[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const abTest = await aiLearningManager.startABTest(testConfig);

    res.json({
      success: true,
      data: abTest,
      message: 'A/B test started successfully'
    });

  } catch (error) {
    logger.error({ err: error }, 'Error starting A/B test');
    res.status(500).json({
      success: false,
      error: 'Failed to start A/B test'
    });
  }
});

/**
 * POST /api/ai-learning/run-learning-cycle
 * Manually trigger a learning cycle
 */
router.post('/run-learning-cycle', async (req, res) => {
  try {
    logger.info('Manual learning cycle triggered via API');

    const results = await aiLearningManager.runLearningCycle();

    res.json({
      success: true,
      data: results,
      message: 'Learning cycle completed successfully'
    });

  } catch (error) {
    logger.error({ err: error }, 'Error running learning cycle');
    res.status(500).json({
      success: false,
      error: 'Failed to run learning cycle'
    });
  }
});

/**
 * GET /api/ai-learning/optimized-strategy
 * Get optimized strategy recommendations for a lead profile
 */
router.get('/optimized-strategy', async (req, res) => {
  try {
    const { intent, budget, source, journey_stage, comfort_level } = req.query;

    if (!intent || !journey_stage) {
      return res.status(400).json({
        success: false,
        error: 'Intent and journey_stage are required parameters'
      });
    }

    const leadProfile = { intent, budget, source };
    const contextAnalysis = { journey_stage, comfort_level };

    const recommendations = await aiLearningService.getOptimizedStrategy(leadProfile, contextAnalysis);

    res.json({
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting optimized strategy');
    res.status(500).json({
      success: false,
      error: 'Failed to get optimized strategy'
    });
  }
});

/**
 * GET /api/ai-learning/performance-metrics
 * Get current performance metrics
 */
router.get('/performance-metrics', async (req, res) => {
  try {
    const dashboard = await aiLearningManager.getPerformanceDashboard();
    
    res.json({
      success: true,
      data: {
        current_metrics: dashboard.current_metrics,
        top_strategies: dashboard.top_performing_strategies,
        recent_optimizations: dashboard.recent_optimizations
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting performance metrics');
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
});

/**
 * POST /api/ai-learning/record-outcome
 * Manually record a conversation outcome (for testing or manual tracking)
 */
router.post('/record-outcome', async (req, res) => {
  try {
    const { lead_id, outcome, strategy_data } = req.body;

    if (!lead_id || !outcome) {
      return res.status(400).json({
        success: false,
        error: 'lead_id and outcome are required'
      });
    }

    await aiLearningService.recordConversationOutcome(lead_id, outcome, strategy_data || {});

    res.json({
      success: true,
      message: 'Conversation outcome recorded successfully'
    });

  } catch (error) {
    logger.error({ err: error }, 'Error recording conversation outcome');
    res.status(500).json({
      success: false,
      error: 'Failed to record conversation outcome'
    });
  }
});

/**
 * GET /api/ai-learning/simulation-history
 * Get simulation history and results
 */
router.get('/simulation-history', async (req, res) => {
  try {
    const { limit = 50, batch_id } = req.query;
    
    let query = supabase
      .from('simulation_results')
      .select('*')
      .order('simulation_timestamp', { ascending: false })
      .limit(parseInt(limit));

    if (batch_id) {
      query = query.eq('simulation_batch_id', batch_id);
    }

    const { data: simulations, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Group by batch for better organization
    const groupedResults = {};
    simulations.forEach(sim => {
      const batchId = sim.simulation_batch_id;
      if (!groupedResults[batchId]) {
        groupedResults[batchId] = {
          batch_id: batchId,
          timestamp: sim.simulation_timestamp,
          simulations: []
        };
      }
      groupedResults[batchId].simulations.push(sim);
    });

    res.json({
      success: true,
      data: {
        batches: Object.values(groupedResults),
        total_simulations: simulations.length
      }
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting simulation history');
    res.status(500).json({
      success: false,
      error: 'Failed to get simulation history'
    });
  }
});

/**
 * GET /api/ai-learning/ab-tests
 * Get A/B test history and results
 */
router.get('/ab-tests', async (req, res) => {
  try {
    const { status = 'all' } = req.query;

    let query = supabase
      .from('ab_tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: abTests, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    res.json({
      success: true,
      data: abTests
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting A/B tests');
    res.status(500).json({
      success: false,
      error: 'Failed to get A/B tests'
    });
  }
});

/**
 * GET /api/ai-learning/learning-insights
 * Get recent learning insights and patterns
 */
router.get('/learning-insights', async (req, res) => {
  try {
    const { data: insights, error } = await supabase
      .from('recent_learning_insights')
      .select('*')
      .limit(20);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting learning insights');
    res.status(500).json({
      success: false,
      error: 'Failed to get learning insights'
    });
  }
});

module.exports = router;
