#!/usr/bin/env node

/**
 * Fact-Checking Integration Test
 * 
 * Tests end-to-end fact-checking integration with real Singapore property data
 * and validates the multi-layer AI system's fact-checking capabilities.
 */

const config = require('../config');
const logger = require('../logger');
const { web_search, searchForPropertyVerification } = require('../services/webSearchService');
const MultiLayerAI = require('../services/multiLayerAI');

class FactCheckingIntegrationTest {
  constructor() {
    this.multiLayerAI = new MultiLayerAI();
    this.testResults = {
      webSearchTests: {},
      propertyVerificationTests: {},
      multiLayerIntegrationTests: {},
      performanceMetrics: {},
      overallSuccess: false
    };
  }

  async runTests() {
    console.log('🔍 Starting Fact-Checking Integration Tests...\n');

    try {
      // Test 1: Direct web search functionality
      await this.testWebSearchFunctionality();

      // Test 2: Property verification searches
      await this.testPropertyVerification();

      // Test 3: Multi-layer AI integration
      await this.testMultiLayerIntegration();

      // Test 4: Performance under load
      await this.testPerformanceUnderLoad();

      // Generate final report
      this.generateReport();

    } catch (error) {
      console.error('❌ Integration test failed:', error.message);
      this.testResults.criticalError = error.message;
    }
  }

  async testWebSearchFunctionality() {
    console.log('🌐 Test 1: Web Search Functionality...');

    const testQueries = [
      {
        query: 'The Continuum Singapore condo price',
        expectedKeywords: ['continuum', 'singapore', 'price', 'condo']
      },
      {
        query: 'HDB resale prices Tampines 2025',
        expectedKeywords: ['hdb', 'resale', 'tampines', 'price']
      },
      {
        query: 'Marina One Residences launch date',
        expectedKeywords: ['marina one', 'residences', 'launch']
      }
    ];

    for (const test of testQueries) {
      try {
        const startTime = Date.now();
        const results = await web_search(test.query, { num_results: 5 });
        const responseTime = Date.now() - startTime;

        const relevantResults = results.filter(result => {
          const content = (result.title + ' ' + result.snippet).toLowerCase();
          return test.expectedKeywords.some(keyword => content.includes(keyword.toLowerCase()));
        });

        this.testResults.webSearchTests[test.query] = {
          success: results.length > 0,
          totalResults: results.length,
          relevantResults: relevantResults.length,
          responseTime,
          averageRelevance: results.reduce((sum, r) => sum + (r.relevanceScore || 0), 0) / results.length,
          topResult: results[0] ? {
            title: results[0].title,
            source: results[0].displayLink,
            reliability: results[0].sourceReliability
          } : null
        };

        console.log(`   ✅ "${test.query}": ${results.length} results, ${relevantResults.length} relevant (${responseTime}ms)`);

      } catch (error) {
        console.log(`   ❌ "${test.query}": ${error.message}`);
        this.testResults.webSearchTests[test.query] = {
          success: false,
          error: error.message
        };
      }
    }

    console.log('');
  }

  async testPropertyVerification() {
    console.log('🏠 Test 2: Property Verification...');

    const testProperties = [
      {
        name: 'The Continuum',
        data: {
          project_name: 'The Continuum',
          developer: 'Hoi Hup Realty',
          district: 'District 15',
          property_type: 'Condominium'
        }
      },
      {
        name: 'Marina One Residences',
        data: {
          project_name: 'Marina One Residences',
          developer: 'M+S Pte Ltd',
          district: 'District 1',
          property_type: 'Condominium'
        }
      }
    ];

    for (const property of testProperties) {
      try {
        const startTime = Date.now();
        const verification = await searchForPropertyVerification(property.name, property.data);
        const responseTime = Date.now() - startTime;

        this.testResults.propertyVerificationTests[property.name] = {
          success: verification && verification.confidence > 0.3,
          confidence: verification?.confidence || 0,
          responseTime,
          primaryResults: verification?.primaryResults?.length || 0,
          secondaryResults: verification?.secondaryResults?.length || 0,
          crossValidation: verification?.crossValidation?.overallConfidence || 0,
          factCheckSummary: verification?.factCheckSummary || 'No summary available'
        };

        console.log(`   ✅ ${property.name}: Confidence ${(verification?.confidence || 0).toFixed(2)} (${responseTime}ms)`);

      } catch (error) {
        console.log(`   ❌ ${property.name}: ${error.message}`);
        this.testResults.propertyVerificationTests[property.name] = {
          success: false,
          error: error.message
        };
      }
    }

    console.log('');
  }

