/**
 * Socket.IO Service for Real-time Communication
 * Handles WebSocket connections for the real estate bot system
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../logger');

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} server - HTTP server instance
 */
function initializeSocketIO(server) {
  try {
    // Create Socket.IO server with CORS configuration
    io = new Server(server, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:8080',
          'https://localhost:3000',
          'https://localhost:8080',
          /^https:\/\/.*\.railway\.app$/,
          /^https:\/\/.*\.up\.railway\.app$/
        ],
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: true
    });

    // Authentication middleware
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          logger.warn('Socket connection attempted without token');
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, config.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        socket.organizationId = decoded.organization_id;
        
        logger.info(`Socket authenticated for user ${decoded.id} (${decoded.role})`);
        next();
      } catch (error) {
        logger.error('Socket authentication failed:', error.message);
        next(new Error('Authentication failed'));
      }
    });

    // Connection event handler
    io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id} (User: ${socket.userId}, Role: ${socket.userRole})`);

      // Join user-specific room
      socket.join(`user_${socket.userId}`);
      
      // Join role-specific rooms
      if (socket.userRole === 'agent') {
        socket.join(`agent_${socket.userId}`);
        socket.join('agents'); // All agents room
      } else if (socket.userRole === 'admin') {
        socket.join(`admin_${socket.organizationId}`);
        socket.join('admins'); // All admins room
      }

      // Handle room joining
      socket.on('join_room', (room) => {
        socket.join(room);
        logger.debug(`Socket ${socket.id} joined room: ${room}`);
      });

      socket.on('leave_room', (room) => {
        socket.leave(room);
        logger.debug(`Socket ${socket.id} left room: ${room}`);
      });

      // Handle user-specific room joining
      socket.on('join_user_room', (userId) => {
        if (socket.userId === userId) {
          socket.join(`user_${userId}`);
          logger.debug(`Socket ${socket.id} joined user room: user_${userId}`);
        }
      });

      // Handle agent-specific room joining
      socket.on('join_agent_room', (agentId) => {
        if (socket.userRole === 'agent' && socket.userId === agentId) {
          socket.join(`agent_${agentId}`);
          logger.debug(`Socket ${socket.id} joined agent room: agent_${agentId}`);
        }
      });

      // Handle admin-specific room joining
      socket.on('join_admin_room', (organizationId) => {
        if (socket.userRole === 'admin' && socket.organizationId === organizationId) {
          socket.join(`admin_${organizationId}`);
          logger.debug(`Socket ${socket.id} joined admin room: admin_${organizationId}`);
        }
      });

      // Handle new lead notifications
      socket.on('new_lead', (leadData) => {
        if (socket.userRole === 'agent') {
          // Broadcast to all agents and admins
          io.to('agents').emit('lead_notification', {
            type: 'new_lead',
            data: leadData,
            timestamp: new Date().toISOString()
          });
          
          io.to('admins').emit('lead_notification', {
            type: 'new_lead',
            data: leadData,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Handle conversation updates
      socket.on('conversation_update', (conversationData) => {
        // Broadcast to relevant users
        io.to(`user_${conversationData.agentId}`).emit('conversation_updated', conversationData);
        
        // Broadcast to admins
        io.to('admins').emit('conversation_updated', conversationData);
      });

      // Handle appointment updates
      socket.on('appointment_update', (appointmentData) => {
        // Broadcast to relevant users
        io.to(`user_${appointmentData.agentId}`).emit('appointment_updated', appointmentData);
        
        // Broadcast to admins
        io.to('admins').emit('appointment_updated', appointmentData);
      });

      // Handle agent status changes
      socket.on('agent_status_change', (statusData) => {
        if (socket.userRole === 'agent') {
          // Broadcast to admins
          io.to('admins').emit('agent_status_changed', {
            agentId: socket.userId,
            agentName: statusData.agentName,
            status: statusData.status,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`Socket disconnected: ${socket.id} (User: ${socket.userId}, Reason: ${reason})`);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });

    logger.info('✅ Socket.IO server initialized successfully');
    return io;

  } catch (error) {
    logger.error('❌ Failed to initialize Socket.IO:', error);
    throw error;
  }
}

/**
 * Get Socket.IO instance
 * @returns {Server|null} Socket.IO server instance
 */
function getSocketIO() {
  return io;
}

/**
 * Emit event to specific user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
    logger.debug(`Emitted ${event} to user ${userId}`);
  }
}

/**
 * Emit event to specific agent
 * @param {string} agentId - Agent ID
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
function emitToAgent(agentId, event, data) {
  if (io) {
    io.to(`agent_${agentId}`).emit(event, data);
    logger.debug(`Emitted ${event} to agent ${agentId}`);
  }
}

/**
 * Emit event to all agents
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
function emitToAllAgents(event, data) {
  if (io) {
    io.to('agents').emit(event, data);
    logger.debug(`Emitted ${event} to all agents`);
  }
}

/**
 * Emit event to all admins
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
function emitToAllAdmins(event, data) {
  if (io) {
    io.to('admins').emit(event, data);
    logger.debug(`Emitted ${event} to all admins`);
  }
}

/**
 * Emit system notification
 * @param {string} type - Notification type (info, warning, error)
 * @param {string} message - Notification message
 * @param {string} targetRole - Target role (agent, admin, all)
 */
function emitSystemNotification(type, message, targetRole = 'all') {
  if (io) {
    const notification = {
      type,
      message,
      timestamp: new Date().toISOString()
    };

    if (targetRole === 'all') {
      io.emit('system_notification', notification);
    } else if (targetRole === 'agents') {
      io.to('agents').emit('system_notification', notification);
    } else if (targetRole === 'admins') {
      io.to('admins').emit('system_notification', notification);
    }

    logger.info(`System notification sent to ${targetRole}: ${message}`);
  }
}

module.exports = {
  initializeSocketIO,
  getSocketIO,
  emitToUser,
  emitToAgent,
  emitToAllAgents,
  emitToAllAdmins,
  emitSystemNotification
};
