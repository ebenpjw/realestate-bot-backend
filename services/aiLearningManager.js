/**
 * AI Learning Manager - Orchestrates the complete learning system
 * Manages simulations, A/B testing, performance monitoring, and strategy optimization
 */

const logger = require('../logger');
const aiLearningService = require('./aiLearningService');
const databaseService = require('./databaseService');

class AILearningManager {
  constructor() {
    this.isRunning = false;
    this.simulationQueue = [];
    this.abTests = new Map();
    this.performanceMetrics = {
      daily_success_rate: 0,
      weekly_success_rate: 0,
      monthly_success_rate: 0,
      last_updated: null
    };
  }

  /**
   * Initialize the learning system
   */
  async initialize() {
    try {
      logger.info('Initializing AI Learning Manager');
      
      // Load active A/B tests
      await this._loadActiveABTests();
      
      // Calculate current performance metrics
      await this._updatePerformanceMetrics();
      
      // Schedule regular optimization
      this._scheduleOptimization();
      
      this.isRunning = true;
      logger.info('AI Learning Manager initialized successfully');
      
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize AI Learning Manager');
      throw error;
    }
  }

  /**
   * Run comprehensive learning analysis and optimization
   */
  async runLearningCycle() {
    try {
      logger.info('Starting comprehensive learning cycle');
      
      const results = {
        strategy_analysis: null,
        simulation_results: null, // Note: simulation_results table removed in cleanup
        ab_test_results: null, // Note: ab_tests table removed in cleanup
        optimization_applied: false,
        performance_improvement: null
      };

      // 1. Analyze current strategy effectiveness
      results.strategy_analysis = await aiLearningService.analyzeStrategyEffectiveness();
      
      // 2. Run simulations for underperforming strategies (simulation_results table removed)
      if (results.strategy_analysis) {
        const underperformingStrategies = this._identifyUnderperformingStrategies(results.strategy_analysis);
        if (underperformingStrategies.length > 0) {
          // Log simulation intent instead of running (table removed)
          logger.info({ underperformingStrategies }, 'Would run targeted simulations');
          results.simulation_results = { total_simulations: 0, note: 'simulation_results table removed' };
        }
      }

      // 3. Check A/B test results
      results.ab_test_results = await this._checkABTestResults();

      // 4. Apply optimizations if significant improvements found
      const optimizations = this._generateOptimizations(results);
      if (optimizations.length > 0) {
        results.optimization_applied = await this._applyOptimizations(optimizations);
        results.performance_improvement = await this._measurePerformanceImprovement();
      }

      // 5. Update performance metrics
      await this._updatePerformanceMetrics();

      logger.info({
        strategiesAnalyzed: results.strategy_analysis?.strategy_performance?.length || 0,
        simulationsRun: results.simulation_results?.total_simulations || 0,
        abTestsChecked: results.ab_test_results?.length || 0,
        optimizationsApplied: optimizations.length,
        performanceImprovement: results.performance_improvement
      }, 'Learning cycle completed');

      return results;

    } catch (error) {
      logger.error({ err: error }, 'Error in learning cycle');
      throw error;
    }
  }

  /**
   * Start A/B test for strategy comparison
   */
  async startABTest(testConfig) {
    try {
      const abTest = {
        test_name: testConfig.name,
        test_description: testConfig.description,
        test_type: 'strategy_comparison',
        control_strategy: testConfig.control_strategy,
        variant_strategy: testConfig.variant_strategy,
        target_lead_types: testConfig.target_lead_types || [],
        sample_size_target: testConfig.sample_size || 100,
        confidence_level: testConfig.confidence_level || 0.95,
        status: 'active',
        start_date: new Date().toISOString(),
        created_by: 'ai_learning_manager'
      };

      // A/B testing system disabled - ab_tests table removed during cleanup
      logger.info({ abTest }, 'A/B test creation skipped - system disabled');
      const createdTest = null;
      const error = null;

      if (error) {
        throw new Error(`Failed to create A/B test: ${error.message}`);
      }

      this.abTests.set(createdTest.id, createdTest);

      logger.info({
        testId: createdTest.id,
        testName: testConfig.name,
        sampleSize: testConfig.sample_size
      }, 'A/B test started');

      return createdTest;

    } catch (error) {
      logger.error({ err: error }, 'Error starting A/B test');
      throw error;
    }
  }

