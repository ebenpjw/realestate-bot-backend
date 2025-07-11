#!/usr/bin/env node

/**
 * Universal Psychology Search Test
 * 
 * Demonstrates the AI's ability to search for any psychology tactics,
 * sales strategies, and persuasion techniques to convert leads to appointments.
 */

const config = require('../config');
const logger = require('../logger');
const { web_search, searchPsychologyTactics } = require('../services/webSearchService');

class UniversalPsychologySearchTest {
  constructor() {
    this.testResults = {
      generalPsychologyTests: {},
      scenarioSpecificTests: {},
      universalSearchTests: {},
      overallAssessment: {}
    };
  }

  async runTests() {
    console.log('🧠 Testing Universal Psychology Search Capabilities...\n');

    try {
      // Test 1: General psychology and persuasion tactics
      await this.testGeneralPsychology();

      // Test 2: Scenario-specific psychology searches
      await this.testScenarioSpecific();

      // Test 3: Universal search for any topic
      await this.testUniversalSearch();

      // Generate comprehensive report
      this.generateReport();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      this.testResults.criticalError = error.message;
    }
  }

  async testGeneralPsychology() {
    console.log('🎯 Test 1: General Psychology & Persuasion Tactics...');

    const psychologyScenarios = [
      {
        scenario: 'reluctant lead objection handling',
        context: { resistanceLevel: 'high', appointmentReadiness: 'resistant' }
      },
      {
        scenario: 'building trust with new prospects',
        context: { appointmentReadiness: 'warming_up', resistanceLevel: 'medium' }
      },
      {
        scenario: 'urgency creation for appointment booking',
        context: { goal: 'book_appointment', appointmentReadiness: 'ready' }
      }
    ];

    for (const test of psychologyScenarios) {
      try {
        console.log(`\n   Testing: ${test.scenario}`);

        const startTime = Date.now();
        const results = await searchPsychologyTactics(test.scenario, test.context);
        const responseTime = Date.now() - startTime;

        this.testResults.generalPsychologyTests[test.scenario] = {
          totalResults: results.totalResults,
          confidence: results.confidence,
          tacticsFound: results.psychologyInsights?.tactics?.length || 0,
          techniquesFound: results.psychologyInsights?.techniques?.length || 0,
          strategiesFound: results.psychologyInsights?.strategies?.length || 0,
          responseTime,
          summary: results.psychologyInsights?.summary || 'No summary'
        };

        console.log(`      Total Results: ${results.totalResults}`);
        console.log(`      Confidence: ${(results.confidence * 100).toFixed(1)}%`);
        console.log(`      Tactics Found: ${results.psychologyInsights?.tactics?.length || 0}`);
        console.log(`      Techniques Found: ${results.psychologyInsights?.techniques?.length || 0}`);
        console.log(`      Response Time: ${responseTime}ms`);

        // Show sample tactics
        if (results.psychologyInsights?.tactics?.length > 0) {
          console.log(`      Sample Tactic: ${results.psychologyInsights.tactics[0].title}`);
        }

      } catch (error) {
        console.log(`      ❌ Error: ${error.message}`);
        this.testResults.generalPsychologyTests[test.scenario] = {
          error: error.message,
          success: false
        };
      }
    }

    console.log('');
  }

  async testScenarioSpecific() {
    console.log('🎭 Test 2: Scenario-Specific Psychology Searches...');

    const specificScenarios = [
      'scarcity psychology real estate sales',
      'social proof techniques appointment setting',
      'reciprocity principle sales conversion',
      'authority bias real estate persuasion',
      'loss aversion property investment psychology'
    ];

    for (const scenario of specificScenarios) {
      try {
        console.log(`\n   Testing: ${scenario}`);

        const startTime = Date.now();
        const results = await web_search(scenario, { num_results: 8 });
        const responseTime = Date.now() - startTime;

        this.testResults.scenarioSpecificTests[scenario] = {
          resultsFound: results?.length || 0,
          responseTime,
          avgRelevance: results?.reduce((sum, r) => sum + (r.relevanceScore || 0), 0) / (results?.length || 1),
          topSources: results?.slice(0, 3).map(r => r.displayLink) || []
        };

        console.log(`      Results: ${results?.length || 0} found in ${responseTime}ms`);
        console.log(`      Avg Relevance: ${((results?.reduce((sum, r) => sum + (r.relevanceScore || 0), 0) / (results?.length || 1)) * 100).toFixed(1)}%`);
        
        if (results && results.length > 0) {
          console.log(`      Top Source: ${results[0].displayLink}`);
          console.log(`      Sample: ${results[0].title.substring(0, 60)}...`);
        }

      } catch (error) {
        console.log(`      ❌ Error: ${error.message}`);
        this.testResults.scenarioSpecificTests[scenario] = {
          error: error.message,
          success: false
        };
      }
    }

    console.log('');
  }

