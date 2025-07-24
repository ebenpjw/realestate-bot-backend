const fs = require('fs');
const path = require('path');

// Key files to review
const filesToReview = [
  // AI Architecture
  'services/multiLayerAI.js',
  'services/multiLayerIntegration.js',
  'services/multiLayerMonitoring.js',
  'services/webSearchService.js',
  
  // Core Services
  'services/botService.js',
  'services/databaseService.js',
  'services/messageOrchestrator.js',
  'services/appointmentService.js',
  
  // Security & Auth
  'middleware/auth.js',
  'services/authService.js',
  
  // API Routes
  'routes/webhook.js',
  'routes/api.js',
  
  // Configuration
  'config/index.js',
  'constants/index.js'
];

// Add review trigger comment to each file
filesToReview.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const reviewComment = `\n// CodeRabbit comprehensive review - ${new Date().toISOString()}\n`;
    fs.writeFileSync(filePath, content + reviewComment);
    console.log(`✅ Added review trigger to ${filePath}`);
  } else {
    console.log(`❌ File not found: ${filePath}`);
  }
});

console.log('🚀 All files prepared for CodeRabbit review');