  /**
   * Get current performance dashboard data
   */
  async getPerformanceDashboard() {
    try {
      const dashboard = {
        current_metrics: this.performanceMetrics,
        recent_optimizations: await this._getRecentOptimizations(),
        active_ab_tests: Array.from(this.abTests.values()),
        top_performing_strategies: await this._getTopPerformingStrategies(),
        learning_insights: await this._getRecentLearningInsights(),
        simulation_summary: await this._getSimulationSummary()
      };

      return dashboard;

    } catch (error) {
      logger.error({ err: error }, 'Error generating performance dashboard');
      throw error;
    }
  }

  /**
   * Run targeted simulations for specific strategies
   * @private
   */
  async _runTargetedSimulations(strategies) {
    try {
      const simulationResults = [];

      for (const strategy of strategies) {
        logger.info({ strategy: strategy.name }, 'Running targeted simulations');
        
        const result = await aiLearningService.runConversationSimulations(
          {
            strategies_used: [strategy.name],
            psychology_principles: strategy.psychology_principles || ['liking', 'reciprocity'],
            conversation_approach: strategy.approach || 'educational'
          },
          50 // 50 simulations per strategy
        );

        simulationResults.push({
          strategy: strategy.name,
          ...result
        });
      }

      return {
        total_simulations: simulationResults.reduce((sum, r) => sum + r.results.length, 0),
        results: simulationResults
      };

    } catch (error) {
      logger.error({ err: error }, 'Error running targeted simulations');
      return null;
    }
  }

  /**
   * Identify underperforming strategies
   * @private
   */
  _identifyUnderperformingStrategies(analysis) {
    if (!analysis?.strategy_performance) return [];

    const avgSuccessRate = analysis.overall_metrics.success_rate;
    return analysis.strategy_performance
      .filter(strategy => strategy.success_rate < avgSuccessRate * 0.8) // 20% below average
      .slice(0, 3); // Top 3 underperformers
  }

  /**
   * Check A/B test results for statistical significance
   * @private
   */
  async _checkABTestResults() {
    try {
      const results = [];

      for (const [testId, test] of this.abTests) {
        if (test.status !== 'active') continue;

        // A/B testing system disabled - ab_tests table removed during cleanup
        logger.debug({ testId }, 'A/B test evaluation skipped - system disabled');
        const updatedTest = null;
        const error = null;

        if (error || !updatedTest) continue;

        // Check if test has enough data for analysis
        const totalSamples = updatedTest.control_total + updatedTest.variant_total;
        if (totalSamples >= updatedTest.sample_size_target) {
          const significance = this._calculateStatisticalSignificance(updatedTest);
          
          if (significance.is_significant) {
            // Mark test as completed (ab_tests table removed in cleanup)
            // For now, log completion instead of updating database
            logger.info({
              testId,
              status: 'completed',
              winner: significance.winner,
              significance: significance.p_value
            }, 'A/B test completed');

            results.push({
              test_id: testId,
              test_name: updatedTest.test_name,
              winner: significance.winner,
              improvement: significance.improvement_percentage,
              confidence: significance.confidence
            });

            this.abTests.delete(testId);
          }
        }
      }

      return results;

    } catch (error) {
      logger.error({ err: error }, 'Error checking A/B test results');
      return [];
    }
  }

