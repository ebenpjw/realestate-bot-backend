#!/usr/bin/env node

/**
 * Railway Unified Server
 * Serves both backend API and frontend Next.js on a single port for Railway deployment
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('../logger');

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log('🚀 Starting PropertyHub Command for Railway deployment...');
console.log(`📊 Environment: ${NODE_ENV}`);
console.log(`🌐 Port: ${PORT}`);

// Create unified app
const app = express();

// Trust proxy for Railway
app.set('trust proxy', 1);

// Health check endpoint (prioritize this)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      backend: 'running',
      frontend: 'running'
    },
    environment: NODE_ENV,
    uptime: process.uptime()
  });
});

// Import and setup backend routes
const setupBackendRoutes = () => {
  try {
    console.log('🔌 Setting up backend API routes...');
    
    // Import all the backend route modules
    const gupshupRouter = require('../api/gupshup');
    const metaRouter = require('../api/meta');
    const testRouter = require('../api/test');
    const authRouter = require('../api/auth');
    const testCalendarRouter = require('../api/testCalendar');
    const aiLearningRouter = require('../api/aiLearning');
    const orchestratorRouter = require('../api/orchestrator');
    const followUpRouter = require('../routes/followUpRoutes');
    const frontendAuthRouter = require('../api/frontendAuth');
    const dashboardRouter = require('../api/dashboard');
    const leadsRouter = require('../api/leads');

    // Setup middleware
    const cors = require('cors');
    const { createSecurityMiddleware } = require('../middleware/security');

    // Apply backend middleware
    app.use(createSecurityMiddleware());
    app.use(cors({
      origin: true, // Allow all origins for unified deployment
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Setup API routes
    app.use('/api/gupshup', gupshupRouter);
    app.use('/api/meta', metaRouter);
    app.use('/api/test', testRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/test-calendar', testCalendarRouter);
    app.use('/api/ai-learning', aiLearningRouter);
    app.use('/api/orchestrator', orchestratorRouter);
    app.use('/api/follow-up', followUpRouter);
    app.use('/api/frontend-auth', frontendAuthRouter);
    app.use('/api/dashboard', dashboardRouter);
    app.use('/api/leads', leadsRouter);

    // Optional visual property API
    try {
      app.use('/api/visual-property', require('../api/visualPropertyData'));
      logger.info('✅ Visual property API routes loaded');
    } catch (error) {
      logger.warn('⚠️ Visual property API not available:', error.message);
    }

    console.log('✅ Backend API routes configured');
  } catch (error) {
    console.error('❌ Failed to setup backend routes:', error);
    throw error;
  }
};

// Setup frontend static serving with proper fallback
const setupFrontend = () => {
  try {
    console.log('📱 Setting up frontend static serving...');

    const frontendBuildPath = path.join(__dirname, '../frontend/.next');
    const frontendStaticPath = path.join(frontendBuildPath, 'static');
    const frontendPublicPath = path.join(__dirname, '../frontend/public');

    // Serve Next.js static files
    if (fs.existsSync(frontendStaticPath)) {
      app.use('/_next/static', express.static(frontendStaticPath));
      console.log('✅ Next.js static files configured');
    }

    // Serve public assets
    if (fs.existsSync(frontendPublicPath)) {
      app.use(express.static(frontendPublicPath));
      console.log('✅ Public assets configured');
    }

    // For all other routes, serve the login page directly without redirects
    app.get('*', (req, res) => {
      // Skip API routes
      if (req.path.startsWith('/api/') || req.path === '/health') {
        return res.status(404).json({ error: 'API endpoint not found' });
      }

      // Serve your beautiful login page directly
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Outpaced - Login</title>
          <link href="/_next/static/css/d9fc9c1bf3227d32.css" rel="stylesheet">
          <script src="/_next/static/chunks/polyfills-42372ed130431b0a.js"></script>
          <script src="/_next/static/chunks/webpack-934b10a36978acf6.js"></script>
          <script src="/_next/static/chunks/framework-f0f34dd321686665.js"></script>
          <script src="/_next/static/chunks/main-app-b0188b8f164115c4.js"></script>
          <style>
            body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .min-h-screen { min-height: 100vh; }
            .flex { display: flex; }
            .items-center { align-items: center; }
            .justify-center { justify-content: center; }
            .bg-background { background-color: hsl(0 0% 100%); }
            .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
            .px-4 { padding-left: 1rem; padding-right: 1rem; }
            .max-w-md { max-width: 28rem; }
            .w-full { width: 100%; }
            .space-y-8 > * + * { margin-top: 2rem; }
            .shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
            .text-center { text-align: center; }
            .space-y-4 > * + * { margin-top: 1rem; }
            .mx-auto { margin-left: auto; margin-right: auto; }
            .h-16 { height: 4rem; }
            .w-16 { width: 4rem; }
            .bg-primary { background-color: hsl(221.2 83.2% 53.3%); }
            .rounded-2xl { border-radius: 1rem; }
            .text-primary-foreground { color: hsl(210 40% 98%); }
            .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
            .font-bold { font-weight: 700; }
            .mt-2 { margin-top: 0.5rem; }
            .card { background-color: hsl(0 0% 100%); border: 1px solid hsl(214.3 31.8% 91.4%); border-radius: 0.5rem; }
            .card-header { padding: 1.5rem 1.5rem 0; }
            .card-content { padding: 1.5rem; }
            .space-y-6 > * + * { margin-top: 1.5rem; }
            .space-y-2 > * + * { margin-top: 0.5rem; }
            .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
            .font-medium { font-weight: 500; }
            .text-foreground { color: hsl(222.2 84% 4.9%); }
            .mb-2 { margin-bottom: 0.5rem; }
            .relative { position: relative; }
            .absolute { position: absolute; }
            .left-3 { left: 0.75rem; }
            .top-3 { top: 0.75rem; }
            .h-4 { height: 1rem; }
            .w-4 { width: 1rem; }
            .text-muted-foreground { color: hsl(215.4 16.3% 46.9%); }
            .pl-10 { padding-left: 2.5rem; }
            .input {
              display: flex; height: 2.5rem; width: 100%; border-radius: 0.375rem;
              border: 1px solid hsl(214.3 31.8% 91.4%); background-color: hsl(0 0% 100%);
              padding: 0.5rem 0.75rem; font-size: 0.875rem; transition: all 0.2s;
            }
            .input:focus { outline: none; border-color: hsl(221.2 83.2% 53.3%); box-shadow: 0 0 0 2px hsl(221.2 83.2% 53.3% / 0.2); }
            .button {
              display: inline-flex; align-items: center; justify-content: center;
              border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500;
              transition: all 0.2s; height: 2.5rem; padding: 0.5rem 1rem;
              background-color: hsl(221.2 83.2% 53.3%); color: hsl(210 40% 98%);
              border: none; cursor: pointer;
            }
            .button:hover { background-color: hsl(221.2 83.2% 48%); }
            .button:disabled { opacity: 0.5; cursor: not-allowed; }
            .text-destructive { color: hsl(0 84.2% 60.2%); }
            .text-xs { font-size: 0.75rem; line-height: 1rem; }
            .underline { text-decoration: underline; }
            .text-primary { color: hsl(221.2 83.2% 53.3%); }
          </style>
        </head>
        <body>
          <div class="min-h-screen flex items-center justify-center bg-background py-12 px-4">
            <div class="max-w-md w-full space-y-8">
              <div class="card shadow-lg">
                <div class="card-header text-center space-y-4">
                  <div class="mx-auto h-16 w-16 bg-primary rounded-2xl flex items-center justify-center">
                    <svg class="h-8 w-8 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 16h6M7 8h6v4H7V8z"></path>
                    </svg>
                  </div>
                  <div>
                    <h1 class="text-3xl font-bold">Welcome back</h1>
                    <p class="mt-2">Sign in to your Outpaced account</p>
                  </div>
                </div>

                <div class="card-content space-y-6">
                  <div id="error-message" style="display: none;" class="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm"></div>

                  <form id="login-form" class="space-y-4">
                    <div class="space-y-2">
                      <label for="email" class="text-sm font-medium text-foreground mb-2">Email address</label>
                      <div class="relative">
                        <svg class="absolute left-3 top-3 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                        </svg>
                        <input id="email" type="email" placeholder="Enter your email" class="input pl-10" required>
                      </div>
                    </div>

                    <div class="space-y-2">
                      <label for="password" class="text-sm font-medium text-foreground mb-2">Password</label>
                      <div class="relative">
                        <svg class="absolute left-3 top-3 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                        <input id="password" type="password" placeholder="Enter your password" class="input pl-10" required>
                      </div>
                    </div>

                    <button type="submit" class="button w-full" id="submit-btn">
                      Sign in
                    </button>
                  </form>

                  <div class="text-center">
                    <p class="text-xs text-muted-foreground">Outpaced</p>
                    <p class="text-xs text-muted-foreground mt-1">Intelligent Real Estate Lead Management System</p>
                  </div>

                  <div class="flex justify-center space-x-4">
                    <a href="/privacy-policy" class="text-xs text-muted-foreground underline">Privacy Policy</a>
                    <a href="/terms-of-service" class="text-xs text-muted-foreground underline">Terms of Service</a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <script>
            document.getElementById('login-form').addEventListener('submit', async function(e) {
              e.preventDefault();

              const submitBtn = document.getElementById('submit-btn');
              const errorDiv = document.getElementById('error-message');
              const email = document.getElementById('email').value;
              const password = document.getElementById('password').value;

              submitBtn.textContent = 'Signing in...';
              submitBtn.disabled = true;
              errorDiv.style.display = 'none';

              try {
                const response = await fetch('/api/frontend-auth/login', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (response.ok) {
                  localStorage.setItem('token', data.token);
                  if (data.user.role === 'admin') {
                    window.location.href = '/admin/dashboard';
                  } else {
                    window.location.href = '/agent/dashboard';
                  }
                } else {
                  errorDiv.textContent = data.error || 'Login failed';
                  errorDiv.style.display = 'block';
                }
              } catch (error) {
                console.error('Login error:', error);
                errorDiv.textContent = 'Login failed. Please try again.';
                errorDiv.style.display = 'block';
              } finally {
                submitBtn.textContent = 'Sign in';
                submitBtn.disabled = false;
              }
            });
          </script>
        </body>
        </html>
      `);
    });

    console.log('✅ Frontend configured with login page');
  } catch (error) {
    console.error('❌ Failed to setup frontend:', error);
    // Continue without frontend - API-only mode
  }
};

// Initialize services
const initializeServices = async () => {
  try {
    console.log('🔧 Initializing services...');
    
    // Initialize any required services here
    // This ensures all dependencies are loaded before starting the server
    
    console.log('✅ Services initialized');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    throw error;
  }
};

// Main startup function
const startServer = async () => {
  try {
    await initializeServices();
    setupBackendRoutes();
    setupFrontend();

    // Error handling
    app.use((err, req, res, next) => {
      logger.error('Server error:', err);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    // Start server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 PropertyHub Command started successfully!');
      console.log(`📱 Frontend: http://localhost:${PORT}`);
      console.log(`🔌 Backend API: http://localhost:${PORT}/api`);
      console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
      
      logger.info({
        port: PORT,
        environment: NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid
      }, 'Railway unified server started successfully');
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`🛑 Received ${signal}, shutting down gracefully...`);
      server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
