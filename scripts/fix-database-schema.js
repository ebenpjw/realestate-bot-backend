/**
 * Fix Database Schema Script
 * Adds missing working_hours and timezone columns to agents table
 */

const supabase = require('../supabaseClient');
const logger = require('../logger');

async function fixDatabaseSchema() {
  try {
    logger.info('🔧 Fixing database schema - adding missing columns...');

    // First, let's check the current structure of the agents table
    logger.info('📋 Checking current agents table structure...');
    
    const { data: agents, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .limit(1);

    if (fetchError) {
      logger.error({ err: fetchError }, 'Error fetching agents to check structure');
      throw fetchError;
    }

    if (agents && agents.length > 0) {
      const sampleAgent = agents[0];
      logger.info({ 
        agentId: sampleAgent.id,
        hasWorkingHours: 'working_hours' in sampleAgent,
        hasTimezone: 'timezone' in sampleAgent,
        currentColumns: Object.keys(sampleAgent)
      }, 'Current agent table structure');

      // If columns already exist, update existing agents with proper working hours
      if ('working_hours' in sampleAgent && 'timezone' in sampleAgent) {
        logger.info('✅ Columns already exist, updating existing agents with proper working hours...');
        
        // Get all agents that need working hours updates
        const { data: allAgents, error: getAllError } = await supabase
          .from('agents')
          .select('id, working_hours, timezone');

        if (getAllError) {
          logger.error({ err: getAllError }, 'Error fetching all agents');
          throw getAllError;
        }

        let updatedCount = 0;
        for (const agent of allAgents) {
          const needsUpdate = !agent.working_hours || !agent.timezone;
          
          if (needsUpdate) {
            const updates = {};
            
            if (!agent.working_hours) {
              updates.working_hours = {
                start: 9,
                end: 18,
                days: [1, 2, 3, 4, 5] // Monday to Friday
              };
            }
            
            if (!agent.timezone) {
              updates.timezone = 'Asia/Singapore';
            }

            const { error: updateError } = await supabase
              .from('agents')
              .update(updates)
              .eq('id', agent.id);

            if (updateError) {
              logger.error({ err: updateError, agentId: agent.id }, 'Failed to update agent');
            } else {
              updatedCount++;
              logger.info({ agentId: agent.id, updates }, 'Updated agent working hours');
            }
          }
        }

        logger.info({ updatedCount, totalAgents: allAgents.length }, '✅ Agent working hours update completed');
        return true;
      }
    }

    // If we reach here, the columns don't exist or there are no agents
    logger.warn('⚠️ Database schema needs to be updated manually');
    logger.info('The following columns need to be added to the agents table:');
    logger.info('  - working_hours JSONB DEFAULT \'{"start": 9, "end": 18, "days": [1, 2, 3, 4, 5]}\'');
    logger.info('  - timezone VARCHAR(100) DEFAULT \'Asia/Singapore\'');
    logger.info('');
    logger.info('You can run this SQL in your Supabase dashboard:');
    logger.info('');
    logger.info('ALTER TABLE agents ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT \'{"start": 9, "end": 18, "days": [1, 2, 3, 4, 5]}\';');
    logger.info('ALTER TABLE agents ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT \'Asia/Singapore\';');
    logger.info('');
    
    return false;

  } catch (error) {
    logger.error({ err: error }, 'Failed to fix database schema');
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  fixDatabaseSchema()
    .then((success) => {
      if (success) {
        logger.info('✅ Database schema fix completed successfully!');
        process.exit(0);
      } else {
        logger.warn('⚠️ Manual database update required');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error({ err: error }, '❌ Database schema fix failed');
      process.exit(1);
    });
}

module.exports = { fixDatabaseSchema };
