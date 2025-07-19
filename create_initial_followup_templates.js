#!/usr/bin/env node

/**
 * Create Initial Follow-Up Templates
 * 
 * This script creates the 5 core follow-up templates needed for the system:
 * 1. follow_up_generic - General follow-up
 * 2. follow_up_family_discussion - When lead needs to discuss with family
 * 3. follow_up_budget_concerns - When lead has budget concerns
 * 4. follow_up_viewing_feedback - After property viewing
 * 5. follow_up_decision_timeline - When lead needs time to decide
 */

require('dotenv').config();
const logger = require('./logger');
const databaseService = require('./services/databaseService');
const wabaTemplateAutomationService = require('./services/wabaTemplateAutomationService');

const CORE_FOLLOWUP_TEMPLATES = [
  {
    templateName: 'follow_up_generic',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, just checking in on your property search. Any updates or questions I can help with? 😊'
      }
    ],
    description: 'Generic follow-up template for general check-ins'
  },
  {
    templateName: 'follow_up_family_discussion',
    category: 'UTILITY', 
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, hope your family discussion went well! Have you had a chance to talk about the {{2}} property? I\'m here if you have any questions. 🏠'
      }
    ],
    description: 'Follow-up when lead needs to discuss with family'
  },
  {
    templateName: 'follow_up_budget_concerns',
    category: 'UTILITY',
    language: 'en', 
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, I understand budget is important. I\'ve found some great options within your range. Would you like me to share a few properties that might work better? 💰'
      }
    ],
    description: 'Follow-up for leads with budget concerns'
  },
  {
    templateName: 'follow_up_viewing_feedback',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, how did the viewing of {{2}} go? I\'d love to hear your thoughts and help you with the next steps! 🔍'
      }
    ],
    description: 'Follow-up after property viewing'
  },
  {
    templateName: 'follow_up_decision_timeline',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, no pressure at all! Just wanted to check if you\'ve had time to consider the {{2}} property. I\'m here whenever you\'re ready to move forward. ⏰'
      }
    ],
    description: 'Follow-up when lead needs time to decide'
  }
];

class InitialTemplateCreator {
  constructor() {
    this.results = [];
  }

  async createTemplates() {
    try {
      console.log('🚀 Creating Initial Follow-Up Templates\n');

      // Get active agent
      const { data: agents, error } = await databaseService.supabase
        .from('agents')
        .select('*')
        .eq('status', 'active')
        .limit(1);

      if (error || !agents || agents.length === 0) {
        throw new Error('No active agents found');
      }

      const agent = agents[0];
      console.log(`👤 Creating templates for agent: ${agent.full_name} (ID: ${agent.id})\n`);

      // Check existing templates
      const { data: existingTemplates, error: existingError } = await databaseService.supabase
        .from('waba_templates')
        .select('template_name')
        .eq('agent_id', agent.id);

      if (existingError) throw existingError;

      const existingNames = new Set((existingTemplates || []).map(t => t.template_name));
      console.log(`📋 Found ${existingNames.size} existing templates`);

      // Create each template
      for (const template of CORE_FOLLOWUP_TEMPLATES) {
        await this.createTemplate(template, agent.id, existingNames);
      }

      // Display results
      this.displayResults();

    } catch (error) {
      logger.error({ err: error }, 'Failed to create initial templates');
      console.error('❌ Template creation failed:', error.message);
      process.exit(1);
    }
  }

  async createTemplate(templateData, agentId, existingNames) {
    const { templateName, description } = templateData;
    
    try {
      console.log(`📝 Processing: ${templateName}`);

      // Check if template already exists
      if (existingNames.has(templateName)) {
        console.log(`   ⏭️  Already exists, skipping`);
        this.results.push({
          template: templateName,
          status: 'skipped',
          reason: 'Already exists'
        });
        return;
      }

      // Add agent ID to template data
      const templateWithAgent = {
        ...templateData,
        agentId: agentId
      };

      // Submit template for approval
      console.log(`   📤 Submitting to Partner API...`);
      const result = await wabaTemplateAutomationService.submitTemplateForApproval(templateWithAgent);

      if (result.success) {
        console.log(`   ✅ Submitted successfully (ID: ${result.templateId})`);
        console.log(`   📊 Status: ${result.status}`);
        
        this.results.push({
          template: templateName,
          status: 'submitted',
          templateId: result.templateId,
          apiStatus: result.status
        });
      } else {
        console.log(`   ❌ Submission failed: ${result.error}`);
        
        this.results.push({
          template: templateName,
          status: 'failed',
          error: result.error
        });
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      
      this.results.push({
        template: templateName,
        status: 'error',
        error: error.message
      });
    }

    console.log(''); // Empty line for readability
  }

  displayResults() {
    console.log('📊 Template Creation Results:');
    console.log('=' .repeat(50));

    let submitted = 0;
    let skipped = 0;
    let failed = 0;

    this.results.forEach(result => {
      let status;
      let details = '';

      switch (result.status) {
        case 'submitted':
          status = '✅ SUBMITTED';
          details = `(ID: ${result.templateId})`;
          submitted++;
          break;
        case 'skipped':
          status = '⏭️  SKIPPED';
          details = `(${result.reason})`;
          skipped++;
          break;
        case 'failed':
        case 'error':
          status = '❌ FAILED';
          details = `(${result.error})`;
          failed++;
          break;
      }

      console.log(`${status} ${result.template} ${details}`);
    });

    console.log('=' .repeat(50));
    console.log(`Total: ${this.results.length} | Submitted: ${submitted} | Skipped: ${skipped} | Failed: ${failed}`);

    if (submitted > 0) {
      console.log(`\n🎉 ${submitted} template(s) submitted for approval!`);
      console.log('⏳ Templates will be automatically approved by Gupshup Partner API.');
      console.log('📊 Check status with: node test_followup_template_flow.js');
    }

    if (failed > 0) {
      console.log(`\n⚠️  ${failed} template(s) failed. Please review the errors above.`);
    }
  }
}

// Run the creator
if (require.main === module) {
  const creator = new InitialTemplateCreator();
  creator.createTemplates().catch(error => {
    console.error('Template creation failed:', error);
    process.exit(1);
  });
}

module.exports = InitialTemplateCreator;