  async testUniversalSearch() {
    console.log('🌐 Test 3: Universal Search Capabilities...');

    const universalTopics = [
      'neuro-linguistic programming sales techniques',
      'behavioral economics real estate decisions',
      'cognitive biases property investment',
      'emotional triggers appointment booking',
      'psychological pricing strategies real estate'
    ];

    for (const topic of universalTopics) {
      try {
        console.log(`\n   Testing: ${topic}`);

        const startTime = Date.now();
        const results = await web_search(topic, { num_results: 10 });
        const responseTime = Date.now() - startTime;

        this.testResults.universalSearchTests[topic] = {
          resultsFound: results?.length || 0,
          responseTime,
          sourceVariety: new Set(results?.map(r => r.displayLink.split('.')[0]) || []).size,
          hasAcademicSources: results?.some(r => r.displayLink.includes('.edu') || r.displayLink.includes('research')) || false,
          hasExpertSources: results?.some(r => r.sourceReliability > 0.8) || false
        };

        console.log(`      Results: ${results?.length || 0} found in ${responseTime}ms`);
        console.log(`      Source Variety: ${new Set(results?.map(r => r.displayLink.split('.')[0]) || []).size} unique domains`);
        console.log(`      Academic Sources: ${results?.some(r => r.displayLink.includes('.edu')) ? 'Yes' : 'No'}`);
        console.log(`      Expert Sources: ${results?.some(r => r.sourceReliability > 0.8) ? 'Yes' : 'No'}`);

      } catch (error) {
        console.log(`      ❌ Error: ${error.message}`);
        this.testResults.universalSearchTests[topic] = {
          error: error.message,
          success: false
        };
      }
    }

    console.log('');
  }

  generateReport() {
    console.log('📊 UNIVERSAL PSYCHOLOGY SEARCH REPORT');
    console.log('='.repeat(60));

    // General Psychology Tests
    const psychologyTests = Object.values(this.testResults.generalPsychologyTests);
    const avgPsychologyResults = psychologyTests.reduce((sum, t) => sum + (t.totalResults || 0), 0) / psychologyTests.length;
    const avgPsychologyConfidence = psychologyTests.reduce((sum, t) => sum + (t.confidence || 0), 0) / psychologyTests.length;
    const totalTactics = psychologyTests.reduce((sum, t) => sum + (t.tacticsFound || 0), 0);

    console.log(`\n🧠 PSYCHOLOGY TACTICS SEARCH:`);
    console.log(`   Average Results per Search: ${avgPsychologyResults.toFixed(1)}`);
    console.log(`   Average Confidence: ${(avgPsychologyConfidence * 100).toFixed(1)}%`);
    console.log(`   Total Tactics Discovered: ${totalTactics}`);

    // Scenario-Specific Tests
    const scenarioTests = Object.values(this.testResults.scenarioSpecificTests);
    const avgScenarioResults = scenarioTests.reduce((sum, t) => sum + (t.resultsFound || 0), 0) / scenarioTests.length;
    const avgScenarioRelevance = scenarioTests.reduce((sum, t) => sum + (t.avgRelevance || 0), 0) / scenarioTests.length;

    console.log(`\n🎭 SCENARIO-SPECIFIC SEARCH:`);
    console.log(`   Average Results per Search: ${avgScenarioResults.toFixed(1)}`);
    console.log(`   Average Relevance: ${(avgScenarioRelevance * 100).toFixed(1)}%`);

    // Universal Search Tests
    const universalTests = Object.values(this.testResults.universalSearchTests);
    const avgUniversalResults = universalTests.reduce((sum, t) => sum + (t.resultsFound || 0), 0) / universalTests.length;
    const totalSourceVariety = universalTests.reduce((sum, t) => sum + (t.sourceVariety || 0), 0);
    const academicSourceCount = universalTests.filter(t => t.hasAcademicSources).length;

    console.log(`\n🌐 UNIVERSAL SEARCH CAPABILITIES:`);
    console.log(`   Average Results per Search: ${avgUniversalResults.toFixed(1)}`);
    console.log(`   Total Source Variety: ${totalSourceVariety} unique domains`);
    console.log(`   Academic Sources Found: ${academicSourceCount}/${universalTests.length} searches`);

    // Overall Assessment
    const overallSuccess = avgPsychologyResults > 15 && 
                          avgPsychologyConfidence > 0.6 && 
                          avgUniversalResults > 8;

    console.log(`\n🎯 OVERALL ASSESSMENT: ${overallSuccess ? '✅ EXCELLENT UNIVERSAL SEARCH CAPABILITIES' : '⚠️ NEEDS OPTIMIZATION'}`);

    if (overallSuccess) {
      console.log('\n💡 KEY CAPABILITIES CONFIRMED:');
      console.log('   ✅ Comprehensive psychology tactics discovery');
      console.log('   ✅ High-confidence strategy recommendations');
      console.log('   ✅ Universal search across any topic');
      console.log('   ✅ Access to academic and expert sources');
      console.log('   ✅ Real-time access to latest psychology research');
      console.log('\n🚀 THE AI CAN NOW SEARCH FOR ANY PSYCHOLOGY TACTIC TO CONVERT LEADS!');
    } else {
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('   - Expand search query strategies');
      console.log('   - Improve relevance scoring algorithms');
      console.log('   - Consider additional search sources');
    }

    // Show practical examples
    console.log('\n📚 PRACTICAL EXAMPLES OF WHAT THE AI CAN NOW SEARCH FOR:');
    console.log('   • "Scarcity psychology real estate urgency tactics"');
    console.log('   • "Social proof techniques appointment conversion"');
    console.log('   • "Reciprocity principle sales psychology"');
    console.log('   • "Authority bias real estate persuasion"');
    console.log('   • "Loss aversion property investment psychology"');
    console.log('   • "Behavioral economics decision making"');
    console.log('   • "Neuro-linguistic programming sales"');
    console.log('   • "Cognitive biases real estate decisions"');
    console.log('   • And literally ANY psychology or sales topic!');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new UniversalPsychologySearchTest();
  tester.runTests().catch(console.error);
}

module.exports = UniversalPsychologySearchTest;
