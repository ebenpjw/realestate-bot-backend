#!/usr/bin/env node

/**
 * FOLLOW-UP SYSTEM STARTUP SCRIPT
 *
 * ⚠️  CURRENTLY DISABLED - DO NOT RUN ⚠️
 *
 * This script is disabled pending Gupshup Partner API approval.
 * The follow-up system requires automated template management which
 * needs Partner API access for template creation and approval.
 *
 * Initializes and starts the intelligent follow-up system including:
 * - Follow-up scheduler with automated processing
 * - Template creation for all agents
 * - Database schema setup
 * - Health monitoring
 */

const logger = require('../logger');
const config = require('../config');
const followUpScheduler = require('../services/followUpScheduler');
const intelligentFollowUpService = require('../services/intelligentFollowUpService');
const multiWABATemplateService = require('../services/multiWABATemplateService');
const supabase = require('../supabaseClient');

class FollowUpSystemInitializer {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the complete follow-up system
   */
  async initialize() {
    try {
      // Check if follow-up system is enabled
      if (!config.ENABLE_FOLLOW_UP_SYSTEM) {
        logger.warn('❌ Follow-up system is disabled in configuration');
        logger.warn('💡 Set ENABLE_FOLLOW_UP_SYSTEM=true in environment to enable');
        logger.warn('⚠️  Requires Gupshup Partner API approval for automated templates');
        throw new Error('Follow-up system is disabled');
      }

      logger.info('🚀 Starting Intelligent Follow-up System initialization...');

      // Step 1: Verify database schema
      await this._verifyDatabaseSchema();

      // Step 2: Create default templates for all agents
      await this._createDefaultTemplates();

      // Step 3: Start automated processing
      await this._startAutomatedProcessing();

      // Step 4: Setup health monitoring
      await this._setupHealthMonitoring();

      this.isInitialized = true;
      logger.info('✅ Intelligent Follow-up System initialized successfully!');

      // Display system status
      await this._displaySystemStatus();

    } catch (error) {
      logger.error({ err: error }, '❌ Failed to initialize follow-up system');
      throw error;
    }
  }

  /**
   * Verify database schema is properly set up
   * @private
   */
  async _verifyDatabaseSchema() {
    try {
      logger.info('📋 Verifying database schema...');

      // Check if required tables exist
      const requiredTables = [
        'lead_states',
        'follow_up_sequences', 
        'agent_follow_up_templates',
        'follow_up_tracking',
        'pdpa_compliance',
        'follow_up_performance_analytics'
      ];

      for (const table of requiredTables) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          throw new Error(`Table ${table} not found or accessible: ${error.message}`);
        }
      }