  /**
   * Calculate statistical significance for A/B test
   * @private
   */
  _calculateStatisticalSignificance(test) {
    const controlRate = test.control_total > 0 ? test.control_conversions / test.control_total : 0;
    const variantRate = test.variant_total > 0 ? test.variant_conversions / test.variant_total : 0;

    // Simple z-test for proportions (simplified implementation)
    const pooledRate = (test.control_conversions + test.variant_conversions) / 
                      (test.control_total + test.variant_total);
    
    const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1/test.control_total + 1/test.variant_total));
    const zScore = Math.abs(controlRate - variantRate) / se;
    
    // Approximate p-value (simplified)
    const pValue = 2 * (1 - this._normalCDF(Math.abs(zScore)));
    const isSignificant = pValue < (1 - test.confidence_level);

    const winner = variantRate > controlRate ? 'variant' : 'control';
    const improvementPercentage = Math.abs((variantRate - controlRate) / controlRate) * 100;

    return {
      is_significant: isSignificant,
      p_value: pValue,
      winner: isSignificant ? winner : 'inconclusive',
      improvement_percentage: improvementPercentage,
      confidence: (1 - pValue) * 100
    };
  }

  /**
   * Normal CDF approximation
   * @private
   */
  _normalCDF(x) {
    return 0.5 * (1 + this._erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   * @private
   */
  _erf(x) {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Load active A/B tests from database
   * @private
   */
  async _loadActiveABTests() {
    try {
      // A/B testing system disabled - ab_tests table removed during cleanup
      logger.info('A/B testing system disabled - using default strategies');
      const activeTests = [];
      const error = null;

      if (error) {
        logger.warn({ err: error }, 'Failed to load active A/B tests');
        return;
      }

      activeTests.forEach(test => {
        this.abTests.set(test.id, test);
      });

      logger.info({ count: activeTests.length }, 'Active A/B tests loaded');

    } catch (error) {
      logger.error({ err: error }, 'Error loading active A/B tests');
    }
  }

  /**
   * Update performance metrics
   * @private
   */
  async _updatePerformanceMetrics() {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Calculate success rates for different time periods
      const [dailyRate, weeklyRate, monthlyRate] = await Promise.all([
        this._calculateSuccessRate(oneDayAgo, now),
        this._calculateSuccessRate(oneWeekAgo, now),
        this._calculateSuccessRate(oneMonthAgo, now)
      ]);

      this.performanceMetrics = {
        daily_success_rate: dailyRate,
        weekly_success_rate: weeklyRate,
        monthly_success_rate: monthlyRate,
        last_updated: now.toISOString()
      };

      logger.info(this.performanceMetrics, 'Performance metrics updated');

    } catch (error) {
      logger.error({ err: error }, 'Error updating performance metrics');
    }
  }

  /**
   * Calculate success rate for a time period
   * @private
   */
  async _calculateSuccessRate(startDate, endDate) {
    try {
      const { data: outcomes, error } = await supabase
        .from('conversation_outcomes')
        .select('outcome_type')
        .gte('outcome_timestamp', startDate.toISOString())
        .lte('outcome_timestamp', endDate.toISOString());

      if (error || !outcomes || outcomes.length === 0) {
        return 0;
      }

      const successful = outcomes.filter(o => o.outcome_type === 'appointment_booked').length;
      return successful / outcomes.length;

    } catch (error) {
      logger.warn({ err: error }, 'Error calculating success rate');
      return 0;
    }
  }

  /**
   * Schedule regular optimization
   * @private
   */
  _scheduleOptimization() {
    // Run learning cycle every 6 hours
    setInterval(async () => {
      if (this.isRunning) {
        try {
          await this.runLearningCycle();
        } catch (error) {
          logger.error({ err: error }, 'Error in scheduled learning cycle');
        }
      }
    }, 6 * 60 * 60 * 1000); // 6 hours

    logger.info('Learning optimization scheduled every 6 hours');
  }

  /**
   * Generate optimizations based on learning results
   * @private
   */
  _generateOptimizations(results) {
    const optimizations = [];

    // Strategy optimizations based on analysis
    if (results.strategy_analysis?.improvement_opportunities) {
      results.strategy_analysis.improvement_opportunities.forEach(opportunity => {
        optimizations.push({
          type: 'strategy_improvement',
          description: opportunity.description,
          expected_improvement: opportunity.expected_improvement,
          implementation: opportunity.implementation
        });
      });
    }

    // A/B test winner implementations
    if (results.ab_test_results) {
      results.ab_test_results.forEach(testResult => {
        if (testResult.winner === 'variant') {
          optimizations.push({
            type: 'ab_test_winner',
            description: `Implement winning variant from ${testResult.test_name}`,
            expected_improvement: testResult.improvement,
            implementation: 'replace_control_with_variant'
          });
        }
      });
    }

    return optimizations;
  }

  /**
   * Apply optimizations to the system
   * @private
   */
  async _applyOptimizations(optimizations) {
    try {
      let appliedCount = 0;

      for (const optimization of optimizations) {
        // Store optimization record
        const { error } = await supabase
          .from('strategy_optimizations')
          .insert({
            optimization_type: 'automated',
            analysis_results: { optimization },
            recommendations: [optimization],
            performance_metrics: this.performanceMetrics,
            status: 'implemented',
            implementation_date: new Date().toISOString()
          });

        if (!error) {
          appliedCount++;
          logger.info({ optimization: optimization.type }, 'Optimization applied');
        }
      }

      return appliedCount > 0;

    } catch (error) {
      logger.error({ err: error }, 'Error applying optimizations');
      return false;
    }
  }

  /**
   * Measure performance improvement after optimizations
   * @private
   */
  async _measurePerformanceImprovement() {
    // This would compare performance before and after optimizations
    // For now, return a placeholder
    return {
      improvement_percentage: 0,
      confidence: 'low',
      measurement_period: '24_hours'
    };
  }

  /**
   * Get recent optimizations
   * @private
   */
  async _getRecentOptimizations() {
    try {
      const { data: optimizations, error } = await supabase
        .from('strategy_optimizations')
        .select('*')
        .gte('optimization_timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('optimization_timestamp', { ascending: false })
        .limit(10);

      return optimizations || [];

    } catch (error) {
      logger.warn({ err: error }, 'Error getting recent optimizations');
      return [];
    }
  }

  /**
   * Get top performing strategies
   * @private
   */
  async _getTopPerformingStrategies() {
    try {
      const { data: strategies, error } = await supabase
        .from('strategy_performance')
        .select('*')
        .order('success_rate', { ascending: false })
        .limit(5);

      return strategies || [];

    } catch (error) {
      logger.warn({ err: error }, 'Error getting top performing strategies');
      return [];
    }
  }

  /**
   * Get recent learning insights
   * @private
   */
  async _getRecentLearningInsights() {
    try {
      const { data: insights, error } = await supabase
        .from('recent_learning_insights')
        .select('*')
        .limit(10);

      return insights || [];

    } catch (error) {
      logger.warn({ err: error }, 'Error getting recent learning insights');
      return [];
    }
  }

  /**
   * Get simulation summary
   * @private
   */
  async _getSimulationSummary() {
    try {
      // simulation_results table removed in cleanup
      // Return empty summary for now
      logger.info('Simulation summary requested but simulation_results table was removed in cleanup');
      return { total: 0, success_rate: 0, note: 'simulation_results table removed' };

      const total = simulations.length;
      const successful = simulations.filter(s => s.outcome === 'appointment_booked').length;
      const avgEngagement = simulations.reduce((sum, s) => sum + s.engagement_score, 0) / total;

      return {
        total,
        success_rate: successful / total,
        avg_engagement_score: avgEngagement
      };

    } catch (error) {
      logger.warn({ err: error }, 'Error getting simulation summary');
      return { total: 0, success_rate: 0 };
    }
  }
}

module.exports = new AILearningManager();
