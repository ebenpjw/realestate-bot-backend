/**
 * AI Learning Service - Continuous improvement through conversation outcome analysis
 * Tracks strategy effectiveness, learns from successful patterns, and optimizes future conversations
 */

const logger = require('../logger');
const supabase = require('../supabaseClient');

class AILearningService {
  constructor() {
    this.learningMetrics = new Map();
    this.strategyPerformance = new Map();
    this.lastOptimization = null;
    this.optimizationInterval = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Record conversation outcome with detailed strategy tracking
   * Called when a conversation reaches a definitive outcome
   */
  async recordConversationOutcome(leadId, outcome, strategyData) {
    try {
      const outcomeRecord = {
        lead_id: leadId,
        outcome_type: outcome.type, // 'appointment_booked', 'lead_lost', 'consultation_declined', 'still_nurturing'
        outcome_timestamp: new Date().toISOString(),
        
        // Strategy details used in this conversation
        strategies_used: strategyData.strategies_used || [],
        psychology_principles: strategyData.psychology_principles || [],
        conversation_approach: strategyData.conversation_approach,
        consultation_timing: strategyData.consultation_timing,
        market_data_used: strategyData.market_data_used || false,
        
        // Conversation metrics
        total_messages: outcome.total_messages || 0,
        conversation_duration_minutes: outcome.conversation_duration_minutes || 0,
        engagement_score: outcome.engagement_score || 0,
        objections_encountered: outcome.objections_encountered || [],
        
        // Success factors
        success_factors: outcome.success_factors || [],
        failure_factors: outcome.failure_factors || [],
        
        // Context
        lead_profile: {
          intent: outcome.lead_intent,
          budget: outcome.lead_budget,
          timeline: outcome.lead_timeline,
          source: outcome.lead_source
        }
      };

      // Store in database
      const { error } = await supabase
        .from('conversation_outcomes')
        .insert(outcomeRecord);

      if (error) {
        logger.error({ err: error, leadId }, 'Failed to record conversation outcome');
        return;
      }

      // Update in-memory performance tracking
      this._updateStrategyPerformance(outcomeRecord);

      // Check if optimization is needed
      await this._checkOptimizationTrigger();

      logger.info({
        leadId,
        outcomeType: outcome.type,
        strategiesUsed: strategyData.strategies_used?.length || 0,
        engagementScore: outcome.engagement_score
      }, 'Conversation outcome recorded for learning');

    } catch (error) {
      logger.error({ err: error, leadId }, 'Error recording conversation outcome');
    }
  }

  /**
   * Get optimized strategy recommendations based on historical performance
   */
  async getOptimizedStrategy(leadProfile, contextAnalysis) {
    try {
      // Find similar successful conversations
      const similarSuccesses = await this._findSimilarSuccessfulConversations(leadProfile, contextAnalysis);
      
      // Analyze current strategy performance
      const performanceData = await this._analyzeCurrentPerformance();
      
      // Generate recommendations
      const recommendations = this._generateStrategyRecommendations(
        similarSuccesses,
        performanceData,
        leadProfile,
        contextAnalysis
      );

      logger.info({
        leadProfile: leadProfile.intent,
        journeyStage: contextAnalysis.journey_stage,
        recommendationsCount: recommendations.strategies.length,
        confidenceScore: recommendations.confidence_score
      }, 'Generated optimized strategy recommendations');

      return recommendations;

    } catch (error) {
      logger.error({ err: error }, 'Error generating optimized strategy');
      return this._getDefaultRecommendations();
    }
  }

  /**
   * Analyze strategy effectiveness across different lead types
   */
  async analyzeStrategyEffectiveness() {
    try {
      const { data: outcomes, error } = await supabase
        .from('conversation_outcomes')
        .select('*')
        .gte('outcome_timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .order('outcome_timestamp', { ascending: false });

      if (error) {
        logger.error({ err: error }, 'Failed to fetch conversation outcomes for analysis');
        return null;
      }

      const analysis = {
        overall_metrics: this._calculateOverallMetrics(outcomes),
        strategy_performance: this._analyzeStrategyPerformance(outcomes),
        psychology_effectiveness: this._analyzePsychologyEffectiveness(outcomes),
        timing_analysis: this._analyzeTimingEffectiveness(outcomes),
        lead_type_patterns: this._analyzeLeadTypePatterns(outcomes),
        improvement_opportunities: this._identifyImprovementOpportunities(outcomes)
      };

      logger.info({
        totalOutcomes: outcomes.length,
        successRate: analysis.overall_metrics.success_rate,
        topStrategy: analysis.strategy_performance[0]?.strategy,
        improvementOpportunities: analysis.improvement_opportunities.length
      }, 'Strategy effectiveness analysis completed');

      return analysis;

    } catch (error) {
      logger.error({ err: error }, 'Error analyzing strategy effectiveness');
      return null;
    }
  }

  /**
   * Update strategy performance tracking
   * @private
   */
  _updateStrategyPerformance(outcomeRecord) {
    const isSuccess = outcomeRecord.outcome_type === 'appointment_booked';
    
    // Track each strategy used
    outcomeRecord.strategies_used.forEach(strategy => {
      if (!this.strategyPerformance.has(strategy)) {
        this.strategyPerformance.set(strategy, {
          total_uses: 0,
          successes: 0,
          total_engagement: 0,
          avg_messages_to_outcome: 0,
          lead_types: new Map()
        });
      }

      const performance = this.strategyPerformance.get(strategy);
      performance.total_uses++;
      performance.total_engagement += outcomeRecord.engagement_score;
      performance.avg_messages_to_outcome = 
        (performance.avg_messages_to_outcome * (performance.total_uses - 1) + outcomeRecord.total_messages) / performance.total_uses;

      if (isSuccess) {
        performance.successes++;
      }

      // Track by lead type
      const leadType = `${outcomeRecord.lead_profile.intent}_${outcomeRecord.lead_profile.source}`;
      if (!performance.lead_types.has(leadType)) {
        performance.lead_types.set(leadType, { uses: 0, successes: 0 });
      }
      const leadTypeData = performance.lead_types.get(leadType);
      leadTypeData.uses++;
      if (isSuccess) leadTypeData.successes++;
    });
  }

  /**
   * Find similar successful conversations for pattern matching
   * @private
   */
  async _findSimilarSuccessfulConversations(leadProfile, contextAnalysis) {
    try {
      const { data: successfulOutcomes, error } = await supabase
        .from('conversation_outcomes')
        .select('*')
        .eq('outcome_type', 'appointment_booked')
        .gte('outcome_timestamp', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()) // Last 60 days
        .order('engagement_score', { ascending: false })
        .limit(50);

      if (error || !successfulOutcomes) {
        return [];
      }

      // Calculate similarity scores
      const similarConversations = successfulOutcomes
        .map(outcome => ({
          ...outcome,
          similarity_score: this._calculateSimilarityScore(leadProfile, contextAnalysis, outcome)
        }))
        .filter(outcome => outcome.similarity_score > 0.6) // 60% similarity threshold
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, 10); // Top 10 most similar

      return similarConversations;

    } catch (error) {
      logger.error({ err: error }, 'Error finding similar successful conversations');
      return [];
    }
  }

  /**
   * Calculate similarity between current lead and historical successful lead
   * @private
   */
  _calculateSimilarityScore(currentProfile, currentContext, historicalOutcome) {
    let score = 0;
    let factors = 0;

    // Intent similarity (30% weight)
    if (currentProfile.intent === historicalOutcome.lead_profile.intent) {
      score += 0.3;
    }
    factors++;

    // Journey stage similarity (25% weight)
    if (currentContext.journey_stage === historicalOutcome.conversation_approach) {
      score += 0.25;
    }
    factors++;

    // Source similarity (15% weight)
    if (currentProfile.source === historicalOutcome.lead_profile.source) {
      score += 0.15;
    }
    factors++;

    // Comfort level similarity (20% weight)
    if (currentContext.comfort_level && historicalOutcome.lead_profile.comfort_level) {
      if (currentContext.comfort_level === historicalOutcome.lead_profile.comfort_level) {
        score += 0.2;
      }
    }
    factors++;

    // Budget range similarity (10% weight)
    if (currentProfile.budget && historicalOutcome.lead_profile.budget) {
      // Simple budget range matching logic
      score += 0.1;
    }
    factors++;

    return score;
  }

  /**
   * Generate strategy recommendations based on analysis
   * @private
   */
  _generateStrategyRecommendations(similarSuccesses, performanceData, leadProfile, contextAnalysis) {
    const recommendations = {
      strategies: [],
      psychology_principles: [],
      timing_recommendations: {},
      confidence_score: 0,
      reasoning: []
    };

    if (similarSuccesses.length === 0) {
      return this._getDefaultRecommendations();
    }

    // Extract most successful strategies from similar conversations
    const strategyFrequency = new Map();
    const psychologyFrequency = new Map();

    similarSuccesses.forEach(success => {
      success.strategies_used.forEach(strategy => {
        strategyFrequency.set(strategy, (strategyFrequency.get(strategy) || 0) + 1);
      });

      success.psychology_principles.forEach(principle => {
        psychologyFrequency.set(principle, (psychologyFrequency.get(principle) || 0) + 1);
      });
    });

    // Convert to recommendations with success rates
    recommendations.strategies = Array.from(strategyFrequency.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([strategy, frequency]) => ({
        strategy,
        success_rate: frequency / similarSuccesses.length,
        confidence: frequency >= 3 ? 'high' : frequency >= 2 ? 'medium' : 'low'
      }));

    recommendations.psychology_principles = Array.from(psychologyFrequency.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([principle, frequency]) => ({
        principle,
        success_rate: frequency / similarSuccesses.length
      }));

    // Calculate confidence score
    recommendations.confidence_score = Math.min(
      0.9,
      (similarSuccesses.length / 10) * 0.5 + 
      (recommendations.strategies[0]?.success_rate || 0) * 0.5
    );

    recommendations.reasoning = [
      `Based on ${similarSuccesses.length} similar successful conversations`,
      `Top strategy: ${recommendations.strategies[0]?.strategy} (${Math.round(recommendations.strategies[0]?.success_rate * 100)}% success rate)`,
      `Confidence: ${Math.round(recommendations.confidence_score * 100)}%`
    ];

    return recommendations;
  }

  /**
   * Get default recommendations when no learning data available
   * @private
   */
  _getDefaultRecommendations() {
    return {
      strategies: [
        { strategy: 'rapport_building_first', success_rate: 0.65, confidence: 'medium' },
        { strategy: 'educational_value_provision', success_rate: 0.6, confidence: 'medium' },
        { strategy: 'soft_consultation_offer', success_rate: 0.55, confidence: 'low' }
      ],
      psychology_principles: [
        { principle: 'liking', success_rate: 0.7 },
        { principle: 'reciprocity', success_rate: 0.65 },
        { principle: 'authority', success_rate: 0.6 }
      ],
      timing_recommendations: {
        consultation_offer: 'after_value_provision',
        market_data_sharing: 'during_needs_discovery'
      },
      confidence_score: 0.3,
      reasoning: ['Using default recommendations - insufficient learning data available']
    };
  }

  /**
   * Check if strategy optimization should be triggered
   * @private
   */
  async _checkOptimizationTrigger() {
    const now = Date.now();
    
    if (!this.lastOptimization || (now - this.lastOptimization) > this.optimizationInterval) {
      await this._optimizeStrategies();
      this.lastOptimization = now;
    }
  }

  /**
   * Optimize strategies based on recent performance data
   * @private
   */
  async _optimizeStrategies() {
    try {
      logger.info('Starting automated strategy optimization');

      const analysis = await this.analyzeStrategyEffectiveness();
      if (!analysis) return;

      // Store optimization results
      const optimizationRecord = {
        optimization_timestamp: new Date().toISOString(),
        analysis_results: analysis,
        recommendations: this._generateOptimizationRecommendations(analysis),
        performance_metrics: {
          overall_success_rate: analysis.overall_metrics.success_rate,
          avg_messages_to_conversion: analysis.overall_metrics.avg_messages_to_conversion,
          top_performing_strategies: analysis.strategy_performance.slice(0, 3)
        }
      };

      const { error } = await supabase
        .from('strategy_optimizations')
        .insert(optimizationRecord);

      if (error) {
        logger.error({ err: error }, 'Failed to store optimization results');
      } else {
        logger.info({
          successRate: analysis.overall_metrics.success_rate,
          topStrategy: analysis.strategy_performance[0]?.strategy,
          improvementOpportunities: analysis.improvement_opportunities.length
        }, 'Strategy optimization completed and stored');
      }

    } catch (error) {
      logger.error({ err: error }, 'Error during strategy optimization');
    }
  }

  /**
   * Run automated conversation simulations for strategy testing
   */
  async runConversationSimulations(strategyToTest, simulationCount = 100) {
    try {
      logger.info({ strategyToTest, simulationCount }, 'Starting conversation simulations');

      const batchId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const results = [];

      for (let i = 0; i < simulationCount; i++) {
        const simulatedLead = this._generateSimulatedLead();
        const simulationResult = await this._runSingleSimulation(batchId, simulatedLead, strategyToTest);
        results.push(simulationResult);

        // Add small delay to prevent overwhelming the system
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Analyze simulation results
      const analysis = this._analyzeSimulationResults(results);

      logger.info({
        batchId,
        totalSimulations: results.length,
        successRate: analysis.success_rate,
        avgMessagesToOutcome: analysis.avg_messages_to_outcome,
        topSuccessFactors: analysis.top_success_factors.slice(0, 3)
      }, 'Conversation simulations completed');

      return {
        batch_id: batchId,
        results,
        analysis
      };

    } catch (error) {
      logger.error({ err: error }, 'Error running conversation simulations');
      throw error;
    }
  }

  /**
   * Generate a realistic simulated lead profile
   * @private
   */
  _generateSimulatedLead() {
    const intents = ['own_stay', 'investment', 'hybrid'];
    const sources = ['WA Direct', 'Facebook', 'Instagram', 'Referral'];
    const budgets = ['500k-800k', '800k-1.2m', '1.2m-1.8m', '1.8m+'];
    const timelines = ['immediate', '1-3 months', '3-6 months', '6+ months'];
    const personalities = ['analytical', 'relationship-focused', 'results-driven', 'cautious', 'impulsive'];
    const objectionTypes = ['budget_concerns', 'timing_issues', 'market_uncertainty', 'agent_trust', 'property_availability'];

    return {
      intent: intents[Math.floor(Math.random() * intents.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      budget: budgets[Math.floor(Math.random() * budgets.length)],
      timeline: timelines[Math.floor(Math.random() * timelines.length)],
      personality: personalities[Math.floor(Math.random() * personalities.length)],
      likely_objections: this._selectRandomObjections(objectionTypes, Math.floor(Math.random() * 3) + 1),
      engagement_tendency: Math.random() * 100, // 0-100 likelihood to engage
      trust_level: Math.random() * 100, // 0-100 initial trust
      decision_speed: Math.random() * 100 // 0-100 how quickly they make decisions
    };
  }

  /**
   * Run a single conversation simulation
   * @private
   */
  async _runSingleSimulation(batchId, simulatedLead, strategy) {
    try {
      // Simulate conversation flow based on strategy and lead personality
      const conversationFlow = this._simulateConversationFlow(simulatedLead, strategy);

      // Determine outcome based on strategy effectiveness and lead characteristics
      const outcome = this._determineSimulationOutcome(simulatedLead, strategy, conversationFlow);

      // Store simulation result
      const simulationResult = {
        simulation_batch_id: batchId,
        simulated_lead_profile: simulatedLead,
        simulated_personality: simulatedLead.personality,
        simulated_objections: simulatedLead.likely_objections,
        strategy_configuration: strategy,
        psychology_principles_used: strategy.psychology_principles || [],
        outcome: outcome.type,
        messages_to_outcome: outcome.messages_to_outcome,
        engagement_score: outcome.engagement_score,
        objections_handled: outcome.objections_handled,
        success_factors: outcome.success_factors,
        failure_factors: outcome.failure_factors,
        insights_generated: outcome.insights
      };

      // Store in database
      const { error } = await supabase
        .from('simulation_results')
        .insert(simulationResult);

      if (error) {
        logger.warn({ err: error, batchId }, 'Failed to store simulation result');
      }

      return simulationResult;

    } catch (error) {
      logger.error({ err: error, batchId }, 'Error in single simulation');
      return null;
    }
  }

  /**
   * Simulate conversation flow based on lead personality and strategy
   * @private
   */
  _simulateConversationFlow(lead, strategy) {
    const flow = {
      stages: [],
      objections_encountered: [],
      engagement_points: [],
      decision_points: []
    };

    // Simulate conversation stages based on strategy
    const stages = ['rapport_building', 'needs_discovery', 'value_provision', 'consultation_offer'];
    let currentEngagement = lead.engagement_tendency;
    let currentTrust = lead.trust_level;

    stages.forEach((stage, index) => {
      // Calculate stage effectiveness based on strategy and lead personality
      const stageEffectiveness = this._calculateStageEffectiveness(stage, strategy, lead);

      // Update engagement and trust based on stage performance
      currentEngagement += stageEffectiveness.engagement_change;
      currentTrust += stageEffectiveness.trust_change;

      flow.stages.push({
        stage,
        effectiveness: stageEffectiveness.score,
        engagement_after: Math.max(0, Math.min(100, currentEngagement)),
        trust_after: Math.max(0, Math.min(100, currentTrust)),
        objections_triggered: stageEffectiveness.objections_triggered
      });

      // Add objections if triggered
      flow.objections_encountered.push(...stageEffectiveness.objections_triggered);
    });

    return flow;
  }

  /**
   * Calculate how effective a conversation stage is for a given lead and strategy
   * @private
   */
  _calculateStageEffectiveness(stage, strategy, lead) {
    let score = 50; // Base effectiveness
    let engagementChange = 0;
    let trustChange = 0;
    let objectionsTriggered = [];

    // Strategy-specific effectiveness
    if (strategy.strategies_used.includes('rapport_building_first') && stage === 'rapport_building') {
      score += 20;
      engagementChange += 15;
      trustChange += 10;
    }

    if (strategy.strategies_used.includes('educational_value_provision') && stage === 'value_provision') {
      score += 15;
      engagementChange += 10;
    }

    // Lead personality impact
    switch (lead.personality) {
      case 'analytical':
        if (stage === 'value_provision') score += 15;
        if (stage === 'rapport_building') score -= 5;
        break;
      case 'relationship-focused':
        if (stage === 'rapport_building') score += 20;
        if (stage === 'consultation_offer') score -= 10;
        break;
      case 'results-driven':
        if (stage === 'consultation_offer') score += 15;
        if (stage === 'rapport_building') score -= 10;
        break;
      case 'cautious':
        if (stage === 'consultation_offer') score -= 15;
        objectionsTriggered.push('trust_concerns');
        break;
    }

    // Random objection triggering based on lead's likely objections
    if (Math.random() < 0.3) { // 30% chance of objection in any stage
      const randomObjection = lead.likely_objections[Math.floor(Math.random() * lead.likely_objections.length)];
      if (randomObjection) {
        objectionsTriggered.push(randomObjection);
        score -= 10;
        engagementChange -= 5;
      }
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      engagement_change: engagementChange,
      trust_change: trustChange,
      objections_triggered: objectionsTriggered
    };
  }

  /**
   * Determine the final outcome of a simulated conversation
   * @private
   */
  _determineSimulationOutcome(lead, strategy, conversationFlow) {
    const finalStage = conversationFlow.stages[conversationFlow.stages.length - 1];
    const finalEngagement = finalStage.engagement_after;
    const finalTrust = finalStage.trust_after;
    const totalObjections = conversationFlow.objections_encountered.length;

    // Calculate success probability
    let successProbability = 0;
    successProbability += finalEngagement * 0.4; // 40% weight on engagement
    successProbability += finalTrust * 0.3; // 30% weight on trust
    successProbability += lead.decision_speed * 0.2; // 20% weight on decision speed
    successProbability -= totalObjections * 5; // Reduce by 5% per objection
    successProbability = Math.max(0, Math.min(100, successProbability));

    // Determine outcome
    const random = Math.random() * 100;
    let outcomeType;
    if (random < successProbability) {
      outcomeType = 'appointment_booked';
    } else if (random < successProbability + 20) {
      outcomeType = 'still_nurturing';
    } else if (random < successProbability + 40) {
      outcomeType = 'consultation_declined';
    } else {
      outcomeType = 'lead_lost';
    }

    // Calculate metrics
    const messagesToOutcome = Math.floor(4 + (conversationFlow.stages.length * 2) + (totalObjections * 1.5));
    const engagementScore = finalEngagement;

    return {
      type: outcomeType,
      messages_to_outcome: messagesToOutcome,
      engagement_score: engagementScore,
      objections_handled: totalObjections,
      success_factors: this._identifySuccessFactors(conversationFlow, strategy, outcomeType),
      failure_factors: this._identifyFailureFactors(conversationFlow, strategy, outcomeType),
      insights: {
        final_engagement: finalEngagement,
        final_trust: finalTrust,
        success_probability: successProbability,
        key_turning_points: conversationFlow.stages.filter(s => Math.abs(s.effectiveness - 50) > 20)
      }
    };
  }

  /**
   * Select random objections for simulated lead
   * @private
   */
  _selectRandomObjections(objectionTypes, count) {
    const shuffled = [...objectionTypes].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Identify success factors from simulation
   * @private
   */
  _identifySuccessFactors(conversationFlow, strategy, outcome) {
    const factors = [];

    if (outcome === 'appointment_booked') {
      // Find high-performing stages
      conversationFlow.stages.forEach(stage => {
        if (stage.effectiveness > 70) {
          factors.push(`effective_${stage.stage}`);
        }
      });

      // Strategy-specific success factors
      if (strategy.strategies_used.includes('rapport_building_first')) {
        factors.push('strong_rapport_foundation');
      }
      if (strategy.strategies_used.includes('educational_value_provision')) {
        factors.push('valuable_insights_shared');
      }
    }

    return factors;
  }

  /**
   * Identify failure factors from simulation
   * @private
   */
  _identifyFailureFactors(conversationFlow, strategy, outcome) {
    const factors = [];

    if (outcome === 'lead_lost' || outcome === 'consultation_declined') {
      // Find low-performing stages
      conversationFlow.stages.forEach(stage => {
        if (stage.effectiveness < 30) {
          factors.push(`poor_${stage.stage}`);
        }
      });

      // Objection handling issues
      if (conversationFlow.objections_encountered.length > 2) {
        factors.push('too_many_objections');
      }
    }

    return factors;
  }

  /**
   * Analyze results from multiple simulations
   * @private
   */
  _analyzeSimulationResults(results) {
    const validResults = results.filter(r => r !== null);
    const successfulResults = validResults.filter(r => r.outcome === 'appointment_booked');

    const analysis = {
      total_simulations: validResults.length,
      successful_simulations: successfulResults.length,
      success_rate: successfulResults.length / validResults.length,
      avg_messages_to_outcome: validResults.reduce((sum, r) => sum + r.messages_to_outcome, 0) / validResults.length,
      avg_engagement_score: validResults.reduce((sum, r) => sum + r.engagement_score, 0) / validResults.length,
      top_success_factors: this._getTopFactors(successfulResults, 'success_factors'),
      top_failure_factors: this._getTopFactors(validResults.filter(r => r.outcome !== 'appointment_booked'), 'failure_factors'),
      outcome_distribution: this._getOutcomeDistribution(validResults)
    };

    return analysis;
  }

  /**
   * Get top factors from simulation results
   * @private
   */
  _getTopFactors(results, factorType) {
    const factorCounts = {};

    results.forEach(result => {
      result[factorType].forEach(factor => {
        factorCounts[factor] = (factorCounts[factor] || 0) + 1;
      });
    });

    return Object.entries(factorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([factor, count]) => ({
        factor,
        frequency: count,
        percentage: (count / results.length) * 100
      }));
  }

  /**
   * Get outcome distribution from simulation results
   * @private
   */
  _getOutcomeDistribution(results) {
    const distribution = {};

    results.forEach(result => {
      distribution[result.outcome] = (distribution[result.outcome] || 0) + 1;
    });

    return Object.entries(distribution).map(([outcome, count]) => ({
      outcome,
      count,
      percentage: (count / results.length) * 100
    }));
  }
}

module.exports = new AILearningService();
