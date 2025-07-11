const MultiLayerAI = require('../services/multiLayerAI');
const multiLayerIntegration = require('../services/multiLayerIntegration');
const multiLayerMonitoring = require('../services/multiLayerMonitoring');
const logger = require('../logger');

/**
 * Multi-Layer AI Testing Suite
 * 
 * Comprehensive testing for the 5-layer AI architecture:
 * 1. Individual layer testing
 * 2. End-to-end processing validation
 * 3. Fact-checking accuracy verification
 * 4. Challenging lead scenario testing
 * 5. Performance and conversion metrics
 */
class MultiLayerAITest {
  constructor() {
    this.testResults = {
      layerTests: {},
      integrationTests: {},
      scenarioTests: {},
      performanceTests: {},
      factCheckTests: {}
    };
    
    this.challengingScenarios = [
      {
        name: 'Resistant Singaporean Buyer',
        description: 'Tired of agent calls, price-sensitive, browsing vs serious',
        leadData: {
          name: 'Alex Tan',
          source: 'Facebook Ad',
          status: 'new',
          budget: '$800,000',
          intent: 'own_stay'
        },
        conversationHistory: [
          { sender: 'lead', message: 'Hi' },
          { sender: 'bot', message: 'Hello! I\'m Doro, your property consultant. How can I help you today?' }
        ],
        testMessage: 'Look, I\'ve been getting calls from so many agents already. I\'m just browsing for now, not ready to buy anything yet.',
        expectedOutcomes: {
          shouldBuildRapport: true,
          shouldNotPushAppointment: true,
          shouldProvideValue: true,
          shouldAddressResistance: true
        }
      },
      {
        name: 'Serious Investor with Specific Requirements',
        description: 'Investment-focused, specific district preference, budget-conscious',
        leadData: {
          name: 'Jennifer Lim',
          source: 'Instagram Ad',
          status: 'qualified',
          budget: '$1,200,000',
          intent: 'investment'
        },
        conversationHistory: [
          { sender: 'lead', message: 'I\'m looking for investment properties' },
          { sender: 'bot', message: 'Great! I specialize in investment properties. What\'s your target area and budget?' },
          { sender: 'lead', message: 'District 9 or 10, around 1.2M budget' }
        ],
        testMessage: 'Do you have any new launches in District 9 with good rental yield potential? I need to see floor plans and pricing.',
        expectedOutcomes: {
          shouldProvideSpecificProperties: true,
          shouldIncludeFloorPlans: true,
          shouldMentionRentalYield: true,
          shouldOfferConsultation: true
        }
      },
      {
        name: 'First-Time Buyer with Budget Concerns',
        description: 'Young professional, first-time buyer, budget-sensitive',
        leadData: {
          name: 'David Wong',
          source: 'Google Ad',
          status: 'interested',
          budget: '$600,000',
          intent: 'own_stay'
        },
        conversationHistory: [
          { sender: 'lead', message: 'I\'m a first-time buyer' },
          { sender: 'bot', message: 'Congratulations on taking this important step! I\'d love to help you find your first home.' }
        ],
        testMessage: 'I\'m worried about the prices. Everything seems so expensive. Are there any affordable options for someone like me?',
        expectedOutcomes: {
          shouldProvideAffordableOptions: true,
          shouldEducateAboutProcess: true,
          shouldBuildConfidence: true,
          shouldMentionGovernmentSchemes: true
        }
      }
    ];
  }

  /**
   * Run comprehensive test suite
   */
  async runFullTestSuite() {
    logger.info('Starting Multi-Layer AI comprehensive test suite');
    
    try {
      // Test individual layers
      await this.testIndividualLayers();
      
      // Test integration
      await this.testIntegration();
      
      // Test challenging scenarios
      await this.testChallengingScenarios();
      
      // Test fact-checking accuracy
      await this.testFactCheckingAccuracy();
      
      // Test performance metrics
      await this.testPerformanceMetrics();
      
      // Generate comprehensive report
      const report = this.generateTestReport();
      
      logger.info('Multi-Layer AI test suite completed');
      return report;
      
    } catch (error) {
      logger.error({ err: error }, 'Error running test suite');
      throw error;
    }
  }

