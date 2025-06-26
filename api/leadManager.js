const supabase = require('../supabaseClient');
const logger = require('../logger');

async function findOrCreateLead({ phoneNumber, fullName, source }) {
  if (!phoneNumber || !fullName || !source) {
    const err = new Error('Phone number, full name, and source are required to find or create a lead.');
    logger.error({ phoneNumber, fullName, source }, err.message);
    throw err;
  }

  try {
    // First, try to find existing lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone_number', phoneNumber)
      .limit(1)
      .maybeSingle();

    if (leadError) {
      logger.error({ err: leadError, phoneNumber }, 'Supabase lookup error for lead.');
      throw new Error(`Supabase lookup error: ${leadError.message}`);
    }

    if (lead) {
      logger.info({ leadId: lead.id, phoneNumber }, `Found existing lead.`);
      return lead;
    }

    logger.info({ phoneNumber, fullName, source }, `Lead not found, creating new one...`);

    // Get a default agent for assignment with better error handling
    let defaultAgent = null;
    try {
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, full_name')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(); // Use maybeSingle to handle no results gracefully

      if (agentError) {
        logger.warn({ agentError }, 'Error fetching active agents');
      } else if (agent) {
        defaultAgent = agent;
        logger.info({
          agentId: agent.id,
          agentName: agent.full_name
        }, 'Found active agent for assignment');
      } else {
        logger.warn('No active agents found in database');
      }
    } catch (agentFetchError) {
      logger.warn({ err: agentFetchError }, 'Failed to fetch agents, proceeding without assignment');
    }

    // Prepare lead data with explicit values
    const newLeadData = {
      full_name: fullName,
      phone_number: phoneNumber,
      source: source,
      status: 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Assign to default agent if available
    if (defaultAgent) {
      newLeadData.assigned_agent_id = defaultAgent.id;
      logger.info({
        agentId: defaultAgent.id,
        agentName: defaultAgent.full_name
      }, 'Assigning lead to active agent');
    } else {
      logger.warn('Creating lead without agent assignment - no active agents available');
    }

    // Insert the new lead with enhanced error handling
    logger.info({ newLeadData }, 'Attempting to insert new lead');

    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert([newLeadData])
      .select()
      .single();

    if (insertError) {
      logger.error({
        err: insertError,
        phoneNumber,
        fullName,
        errorCode: insertError.code,
        errorMessage: insertError.message,
        errorDetails: insertError.details,
        errorHint: insertError.hint
      }, 'Failed to insert new lead - detailed error info');

      // Handle duplicate phone number (race condition)
      if (insertError.code === '23505') {
        logger.warn({ phoneNumber }, `Race condition: A lead with this phone number was just created. Fetching it.`);
        try {
          const { data: existingLead, error: retryError } = await supabase
            .from('leads')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();

          if (retryError) {
            logger.error({ err: retryError, phoneNumber }, 'Failed to fetch lead after race condition.');
            throw new Error(`Failed to fetch lead after race condition: ${retryError.message}`);
          }
          return existingLead;
        } catch (retryFetchError) {
          logger.error({ err: retryFetchError, phoneNumber }, 'Critical error during race condition recovery');
          throw new Error(`Critical error during race condition recovery: ${retryFetchError.message}`);
        }
      }

      // Handle other database errors
      throw new Error(`Failed to insert new lead: ${insertError.message} (Code: ${insertError.code})`);
    }

    if (!newLead) {
      logger.error({ phoneNumber, fullName }, 'Lead insertion returned no data');
      throw new Error('Lead insertion returned no data - possible database configuration issue');
    }

    logger.info({ leadId: newLead.id, fullName, phoneNumber }, `Successfully created new lead`);
    return newLead;

  } catch (error) {
    logger.error({
      err: error,
      phoneNumber,
      fullName,
      source,
      stack: error.stack
    }, 'Critical error in findOrCreateLead function');

    // Re-throw with more context
    throw new Error(`Lead creation failed: ${error.message}`);
  }
}

module.exports = { findOrCreateLead };
