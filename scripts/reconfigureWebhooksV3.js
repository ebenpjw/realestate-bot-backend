#!/usr/bin/env node

/**
 * Reconfigure Webhook Subscriptions for v3 API
 * 
 * This script updates all agent webhook subscriptions to use the proper v3 configuration
 * with specific event modes for better delivery tracking.
 */

const databaseService = require('../services/databaseService');
const gupshupPartnerService = require('../services/gupshupPartnerService');
const logger = require('../logger');

class WebhookReconfigurationService {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  /**
   * Get webhook URL for the environment
   */
  getWebhookUrl() {
    // Always use production HTTPS URL for webhook configuration
    // This ensures webhooks work even when configuring from local development
    const productionUrl = 'https://backend-api-production-d74a.up.railway.app/api/gupshup/webhook';

    // For production/Railway deployment
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
      return productionUrl;
    }

    // For local development - use ngrok or similar tunnel if available
    if (process.env.WEBHOOK_BASE_URL && process.env.WEBHOOK_BASE_URL.startsWith('https://')) {
      return `${process.env.WEBHOOK_BASE_URL}/api/gupshup/webhook`;
    }

    // Default to production URL for webhook configuration
    // This allows local scripts to configure production webhooks
    console.log('ℹ️ Using production webhook URL for configuration from local environment');
    return productionUrl;
  }

  /**
   * Reconfigure webhook for a single agent
   */
  async reconfigureAgentWebhook(agent) {
    const prefix = `[${agent.full_name}]`;
    
    try {
      console.log(`${prefix} 🔧 Reconfiguring webhook subscription...`);
      
      // Delete existing subscriptions first
      try {
        const existingSubscriptions = await gupshupPartnerService.getAppSubscriptions(agent.gupshup_app_id);
        
        for (const subscription of existingSubscriptions) {
          console.log(`${prefix} 🗑️ Deleting existing subscription: ${subscription.id}`);
          await gupshupPartnerService.deleteAppSubscription(agent.gupshup_app_id, subscription.id);
        }
      } catch (deleteError) {
        console.log(`${prefix} ⚠️ Could not delete existing subscriptions: ${deleteError.message}`);
      }

      // Configure new v3 webhook subscription
      const webhookUrl = this.getWebhookUrl();
      const subscription = await gupshupPartnerService.configureWebhookSubscription(agent.gupshup_app_id, {
        webhookUrl
      });

      console.log(`${prefix} ✅ Webhook reconfigured successfully`);
      console.log(`${prefix}    Subscription ID: ${subscription.id}`);
      console.log(`${prefix}    Webhook URL: ${subscription.url}`);
      console.log(`${prefix}    Version: ${subscription.version}`);
      console.log(`${prefix}    Modes: ${subscription.mode}`);

      this.results.push({
        agentId: agent.id,
        agentName: agent.full_name,
        appId: agent.gupshup_app_id,
        success: true,
        action: 'reconfigured',
        subscriptionId: subscription.id,
        webhookUrl: subscription.url,
        version: subscription.version
      });

    } catch (error) {
      console.error(`${prefix} ❌ Failed to reconfigure webhook:`, error.message);
      
      this.errors.push({
        agentId: agent.id,
        agentName: agent.full_name,
        appId: agent.gupshup_app_id,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Reconfigure webhooks for all agents
   */
  async reconfigureAllWebhooks() {
    console.log('🚀 Starting webhook reconfiguration for v3 API...\n');

    try {
      // Get all agents with WABA configuration
      const { data: agents, error } = await databaseService.supabase
        .from('agents')
        .select('id, full_name, gupshup_app_id, waba_phone_number')
        .not('gupshup_app_id', 'is', null)
        .not('waba_phone_number', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch agents: ${error.message}`);
      }

      if (!agents || agents.length === 0) {
        console.log('⚠️ No agents found with WABA configuration');
        return;
      }

      console.log(`📋 Found ${agents.length} agents to reconfigure\n`);

      // Process each agent
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        console.log(`\n[${i + 1}/${agents.length}] Processing ${agent.full_name}...`);
        
        await this.reconfigureAgentWebhook(agent);
        
        // Add delay between requests to avoid rate limiting
        if (i < agents.length - 1) {
          console.log('⏳ Waiting 2 seconds before next agent...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Print summary
      this.printSummary();

    } catch (error) {
      console.error('💥 Fatal error during webhook reconfiguration:', error.message);
      process.exit(1);
    }
  }

  /**
   * Print summary of results
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 WEBHOOK RECONFIGURATION SUMMARY');
    console.log('='.repeat(60));

    console.log(`✅ Successfully reconfigured: ${this.results.length}`);
    console.log(`❌ Failed: ${this.errors.length}`);

    if (this.results.length > 0) {
      console.log('\n✅ SUCCESSFUL RECONFIGURATIONS:');
      this.results.forEach(result => {
        console.log(`   • ${result.agentName} (${result.appId})`);
        console.log(`     Subscription ID: ${result.subscriptionId}`);
        console.log(`     Version: ${result.version}`);
      });
    }

    if (this.errors.length > 0) {
      console.log('\n❌ FAILED RECONFIGURATIONS:');
      this.errors.forEach(error => {
        console.log(`   • ${error.agentName} (${error.appId})`);
        console.log(`     Error: ${error.error}`);
      });
    }

    console.log('\n🎉 Webhook reconfiguration completed!');
    console.log('📝 All agents should now have v3 webhook subscriptions with proper delivery tracking.');
  }
}

// Run the script
async function main() {
  const service = new WebhookReconfigurationService();
  await service.reconfigureAllWebhooks();
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = WebhookReconfigurationService;
