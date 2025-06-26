// setup-test-agent.js
// Script to set up a test agent with zoom_email for Server-to-Server OAuth testing

require('dotenv').config();
const supabase = require('./supabaseClient');

async function setupTestAgent() {
    console.log('🔧 Setting up test agent for Zoom Server-to-Server OAuth\n');

    try {
        // Get the first active agent
        const { data: agents, error: fetchError } = await supabase
            .from('agents')
            .select('id, full_name, email, zoom_email')
            .eq('status', 'active')
            .limit(1);

        if (fetchError) {
            console.log('❌ Failed to fetch agents:', fetchError.message);
            return;
        }

        if (!agents || agents.length === 0) {
            console.log('❌ No active agents found in database');
            return;
        }

        const agent = agents[0];
        console.log('📋 Current agent details:');
        console.log('   - Name:', agent.full_name);
        console.log('   - Email:', agent.email);
        console.log('   - Current Zoom Email:', agent.zoom_email || 'Not set');
        console.log('   - Agent ID:', agent.id);
        console.log();

        // Set zoom_email for testing
        const testZoomEmail = 'doro@marketingwithdoro.com'; // Use your business email
        
        const { data: updatedAgent, error: updateError } = await supabase
            .from('agents')
            .update({ zoom_email: testZoomEmail })
            .eq('id', agent.id)
            .select()
            .single();

        if (updateError) {
            console.log('❌ Failed to update agent:', updateError.message);
            return;
        }

        console.log('✅ Successfully updated agent:');
        console.log('   - Name:', updatedAgent.full_name);
        console.log('   - New Zoom Email:', updatedAgent.zoom_email);
        console.log();

        console.log('🎉 Test agent is ready!');
        console.log('📝 Next step: Run "node test-zoom-integration.js" to test the integration');

    } catch (error) {
        console.log('❌ Error setting up test agent:', error.message);
    }
}

// Run the setup
setupTestAgent().catch(console.error);
