// index.js
const config = require('./config'); // Use centralized config
const logger = require('./logger'); // Use structured logger
const express = require('express');

const gupshupRouter = require('./api/gupshup');
const metaRouter = require('./api/meta');
const testRouter = require('./api/test');
const authRouter = require('./api/auth');

const app = express();
const PORT = config.PORT;

app.get('/health', (req, res) => {
  res.send('✅ Bot backend is alive');
});

// IMPORTANT: We need a special JSON parser for the Gupshup webhook
// to preserve the raw body for signature verification.
app.use('/api/gupshup', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Use the standard JSON parser for all other routes that come after.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API Routers ---
app.use('/api/gupshup', gupshupRouter);
app.use('/api/meta', metaRouter);
app.use('/api/test', testRouter);
app.use('/api/auth', authRouter);

// --- Centralized Error Handler ---
// This middleware catches any errors passed to next() from async routes.
app.use((err, req, res, next) => {
  // ADD THIS LINE TO PRINT THE FULL ERROR TO THE LOGS
  console.error('--- DETAILED ERROR ---', err);

  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
    },
    req: {
      method: req.method,
      url: req.originalUrl,
      body: req.body,
    }
  }, 'An unhandled error occurred!');
  
  res.status(500).json({ error: 'An internal server error occurred.' });
});

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} in ${config.NODE_ENV} mode`);
});