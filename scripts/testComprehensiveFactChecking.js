#!/usr/bin/env node

/**
 * Comprehensive Fact-Checking Test
 * 
 * Tests the enhanced fact-checking system with multiple search strategies
 * to demonstrate improved data collection and accuracy.
 */

const config = require('../config');
const logger = require('../logger');
const { web_search, comprehensiveFactCheck } = require('../services/webSearchService');

class ComprehensiveFactCheckTest {
  constructor() {
    this.testResults = {
      basicSearchTests: {},
      comprehensiveTests: {},
      comparisonMetrics: {},
      overallAssessment: {}
    };
  }

  async runTests() {
    console.log('🔍 Testing Comprehensive Fact-Checking System...\n');

    try {
      // Test 1: Compare basic vs comprehensive search
      await this.compareSearchMethods();

      // Test 2: Test with real Singapore properties
      await this.testRealProperties();

      // Test 3: Performance analysis
      await this.analyzePerformance();

      // Generate comprehensive report
      this.generateReport();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      this.testResults.criticalError = error.message;
    }
  }

  async compareSearchMethods() {
    console.log('📊 Test 1: Comparing Basic vs Comprehensive Search...');

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
        console.log(`\n   Testing: ${property.name}`);

        // Basic search (old method)
        const basicStartTime = Date.now();
        const basicResults = await web_search(`${property.name} Singapore property price`, { num_results: 5 });
        const basicTime = Date.now() - basicStartTime;

        // Comprehensive search (new method)
        const comprehensiveStartTime = Date.now();
        const comprehensiveResults = await comprehensiveFactCheck(property.name, property.data);
        const comprehensiveTime = Date.now() - comprehensiveStartTime;

        this.testResults.basicSearchTests[property.name] = {
          resultCount: basicResults?.length || 0,
          responseTime: basicTime,
          avgRelevance: basicResults?.reduce((sum, r) => sum + (r.relevanceScore || 0), 0) / (basicResults?.length || 1)
        };

        this.testResults.comprehensiveTests[property.name] = {
          totalResults: comprehensiveResults.totalResults,
          specificResults: comprehensiveResults.specificResults,
          generalResults: comprehensiveResults.generalResults,
          developerResults: comprehensiveResults.developerResults,
          locationResults: comprehensiveResults.locationResults,
          confidence: comprehensiveResults.confidence,
          responseTime: comprehensiveTime,
          factCheckAnalysis: comprehensiveResults.factCheckAnalysis
        };

        console.log(`      Basic Search: ${basicResults?.length || 0} results (${basicTime}ms)`);
        console.log(`      Comprehensive: ${comprehensiveResults.totalResults} total results (${comprehensiveTime}ms)`);
        console.log(`      - Specific: ${comprehensiveResults.specificResults}`);
        console.log(`      - General: ${comprehensiveResults.generalResults}`);
        console.log(`      - Developer: ${comprehensiveResults.developerResults}`);
        console.log(`      - Location: ${comprehensiveResults.locationResults}`);
        console.log(`      Confidence: ${(comprehensiveResults.confidence * 100).toFixed(1)}%`);

      } catch (error) {
        console.log(`      ❌ Error testing ${property.name}: ${error.message}`);
      }
    }

    console.log('');
  }

  async testRealProperties() {
    console.log('🏠 Test 2: Testing Real Singapore Properties...');

    const realProperties = [
      {
        name: 'Parc Central Residences',
        data: {
          project_name: 'Parc Central Residences',
          developer: 'Sim Lian Group',
          district: 'District 14',
          property_type: 'Executive Condominium'
        }
      },
      {
        name: 'Tembusu Grand',
        data: {
          project_name: 'Tembusu Grand',
          developer: 'Wing Tai Holdings',
          district: 'District 15',
          property_type: 'Condominium'
        }
      },
      {
        name: 'The Landmark',
        data: {
          project_name: 'The Landmark',
          developer: 'MCC Land',
          district: 'District 3',
          property_type: 'Condominium'
        }
      }
    ];

    for (const property of realProperties) {
      try {
        console.log(`\n   Fact-checking: ${property.name}`);

        const startTime = Date.now();
        const results = await comprehensiveFactCheck(property.name, property.data);
        const responseTime = Date.now() - startTime;

        console.log(`      Total Results: ${results.totalResults}`);
        console.log(`      Confidence: ${(results.confidence * 100).toFixed(1)}%`);
        console.log(`      Data Points: ${results.factCheckAnalysis?.dataPoints?.length || 0}`);
        console.log(`      Source Quality: ${((results.factCheckAnalysis?.sourceQuality || 0) * 100).toFixed(1)}%`);
        console.log(`      Reliable Sources: ${results.factCheckAnalysis?.reliableSources || 0}/${results.factCheckAnalysis?.totalSources || 0}`);
        console.log(`      Response Time: ${responseTime}ms`);
        console.log(`      Summary: ${results.factCheckAnalysis?.summary || 'No summary'}`);

        // Store detailed results
        this.testResults.comprehensiveTests[property.name] = {
          ...results,
          responseTime
        };

      } catch (error) {
        console.log(`      ❌ Error: ${error.message}`);
      }
    }

    console.log('');
  }

  async analyzePerformance() {
    console.log('⚡ Test 3: Performance Analysis...');

    try {
      // Test concurrent fact-checking
      const concurrentProperties = [
        'The Continuum',
        'Marina One Residences',
        'Parc Central Residences'
      ];

      const startTime = Date.now();
      
      const promises = concurrentProperties.map(name => 
        comprehensiveFactCheck(name, { project_name: name }).catch(error => ({ error: error.message }))
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      const successfulTests = results.filter(r => !r.error).length;
      const totalResults = results.reduce((sum, r) => sum + (r.totalResults || 0), 0);
      const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length;

      this.testResults.comparisonMetrics = {
        concurrentTests: concurrentProperties.length,
        successfulTests,
        totalTime,
        averageTime: totalTime / concurrentProperties.length,
        totalResults,
        averageResultsPerProperty: totalResults / successfulTests,
        averageConfidence: avgConfidence,
        performanceRating: this._calculatePerformanceRating(totalTime, totalResults, avgConfidence)
      };

      console.log(`   Concurrent Tests: ${successfulTests}/${concurrentProperties.length} successful`);
      console.log(`   Total Time: ${totalTime}ms (avg: ${(totalTime / concurrentProperties.length).toFixed(0)}ms per property)`);
      console.log(`   Total Results Collected: ${totalResults}`);
      console.log(`   Average Results per Property: ${(totalResults / successfulTests).toFixed(1)}`);
      console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

    } catch (error) {
      console.log(`   ❌ Performance test failed: ${error.message}`);
    }

    console.log('');
  }

  _calculatePerformanceRating(totalTime, totalResults, avgConfidence) {
    let score = 0;
    
    // Time performance (max 30 points)
    if (totalTime < 5000) score += 30;
    else if (totalTime < 10000) score += 20;
    else if (totalTime < 15000) score += 10;
    
    // Result quantity (max 40 points)
    if (totalResults > 50) score += 40;
    else if (totalResults > 30) score += 30;
    else if (totalResults > 20) score += 20;
    else if (totalResults > 10) score += 10;
    
    // Confidence quality (max 30 points)
    if (avgConfidence > 0.8) score += 30;
    else if (avgConfidence > 0.6) score += 20;
    else if (avgConfidence > 0.4) score += 10;
    
    return {
      score,
      rating: score > 80 ? 'Excellent' : score > 60 ? 'Good' : score > 40 ? 'Fair' : 'Needs Improvement'
    };
  }

  generateReport() {
    console.log('📊 COMPREHENSIVE FACT-CHECKING REPORT');
    console.log('='.repeat(60));

    // Basic vs Comprehensive comparison
    const basicTests = Object.values(this.testResults.basicSearchTests);
    const comprehensiveTests = Object.values(this.testResults.comprehensiveTests);

    if (basicTests.length > 0 && comprehensiveTests.length > 0) {
      const avgBasicResults = basicTests.reduce((sum, t) => sum + t.resultCount, 0) / basicTests.length;
      const avgComprehensiveResults = comprehensiveTests.reduce((sum, t) => sum + (t.totalResults || 0), 0) / comprehensiveTests.length;
      const avgConfidence = comprehensiveTests.reduce((sum, t) => sum + (t.confidence || 0), 0) / comprehensiveTests.length;

      console.log(`\n📈 IMPROVEMENT METRICS:`);
      console.log(`   Basic Search Average: ${avgBasicResults.toFixed(1)} results per property`);
      console.log(`   Comprehensive Average: ${avgComprehensiveResults.toFixed(1)} results per property`);
      console.log(`   Improvement Factor: ${(avgComprehensiveResults / avgBasicResults).toFixed(1)}x more data`);
      console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    }

    // Performance metrics
    if (this.testResults.comparisonMetrics.performanceRating) {
      console.log(`\n⚡ PERFORMANCE RATING:`);
      console.log(`   Score: ${this.testResults.comparisonMetrics.performanceRating.score}/100`);
      console.log(`   Rating: ${this.testResults.comparisonMetrics.performanceRating.rating}`);
      console.log(`   Average Results per Property: ${this.testResults.comparisonMetrics.averageResultsPerProperty.toFixed(1)}`);
      console.log(`   Average Response Time: ${this.testResults.comparisonMetrics.averageTime.toFixed(0)}ms`);
    }

    // Overall assessment
    const overallSuccess = (this.testResults.comparisonMetrics.averageConfidence || 0) > 0.6 &&
                          (this.testResults.comparisonMetrics.averageResultsPerProperty || 0) > 15;

    console.log(`\n🎯 OVERALL ASSESSMENT: ${overallSuccess ? '✅ SIGNIFICANTLY IMPROVED' : '⚠️ NEEDS OPTIMIZATION'}`);

    if (overallSuccess) {
      console.log('\n💡 KEY IMPROVEMENTS:');
      console.log('   ✅ Multi-strategy search provides comprehensive data coverage');
      console.log('   ✅ Increased result quantity improves fact-checking accuracy');
      console.log('   ✅ Source reliability assessment enhances confidence scoring');
      console.log('   ✅ Concurrent searches maintain acceptable performance');
    } else {
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('   - Consider optimizing search query strategies');
      console.log('   - Review Custom Search Engine configuration');
      console.log('   - Implement result caching for frequently searched properties');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ComprehensiveFactCheckTest();
  tester.runTests().catch(console.error);
}

module.exports = ComprehensiveFactCheckTest;
