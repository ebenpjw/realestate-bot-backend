#!/usr/bin/env node

/**
 * Script to check if the correct Supabase key is being used
 * This helps diagnose RLS authentication issues
 */

const config = require('../config');
const logger = require('../logger');

function checkSupabaseKey() {
  console.log('\n=== Supabase Key Diagnostic ===\n');
  
  if (!config.SUPABASE_KEY) {
    console.log('❌ SUPABASE_KEY is not set in environment variables');
    return false;
  }
  
  const key = config.SUPABASE_KEY;
  const keyLength = key.length;
  const keyPrefix = key.substring(0, 30) + '...';
  
  console.log(`Key Length: ${keyLength}`);
  console.log(`Key Prefix: ${keyPrefix}`);
  
  // Check if it's likely a service role key
  const isServiceRoleKey = key.includes('service_role') || 
                          key.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6');
  
  // Check if it's likely an anon key
  const isAnonKey = key.includes('anon') || 
                   (key.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9') && !isServiceRoleKey);
  
  if (isServiceRoleKey) {
    console.log('✅ Key appears to be a SERVICE_ROLE key (correct for backend)');
    return true;
  } else if (isAnonKey) {
    console.log('❌ Key appears to be an ANON key (incorrect for backend)');
    console.log('\n🔧 SOLUTION:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to Settings > API');
    console.log('3. Copy the "service_role" key (NOT the "anon" key)');
    console.log('4. Update your Railway environment variable SUPABASE_KEY');
    console.log('5. Redeploy your application');
    return false;
  } else {
    console.log('⚠️  Key type is unclear - please verify manually');
    console.log('\nExpected service_role key characteristics:');
    console.log('- Should be a long JWT token');
    console.log('- Should NOT contain "anon" in the name');
    console.log('- Should be labeled as "service_role" in Supabase dashboard');
    return false;
  }
}

function main() {
  console.log('Checking Supabase configuration...\n');
  
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log(`Supabase URL: ${config.SUPABASE_URL}`);
  
  const isCorrectKey = checkSupabaseKey();
  
  if (!isCorrectKey) {
    console.log('\n❌ ISSUE DETECTED: Incorrect Supabase key type');
    console.log('\nThis is likely causing the "row-level security policy" error.');
    console.log('The backend needs the service_role key to bypass RLS policies.');
    process.exit(1);
  } else {
    console.log('\n✅ Supabase key configuration looks correct');
    console.log('\nIf you\'re still getting RLS errors, check:');
    console.log('1. The key is correctly set in Railway environment');
    console.log('2. The application has been redeployed after key update');
    console.log('3. RLS policies are correctly configured in Supabase');
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkSupabaseKey };
