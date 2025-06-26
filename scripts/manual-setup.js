/**
 * Manual Setup Script
 * Run this manually if Railway auto-setup fails
 */

const { railwayDeploy } = require('./railway-deploy');

console.log('🔧 Running manual setup...');
console.log('This will:');
console.log('  1. Setup Supabase database schema');
console.log('  2. Create default agent');
console.log('  3. Assign agents to existing leads');
console.log('');

railwayDeploy()
  .then((success) => {
    if (success) {
      console.log('✅ Manual setup completed successfully!');
      console.log('Your bot is now ready to receive WhatsApp messages.');
    } else {
      console.log('⚠️ Setup completed with some issues.');
      console.log('Check the logs above for details.');
    }
  })
  .catch((error) => {
    console.error('❌ Manual setup failed:', error.message);
    console.error('Please check your environment variables and try again.');
    throw new Error('Manual setup failed');
  });
