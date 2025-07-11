#!/usr/bin/env node

/**
 * Validation script for Direct Supabase Integration
 * Tests database connectivity and data integrity
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class IntegrationValidator {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }
    
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  async validateDatabaseSchema() {
    console.log('🔍 Validating database schema...');
    
    const requiredTables = [
      'property_projects',
      'property_unit_mix', 
      'visual_assets',
      'scraping_sessions'
    ];

    for (const table of requiredTables) {
      try {
        const { data, error } = await this.supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`❌ Table '${table}' validation failed: ${error.message}`);
          return false;
        }
        
        console.log(`✅ Table '${table}' exists and accessible`);
      } catch (error) {
        console.log(`❌ Table '${table}' check failed: ${error.message}`);
        return false;
      }
    }

    return true;
  }

  async testDataOperations() {
    console.log('🧪 Testing data operations...');
    
    try {
      // Test property insertion
      const testProperty = {
        project_name: 'Test Property ' + Date.now(),
        developer: 'Test Developer',
        address: 'Test Address, Singapore',
        district: 'Test District',
        property_type: 'Private Condo',
        source_url: 'test://validation-script',
        scraping_status: 'completed'
      };

      const { data: project, error: projectError } = await this.supabase
        .from('property_projects')
        .insert(testProperty)
        .select()
        .single();

      if (projectError) {
        throw new Error(`Property insertion failed: ${projectError.message}`);
      }

      console.log(`✅ Property created: ${project.project_name}`);

      // Test unit mix insertion
      const testUnitMix = {
        project_id: project.id,
        unit_type: '2 Bedroom',
        size_range_raw: '700 - 900 sqft',
        size_min_sqft: 700,
        size_max_sqft: 900,
        price_range_raw: '$1.2M - $1.5M',
        availability_raw: '5 / 10',
        units_available: 5,
        units_total: 10
      };

      const { error: unitMixError } = await this.supabase
        .from('property_unit_mix')
        .insert(testUnitMix);

      if (unitMixError) {
        throw new Error(`Unit mix insertion failed: ${unitMixError.message}`);
      }

      console.log('✅ Unit mix data saved');

      // Test visual asset insertion
      const testAsset = {
        project_id: project.id,
        asset_type: 'floor_plan',
        file_name: 'test_floor_plan.jpg',
        storage_path: `floor-plans/${project.id}/test_floor_plan.jpg`,
        public_url: 'https://example.com/test_floor_plan.jpg',
        original_url: 'https://example.com/test_floor_plan.jpg',
        description: JSON.stringify({
          name: 'A1',
          bedroomType: '2 Bedroom',
          bedroomCount: 2,
          alt_text: 'Test floor plan'
        }),
        processing_status: 'completed'
      };

      const { error: assetError } = await this.supabase
        .from('visual_assets')
        .insert(testAsset);

      if (assetError) {
        throw new Error(`Visual asset insertion failed: ${assetError.message}`);
      }

      console.log('✅ Visual asset saved');

      // Test session tracking
      const testSession = {
        session_type: 'test',
        status: 'completed',
        triggered_by: 'validation-script',
        projects_processed: 1,
        projects_updated: 0,
        errors_encountered: 0,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      };

      const { error: sessionError } = await this.supabase
        .from('scraping_sessions')
        .insert(testSession);

      if (sessionError) {
        throw new Error(`Session tracking failed: ${sessionError.message}`);
      }

      console.log('✅ Session tracking works');

      // Clean up test data
      await this.supabase
        .from('property_projects')
        .delete()
        .eq('id', project.id);

      console.log('✅ Test data cleaned up');
      return true;

    } catch (error) {
      console.log(`❌ Data operations test failed: ${error.message}`);
      return false;
    }
  }

  async validateDataIntegrity() {
    console.log('🔗 Validating data relationships...');
    
    try {
      // Check for orphaned records
      const { data: orphanedUnitMix } = await this.supabase
        .from('property_unit_mix')
        .select('id, project_id')
        .not('project_id', 'in', 
          `(${await this.supabase.from('property_projects').select('id').then(r => r.data?.map(p => p.id).join(',') || '')})`
        );

      if (orphanedUnitMix && orphanedUnitMix.length > 0) {
        console.log(`⚠️ Found ${orphanedUnitMix.length} orphaned unit mix records`);
      } else {
        console.log('✅ No orphaned unit mix records');
      }

      // Check data consistency
      const { data: projects } = await this.supabase
        .from('property_projects')
        .select('id, project_name, scraping_status')
        .limit(5);

      if (projects && projects.length > 0) {
        console.log(`✅ Found ${projects.length} properties in database`);
        
        for (const project of projects) {
          const { data: unitMix } = await this.supabase
            .from('property_unit_mix')
            .select('count')
            .eq('project_id', project.id);

          const { data: assets } = await this.supabase
            .from('visual_assets')
            .select('count')
            .eq('project_id', project.id);

          console.log(`   📊 ${project.project_name}: ${unitMix?.length || 0} unit types, ${assets?.length || 0} assets`);
        }
      }

      return true;
    } catch (error) {
      console.log(`❌ Data integrity check failed: ${error.message}`);
      return false;
    }
  }

  async runValidation() {
    console.log('🚀 Starting Integration Validation...\n');

    const schemaValid = await this.validateDatabaseSchema();
    console.log('');

    const operationsValid = await this.testDataOperations();
    console.log('');

    const integrityValid = await this.validateDataIntegrity();
    console.log('');

    if (schemaValid && operationsValid && integrityValid) {
      console.log('🎉 All validation tests passed! Integration is ready.');
      return true;
    } else {
      console.log('❌ Some validation tests failed. Please check the issues above.');
      return false;
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new IntegrationValidator();
  validator.runValidation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = IntegrationValidator;
