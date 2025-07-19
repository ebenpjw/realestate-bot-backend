#!/usr/bin/env node

/**
 * CREATE CORE TEMPLATES SCRIPT
 * 
 * Creates the 6 core appointment-setting templates for all agents.
 * These are the essential templates needed for the bot to function.
 */

const automaticTemplateApprovalService = require('./services/automaticTemplateApprovalService');
const databaseService = require('./services/databaseService');

async function createCoreTemplates() {
  try {
    console.log('🚀 Creating Core Appointment-Setting Templates\n');

    // Get all active agents
    const { data: agents, error } = await databaseService.supabase
      .from('agents')
      .select('id, full_name, phone_number')
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch agents: ${error.message}`);
    }

    if (!agents || agents.length === 0) {
      console.log('❌ No active agents found');
      return;
    }

    console.log(`👥 Found ${agents.length} active agent(s):`);
    agents.forEach(agent => {
      console.log(`   - ${agent.full_name} (${agent.phone_number})`);
    });
    console.log();

    // Process each agent
    const results = [];
    for (const agent of agents) {
      console.log(`👤 Processing agent: ${agent.full_name} (ID: ${agent.id})`);
      
      try {
        const result = await automaticTemplateApprovalService.checkAndEnsureTemplateApproval(agent.id);
        results.push(result);
        
        if (result.coreTemplatesSubmitted > 0) {
          console.log(`   ✅ Submitted ${result.coreTemplatesSubmitted} core templates`);
          if (result.missingCoreTemplates && result.missingCoreTemplates.length > 0) {
            console.log(`   📝 Templates created: ${result.missingCoreTemplates.join(', ')}`);
          }
        } else {
          console.log(`   ✅ All core templates already exist`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        results.push({
          agentId: agent.id,
          agentName: agent.full_name,
          error: error.message,
          status: 'error'
        });
      }
      
      console.log();
    }

    // Summary
    console.log('📊 Core Template Creation Summary:');
    console.log('==================================================');
    
    const successful = results.filter(r => r.status !== 'error');
    const failed = results.filter(r => r.status === 'error');
    const totalSubmitted = successful.reduce((sum, r) => sum + (r.coreTemplatesSubmitted || 0), 0);
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📝 Total templates submitted: ${totalSubmitted}`);
    console.log('==================================================');
    
    if (failed.length > 0) {
      console.log('\n❌ Failed agents:');
      failed.forEach(result => {
        console.log(`   - ${result.agentName}: ${result.error}`);
      });
    }

    if (totalSubmitted > 0) {
      console.log('\n🎉 Core templates submitted successfully!');
      console.log('⏳ Templates will be automatically approved by Gupshup Partner API.');
      console.log('📊 Check status with: node test_followup_template_flow.js');
    } else {
      console.log('\n✅ All agents already have their core templates!');
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createCoreTemplates()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createCoreTemplates };
