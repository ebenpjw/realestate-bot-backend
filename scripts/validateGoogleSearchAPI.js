#!/usr/bin/env node

/**
 * Google Search API Validation Script
 * 
 * Validates Google Custom Search API configuration and tests fact-checking functionality
 * for the real estate bot backend system.
 */

const config = require('../config');
const logger = require('../logger');
const { validateConfiguration, web_search } = require('../services/webSearchService');

class GoogleSearchAPIValidator {
  constructor() {
    this.results = {
      configurationValid: false,
      basicSearchWorking: false,
      propertySearchWorking: false,
      factCheckingWorking: false,
      performanceMetrics: {},
      errors: [],
      recommendations: []
    };
  }

  async runValidation() {
    console.log('🔍 Starting Google Search API Validation...\n');

    try {
      // Step 1: Validate basic configuration
      await this.validateBasicConfiguration();

      // Step 2: Test basic search functionality
      await this.testBasicSearch();

      // Step 3: Test property-specific searches
      await this.testPropertySearch();

      // Step 4: Test fact-checking integration
      await this.testFactChecking();

      // Step 5: Performance testing
      await this.testPerformance();

      // Generate final report
      this.generateReport();

    } catch (error) {
      console.error('❌ Validation failed with error:', error.message);
      this.results.errors.push(`Critical error: ${error.message}`);
    }
  }

  async validateBasicConfiguration() {
    console.log('📋 Step 1: Validating basic configuration...');

    try {
      const validation = await validateConfiguration();
      
      console.log(`   API Key: ${validation.hasApiKey ? '✅ Present' : '❌ Missing'}`);
      console.log(`   Engine ID: ${validation.hasEngineId ? '✅ Present' : '❌ Missing'}`);
      console.log(`   API Key Valid: ${validation.apiKeyValid ? '✅ Valid' : '❌ Invalid'}`);
      console.log(`   Engine ID Valid: ${validation.engineIdValid ? '✅ Valid' : '❌ Invalid'}`);
      console.log(`   Search Working: ${validation.searchWorking ? '✅ Working' : '❌ Not Working'}`);

      if (validation.error) {
        console.log(`   Error: ❌ ${validation.error}`);
        this.results.errors.push(`Configuration error: ${validation.error}`);
      }

      if (validation.testResults) {
        console.log(`   Test Query: "${validation.testResults.query}"`);
        console.log(`   Results Found: ${validation.testResults.resultsFound}`);
        console.log(`   First Result: ${validation.testResults.firstResult.title}`);
      }

      this.results.configurationValid = validation.searchWorking;

    } catch (error) {
      console.log(`   ❌ Configuration validation failed: ${error.message}`);
      this.results.errors.push(`Configuration validation error: ${error.message}`);
    }

    console.log('');
  }

  async testBasicSearch() {
    console.log('🔍 Step 2: Testing basic search functionality...');

    const testQueries = [
      'Singapore property market 2025',
      'HDB resale prices Singapore',
      'Private property launch Singapore'
    ];

    for (const query of testQueries) {
      try {
        const startTime = Date.now();
        const results = await web_search(query, { num_results: 3 });
        const responseTime = Date.now() - startTime;

        console.log(`   Query: "${query}"`);
        console.log(`   Results: ${results?.length || 0} found in ${responseTime}ms`);
        
        if (results && results.length > 0) {
          console.log(`   ✅ Success - First result: ${results[0].title}`);
          this.results.basicSearchWorking = true;
        } else {
          console.log(`   ❌ No results returned`);
          this.results.errors.push(`No results for query: ${query}`);
        }

      } catch (error) {
        console.log(`   ❌ Search failed: ${error.message}`);
        this.results.errors.push(`Search error for "${query}": ${error.message}`);
      }
    }

    console.log('');
  }

  async testPropertySearch() {
    console.log('🏠 Step 3: Testing property-specific searches...');

    const propertyQueries = [
      'The Continuum Singapore condo price',
      'Marina One Residences Singapore launch',
      'Parc Central Residences EC Singapore'
    ];

    for (const query of propertyQueries) {
      try {
        const startTime = Date.now();
        const results = await web_search(query, { num_results: 5 });
        const responseTime = Date.now() - startTime;

        console.log(`   Property Query: "${query}"`);
        console.log(`   Results: ${results?.length || 0} found in ${responseTime}ms`);
        
        if (results && results.length > 0) {
          const relevantResults = results.filter(r => 
            r.title.toLowerCase().includes('singapore') || 
            r.snippet.toLowerCase().includes('singapore')
          );
          console.log(`   ✅ Success - ${relevantResults.length} Singapore-relevant results`);
          this.results.propertySearchWorking = true;
        } else {
          console.log(`   ❌ No results returned`);
        }

      } catch (error) {
        console.log(`   ❌ Property search failed: ${error.message}`);
        this.results.errors.push(`Property search error: ${error.message}`);
      }
    }

    console.log('');
  }

