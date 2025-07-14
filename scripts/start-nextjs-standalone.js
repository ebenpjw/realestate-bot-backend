#!/usr/bin/env node

/**
 * Start Next.js in standalone mode for Railway deployment
 * This runs the Next.js app on the main port and proxies API requests to Express
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const NODE_ENV = process.env.NODE_ENV || 'production';
const PORT = process.env.PORT || 8080;
const API_PORT = process.env.API_PORT || 8081;

console.log('🚀 Starting PropertyHub Command in standalone mode...');
console.log(`📊 Environment: ${NODE_ENV}`);
console.log(`🌐 Frontend Port: ${PORT}`);
console.log(`🔌 API Port: ${API_PORT}`);

// Start the Express API server on a different port
console.log('🔌 Starting Express API server...');
const apiServer = spawn('node', ['scripts/unified-server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: API_PORT,
    NODE_ENV: NODE_ENV
  }
});

apiServer.on('error', (err) => {
  console.error('❌ Failed to start API server:', err);
  process.exit(1);
});

// Wait a moment for API server to start
setTimeout(() => {
  // Start Next.js server
  console.log('📱 Starting Next.js frontend...');
  
  const frontendDir = path.join(__dirname, '../frontend');
  const nextServer = spawn('npx', ['next', 'start', '-p', PORT], {
    stdio: 'inherit',
    cwd: frontendDir,
    env: {
      ...process.env,
      PORT: PORT,
      NODE_ENV: NODE_ENV,
      NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
      API_URL: `http://localhost:${API_PORT}`
    }
  });

  nextServer.on('error', (err) => {
    console.error('❌ Failed to start Next.js server:', err);
    process.exit(1);
  });

  // Handle process termination
  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    apiServer.kill('SIGTERM');
    nextServer.kill('SIGTERM');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    apiServer.kill('SIGINT');
    nextServer.kill('SIGINT');
    process.exit(0);
  });

}, 3000);
