const supabase = require('../supabaseClient');
const logger = require('../logger');

async function createDefaultAgent() {
  try {
    logger.info('🚀 Creating default agent for lead assignment...');

    // Check if any agents exist
    const { data: existingAgents, error: checkError } = await supabase
      .from('agents')
      .select('id, full_name, status')
      .limit(5);

    if (checkError) {
      logger.error({ err: checkError }, 'Error checking existing agents');
      throw checkError;
    }

    if (existingAgents && existingAgents.length > 0) {
      logger.info({ 
        agentCount: existingAgents.length,
        agents: existingAgents.map(a => ({ id: a.id, name: a.full_name, status: a.status }))
      }, '✅ Agents already exist');
      
      // Check if there's an active agent
      const activeAgent = existingAgents.find(a => a.status === 'active');
      if (activeAgent) {
        logger.info({ agentId: activeAgent.id, name: activeAgent.full_name }, '✅ Active agent found for lead assignment');
        return activeAgent;
      } else {
        logger.warn('⚠️ No active agents found, leads will not be auto-assigned');
        return null;
      }
    }

    // Create default agent
    logger.info('📝 No agents found, creating default agent...');
    
    const defaultAgentData = {
      full_name: 'Default Agent',
      email: 'agent@realestate-bot.com',
      phone_number: '+6512345678',
      status: 'active',
      google_email: 'agent@realestate-bot.com',
      created_at: new Date().toISOString()
    };

    const { data: newAgent, error: createError } = await supabase
      .from('agents')
      .insert(defaultAgentData)
      .select()
      .single();

    if (createError) {
      logger.error({ err: createError }, 'Failed to create default agent');
      throw createError;
    }

    logger.info({ 
      agentId: newAgent.id, 
      name: newAgent.full_name,
      email: newAgent.email 
    }, '✅ Default agent created successfully');

    return newAgent;

  } catch (error) {
    logger.error({ err: error }, '❌ Failed to create default agent');
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createDefaultAgent()
    .then((agent) => {
      if (agent) {
        console.log(`✅ Default agent ready: ${agent.full_name} (${agent.id})`);
      } else {
        console.log('⚠️ No active agent available for lead assignment');
      }
      return true;
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error.message);
      throw error;
    });
}

module.exports = { createDefaultAgent };