  /**
   * Test individual AI layers
   */
  async testIndividualLayers() {
    logger.info('Testing individual AI layers');
    
    const multiLayerAI = new MultiLayerAI();
    const testLead = {
      id: 'test-lead-1',
      name: 'Test User',
      source: 'test',
      status: 'new'
    };
    
    // Test Layer 1: Psychology Analysis
    try {
      const psychologyResult = await multiLayerAI._layer1_psychologyAnalysis({
        leadId: testLead.id,
        userText: 'I\'m interested in buying a property but not sure about the market',
        conversationHistory: [],
        leadData: testLead,
        operationId: 'test-psychology'
      });
      
      this.testResults.layerTests.psychology = {
        success: !!psychologyResult.communicationStyle,
        processingTime: psychologyResult.processingTime,
        hasRequiredFields: !!(
          psychologyResult.communicationStyle &&
          psychologyResult.resistanceLevel &&
          psychologyResult.urgencyScore !== undefined &&
          psychologyResult.appointmentReadiness
        )
      };
      
    } catch (error) {
      this.testResults.layerTests.psychology = {
        success: false,
        error: error.message
      };
    }

    // Test Layer 2: Intelligence Gathering
    try {
      const intelligenceResult = await multiLayerAI._layer2_intelligenceGathering({
        psychologyAnalysis: { communicationStyle: 'polite', resistanceLevel: 'medium' },
        userText: 'Show me properties in District 9 under $1M',
        leadData: testLead,
        operationId: 'test-intelligence'
      });
      
      this.testResults.layerTests.intelligence = {
        success: !!intelligenceResult.propertyData,
        processingTime: intelligenceResult.processingTime,
        hasPropertyData: Array.isArray(intelligenceResult.propertyData),
        factChecked: !!intelligenceResult.factCheckResults,
        dataConfidence: intelligenceResult.dataConfidence
      };
      
    } catch (error) {
      this.testResults.layerTests.intelligence = {
        success: false,
        error: error.message
      };
    }

    logger.info('Individual layer testing completed');
  }

  /**
   * Test integration with message orchestrator
   */
  async testIntegration() {
    logger.info('Testing multi-layer integration');
    
    try {
      const testParams = {
        leadId: 'test-lead-integration',
        senderWaId: 'test-wa-id',
        batchedMessages: [{
          userText: 'I want to buy a condo in Orchard area',
          senderName: 'Test User',
          timestamp: Date.now()
        }],
        leadData: {
          id: 'test-lead-integration',
          name: 'Test User',
          source: 'test',
          status: 'new',
          budget: '$1,000,000',
          intent: 'own_stay'
        },
        conversationHistory: []
      };
      
      const result = await multiLayerIntegration.processBatchedMessages(testParams);
      
      this.testResults.integrationTests.messageProcessing = {
        success: result.success,
        hasResponse: !!result.response,
        processingTime: result.metrics?.processingTime,
        qualityScore: result.metrics?.qualityScore,
        appointmentIntent: result.appointmentIntent,
        synthesized: result.synthesized
      };
      
    } catch (error) {
      this.testResults.integrationTests.messageProcessing = {
        success: false,
        error: error.message
      };
    }

    logger.info('Integration testing completed');
  }

  /**
   * Test challenging lead scenarios
   */
  async testChallengingScenarios() {
    logger.info('Testing challenging lead scenarios');
    
    for (const scenario of this.challengingScenarios) {
      try {
        logger.info(`Testing scenario: ${scenario.name}`);
        
        const result = await multiLayerIntegration.processBatchedMessages({
          leadId: `test-${scenario.name.toLowerCase().replace(/\s+/g, '-')}`,
          senderWaId: 'test-scenario-wa-id',
          batchedMessages: [{
            userText: scenario.testMessage,
            senderName: scenario.leadData.name,
            timestamp: Date.now()
          }],
          leadData: scenario.leadData,
          conversationHistory: scenario.conversationHistory
        });
        
        // Analyze response against expected outcomes
        const analysis = this.analyzeScenarioResponse(result, scenario);
        
        this.testResults.scenarioTests[scenario.name] = {
          success: result.success,
          response: result.response,
          analysis,
          processingTime: result.metrics?.processingTime,
          qualityScore: result.metrics?.qualityScore,
          meetsExpectations: analysis.overallScore > 0.7
        };
        
      } catch (error) {
        this.testResults.scenarioTests[scenario.name] = {
          success: false,
          error: error.message
        };
      }
    }

    logger.info('Challenging scenario testing completed');
  }

  /**
   * Test fact-checking accuracy
   */
  async testFactCheckingAccuracy() {
    logger.info('Testing fact-checking accuracy');
    
    const factCheckTests = [
      {
        query: 'Marina One Residences Singapore price launch date',
        expectedAccuracy: 0.8
      },
      {
        query: 'Parc Esta Eunos new launch developer',
        expectedAccuracy: 0.8
      }
    ];
    
    for (const test of factCheckTests) {
      try {
        const { web_search } = require('../services/webSearchService');
        const results = await web_search(test.query, { num_results: 3 });
        
        this.testResults.factCheckTests[test.query] = {
          success: results && results.length > 0,
          resultsCount: results?.length || 0,
          hasRelevantResults: results?.some(r => r.relevanceScore > 0.7),
          averageRelevance: results?.reduce((sum, r) => sum + r.relevanceScore, 0) / results?.length || 0
        };
        
      } catch (error) {
        this.testResults.factCheckTests[test.query] = {
          success: false,
          error: error.message
        };
      }
    }

    logger.info('Fact-checking accuracy testing completed');
  }