  async testMultiLayerIntegration() {
    console.log('🧠 Test 3: Multi-Layer AI Integration...');

    const testScenarios = [
      {
        userText: "I'm interested in The Continuum condo, what's the current price?",
        leadData: {
          name: 'John Tan',
          phone: '+6591234567',
          budget_min: 2000000,
          budget_max: 4000000,
          property_type: 'Condominium'
        }
      },
      {
        userText: "Can you tell me about HDB resale prices in Tampines?",
        leadData: {
          name: 'Sarah Lim',
          phone: '+6598765432',
          budget_min: 500000,
          budget_max: 800000,
          property_type: 'HDB'
        }
      }
    ];

    for (const scenario of testScenarios) {
      try {
        const startTime = Date.now();
        
        // Test Layer 2 (Intelligence Gathering) with fact-checking
        const intelligenceResult = await this.multiLayerAI._layer2_intelligenceGathering({
          psychologyAnalysis: { intent: 'property_inquiry', urgency: 'medium' },
          userText: scenario.userText,
          leadData: scenario.leadData,
          operationId: `test-${Date.now()}`
        });

        const responseTime = Date.now() - startTime;

        this.testResults.multiLayerIntegrationTests[scenario.userText] = {
          success: intelligenceResult && intelligenceResult.propertyData,
          responseTime,
          propertiesFound: intelligenceResult?.propertyData?.length || 0,
          factCheckingEnabled: intelligenceResult?.factCheckResults !== null,
          factCheckConfidence: intelligenceResult?.factCheckResults?.confidence || 0,
          marketIntelligence: !!intelligenceResult?.marketIntelligence,
          hasVerifiedProperties: intelligenceResult?.propertyData?.some(p => p.verified) || false
        };

        console.log(`   ✅ Scenario: ${scenario.userText.substring(0, 50)}...`);
        console.log(`      Properties: ${intelligenceResult?.propertyData?.length || 0}, Fact-checked: ${intelligenceResult?.factCheckResults ? 'Yes' : 'No'} (${responseTime}ms)`);

      } catch (error) {
        console.log(`   ❌ Scenario failed: ${error.message}`);
        this.testResults.multiLayerIntegrationTests[scenario.userText] = {
          success: false,
          error: error.message
        };
      }
    }

    console.log('');
  }

  async testPerformanceUnderLoad() {
    console.log('⚡ Test 4: Performance Under Load...');

    const concurrentSearches = [
      'Singapore property market trends',
      'HDB resale prices',
      'Private condo launches',
      'Property investment Singapore',
      'Real estate market analysis'
    ];

    try {
      const startTime = Date.now();
      
      // Run concurrent searches
      const promises = concurrentSearches.map(query => 
        web_search(query, { num_results: 3 }).catch(error => ({ error: error.message }))
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      const successfulSearches = results.filter(result => !result.error).length;
      const averageTime = totalTime / concurrentSearches.length;

      this.testResults.performanceMetrics = {
        totalSearches: concurrentSearches.length,
        successfulSearches,
        successRate: (successfulSearches / concurrentSearches.length) * 100,
        totalTime,
        averageTime,
        concurrentPerformance: totalTime < 10000 // Should complete within 10 seconds
      };

      console.log(`   ✅ Concurrent searches: ${successfulSearches}/${concurrentSearches.length} successful`);
      console.log(`   ✅ Total time: ${totalTime}ms, Average: ${averageTime.toFixed(0)}ms per search`);

    } catch (error) {
      console.log(`   ❌ Performance test failed: ${error.message}`);
      this.testResults.performanceMetrics = {
        success: false,
        error: error.message
      };
    }

    console.log('');
  }

  generateReport() {
    console.log('📊 FACT-CHECKING INTEGRATION REPORT');
    console.log('='.repeat(60));

    // Web Search Tests
    const webSearchSuccess = Object.values(this.testResults.webSearchTests).filter(t => t.success).length;
    const webSearchTotal = Object.keys(this.testResults.webSearchTests).length;
    console.log(`Web Search Tests: ${webSearchSuccess}/${webSearchTotal} passed`);

    // Property Verification Tests
    const verificationSuccess = Object.values(this.testResults.propertyVerificationTests).filter(t => t.success).length;
    const verificationTotal = Object.keys(this.testResults.propertyVerificationTests).length;
    console.log(`Property Verification: ${verificationSuccess}/${verificationTotal} passed`);

    // Multi-Layer Integration Tests
    const integrationSuccess = Object.values(this.testResults.multiLayerIntegrationTests).filter(t => t.success).length;
    const integrationTotal = Object.keys(this.testResults.multiLayerIntegrationTests).length;
    console.log(`Multi-Layer Integration: ${integrationSuccess}/${integrationTotal} passed`);

    // Performance Metrics
    if (this.testResults.performanceMetrics.successRate) {
      console.log(`Performance: ${this.testResults.performanceMetrics.successRate.toFixed(1)}% success rate`);
      console.log(`Average Response Time: ${this.testResults.performanceMetrics.averageTime.toFixed(0)}ms`);
    }

    // Overall Assessment
    const overallSuccess = webSearchSuccess === webSearchTotal &&
                          verificationSuccess === verificationTotal &&
                          integrationSuccess === integrationTotal &&
                          (this.testResults.performanceMetrics.successRate || 0) >= 80;

    this.testResults.overallSuccess = overallSuccess;

    console.log(`\n🎯 OVERALL STATUS: ${overallSuccess ? '✅ FACT-CHECKING READY FOR PRODUCTION' : '❌ NEEDS ATTENTION'}`);

    if (!overallSuccess) {
      console.log('\n💡 RECOMMENDATIONS:');
      if (webSearchSuccess < webSearchTotal) {
        console.log('   - Review web search query optimization');
      }
      if (verificationSuccess < verificationTotal) {
        console.log('   - Improve property verification algorithms');
      }
      if (integrationSuccess < integrationTotal) {
        console.log('   - Debug multi-layer AI integration issues');
      }
      if ((this.testResults.performanceMetrics.successRate || 0) < 80) {
        console.log('   - Optimize performance for concurrent operations');
      }
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new FactCheckingIntegrationTest();
  tester.runTests().catch(console.error);
}

module.exports = FactCheckingIntegrationTest;
