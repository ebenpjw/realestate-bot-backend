#!/usr/bin/env node

/**
 * Debug Login Process
 * Step-by-step debugging of the authentication flow
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../supabaseClient');
const config = require('../config');
const logger = require('../logger');

async function debugLogin() {
  try {
    const email = 'test.agent@propertyhub.com';
    const password = 'TestPassword123!';

    logger.info('🔍 Debugging login process...');
    logger.info(`📧 Email: ${email}`);
    logger.info(`🔑 Password: ${password}`);
    logger.info(`🔐 JWT_SECRET exists: ${!!config.JWT_SECRET}`);

    // Step 1: Find user
    logger.info('Step 1: Finding user in database...');
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select(`
        id,
        email,
        full_name,
        status,
        password_hash,
        role,
        organization_id,
        waba_phone_number,
        created_at,
        last_active
      `)
      .eq('email', email.toLowerCase())
      .single();

    if (agentError) {
      logger.error('❌ Database error:', agentError);
      return;
    }

    if (!agent) {
      logger.error('❌ No user found');
      return;
    }

    logger.info('✅ User found:', {
      id: agent.id,
      email: agent.email,
      status: agent.status,
      role: agent.role,
      hasPassword: !!agent.password_hash
    });

    // Step 2: Check account status
    logger.info('Step 2: Checking account status...');
    if (agent.status !== 'active') {
      logger.error(`❌ Account inactive: ${agent.status}`);
      return;
    }
    logger.info('✅ Account is active');

    // Step 3: Verify password
    logger.info('Step 3: Verifying password...');
    if (!agent.password_hash) {
      logger.error('❌ No password hash found');
      return;
    }

    const passwordMatch = await bcrypt.compare(password, agent.password_hash);
    if (!passwordMatch) {
      logger.error('❌ Password does not match');
      return;
    }
    logger.info('✅ Password matches');

    // Step 4: Generate JWT token
    logger.info('Step 4: Generating JWT token...');
    const tokenPayload = {
      id: agent.id,
      email: agent.email,
      role: agent.role || 'agent',
      organization_id: agent.organization_id
    };

    const token = jwt.sign(tokenPayload, config.JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'propertyhub-command',
      audience: 'frontend-client'
    });

    logger.info('✅ JWT token generated:', token.substring(0, 50) + '...');

    // Step 5: Verify token
    logger.info('Step 5: Verifying generated token...');
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET, {
        issuer: 'propertyhub-command',
        audience: 'frontend-client'
      });
      logger.info('✅ Token verification successful:', {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      });
    } catch (verifyError) {
      logger.error('❌ Token verification failed:', verifyError.message);
      return;
    }

    // Step 6: Prepare response
    logger.info('Step 6: Preparing response...');
    const userData = {
      id: agent.id,
      email: agent.email,
      full_name: agent.full_name,
      role: agent.role || 'agent',
      organization_id: agent.organization_id,
      status: agent.status,
      waba_phone_number: agent.waba_phone_number,
      permissions: agent.role === 'admin' ? [
        'view_all_agents',
        'manage_agents',
        'view_all_leads',
        'manage_waba',
        'view_analytics',
        'manage_system'
      ] : [
        'view_own_leads',
        'manage_own_leads',
        'view_own_analytics',
        'test_bot'
      ]
    };

    const response = {
      success: true,
      token,
      user: userData
    };

    logger.info('✅ Login process completed successfully!');
    logger.info('📋 Response:', JSON.stringify(response, null, 2));

    // Step 7: Test actual API call
    logger.info('Step 7: Testing actual API call...');
    const axios = require('axios');
    
    try {
      const apiResponse = await axios.post('http://localhost:8080/api/frontend-auth/login', {
        email,
        password
      });
      
      logger.info('✅ API call successful!');
      logger.info('🎉 Login working correctly!');
      
    } catch (apiError) {
      logger.error('❌ API call failed:', apiError.response?.data || apiError.message);
    }

  } catch (error) {
    logger.error({ err: error }, '❌ Debug login failed');
  }
}

// Run if called directly
if (require.main === module) {
  debugLogin().then(() => {
    logger.info('🔍 Debug login complete');
    process.exit(0);
  }).catch(error => {
    logger.error({ err: error }, 'Debug login crashed');
    process.exit(1);
  });
}

module.exports = { debugLogin };
