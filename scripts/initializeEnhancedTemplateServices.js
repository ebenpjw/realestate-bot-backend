#!/usr/bin/env node

/**
 * ENHANCED TEMPLATE SERVICES INITIALIZATION SCRIPT
 * 
 * Initializes and starts the AI Template Generation Service and Automatic Template 
 * Approval Service with proper error handling and integration with the existing 
 * intelligent follow-up system.
 * 
 * Usage:
 *   node scripts/initializeEnhancedTemplateServices.js [options]
 * 
 * Options:
 *   --check-only     Only check current status without starting services
 *   --agent-id       Initialize for specific agent only
 *   --force-sync     Force template sync across all agents
 *   --dry-run        Show what would be done without making changes
 */

const logger = require('../logger');
const config = require('../config');
const intelligentFollowUpService = require('../services/intelligentFollowUpService');
const aiTemplateGenerationService = require('../services/aiTemplateGenerationService');
const automaticTemplateApprovalService = require('../services/automaticTemplateApprovalService');
const multiWABATemplateService = require('../services/multiWABATemplateService');
const supabase = require('../supabaseClient');

class EnhancedTemplateServicesInitializer {
  constructor() {
    this.options = this._parseCommandLineArgs();
    this.initializationResults = {
      aiTemplateGeneration: false,
      automaticApproval: false,
      templateCoverage: {},
      errors: []
    };
  }

  /**
   * Parse command line arguments
   * @private
   */
  _parseCommandLineArgs() {
    const args = process.argv.slice(2);
    const options = {
      checkOnly: args.includes('--check-only'),
      agentId: null,
      forceSync: args.includes('--force-sync'),
      dryRun: args.includes('--dry-run')
    };

    // Extract agent ID if provided
    const agentIdIndex = args.indexOf('--agent-id');
    if (agentIdIndex !== -1 && args[agentIdIndex + 1]) {
      options.agentId = args[agentIdIndex + 1];
    }

    return options;
  }

  /**
   * Main initialization method
   */
  async initialize() {
    try {
      logger.info({ options: this.options }, 'Starting Enhanced Template Services initialization');

      // Validate environment configuration
      await this._validateConfiguration();

      if (this.options.checkOnly) {
        return await this._performStatusCheck();
      }

      // Initialize services
      await this._initializeServices();

      // Check template coverage
      await this._checkTemplateCoverage();

      // Perform initial template generation if needed
      await this._performInitialTemplateGeneration();

      // Sync templates across agents if requested
      if (this.options.forceSync) {
        await this._syncTemplatesAcrossAgents();
      }

      // Display results
      this._displayResults();

      logger.info('Enhanced Template Services initialization completed successfully');
      return { success: true, results: this.initializationResults };

    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize Enhanced Template Services');
      this.initializationResults.errors.push(error.message);
      return { success: false, error: error.message, results: this.initializationResults };
    }
  }

