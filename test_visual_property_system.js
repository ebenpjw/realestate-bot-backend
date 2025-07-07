#!/usr/bin/env node

/**
 * Visual Property Data Collection System - Comprehensive Test Suite
 * 
 * This script tests all components of the visual property data system:
 * - Database schema validation
 * - Web scraping functionality
 * - AI analysis capabilities
 * - API endpoints
 * - Bot integration
 */

const axios = require('axios');
const logger = require('./logger');
const supabase = require('./supabaseClient');
const VisualPropertyScrapingService = require('./services/visualPropertyScrapingService');
const VisualAnalysisService = require('./services/visualAnalysisService');

// Configuration
const BASE_URL = process.env.RAILWAY_URL || 'http://localhost:8080';
const TEST_TIMEOUT = 30000; // 30 seconds

class VisualPropertySystemTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Visual Property Data System Tests\n');
    console.log('=' .repeat(60));

    try {
      // Database tests
      await this.testDatabaseSchema();
      await this.testDatabaseOperations();

      // Service tests
      await this.testScrapingService();
      await this.testAnalysisService();

      // API tests
      await this.testAPIEndpoints();

      // Integration tests
      await this.testBotIntegration();

      // Performance tests
      await this.testPerformance();

      // Generate report
      this.generateReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test database schema
   */
  async testDatabaseSchema() {
    console.log('\n📊 Testing Database Schema...');

    const tests = [
      {
        name: 'property_projects table exists',
        query: "SELECT to_regclass('property_projects')",
        expected: 'property_projects'
      },
      {
        name: 'visual_assets table exists',
        query: "SELECT to_regclass('visual_assets')",
        expected: 'visual_assets'
      },
      {
        name: 'ai_visual_analysis table exists',
        query: "SELECT to_regclass('ai_visual_analysis')",
        expected: 'ai_visual_analysis'
      },
      {
        name: 'property_search_index table exists',
        query: "SELECT to_regclass('property_search_index')",
        expected: 'property_search_index'
      },
      {
        name: 'scraping_sessions table exists',
        query: "SELECT to_regclass('scraping_sessions')",
        expected: 'scraping_sessions'
      }
    ];

    for (const test of tests) {
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: test.query });
        
        if (error) {
          this.recordTest(test.name, false, `Database error: ${error.message}`);
        } else if (data && data[0] && data[0].to_regclass === test.expected) {
          this.recordTest(test.name, true);
        } else {
          this.recordTest(test.name, false, `Table not found: ${test.expected}`);
        }
      } catch (error) {
        this.recordTest(test.name, false, `Test error: ${error.message}`);
      }
    }
  }

  /**
   * Test database operations
   */
  async testDatabaseOperations() {
    console.log('\n💾 Testing Database Operations...');

    // Test property project insertion
    try {
      const testProject = {
        project_name: 'Test Property Project',
        developer: 'Test Developer',
        district: 'D01',
        property_type: 'Private Condo',
        sales_status: 'Available'
      };

      const { data: project, error } = await supabase
        .from('property_projects')
        .insert(testProject)
        .select()
        .single();

      if (error) {
        this.recordTest('Insert property project', false, error.message);
      } else {
        this.recordTest('Insert property project', true);

        // Test visual asset insertion
        const testAsset = {
          project_id: project.id,
          asset_type: 'floor_plan',
          file_name: 'test_floor_plan.jpg',
          storage_path: 'test/path',
          processing_status: 'completed'
        };

        const { error: assetError } = await supabase
          .from('visual_assets')
          .insert(testAsset);

        if (assetError) {
          this.recordTest('Insert visual asset', false, assetError.message);
        } else {
          this.recordTest('Insert visual asset', true);
        }

        // Cleanup test data
        await supabase.from('property_projects').delete().eq('id', project.id);
      }
    } catch (error) {
      this.recordTest('Database operations', false, error.message);
    }
  }

  /**
   * Test scraping service
   */
  async testScrapingService() {
    console.log('\n🕷️ Testing Scraping Service...');

    try {
      const scrapingService = new VisualPropertyScrapingService();

      // Test initialization
      try {
        await scrapingService.initialize();
        this.recordTest('Scraping service initialization', true);
        
        // Test property listings extraction (limited test)
        try {
          const propertyLinks = await scrapingService.getPropertyListings();
          
          if (Array.isArray(propertyLinks)) {
            this.recordTest('Property listings extraction', true, `Found ${propertyLinks.length} properties`);
          } else {
            this.recordTest('Property listings extraction', false, 'Invalid response format');
          }
        } catch (error) {
          this.recordTest('Property listings extraction', false, error.message);
        }

        await scrapingService.cleanup();
        
      } catch (error) {
        this.recordTest('Scraping service initialization', false, error.message);
      }
    } catch (error) {
      this.recordTest('Scraping service test', false, error.message);
    }
  }

  /**
   * Test AI analysis service
   */
  async testAnalysisService() {
    console.log('\n🤖 Testing AI Analysis Service...');

    try {
      const analysisService = new VisualAnalysisService();

      // Test floor plan analysis parsing
      const testAnalysisText = `This floor plan shows a 3-bedroom, 2-bathroom unit with an open concept layout. 
      The unit features a spacious living room, modern kitchen with island, master bedroom with ensuite bathroom, 
      and a study room. Total area is approximately 1200 square feet.`;

      const parsedData = analysisService.parseFloorPlanAnalysis(testAnalysisText);

      if (parsedData.bedrooms === 3 && parsedData.bathrooms === 2) {
        this.recordTest('Floor plan analysis parsing', true);
      } else {
        this.recordTest('Floor plan analysis parsing', false, 'Incorrect parsing results');
      }

      // Test brochure analysis parsing
      const testBrochureText = `Property Name: "Luxury Residences" by Premium Developer. 
      Features include swimming pool, gym, playground, and 24-hour security. 
      Located near MRT station with excellent connectivity.`;

      const brochureData = analysisService.parseBrochureAnalysis(testBrochureText);

      if (brochureData.amenities.includes('swimming pool')) {
        this.recordTest('Brochure analysis parsing', true);
      } else {
        this.recordTest('Brochure analysis parsing', false, 'Amenities not extracted correctly');
      }

    } catch (error) {
      this.recordTest('AI analysis service test', false, error.message);
    }
  }

  /**
   * Test API endpoints
   */
  async testAPIEndpoints() {
    console.log('\n🌐 Testing API Endpoints...');

    const endpoints = [
      {
        name: 'GET /api/visual-property/projects',
        method: 'GET',
        url: '/api/visual-property/projects?limit=5'
      },
      {
        name: 'GET /api/visual-property/search',
        method: 'GET',
        url: '/api/visual-property/search?district=D01&limit=3'
      },
      {
        name: 'GET /api/visual-property/sessions',
        method: 'GET',
        url: '/api/visual-property/sessions?limit=5'
      },
      {
        name: 'GET /api/visual-property/stats',
        method: 'GET',
        url: '/api/visual-property/stats'
      }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${BASE_URL}${endpoint.url}`,
          timeout: TEST_TIMEOUT
        });

        if (response.status === 200 && response.data.success !== false) {
          this.recordTest(endpoint.name, true, `Status: ${response.status}`);
        } else {
          this.recordTest(endpoint.name, false, `Unexpected response: ${response.status}`);
        }
      } catch (error) {
        this.recordTest(endpoint.name, false, error.message);
      }
    }
  }

  /**
   * Test bot integration
   */
  async testBotIntegration() {
    console.log('\n🤖 Testing Bot Integration...');

    try {
      // Test visual property data integration in bot responses
      const testMessages = [
        'Show me 3-bedroom condos in District 1',
        'I need floor plans for new launch properties',
        'What properties have swimming pools and gym?'
      ];

      for (const message of testMessages) {
        try {
          const response = await axios.post(`${BASE_URL}/api/test/simulate-inbound`, {
            from: '+6512345678',
            text: message,
            name: 'Test User'
          }, { timeout: TEST_TIMEOUT });

          if (response.status === 200 && response.data.ai_responses) {
            this.recordTest(`Bot integration: "${message}"`, true);
          } else {
            this.recordTest(`Bot integration: "${message}"`, false, 'No AI response');
          }
        } catch (error) {
          this.recordTest(`Bot integration: "${message}"`, false, error.message);
        }
      }
    } catch (error) {
      this.recordTest('Bot integration test', false, error.message);
    }
  }

  /**
   * Test system performance
   */
  async testPerformance() {
    console.log('\n⚡ Testing Performance...');

    try {
      // Test API response times
      const startTime = Date.now();
      
      await axios.get(`${BASE_URL}/api/visual-property/stats`, { timeout: 5000 });
      
      const responseTime = Date.now() - startTime;
      
      if (responseTime < 1000) {
        this.recordTest('API response time', true, `${responseTime}ms`);
      } else {
        this.recordTest('API response time', false, `Slow response: ${responseTime}ms`);
      }

      // Test database query performance
      const dbStartTime = Date.now();
      
      await supabase
        .from('property_projects')
        .select('id, project_name')
        .limit(10);
      
      const dbResponseTime = Date.now() - dbStartTime;
      
      if (dbResponseTime < 500) {
        this.recordTest('Database query performance', true, `${dbResponseTime}ms`);
      } else {
        this.recordTest('Database query performance', false, `Slow query: ${dbResponseTime}ms`);
      }

    } catch (error) {
      this.recordTest('Performance test', false, error.message);
    }
  }

  /**
   * Record test result
   */
  recordTest(testName, passed, details = '') {
    this.testResults.total++;
    
    if (passed) {
      this.testResults.passed++;
      console.log(`  ✅ ${testName}${details ? ` (${details})` : ''}`);
    } else {
      this.testResults.failed++;
      console.log(`  ❌ ${testName}${details ? ` - ${details}` : ''}`);
    }

    this.testResults.details.push({
      name: testName,
      passed,
      details
    });
  }

  /**
   * Generate test report
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST REPORT');
    console.log('='.repeat(60));
    
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed} ✅`);
    console.log(`Failed: ${this.testResults.failed} ❌`);
    
    const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%`);

    if (this.testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.details
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.details}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    
    if (this.testResults.failed === 0) {
      console.log('🎉 All tests passed! System is ready for deployment.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix issues before deployment.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new VisualPropertySystemTester();
  tester.runAllTests().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = VisualPropertySystemTester;
