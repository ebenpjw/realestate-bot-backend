// ---🧠 Imports & Config --------------------------------------
require('dotenv').config();
const express = require('express');

// --- Import Routers ---
const gupshupRouter = require('./api/gupshup');
const metaRouter = require('./api/meta');
const testRouter = require('./api/test'); // <-- ADD THIS

// ---🚀 App Init ----------------------------------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

// ---💓 Healthcheck -------------------------------------------
app.get('/health', (req, res) => {
  res.send('✅ Bot backend is alive');
});

// --- API Routes ---
app.use('/api/gupshup', gupshupRouter);
app.use('/api/meta', metaRouter);
app.use('/api/test', testRouter); // <-- ADD THIS

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
