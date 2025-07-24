#!/usr/bin/env node

/**
 * Configure Webhook Subscriptions for All Existing Agents
 * 
 * This script fixes the critical issue where WhatsApp messages are not being delivered
 * by configuring webhook subscriptions for all agents using the Gupshup Partner API.
 * 
 * For Partner API users, webhooks MUST be configured programmatically - they cannot
 * be configured through the Gupshup Partner Portal UI.
 * 
 * Usage:
 *   node scripts/configureWebhooksForAllAgents.js
 *   node scripts/configureWebhooksForAllAgents.js --dry-run
 *   node scripts/configureWebhooksForAllAgents.js --agent-id=<specific-agent-id>
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.development') });

const logger = require('../logger');
const databaseService = require('../services/databaseService');
const gupshupPartnerService = require('../services/gupshupPartnerService');

class WebhookConfigurationScript {
  constructor() {
    this.dryRun = process.argv.includes('--dry-run');
    this.specificAgentId = this.getArgValue('--agent-id');
    this.results = [];
  }

  getArgValue(argName) {
    const arg = process.argv.find(arg => arg.startsWith(`${argName}=`));
    return arg ? arg.split('=')[1] : null;
  }

  async run() {
    try {
      console.log('🚀 Starting Webhook Configuration Script');
      console.log(`📋 Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
      console.log(`🎯 Target: ${this.specificAgentId ? `Agent ${this.specificAgentId}` : 'All Agents'}`);
      console.log(`🌐 Webhook URL: ${this.getWebhookUrl()}\n`);

      // Get agents to process
      const agents = await this.getAgentsToProcess();
      
      if (agents.length === 0) {
        console.log('❌ No agents found with Gupshup app configurations');
        return;
      }

      console.log(`📊 Found ${agents.length} agent(s) to process:\n`);
      
      // Display agents
      agents.forEach((agent, index) => {
        console.log(`${index + 1}. ${agent.full_name} (${agent.id})`);
        console.log(`   📱 Phone: ${agent.waba_phone_number || 'Not set'}`);
        console.log(`   🏗️ App ID: ${agent.gupshup_app_id}`);
        console.log('');
      });

      if (this.dryRun) {
        console.log('🔍 DRY RUN MODE - No actual changes will be made');
        return;
      }

      // Confirm execution
      if (!this.specificAgentId) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise(resolve => {
          readline.question('⚠️ This will configure webhooks for all agents. Continue? (y/N): ', resolve);
        });
        
        readline.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ Operation cancelled');
          return;
        }
      }

      // Process each agent
      console.log('\n🔧 Configuring webhooks...\n');
      
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        await this.configureWebhookForAgent(agent, i + 1, agents.length);
      }

      // Display results
      this.displayResults();

    } catch (error) {
      logger.error({ err: error }, 'Script execution failed');
      console.error('❌ Script failed:', error.message);
      process.exit(1);
    }
  }

  async getAgentsToProcess() {
    let query = databaseService.supabase
      .from('agents')
      .select('id, full_name, gupshup_app_id, waba_phone_number, waba_display_name')
      .not('gupshup_app_id', 'is', null);

    if (this.specificAgentId) {
      query = query.eq('id', this.specificAgentId);
    }

    const { data: agents, error } = await query;

    if (error) {
      throw new Error(`Failed to get agents: ${error.message}`);
    }

    return agents || [];
  }

  async configureWebhookForAgent(agent, current, total) {
    const prefix = `[${current}/${total}]`;
    
    try {
      console.log(`${prefix} 🔧 Configuring webhook for ${agent.full_name}...`);
      
      // Check existing subscriptions first
      const existingSubscriptions = await gupshupPartnerService.getAppSubscriptions(agent.gupshup_app_id);
      
      if (existingSubscriptions.length > 0) {
        console.log(`${prefix} ℹ️ Found ${existingSubscriptions.length} existing subscription(s)`);
        
        // Check if any subscription matches our webhook URL and has ALL modes
        const webhookUrl = this.getWebhookUrl();
        const productionWebhookUrl = 'https://backend-api-production-d74a.up.railway.app/api/gupshup/webhook';
        const isLocalTesting = process.env.WEBHOOK_BASE_URL && process.env.WEBHOOK_BASE_URL.includes('ngrok');

        // For local testing, always reconfigure to use ngrok URL
        if (isLocalTesting) {
          console.log(`${prefix} 🔄 Local testing mode detected - will reconfigure webhook to use ngrok URL`);

          // Delete all existing subscriptions for clean setup
          for (const subscription of existingSubscriptions) {
            try {
              await gupshupPartnerService.deleteSubscription(agent.gupshup_app_id, subscription.id);
              console.log(`${prefix} 🗑️ Deleted existing subscription (ID: ${subscription.id})`);
            } catch (deleteError) {
              console.log(`${prefix} ⚠️ Could not delete subscription ${subscription.id}: ${deleteError.message}`);
            }
          }
        } else {
          // Look for subscription with production URL (more important than local URL)
          let matchingSubscription = existingSubscriptions.find(sub => sub.url === productionWebhookUrl);

          if (!matchingSubscription) {
            // Fallback to any subscription with our webhook URL
            matchingSubscription = existingSubscriptions.find(sub => sub.url === webhookUrl);
          }

          if (matchingSubscription) {
            // Check if subscription has ALL modes (mode should be 2047 for ALL)
            const hasAllModes = matchingSubscription.mode === 2047 ||
                               (matchingSubscription.modes && matchingSubscription.modes.includes('ALL'));

            if (hasAllModes) {
              console.log(`${prefix} ✅ Webhook already configured with ALL modes (Subscription ID: ${matchingSubscription.id})`);

              this.results.push({
                agentId: agent.id,
                agentName: agent.full_name,
                appId: agent.gupshup_app_id,
                success: true,
                action: 'already_configured',
                subscriptionId: matchingSubscription.id,
                webhookUrl: matchingSubscription.url
              });

              return;
            } else {
              console.log(`${prefix} ⚠️ Webhook exists but only has limited modes (${matchingSubscription.modes?.join(', ') || 'mode: ' + matchingSubscription.mode})`);
              console.log(`${prefix} 🔄 Will update to ALL modes...`);

              // Delete the limited subscription and create a new one with ALL modes
              try {
                await gupshupPartnerService.deleteSubscription(agent.gupshup_app_id, matchingSubscription.id);
                console.log(`${prefix} 🗑️ Deleted limited subscription (ID: ${matchingSubscription.id})`);
              } catch (deleteError) {
                console.log(`${prefix} ⚠️ Could not delete existing subscription: ${deleteError.message}`);
              }
            }
          }
        }
      }

      // Configure new webhook subscription with the production URL
      const productionWebhookUrl = 'https://backend-api-production-d74a.up.railway.app/api/gupshup/webhook';
      const subscription = await gupshupPartnerService.configureWebhookSubscription(agent.gupshup_app_id, {
        webhookUrl: productionWebhookUrl
      });

      console.log(`${prefix} ✅ Webhook configured successfully`);
      console.log(`${prefix}    Subscription ID: ${subscription.id}`);
      console.log(`${prefix}    Webhook URL: ${subscription.url}`);
      console.log(`${prefix}    Modes: ALL (${subscription.mode})`);

      this.results.push({
        agentId: agent.id,
        agentName: agent.full_name,
        appId: agent.gupshup_app_id,
        success: true,
        action: 'configured',
        subscriptionId: subscription.id,
        webhookUrl: subscription.url
      });

    } catch (error) {
      console.log(`${prefix} ❌ Failed to configure webhook: ${error.message}`);
      
      this.results.push({
        agentId: agent.id,
        agentName: agent.full_name,
        appId: agent.gupshup_app_id,
        success: false,
        error: error.message
      });
      
      logger.error({
        err: error,
        agentId: agent.id,
        appId: agent.gupshup_app_id
      }, 'Failed to configure webhook for agent');
    }
  }

  displayResults() {
    console.log('\n📊 WEBHOOK CONFIGURATION RESULTS\n');
    
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const alreadyConfigured = successful.filter(r => r.action === 'already_configured');
    const newlyConfigured = successful.filter(r => r.action === 'configured');
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`   📋 Already configured: ${alreadyConfigured.length}`);
    console.log(`   🆕 Newly configured: ${newlyConfigured.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📊 Total: ${this.results.length}\n`);
    
    if (failed.length > 0) {
      console.log('❌ FAILED CONFIGURATIONS:\n');
      failed.forEach(result => {
        console.log(`   • ${result.agentName} (${result.agentId})`);
        console.log(`     App ID: ${result.appId}`);
        console.log(`     Error: ${result.error}\n`);
      });
    }
    
    if (newlyConfigured.length > 0) {
      console.log('🆕 NEWLY CONFIGURED WEBHOOKS:\n');
      newlyConfigured.forEach(result => {
        console.log(`   • ${result.agentName} (${result.agentId})`);
        console.log(`     Subscription ID: ${result.subscriptionId}`);
        console.log(`     Webhook URL: ${result.webhookUrl}\n`);
      });
    }
    
    console.log('🎉 Webhook configuration completed!');
    
    if (newlyConfigured.length > 0) {
      console.log('\n💡 NEXT STEPS:');
      console.log('1. Test message delivery by sending a WhatsApp message to any configured agent');
      console.log('2. Check the logs for incoming webhook events');
      console.log('3. Verify that the bot responds to messages');
    }
  }

  getWebhookUrl() {
    // For local development - prioritize WEBHOOK_BASE_URL if set
    if (process.env.WEBHOOK_BASE_URL) {
      return `${process.env.WEBHOOK_BASE_URL}/api/gupshup/webhook`;
    }

    // For production/Railway deployment
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
      return 'https://backend-api-production-d74a.up.railway.app/api/gupshup/webhook';
    }

    return 'http://localhost:8080/api/gupshup/webhook';
  }
}

// Run the script
if (require.main === module) {
  const script = new WebhookConfigurationScript();
  script.run().catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}

module.exports = WebhookConfigurationScript;