  async testFactChecking() {
    console.log('✅ Step 4: Testing fact-checking integration...');

    const mockProperty = {
      project_name: 'The Continuum',
      developer: 'Hoi Hup Realty',
      price_range_min: 2000000,
      price_range_max: 5000000
    };

    try {
      const factCheckQuery = `"${mockProperty.project_name}" Singapore property price launch date developer "${mockProperty.developer}" July 2025`;
      
      const startTime = Date.now();
      const results = await web_search(factCheckQuery, { num_results: 3 });
      const responseTime = Date.now() - startTime;

      console.log(`   Fact-check Query: "${factCheckQuery}"`);
      console.log(`   Results: ${results?.length || 0} found in ${responseTime}ms`);

      if (results && results.length > 0) {
        const relevantResults = results.filter(r => 
          r.title.toLowerCase().includes(mockProperty.project_name.toLowerCase()) ||
          r.snippet.toLowerCase().includes(mockProperty.project_name.toLowerCase())
        );
        
        console.log(`   ✅ Fact-checking working - ${relevantResults.length} relevant results`);
        console.log(`   Sample result: ${results[0].title}`);
        this.results.factCheckingWorking = true;
      } else {
        console.log(`   ❌ No fact-checking results returned`);
      }

    } catch (error) {
      console.log(`   ❌ Fact-checking failed: ${error.message}`);
      this.results.errors.push(`Fact-checking error: ${error.message}`);
    }

    console.log('');
  }

  async testPerformance() {
    console.log('⚡ Step 5: Testing performance...');

    const performanceTests = [
      { query: 'Singapore property market trends', expectedTime: 3000 },
      { query: 'HDB resale prices Tampines', expectedTime: 3000 },
      { query: 'Private condo launch Orchard Road', expectedTime: 3000 }
    ];

    let totalTime = 0;
    let successfulTests = 0;

    for (const test of performanceTests) {
      try {
        const startTime = Date.now();
        const results = await web_search(test.query, { num_results: 3 });
        const responseTime = Date.now() - startTime;

        totalTime += responseTime;
        if (results && results.length > 0) successfulTests++;

        const status = responseTime <= test.expectedTime ? '✅' : '⚠️';
        console.log(`   ${status} "${test.query}": ${responseTime}ms (target: ${test.expectedTime}ms)`);

      } catch (error) {
        console.log(`   ❌ Performance test failed: ${error.message}`);
      }
    }

    const averageTime = totalTime / performanceTests.length;
    this.results.performanceMetrics = {
      averageResponseTime: averageTime,
      successfulTests,
      totalTests: performanceTests.length,
      successRate: (successfulTests / performanceTests.length) * 100
    };

    console.log(`   Average Response Time: ${averageTime.toFixed(0)}ms`);
    console.log(`   Success Rate: ${this.results.performanceMetrics.successRate.toFixed(1)}%`);
    console.log('');
  }

  generateReport() {
    console.log('📊 VALIDATION REPORT');
    console.log('='.repeat(50));
    
    console.log(`Configuration Valid: ${this.results.configurationValid ? '✅' : '❌'}`);
    console.log(`Basic Search Working: ${this.results.basicSearchWorking ? '✅' : '❌'}`);
    console.log(`Property Search Working: ${this.results.propertySearchWorking ? '✅' : '❌'}`);
    console.log(`Fact-Checking Working: ${this.results.factCheckingWorking ? '✅' : '❌'}`);
    
    if (this.results.performanceMetrics.averageResponseTime) {
      console.log(`Average Response Time: ${this.results.performanceMetrics.averageResponseTime.toFixed(0)}ms`);
      console.log(`Search Success Rate: ${this.results.performanceMetrics.successRate.toFixed(1)}%`);
    }

    if (this.results.errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      this.results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    // Generate recommendations
    this.generateRecommendations();

    if (this.results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    const overallStatus = this.results.configurationValid && 
                         this.results.basicSearchWorking && 
                         this.results.propertySearchWorking && 
                         this.results.factCheckingWorking;

    console.log(`\n🎯 OVERALL STATUS: ${overallStatus ? '✅ READY FOR PRODUCTION' : '❌ NEEDS ATTENTION'}`);
  }

  generateRecommendations() {
    if (!this.results.configurationValid) {
      this.results.recommendations.push('Check Google Cloud Console for API key validity and Custom Search Engine configuration');
    }

    if (!this.results.basicSearchWorking) {
      this.results.recommendations.push('Verify network connectivity and API quotas in Google Cloud Console');
    }

    if (this.results.performanceMetrics.averageResponseTime > 5000) {
      this.results.recommendations.push('Consider optimizing search queries or implementing caching for better performance');
    }

    if (this.results.performanceMetrics.successRate < 90) {
      this.results.recommendations.push('Review search query strategies and error handling mechanisms');
    }

    if (this.results.errors.length > 2) {
      this.results.recommendations.push('Multiple errors detected - consider reviewing Google Search API setup documentation');
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new GoogleSearchAPIValidator();
  validator.runValidation().catch(console.error);
}

module.exports = GoogleSearchAPIValidator;