  /**
   * Test performance metrics
   */
  async testPerformanceMetrics() {
    logger.info('Testing performance metrics');
    
    const healthStatus = multiLayerMonitoring.getHealthStatus();
    const performanceReport = multiLayerMonitoring.getPerformanceReport();
    
    this.testResults.performanceTests = {
      healthStatus: healthStatus.overall.status,
      averageProcessingTime: healthStatus.overall.averageProcessingTime,
      successRate: healthStatus.overall.successRate,
      conversionRate: healthStatus.overall.conversionRate,
      layerHealth: healthStatus.layers,
      activeAlerts: healthStatus.alerts.length,
      recommendations: performanceReport.recommendations
    };

    logger.info('Performance metrics testing completed');
  }

  /**
   * Analyze scenario response against expected outcomes
   * @private
   */
  analyzeScenarioResponse(result, scenario) {
    const response = result.response?.toLowerCase() || '';
    const analysis = {
      scores: {},
      overallScore: 0
    };
    
    const expectations = scenario.expectedOutcomes;
    let totalChecks = 0;
    let passedChecks = 0;
    
    // Check each expectation
    Object.keys(expectations).forEach(expectation => {
      totalChecks++;
      let passed = false;
      
      switch (expectation) {
        case 'shouldBuildRapport':
          passed = response.includes('understand') || response.includes('help') || response.includes('appreciate');
          break;
        case 'shouldNotPushAppointment':
          passed = !response.includes('book') && !response.includes('schedule') && !response.includes('meet');
          break;
        case 'shouldProvideValue':
          passed = response.includes('market') || response.includes('property') || response.includes('information');
          break;
        case 'shouldAddressResistance':
          passed = response.includes('no pressure') || response.includes('take your time') || response.includes('when ready');
          break;
        case 'shouldProvideSpecificProperties':
          passed = response.includes('district') || response.includes('property') || response.includes('development');
          break;
        case 'shouldIncludeFloorPlans':
          passed = result.floorPlanImages?.length > 0 || response.includes('floor plan');
          break;
        case 'shouldOfferConsultation':
          passed = response.includes('consultation') || response.includes('discuss') || response.includes('chat');
          break;
      }
      
      analysis.scores[expectation] = passed ? 1 : 0;
      if (passed) passedChecks++;
    });
    
    analysis.overallScore = totalChecks > 0 ? passedChecks / totalChecks : 0;
    
    return analysis;
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        overallScore: 0
      },
      layerTests: this.testResults.layerTests,
      integrationTests: this.testResults.integrationTests,
      scenarioTests: this.testResults.scenarioTests,
      factCheckTests: this.testResults.factCheckTests,
      performanceTests: this.testResults.performanceTests,
      recommendations: []
    };
    
    // Calculate summary statistics
    let totalTests = 0;
    let passedTests = 0;
    
    // Count layer tests
    Object.values(this.testResults.layerTests).forEach(test => {
      totalTests++;
      if (test.success) passedTests++;
    });
    
    // Count integration tests
    Object.values(this.testResults.integrationTests).forEach(test => {
      totalTests++;
      if (test.success) passedTests++;
    });
    
    // Count scenario tests
    Object.values(this.testResults.scenarioTests).forEach(test => {
      totalTests++;
      if (test.success && test.meetsExpectations) passedTests++;
    });
    
    report.summary.totalTests = totalTests;
    report.summary.passedTests = passedTests;
    report.summary.failedTests = totalTests - passedTests;
    report.summary.overallScore = totalTests > 0 ? passedTests / totalTests : 0;
    
    // Generate recommendations
    if (report.summary.overallScore < 0.8) {
      report.recommendations.push('System performance below 80% - review failed tests and improve layer processing');
    }
    
    if (this.testResults.performanceTests.averageProcessingTime > 25000) {
      report.recommendations.push('Processing time exceeds 25 seconds - optimize layer performance');
    }
    
    if (this.testResults.performanceTests.activeAlerts > 0) {
      report.recommendations.push('Active monitoring alerts detected - review system health');
    }
    
    return report;
  }
}

module.exports = MultiLayerAITest;
