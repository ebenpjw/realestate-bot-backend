const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../logger');
const databaseService = require('../services/databaseService');
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');

/**
 * FRONTEND AUTHENTICATION API
 * JWT-based authentication for frontend users (agents and admins)
 */

/**
 * POST /api/frontend-auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user in agents table
    const { data: agent, error: agentError } = await databaseService.supabase
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
        updated_at
      `)
      .eq('email', email.toLowerCase())
      .single();

    if (agentError || !agent) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (agent.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'Account is inactive. Please contact your administrator.'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, agent.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: agent.id,
      email: agent.email,
      role: agent.role || 'agent',
      organization_id: agent.organization_id
    };

    const token = jwt.sign(tokenPayload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: 'propertyhub-command',
      audience: 'frontend-client'
    });

    // Update last active timestamp
    await databaseService.supabase
      .from('agents')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', agent.id);

    // Prepare user data for frontend
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

    logger.info({ 
      userId: agent.id, 
      email: agent.email, 
      role: agent.role 
    }, 'User logged in successfully');

    res.json({
      success: true,
      token,
      user: userData,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    logger.error({ err: error }, 'Login error');
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/frontend-auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Update last active timestamp
    await databaseService.supabase
      .from('agents')
      .update({ last_active: new Date().toISOString() })
      .eq('id', req.user.id);

    logger.info({ userId: req.user.id }, 'User logged out');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error({ err: error }, 'Logout error');
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/frontend-auth/me
 * Get current user information
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    logger.info('Fetching user data for /me endpoint', { userId: req.user.id });

    const { data: agent, error } = await databaseService.supabase
      .from('agents')
      .select(`
        id,
        email,
        full_name,
        status,
        role,
        organization_id,
        waba_phone_number,
        waba_display_name,
        bot_name,
        created_at,
        updated_at
      `)
      .eq('id', req.user.id)
      .single();

    if (error) {
      logger.error('Database error in /me endpoint', {
        error: error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorStack: error.stack,
        errorType: typeof error,
        errorKeys: Object.keys(error || {}),
        userId: req.user.id,
        fullErrorObject: JSON.stringify(error, null, 2)
      });
      return res.status(500).json({
        success: false,
        error: 'Database error'
      });
    }

    if (!agent) {
      logger.warn('User not found in /me endpoint', { userId: req.user.id });
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userData = {
      id: agent.id,
      email: agent.email,
      full_name: agent.full_name,
      role: agent.role || 'agent',
      organization_id: agent.organization_id,
      status: agent.status,
      waba_phone_number: agent.waba_phone_number,
      waba_display_name: agent.waba_display_name,
      bot_name: agent.bot_name,
      google_connected: false, // TODO: Implement Google integration
      zoom_connected: false, // TODO: Implement Zoom integration
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

    res.json({
      success: true,
      data: userData
    });

  } catch (error) {
    logger.error({ err: error, userId: req.user.id }, 'Error getting user info');
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/frontend-auth/refresh
 * Refresh JWT token - allows expired tokens for refresh
 */
router.post('/refresh', (req, res, next) => {
  // Custom auth middleware that allows expired tokens
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, config.JWT_SECRET, {
    issuer: 'propertyhub-command',
    audience: 'frontend-client',
    ignoreExpiration: true // Allow expired tokens for refresh
  }, (err, user) => {
    if (err && err.name !== 'TokenExpiredError') {
      logger.warn({ err: err.message }, 'JWT verification failed during refresh');
      return res.status(403).json({
        success: false,
        error: 'Invalid token'
      });
    }

    req.user = user;
    next();
  });
}, async (req, res) => {
  try {
    // Generate new token
    const tokenPayload = {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      organization_id: req.user.organization_id
    };

    const token = jwt.sign(tokenPayload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: 'propertyhub-command',
      audience: 'frontend-client'
    });

    res.json({
      success: true,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    });

  } catch (error) {
    logger.error({ err: error, userId: req.user.id }, 'Token refresh error');
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/frontend-auth/change-password
 * Change user password
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long'
      });
    }

    // Get current password hash
    const { data: agent, error: fetchError } = await databaseService.supabase
      .from('agents')
      .select('password_hash')
      .eq('id', req.user.id)
      .single();

    if (fetchError || !agent) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(current_password, agent.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    const { error: updateError } = await databaseService.supabase
      .from('agents')
      .update({ 
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (updateError) {
      throw updateError;
    }

    logger.info({ userId: req.user.id }, 'Password changed successfully');

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error({ err: error, userId: req.user.id }, 'Password change error');
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PATCH /api/frontend-auth/profile
 * Update user profile
 */
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, phone_number } = req.body;
    const updateData = {};

    if (full_name) {
      updateData.full_name = full_name.trim();
    }

    if (phone_number) {
      updateData.phone_number = phone_number.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updateData.updated_at = new Date().toISOString();

    const { data: updatedAgent, error } = await databaseService.supabase
      .from('agents')
      .update(updateData)
      .eq('id', req.user.id)
      .select(`
        id,
        email,
        full_name,
        phone_number,
        status,
        role,
        organization_id
      `)
      .single();

    if (error) {
      throw error;
    }

    logger.info({ userId: req.user.id, updateData }, 'Profile updated successfully');

    res.json({
      success: true,
      data: updatedAgent
    });

  } catch (error) {
    logger.error({ err: error, userId: req.user.id }, 'Profile update error');
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
