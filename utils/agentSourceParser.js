/**
 * Agent Source Parser - Handles multi-agent source tracking and assignment
 */

const logger = require('../logger');

/**
 * Parse source to extract agent information
 * @param {string} source - Source string (e.g., "WA_Agent_John_Smith", "FB_Ad_Agent_Sarah_Tan")
 * @returns {Object} Parsed source information
 */
function parseAgentSource(source) {
  try {
    if (!source || typeof source !== 'string') {
      return {
        platform: 'WA',
        agentName: null,
        agentId: null,
        campaign: 'Direct',
        originalSource: source || 'WA Direct'
      };
    }

    // Expected formats:
    // "WA_Agent_John_Smith" 
    // "FB_Ad_Agent_Sarah_Tan"
    // "Google_Ad_Agent_Mike_Lee"
    // "WA Direct" (fallback)

    const parts = source.split('_');
    
    if (parts.length >= 3 && parts[1].toLowerCase() === 'agent') {
      // Extract agent name from parts[2] onwards
      const agentNameParts = parts.slice(2);
      const agentName = agentNameParts.join(' ').replace(/[^a-zA-Z\s]/g, '').trim();
      
      return {
        platform: parts[0].toUpperCase(),
        agentName: agentName,
        agentId: null, // Will be resolved later
        campaign: parts[1],
        originalSource: source
      };
    }

    // Fallback for unrecognized formats
    return {
      platform: 'WA',
      agentName: null,
      agentId: null,
      campaign: 'Direct',
      originalSource: source
    };

  } catch (error) {
    logger.error({ err: error, source }, 'Error parsing agent source');
    return {
      platform: 'WA',
      agentName: null,
      agentId: null,
      campaign: 'Direct',
      originalSource: source || 'WA Direct'
    };
  }
}

/**
 * Find agent by name in database
 * @param {Object} supabase - Supabase client
 * @param {string} agentName - Agent name to search for
 * @returns {Promise<Object|null>} Agent object or null
 */
async function findAgentByName(supabase, agentName) {
  try {
    if (!agentName) return null;

    // Try exact match first
    let { data: agent, error } = await supabase
      .from('agents')
      .select('id, full_name, status')
      .eq('status', 'active')
      .ilike('full_name', agentName)
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn({ err: error, agentName }, 'Error searching for agent by exact name');
    }

    if (agent) {
      logger.info({ 
        agentId: agent.id, 
        agentName: agent.full_name,
        searchName: agentName 
      }, 'Found agent by exact name match');
      return agent;
    }

    // Try partial match (first name or last name)
    const nameParts = agentName.split(' ');
    if (nameParts.length > 1) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];

      const { data: partialMatches, error: partialError } = await supabase
        .from('agents')
        .select('id, full_name, status')
        .eq('status', 'active')
        .or(`full_name.ilike.%${firstName}%,full_name.ilike.%${lastName}%`)
        .limit(5);

      if (partialError) {
        logger.warn({ err: partialError, agentName }, 'Error searching for agent by partial name');
      }

      if (partialMatches && partialMatches.length > 0) {
        // Return the first match
        const match = partialMatches[0];
        logger.info({ 
          agentId: match.id, 
          agentName: match.full_name,
          searchName: agentName,
          matchType: 'partial'
        }, 'Found agent by partial name match');
        return match;
      }
    }

    logger.warn({ agentName }, 'No agent found matching name');
    return null;

  } catch (error) {
    logger.error({ err: error, agentName }, 'Error finding agent by name');
    return null;
  }
}

/**
 * Get fallback agent (first active agent)
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Object|null>} Agent object or null
 */
async function getFallbackAgent(supabase) {
  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select('id, full_name, status')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn({ err: error }, 'Error fetching fallback agent');
      return null;
    }

    if (agent) {
      logger.info({ 
        agentId: agent.id, 
        agentName: agent.full_name 
      }, 'Using fallback agent');
    } else {
      logger.warn('No active agents available for fallback');
    }

    return agent;

  } catch (error) {
    logger.error({ err: error }, 'Error getting fallback agent');
    return null;
  }
}

/**
 * Resolve agent assignment from source
 * @param {Object} supabase - Supabase client
 * @param {string} source - Source string
 * @returns {Promise<Object>} Agent assignment result
 */
async function resolveAgentFromSource(supabase, source) {
  try {
    const parsedSource = parseAgentSource(source);
    
    let assignedAgent = null;
    let assignmentReason = 'fallback';

    // Try to find specific agent if name is provided
    if (parsedSource.agentName) {
      assignedAgent = await findAgentByName(supabase, parsedSource.agentName);
      if (assignedAgent) {
        assignmentReason = 'source_match';
      }
    }

    // Fallback to any active agent
    if (!assignedAgent) {
      assignedAgent = await getFallbackAgent(supabase);
    }

    return {
      agent: assignedAgent,
      parsedSource,
      assignmentReason,
      success: !!assignedAgent
    };

  } catch (error) {
    logger.error({ err: error, source }, 'Error resolving agent from source');
    return {
      agent: null,
      parsedSource: parseAgentSource(source),
      assignmentReason: 'error',
      success: false
    };
  }
}

module.exports = {
  parseAgentSource,
  findAgentByName,
  getFallbackAgent,
  resolveAgentFromSource
};