      logger.info('✅ Database schema verification completed');

    } catch (error) {
      logger.error({ err: error }, 'Database schema verification failed');
      throw error;
    }
  }

  /**
   * Create default templates for all agents
   * @private
   */
  async _createDefaultTemplates() {
    try {
      logger.info('📝 Creating default follow-up templates...');

      // Get all active agents
      const { data: agents, error } = await supabase
        .from('agents')
        .select('id, full_name, email')
        .eq('status', 'active');

      if (error) throw error;

      if (!agents || agents.length === 0) {
        logger.warn('No active agents found - skipping template creation');
        return;
      }

      const defaultTemplates = this._getDefaultTemplateLibrary();

      let createdCount = 0;
      for (const agent of agents) {
        for (const template of defaultTemplates) {
          try {
            // Check if template already exists
            const { data: existing } = await supabase
              .from('agent_follow_up_templates')
              .select('id')
              .eq('agent_id', agent.id)
              .eq('template_name', template.template_name)
              .eq('variation_number', template.variation_number)
              .single();

            if (!existing) {
              await multiWABATemplateService.createTemplate(agent.id, template);
              createdCount++;
            }

          } catch (templateError) {
            logger.warn({ 
              err: templateError, 
              agentId: agent.id, 
              templateName: template.template_name 
            }, 'Failed to create template for agent');
          }
        }
      }

      logger.info({ 
        agentsProcessed: agents.length,
        templatesCreated: createdCount 
      }, '✅ Default templates creation completed');

    } catch (error) {
      logger.error({ err: error }, 'Failed to create default templates');
      throw error;
    }
  }

  /**
   * Start automated follow-up processing
   * @private
   */
  async _startAutomatedProcessing() {
    try {
      logger.info('⚡ Starting automated follow-up processing...');

      // Start the scheduler with 5-minute intervals
      followUpScheduler.start();

      // Start intelligent follow-up service processing
      intelligentFollowUpService.startAutomatedProcessing(5);

      logger.info('✅ Automated processing started successfully');

    } catch (error) {
      logger.error({ err: error }, 'Failed to start automated processing');
      throw error;
    }
  }

  /**
   * Setup health monitoring
   * @private
   */
  async _setupHealthMonitoring() {
    try {
      logger.info('🏥 Setting up health monitoring...');

      // Setup graceful shutdown handlers
      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully...');
        await this.shutdown();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
        await this.shutdown();
        process.exit(0);
      });

      // Setup uncaught exception handlers
      process.on('uncaughtException', (error) => {
        logger.error({ err: error }, 'Uncaught exception in follow-up system');
      });

      process.on('unhandledRejection', (reason, promise) => {
        logger.error({ reason, promise }, 'Unhandled rejection in follow-up system');
      });

      logger.info('✅ Health monitoring setup completed');

    } catch (error) {
      logger.error({ err: error }, 'Failed to setup health monitoring');
      throw error;
    }
  }

  /**
   * Display system status
   * @private
   */
  async _displaySystemStatus() {
    try {
      const schedulerStatus = followUpScheduler.getStatus();
      
      // Get pending follow-ups count
      const { count: pendingCount } = await supabase
        .from('follow_up_sequences')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lte('scheduled_time', new Date().toISOString());

      // Get active agents count
      const { count: agentsCount } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get templates count
      const { count: templatesCount } = await supabase
        .from('agent_follow_up_templates')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      console.log('\n🎯 INTELLIGENT FOLLOW-UP SYSTEM STATUS');
      console.log('=====================================');
      console.log(`📊 System Status: ${this.isInitialized ? '✅ RUNNING' : '❌ STOPPED'}`);
      console.log(`🤖 Active Agents: ${agentsCount || 0}`);
      console.log(`📝 Active Templates: ${templatesCount || 0}`);
      console.log(`⏰ Pending Follow-ups: ${pendingCount || 0}`);
      console.log(`🔄 Scheduler Jobs: ${schedulerStatus.activeJobs.length}`);
      console.log(`📈 Total Processed: ${schedulerStatus.stats.totalProcessed}`);
      console.log(`❌ Total Failed: ${schedulerStatus.stats.totalFailed}`);
      console.log(`🕐 Last Run: ${schedulerStatus.stats.lastRunTime || 'Never'}`);
      console.log('=====================================\n');

    } catch (error) {
      logger.error({ err: error }, 'Failed to display system status');
    }
  }

  /**
   * Get default template library
   * @private
   */
  _getDefaultTemplateLibrary() {
    return [
      // Family Discussion Templates
      {
        template_name: 'family_discussion_v1',
        template_category: 'state_based',
        lead_state: 'need_family_discussion',
        template_content: 'Hey {{name}}, how are you doing? Just checking in regarding your property search. Have you had a chance to discuss with your family?',
        variation_group: 'family_discussion',
        variation_number: 1,
        usage_weight: 1.0
      },
      {
        template_name: 'family_discussion_v2',
        template_category: 'state_based',
        lead_state: 'need_family_discussion',
        template_content: 'Hi {{name}}! Hope you\'re well. Wondering if you\'ve had time to chat with your family about the property options we discussed?',
        variation_group: 'family_discussion',
        variation_number: 2,
        usage_weight: 1.0
      },

      // Still Looking Templates
      {
        template_name: 'still_looking_v1',
        template_category: 'state_based',
        lead_state: 'still_looking',
        template_content: 'Hey {{name}}, how\'s the property hunt going? Just wanted to check if you\'d like me to keep an eye out for anything specific.',
        variation_group: 'still_looking',
        variation_number: 1,
        usage_weight: 1.0
      },
      {
        template_name: 'still_looking_v2',
        template_category: 'state_based',
        lead_state: 'still_looking',
        template_content: 'Hi {{name}}! Hope your property search is going well. Any particular areas or types you\'d like me to focus on?',
        variation_group: 'still_looking',
        variation_number: 2,
        usage_weight: 1.0
      },

      // Budget Concerns Templates
      {
        template_name: 'budget_concerns_v1',
        template_category: 'state_based',
        lead_state: 'budget_concerns',
        template_content: 'Hey {{name}}, how are you doing? Just checking in - have you had a chance to review your budget options?',
        variation_group: 'budget_concerns',
        variation_number: 1,
        usage_weight: 1.0
      },

      // Generic Templates
      {
        template_name: 'generic_checkin_v1',
        template_category: 'generic',
        lead_state: 'default',
        template_content: 'Hey {{name}}, how are you doing? Just checking in regarding your property search. Anything I can help with?',
        variation_group: 'generic_checkin',
        variation_number: 1,
        usage_weight: 1.0
      },
      {
        template_name: 'generic_checkin_v2',
        template_category: 'generic',
        lead_state: 'default',
        template_content: 'Hi {{name}}! Hope you\'re well. Just wanted to see how things are going with your property plans.',
        variation_group: 'generic_checkin',
        variation_number: 2,
        usage_weight: 1.0
      },

      // Final Attempt Templates
      {
        template_name: 'final_attempt_v1',
        template_category: 'final',
        lead_state: 'default',
        template_content: 'Hey {{name}}, this will be my last check-in regarding your property search. If you need any help in the future, feel free to reach out!',
        variation_group: 'final_attempt',
        variation_number: 1,
        usage_weight: 1.0
      }
    ];
  }

  /**
   * Shutdown the follow-up system gracefully
   */
  async shutdown() {
    try {
      logger.info('🛑 Shutting down follow-up system...');

      // Stop scheduler
      followUpScheduler.stop();

      // Stop automated processing
      intelligentFollowUpService.stopAutomatedProcessing();

      this.isInitialized = false;
      logger.info('✅ Follow-up system shutdown completed');

    } catch (error) {
      logger.error({ err: error }, 'Error during follow-up system shutdown');
    }
  }
}

// Main execution
async function main() {
  const initializer = new FollowUpSystemInitializer();
  
  try {
    await initializer.initialize();
    
    // Keep the process running
    logger.info('Follow-up system is running. Press Ctrl+C to stop.');
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to start follow-up system');
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = FollowUpSystemInitializer;
