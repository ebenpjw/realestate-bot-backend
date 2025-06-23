// index.js

require('dotenv').config();
const express = require('express');

const gupshupRouter = require('./api/gupshup');
const metaRouter = require('./api/meta');
const testRouter = require('./api/test');

const app = express();
const PORT = process.env.PORT || 8080;

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

app.use('/api/gupshup', gupshupRouter);
app.use('/api/meta', metaRouter);
app.use('/api/test', testRouter);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});