  /**
   * Validate environment configuration
   * @private
   */
  async _validateConfiguration() {
    logger.info('Validating configuration...');

    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'GUPSHUP_API_KEY',
      'GUPSHUP_PARTNER_EMAIL',
      'GUPSHUP_PARTNER_PASSWORD',
      'SUPABASE_URL',
      'SUPABASE_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Test database connection
    try {
      const { data, error } = await supabase.from('agents').select('id').limit(1);
      if (error) throw error;
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    logger.info('Configuration validation passed');
  }

  /**
   * Perform status check only
   * @private
   */
  async _performStatusCheck() {
    logger.info('Performing status check...');

    try {
      // Check AI template generation statistics
      const generationStats = await aiTemplateGenerationService.getGenerationStatistics(this.options.agentId);
      
      // Check template approval statistics
      const approvalStats = await automaticTemplateApprovalService.getApprovalStatistics(this.options.agentId);
      
      // Check template coverage for agents
      const agents = await this._getAgents();
      const coverageResults = {};
      
      for (const agent of agents) {
        coverageResults[agent.id] = await multiWABATemplateService.checkTemplateCoverage(agent.id);
      }

      const statusReport = {
        timestamp: new Date().toISOString(),
        agentsChecked: agents.length,
        templateGeneration: generationStats,
        templateApproval: approvalStats,
        templateCoverage: coverageResults
      };

      console.log('\n=== ENHANCED TEMPLATE SERVICES STATUS ===');
      console.log(JSON.stringify(statusReport, null, 2));

      return { success: true, statusReport };

    } catch (error) {
      logger.error({ err: error }, 'Status check failed');
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize the enhanced services
   * @private
   */
  async _initializeServices() {
    logger.info('Initializing enhanced services...');

    if (this.options.dryRun) {
      logger.info('[DRY RUN] Would initialize AI Template Generation Service');
      logger.info('[DRY RUN] Would initialize Automatic Template Approval Service');
      return;
    }

    try {
      // Initialize AI Template Generation Service
      await aiTemplateGenerationService.initialize();
      this.initializationResults.aiTemplateGeneration = true;
      logger.info('AI Template Generation Service initialized');

      // Initialize Automatic Template Approval Service
      await automaticTemplateApprovalService.initialize();
      this.initializationResults.automaticApproval = true;
      logger.info('Automatic Template Approval Service initialized');

      // Initialize enhanced services in the main follow-up service
      const enhancedResult = await intelligentFollowUpService.initializeEnhancedServices();
      
      if (!enhancedResult.success) {
        throw new Error(`Enhanced services initialization failed: ${enhancedResult.error}`);
      }

    } catch (error) {
      this.initializationResults.errors.push(`Service initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check template coverage for all agents
   * @private
   */
  async _checkTemplateCoverage() {
    logger.info('Checking template coverage...');

    try {
      const agents = await this._getAgents();
      
      for (const agent of agents) {
        if (this.options.agentId && agent.id !== this.options.agentId) {
          continue;
        }

        const coverage = await multiWABATemplateService.checkTemplateCoverage(agent.id);
        this.initializationResults.templateCoverage[agent.id] = {
          agentName: agent.full_name,
          ...coverage
        };

        if (!coverage.overallCoverage) {
          logger.warn({ 
            agentId: agent.id,
            agentName: agent.full_name,
            missingCategories: coverage.missingCategories 
          }, 'Agent has incomplete template coverage');
        }
      }

    } catch (error) {
      this.initializationResults.errors.push(`Template coverage check failed: ${error.message}`);
      logger.error({ err: error }, 'Template coverage check failed');
    }
  }

  /**
   * Perform initial template generation
   * @private
   */
  async _performInitialTemplateGeneration() {
    logger.info('Performing initial template generation...');

    if (this.options.dryRun) {
      logger.info('[DRY RUN] Would trigger AI template generation');
      return;
    }

    try {
      const generationResult = await intelligentFollowUpService.triggerTemplateGeneration(this.options.agentId);
      
      if (generationResult.success) {
        logger.info({ 
          templatesGenerated: generationResult.templatesGenerated 
        }, 'Initial template generation completed');
      } else {
        logger.warn({ error: generationResult.error }, 'Template generation failed');
      }

    } catch (error) {
      this.initializationResults.errors.push(`Template generation failed: ${error.message}`);
      logger.error({ err: error }, 'Initial template generation failed');
    }
  }

  /**
   * Sync templates across agents
   * @private
   */
  async _syncTemplatesAcrossAgents() {
    logger.info('Syncing templates across agents...');

    if (this.options.dryRun) {
      logger.info('[DRY RUN] Would sync templates across agents');
      return;
    }

    try {
      const agents = await this._getAgents();
      
      if (agents.length < 2) {
        logger.info('Less than 2 agents found, skipping template sync');
        return;
      }

      // Find agent with most approved templates as source
      let sourceAgent = null;
      let maxTemplates = 0;

      for (const agent of agents) {
        const coverage = this.initializationResults.templateCoverage[agent.id];
        if (coverage && coverage.totalApprovedTemplates > maxTemplates) {
          maxTemplates = coverage.totalApprovedTemplates;
          sourceAgent = agent;
        }
      }

      if (!sourceAgent) {
        logger.warn('No suitable source agent found for template sync');
        return;
      }

      const targetAgentIds = agents
        .filter(a => a.id !== sourceAgent.id)
        .map(a => a.id);

      const syncResult = await automaticTemplateApprovalService.syncTemplatesAcrossAgents(
        sourceAgent.id,
        targetAgentIds
      );

      if (syncResult.success) {
        logger.info({ 
          sourceAgent: sourceAgent.full_name,
          targetAgents: syncResult.targetAgents,
          templatesSubmitted: syncResult.templatesSubmitted 
        }, 'Template sync completed');
      }

    } catch (error) {
      this.initializationResults.errors.push(`Template sync failed: ${error.message}`);
      logger.error({ err: error }, 'Template sync failed');
    }
  }

  /**
   * Get agents to process
   * @private
   */
  async _getAgents() {
    try {
      let query = supabase
        .from('agents')
        .select('id, full_name, email, status')
        .eq('status', 'active');

      if (this.options.agentId) {
        query = query.eq('id', this.options.agentId);
      }

      const { data: agents, error } = await query;

      if (error) throw error;

      return agents || [];
    } catch (error) {
      logger.error({ err: error }, 'Failed to get agents');
      return [];
    }
  }

  /**
   * Display initialization results
   * @private
   */
  _displayResults() {
    console.log('\n=== INITIALIZATION RESULTS ===');
    console.log(`AI Template Generation: ${this.initializationResults.aiTemplateGeneration ? '✅' : '❌'}`);
    console.log(`Automatic Approval: ${this.initializationResults.automaticApproval ? '✅' : '❌'}`);
    
    console.log('\n=== TEMPLATE COVERAGE ===');
    Object.entries(this.initializationResults.templateCoverage).forEach(([agentId, coverage]) => {
      const status = coverage.overallCoverage ? '✅' : '⚠️';
      console.log(`${status} ${coverage.agentName}: ${coverage.totalApprovedTemplates} templates`);
      
      if (!coverage.overallCoverage && coverage.missingCategories) {
        console.log(`   Missing: ${coverage.missingCategories.join(', ')}`);
      }
    });

    if (this.initializationResults.errors.length > 0) {
      console.log('\n=== ERRORS ===');
      this.initializationResults.errors.forEach(error => {
        console.log(`❌ ${error}`);
      });
    }

    console.log('\n=== NEXT STEPS ===');
    console.log('1. Monitor template generation in logs');
    console.log('2. Check Gupshup dashboard for template approval status');
    console.log('3. Review template coverage reports regularly');
    console.log('4. Use the enhanced statistics endpoint for monitoring');
  }
}

// Main execution
async function main() {
  const initializer = new EnhancedTemplateServicesInitializer();
  
  try {
    const result = await initializer.initialize();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error({ err: error }, 'Initialization script failed');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = EnhancedTemplateServicesInitializer;
