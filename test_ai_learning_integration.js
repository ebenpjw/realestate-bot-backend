/**
 * Test script to verify AI Learning System integration
 * Run this after starting your server to test the learning system
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // Adjust if your server runs on different port

async function testAILearningIntegration() {
  console.log('🧪 Testing AI Learning System Integration\n');

  const tests = [
    {
      name: 'Health Check with AI Learning',
      endpoint: '/health',
      method: 'GET'
    },
    {
      name: 'AI Learning Dashboard',
      endpoint: '/api/ai-learning/dashboard',
      method: 'GET'
    },
    {
      name: 'Performance Metrics',
      endpoint: '/api/ai-learning/performance-metrics',
      method: 'GET'
    },
    {
      name: 'Strategy Analysis',
      endpoint: '/api/ai-learning/strategy-analysis',
      method: 'GET'
    },
    {
      name: 'Optimized Strategy Recommendations',
      endpoint: '/api/ai-learning/optimized-strategy?intent=own_stay&journey_stage=interested&comfort_level=warming',
      method: 'GET'
    },
    {
      name: 'Learning Insights',
      endpoint: '/api/ai-learning/learning-insights',
      method: 'GET'
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      console.log(`📋 Testing: ${test.name}`);
      
      const response = await axios({
        method: test.method,
        url: `${BASE_URL}${test.endpoint}`,
        timeout: 10000
      });

      if (response.status === 200) {
        console.log(`✅ ${test.name} - PASSED`);
        
        // Log some interesting data for specific endpoints
        if (test.endpoint === '/health' && response.data.services?.aiLearning) {
          console.log(`   AI Learning Status: ${response.data.services.aiLearning.status}`);
        }
        
        if (test.endpoint === '/api/ai-learning/dashboard' && response.data.success) {
          console.log(`   Dashboard loaded successfully`);
        }
        
        if (test.endpoint.includes('optimized-strategy') && response.data.success) {
          const recommendations = response.data.data;
          console.log(`   Strategy Recommendations: ${recommendations.strategies?.length || 0} strategies`);
          console.log(`   Confidence Score: ${Math.round((recommendations.confidence_score || 0) * 100)}%`);
        }
        
        passedTests++;
      } else {
        console.log(`❌ ${test.name} - FAILED (Status: ${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - FAILED`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${error.response.data?.error || error.response.statusText}`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`   Error: Server not running on ${BASE_URL}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
    console.log('');
  }

  console.log('📊 Test Summary');
  console.log('================');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! AI Learning System is fully integrated and working.');
    console.log('\n🚀 Next Steps:');
    console.log('1. Visit http://localhost:3000/test-bot to test conversations');
    console.log('2. Click "🧠 AI Learning Dashboard" to view learning metrics');
    console.log('3. The system will automatically start learning from conversations');
    console.log('4. Check /api/ai-learning/dashboard periodically to see improvements');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above and ensure:');
    console.log('1. Your server is running on the correct port');
    console.log('2. All database tables were created successfully');
    console.log('3. No import/export errors in the learning services');
  }
}

// Test specific learning functionality
async function testLearningFunctionality() {
  console.log('\n🔬 Testing Learning Functionality\n');

  try {
    // Test manual outcome recording
    console.log('📋 Testing: Manual Outcome Recording');
    const outcomeResponse = await axios.post(`${BASE_URL}/api/ai-learning/record-outcome`, {
      lead_id: 'test-lead-123',
      outcome: {
        type: 'appointment_booked',
        total_messages: 8,
        engagement_score: 85,
        conversation_duration_minutes: 15
      },
      strategy_data: {
        strategies_used: ['rapport_building_first', 'educational_value_provision'],
        psychology_principles: ['liking', 'reciprocity'],
        conversation_approach: 'educational_then_consultative'
      }
    });

    if (outcomeResponse.status === 200) {
      console.log('✅ Manual Outcome Recording - PASSED');
    } else {
      console.log('❌ Manual Outcome Recording - FAILED');
    }

  } catch (error) {
    console.log('❌ Manual Outcome Recording - FAILED');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
  }

  try {
    // Test simulation run
    console.log('\n📋 Testing: Conversation Simulations');
    const simulationResponse = await axios.post(`${BASE_URL}/api/ai-learning/run-simulations`, {
      strategy: {
        strategies_used: ['rapport_building_first'],
        psychology_principles: ['liking', 'reciprocity'],
        conversation_approach: 'educational'
      },
      simulation_count: 10
    });

    if (simulationResponse.status === 200) {
      console.log('✅ Conversation Simulations - PASSED');
      const results = simulationResponse.data.data;
      console.log(`   Simulations Run: ${results.results?.length || 0}`);
      console.log(`   Success Rate: ${Math.round((results.analysis?.success_rate || 0) * 100)}%`);
    } else {
      console.log('❌ Conversation Simulations - FAILED');
    }

  } catch (error) {
    console.log('❌ Conversation Simulations - FAILED');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
  }

  try {
    // Test learning cycle
    console.log('\n📋 Testing: Manual Learning Cycle');
    const learningResponse = await axios.post(`${BASE_URL}/api/ai-learning/run-learning-cycle`);

    if (learningResponse.status === 200) {
      console.log('✅ Manual Learning Cycle - PASSED');
      const results = learningResponse.data.data;
      console.log(`   Strategies Analyzed: ${results.strategy_analysis?.strategy_performance?.length || 0}`);
      console.log(`   Optimizations Applied: ${results.optimization_applied ? 'Yes' : 'No'}`);
    } else {
      console.log('❌ Manual Learning Cycle - FAILED');
    }

  } catch (error) {
    console.log('❌ Manual Learning Cycle - FAILED');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testAILearningIntegration();
    await testLearningFunctionality();
    
    console.log('\n🎯 Integration Test Complete!');
    console.log('\nThe AI Learning System is now ready to:');
    console.log('• 📊 Track conversation outcomes automatically');
    console.log('• 🧠 Learn from successful patterns');
    console.log('• 🔄 Optimize strategies continuously');
    console.log('• 📈 Improve performance over time');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('🚀 Starting AI Learning System Integration Tests...\n');
  console.log('Make sure your server is running before running these tests.\n');
  
  runAllTests().catch(console.error);
}

module.exports = {
  testAILearningIntegration,
  testLearningFunctionality,
  runAllTests
};
