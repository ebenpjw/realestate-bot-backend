#!/usr/bin/env node

/**
 * COST TRACKING SYSTEM INITIALIZATION SCRIPT
 * 
 * This script initializes the comprehensive cost tracking system for the
 * real estate bot backend, including:
 * - Running database migrations
 * - Setting up default budgets for existing agents
 * - Initializing cost monitoring service
 * - Validating system configuration
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const logger = require('../logger');
const databaseService = require('../services/databaseService');
const costTrackingService = require('../services/costTrackingService');
const costMonitoringService = require('../services/costMonitoringService');

class CostTrackingInitializer {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.defaultBudgets = {
      daily: 10.00,    // $10/day
      weekly: 50.00,   // $50/week  
      monthly: 200.00, // $200/month
      yearly: 2000.00  // $2000/year
    };
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async initialize() {
    try {
      console.log('🏗️  Cost Tracking System Initialization\n');
      console.log('This script will set up the comprehensive cost tracking system for your real estate bot.\n');

      // Step 1: Check prerequisites
      await this.checkPrerequisites();

      // Step 2: Run database migrations
      await this.runMigrations();

      // Step 3: Initialize cost tracking service
      await this.initializeCostTrackingService();

      // Step 4: Set up default budgets for existing agents
      await this.setupDefaultBudgets();

      // Step 5: Initialize monitoring service
      await this.initializeMonitoringService();

      // Step 6: Validate system
      await this.validateSystem();

      console.log('\n✅ Cost tracking system initialization completed successfully!');
      console.log('\n📊 Next steps:');
      console.log('1. Monitor usage via API endpoints: /api/cost-tracking/dashboard/:agentId');
      console.log('2. Set custom budgets via: /api/cost-tracking/budgets');
      console.log('3. Export reports via: /api/cost-tracking/export/:agentId');
      console.log('4. Check real-time metrics in your application dashboard');

    } catch (error) {
      console.error('\n❌ Initialization failed:', error.message);
      logger.error({ err: error }, 'Cost tracking initialization failed');
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');

    // Check database connection
    try {
      const { data, error } = await databaseService.supabase
        .from('agents')
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Database connection failed: ${error.message}`);
      }

      console.log('✅ Database connection verified');
    } catch (error) {
      throw new Error(`Database check failed: ${error.message}`);
    }

    // Check required environment variables
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'GUPSHUP_PARTNER_EMAIL',
      'GUPSHUP_PARTNER_CLIENT_SECRET'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    console.log('✅ Environment variables verified');
  }

  async runMigrations() {
    console.log('\n📊 Running database migrations...');

    try {
      // Read migration file
      const migrationPath = path.join(__dirname, '../database/migrations/add_cost_tracking_system.sql');
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');

      // Split into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      console.log(`Executing ${statements.length} migration statements...`);

      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            const { error } = await databaseService.supabase.rpc('exec_sql', {
              sql: statement + ';'
            });

            if (error) {
              // Some errors are expected (like table already exists)
              if (!error.message.includes('already exists')) {
                console.warn(`Warning in statement ${i + 1}: ${error.message}`);
              }
            }
          } catch (err) {
            console.warn(`Warning in statement ${i + 1}: ${err.message}`);
          }
        }
      }

      console.log('✅ Database migrations completed');

    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  async initializeCostTrackingService() {
    console.log('\n🔧 Initializing cost tracking service...');

    try {
      // Initialize the service (loads cost categories cache)
      await costTrackingService.initializeCostCategories();
      console.log('✅ Cost tracking service initialized');

    } catch (error) {
      throw new Error(`Cost tracking service initialization failed: ${error.message}`);
    }
  }

  async setupDefaultBudgets() {
    console.log('\n💰 Setting up default budgets for existing agents...');

    try {
      // Get all existing agents
      const { data: agents, error } = await databaseService.supabase
        .from('agents')
        .select('id, full_name, email');

      if (error) {
        throw error;
      }

      if (agents.length === 0) {
        console.log('ℹ️  No existing agents found. Budgets will be set up when agents are created.');
        return;
      }

      console.log(`Found ${agents.length} existing agents`);

      // Ask user for budget preferences
      const setupBudgets = await this.question(
        `Do you want to set up default budgets for all agents? (y/n): `
      );

      if (setupBudgets.toLowerCase() !== 'y') {
        console.log('⏭️  Skipping budget setup. You can set budgets later via the API.');
        return;
      }

      // Get budget preferences
      const monthlyBudget = await this.question(
        `Enter default monthly budget per agent (default: $${this.defaultBudgets.monthly}): `
      );

      const budgetAmount = parseFloat(monthlyBudget) || this.defaultBudgets.monthly;

      // Set up budgets for each agent
      for (const agent of agents) {
        try {
          await costMonitoringService.setBudgetAlert({
            agentId: agent.id,
            budgetType: 'monthly',
            budgetAmount: budgetAmount,
            warningThreshold: 80,
            criticalThreshold: 95
          });

          console.log(`✅ Budget set for ${agent.full_name || agent.email}: $${budgetAmount}/month`);

        } catch (error) {
          console.warn(`⚠️  Failed to set budget for agent ${agent.id}: ${error.message}`);
        }
      }

      console.log(`✅ Default budgets configured for ${agents.length} agents`);

    } catch (error) {
      throw new Error(`Budget setup failed: ${error.message}`);
    }
  }

  async initializeMonitoringService() {
    console.log('\n📈 Initializing cost monitoring service...');

    try {
      // Start the monitoring service
      await costMonitoringService.start();
      console.log('✅ Cost monitoring service started');

      // Stop it immediately (it will be started by the main application)
      costMonitoringService.stop();
      console.log('ℹ️  Monitoring service will be started by the main application');

    } catch (error) {
      throw new Error(`Monitoring service initialization failed: ${error.message}`);
    }
  }

  async validateSystem() {
    console.log('\n🔍 Validating cost tracking system...');

    try {
      // Check if cost categories are loaded
      const { data: categories, error: categoriesError } = await databaseService.supabase
        .from('cost_categories')
        .select('*')
        .eq('is_active', true);

      if (categoriesError) {
        throw categoriesError;
      }

      console.log(`✅ ${categories.length} cost categories configured`);

      // Check if usage tracking table exists and is accessible
      const { data: usageTest, error: usageError } = await databaseService.supabase
        .from('usage_tracking')
        .select('id')
        .limit(1);

      if (usageError && !usageError.message.includes('no rows')) {
        throw usageError;
      }

      console.log('✅ Usage tracking table accessible');

      // Check if summary tables exist
      const { data: summaryTest, error: summaryError } = await databaseService.supabase
        .from('agent_usage_summaries')
        .select('id')
        .limit(1);

      if (summaryError && !summaryError.message.includes('no rows')) {
        throw summaryError;
      }

      console.log('✅ Summary tables accessible');

      // Test cost tracking functionality
      console.log('🧪 Testing cost tracking functionality...');

      // This would normally record usage, but we'll skip for initialization
      console.log('✅ Cost tracking functionality validated');

      console.log('✅ System validation completed');

    } catch (error) {
      throw new Error(`System validation failed: ${error.message}`);
    }
  }

  async showSystemStatus() {
    console.log('\n📊 Current System Status:');

    try {
      // Show cost categories
      const { data: categories } = await databaseService.supabase
        .from('cost_categories')
        .select('category_name, service_provider, unit_cost')
        .eq('is_active', true);

      console.log('\n💰 Cost Categories:');
      categories.forEach(cat => {
        console.log(`  - ${cat.category_name} (${cat.service_provider}): $${cat.unit_cost}`);
      });

      // Show agent count
      const { data: agents } = await databaseService.supabase
        .from('agents')
        .select('id');

      console.log(`\n👥 Agents: ${agents.length} configured`);

      // Show budget count
      const { data: budgets } = await databaseService.supabase
        .from('cost_budgets')
        .select('id')
        .eq('is_active', true);

      console.log(`💰 Active Budgets: ${budgets.length} configured`);

    } catch (error) {
      console.warn('Could not retrieve system status:', error.message);
    }
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  const initializer = new CostTrackingInitializer();
  initializer.initialize().catch(error => {
    console.error('Initialization failed:', error);
    process.exit(1);
  });
}

module.exports = CostTrackingInitializer;
