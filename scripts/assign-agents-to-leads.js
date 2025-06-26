const supabase = require('../supabaseClient');
const logger = require('../logger');

async function assignAgentsToLeads() {
  try {
    logger.info('🚀 Assigning agents to existing leads...');

    // Get active agents
    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('id, full_name, email')
      .eq('status', 'active');

    if (agentError) {
      logger.error({ err: agentError }, 'Error fetching agents');
      throw agentError;
    }

    if (!agents || agents.length === 0) {
      logger.warn('⚠️ No active agents found');
      return;
    }

    logger.info({ 
      agentCount: agents.length,
      agents: agents.map(a => ({ id: a.id, name: a.full_name }))
    }, 'Found active agents');

    // Get leads without agent assignment
    const { data: unassignedLeads, error: leadError } = await supabase
      .from('leads')
      .select('id, phone_number, full_name')
      .is('assigned_agent_id', null);

    if (leadError) {
      logger.error({ err: leadError }, 'Error fetching unassigned leads');
      throw leadError;
    }

    if (!unassignedLeads || unassignedLeads.length === 0) {
      logger.info('✅ All leads are already assigned to agents');
      return;
    }

    logger.info({ 
      unassignedCount: unassignedLeads.length 
    }, 'Found unassigned leads');

    // Use the first active agent with a name as default
    const defaultAgent = agents.find(a => a.full_name) || agents[0];
    
    // Update all unassigned leads
    const { data: updatedLeads, error: updateError } = await supabase
      .from('leads')
      .update({ assigned_agent_id: defaultAgent.id })
      .is('assigned_agent_id', null)
      .select('id, phone_number, full_name');

    if (updateError) {
      logger.error({ err: updateError }, 'Error updating leads');
      throw updateError;
    }

    logger.info({ 
      updatedCount: updatedLeads?.length || 0,
      agentId: defaultAgent.id,
      agentName: defaultAgent.full_name
    }, '✅ Successfully assigned agent to leads');

    return {
      agent: defaultAgent,
      updatedLeads: updatedLeads || []
    };

  } catch (error) {
    logger.error({ err: error }, '❌ Failed to assign agents to leads');
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  assignAgentsToLeads()
    .then((result) => {
      if (result) {
        console.log(`✅ Assigned ${result.updatedLeads.length} leads to agent: ${result.agent.full_name}`);
      }
      return true;
    })
    .catch((error) => {
      console.error('❌ Assignment failed:', error.message);
      throw error;
    });
}

module.exports = { assignAgentsToLeads };
