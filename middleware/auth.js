const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../logger');

/**
 * JWT Authentication Middleware for Frontend
 */

/**
 * Authenticate JWT token from Authorization header
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, config.JWT_SECRET, {
    issuer: 'propertyhub-command',
    audience: 'frontend-client'
  }, (err, user) => {
    if (err) {
      logger.warn({ err: err.message }, 'JWT verification failed');
      
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(403).json({
        success: false,
        error: 'Invalid token'
      });
    }

    req.user = user;
    next();
  });
}

/**
 * Require specific role(s)
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role || 'agent';
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
}

/**
 * Require specific permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check agent permissions
    const agentPermissions = [
      'view_own_leads',
      'manage_own_leads',
      'view_own_analytics',
      'test_bot'
    ];

    if (!agentPermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
}

/**
 * Optional authentication - sets req.user if token is valid
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, config.JWT_SECRET, {
    issuer: 'propertyhub-command',
    audience: 'frontend-client'
  }, (err, user) => {
    if (!err) {
      req.user = user;
    }
    next();
  });
}

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  optionalAuth
};
