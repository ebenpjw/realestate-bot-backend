/**
 * Test Calendar Integration Script
 * Tests the calendar booking functionality with proper agent working hours
 */

const supabase = require('../supabaseClient');
const logger = require('../logger');
const { getAgentWorkingHours, findNextAvailableSlots } = require('../api/bookingHelper');

async function testCalendarIntegration() {
  try {
    logger.info('🧪 Testing calendar integration...');

    // 1. Get active agents
    logger.info('📋 Fetching active agents...');
    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('id, full_name, email, status, working_hours, timezone')
      .eq('status', 'active')
      .limit(5);

    if (agentError) {
      logger.error({ err: agentError }, 'Error fetching agents');
      throw agentError;
    }

    if (!agents || agents.length === 0) {
      logger.warn('⚠️ No active agents found');
      return false;
    }

    logger.info({ 
      agentCount: agents.length,
      agents: agents.map(a => ({ 
        id: a.id, 
        name: a.full_name, 
        hasWorkingHours: !!a.working_hours,
        hasTimezone: !!a.timezone 
      }))
    }, 'Found active agents');

    // 2. Test working hours retrieval for each agent
    for (const agent of agents) {
      logger.info(`🕒 Testing working hours for agent: ${agent.full_name}`);
      
      try {
        const workingHours = await getAgentWorkingHours(agent.id);
        logger.info({ 
          agentId: agent.id,
          agentName: agent.full_name,
          workingHours 
        }, 'Agent working hours retrieved successfully');

        // 3. Test slot finding
        logger.info(`📅 Finding available slots for agent: ${agent.full_name}`);
        const availableSlots = await findNextAvailableSlots(agent.id, null, 3); // 3 days ahead
        
        logger.info({ 
          agentId: agent.id,
          agentName: agent.full_name,
          slotCount: availableSlots.length,
          nextFewSlots: availableSlots.slice(0, 3).map(slot => ({
            time: slot.toISOString(),
            localTime: slot.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
          }))
        }, 'Available slots found');

      } catch (error) {
        logger.error({ 
          err: error, 
          agentId: agent.id, 
          agentName: agent.full_name 
        }, 'Error testing agent calendar integration');
      }
    }

    // 4. Test database schema
    logger.info('🗄️ Testing database schema...');
    const { data: sampleAgent, error: schemaError } = await supabase
      .from('agents')
      .select('*')
      .limit(1)
      .single();

    if (schemaError) {
      logger.error({ err: schemaError }, 'Error checking database schema');
      throw schemaError;
    }

    const hasRequiredColumns = sampleAgent && 
      'working_hours' in sampleAgent && 
      'timezone' in sampleAgent;

    logger.info({ 
      hasRequiredColumns,
      availableColumns: sampleAgent ? Object.keys(sampleAgent) : [],
      workingHoursValue: sampleAgent?.working_hours,
      timezoneValue: sampleAgent?.timezone
    }, 'Database schema check completed');

    if (!hasRequiredColumns) {
      logger.error('❌ Required columns (working_hours, timezone) are missing from agents table');
      return false;
    }

    logger.info('✅ Calendar integration test completed successfully!');
    return true;

  } catch (error) {
    logger.error({ err: error }, '❌ Calendar integration test failed');
    return false;
  }
}

// Run the test if called directly
if (require.main === module) {
  testCalendarIntegration()
    .then((success) => {
      if (success) {
        logger.info('✅ All calendar integration tests passed!');
        process.exit(0);
      } else {
        logger.error('❌ Calendar integration tests failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error({ err: error }, '❌ Test execution failed');
      process.exit(1);
    });
}

module.exports = { testCalendarIntegration };
