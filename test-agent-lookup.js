// test-agent-lookup.js - Test agent lookup functionality
const supabase = require('./supabaseClient');
const logger = require('./logger');

async function testAgentLookup() {
  const testAgentId = '4d1c54b9-71b5-4f89-828b-ffe179fcab08';
  
  try {
    logger.info('🔍 Testing agent lookup...');
    
    // First, let's check if we can connect to the database
    logger.info('📡 Testing database connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('leads')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      logger.error({ err: connectionError }, '❌ Database connection failed');
      return false;
    }
    
    logger.info('✅ Database connection successful');
    
    // Now let's check if the agents table exists and has data
    logger.info('📋 Checking agents table...');
    const { data: allAgents, error: agentsError } = await supabase
      .from('agents')
      .select('id, full_name, status')
      .limit(5);
    
    if (agentsError) {
      logger.error({ err: agentsError }, '❌ Failed to query agents table');
      return false;
    }
    
    logger.info({ 
      agentCount: allAgents?.length || 0,
      agents: allAgents 
    }, '📊 Agents table query successful');
    
    // Now test the specific agent lookup
    logger.info({ agentId: testAgentId }, '🎯 Looking up specific agent...');
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, full_name, status')
      .eq('id', testAgentId)
      .single();
    
    if (agentError) {
      logger.error({ 
        err: agentError, 
        agentId: testAgentId,
        errorCode: agentError.code,
        errorMessage: agentError.message
      }, '❌ Agent lookup failed');
      
      if (agentError.code === 'PGRST116') {
        logger.warn('🔍 Agent not found - this is the likely cause of the 400 error');
      }
      
      return false;
    }
    
    if (!agent) {
      logger.warn({ agentId: testAgentId }, '⚠️ Agent query returned null');
      return false;
    }
    
    logger.info({ 
      agent,
      agentId: testAgentId 
    }, '✅ Agent found successfully');
    
    return true;
    
  } catch (error) {
    logger.error({ 
      err: error,
      agentId: testAgentId 
    }, '💥 Agent lookup test failed with exception');
    
    return false;
  }
}

// Run test if called directly
if (require.main === module) {
  testAgentLookup()
    .then(success => {
      if (success) {
        logger.info('🎉 Agent lookup test completed successfully');
      } else {
        logger.error('❌ Agent lookup test failed');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error({ err: error }, '💥 Agent lookup test execution failed');
      process.exit(1);
    });
}

module.exports = { testAgentLookup };
