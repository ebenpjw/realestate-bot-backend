const helmet = require('helmet');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const logger = require('../logger');
const config = require('../config');

// Rate limiting completely disabled for scalability
// All rate limiting functions are now no-ops

const rateLimits = {
  webhook: (req, res, next) => next(), // No-op middleware
  api: (req, res, next) => next(), // No-op middleware
};

// CORS configuration for unified deployment
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : [
        /^https?:\/\/.*\.railway\.app$/,  // Railway deployments
        /^https?:\/\/.*\.netlify\.app$/,  // Netlify deployments (legacy)
        /^https?:\/\/.*\.vercel\.app$/    // Vercel deployments (legacy)
      ])
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-hub-signature-256',
    'x-hub-signature',
    'X-Requested-With',
    'X-Request-ID',
    'x-request-id',
    'X-Request-Time',
    'x-request-time'
  ],
  credentials: true, // Enable credentials for unified deployment
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
};

// Helmet security configuration - Enhanced for 2025 OWASP recommendations
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Consider removing unsafe-inline in future
      scriptSrc: ["'self'", "'strict-dynamic'"], // 2025: Use strict-dynamic for better security
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.openai.com",
        "https://api.gupshup.io",
        "https://zoom.us",
        "https://api.zoom.us",
        "https://accounts.google.com",
        "https://oauth2.googleapis.com",
        "https://www.googleapis.com",
        "https://graph.facebook.com",
        "https://*.railway.app",
        "wss://*.railway.app"
      ],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"], // 2025: Prevent base tag injection
      formAction: ["'self'"], // 2025: Restrict form submissions
      frameAncestors: ["'none'"], // 2025: Prevent clickjacking
      upgradeInsecureRequests: [], // 2025: Force HTTPS
    },
    reportOnly: false // Set to true for testing, false for enforcement
  },
  hsts: {
    maxAge: 63072000, // 2 years (2025 recommendation)
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  // 2025: Additional security headers
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin for API
  originAgentCluster: true // 2025: Enable origin agent clustering
};

// Input validation schemas
const validationSchemas = {
  webhookMessage: [
    body('payload.source').isString().trim().isLength({ min: 1, max: 50 }),
    body('payload.payload.text').isString().trim().isLength({ min: 1, max: 4096 }),
    body('payload.sender.name').optional().isString().trim().isLength({ max: 100 })
  ],
  testMessage: [
    body('senderWaId').isString().trim().matches(/^\d{10,15}$/),
    body('userText').isString().trim().isLength({ min: 1, max: 4096 }),
    body('senderName').optional().isString().trim().isLength({ max: 100 })
  ]
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({
      ip: req.ip,
      url: req.originalUrl,
      errors: errors.array()
    }, 'Validation failed');
    
    return res.status(400).json({
      error: 'Invalid input data',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Enhanced webhook signature verification for Meta/Facebook
const verifyWebhookSignature = (req, res, next) => {
  if (!req.originalUrl.includes('/meta/webhook')) {
    return next(); // Skip verification for non-Meta webhooks
  }

  // Only verify signatures in production
  if (config.NODE_ENV !== 'production') {
    return next();
  }

  const signature = req.get('x-hub-signature-256');
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

  if (!config.META_APP_SECRET) {
    logger.error('META_APP_SECRET not configured for webhook verification');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!signature) {
    logger.warn({
      ip: req.ip,
      url: req.originalUrl
    }, 'Missing webhook signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', config.META_APP_SECRET)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(`sha256=${expectedSignature}`);

    if (signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      logger.warn({
        ip: req.ip,
        signature: `${signature.substring(0, 10)}...`,
        url: req.originalUrl
      }, 'Invalid webhook signature');

      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  } catch (error) {
    logger.error({ err: error, ip: req.ip }, 'Webhook signature verification failed');
    return res.status(500).json({ error: 'Signature verification failed' });
  }
};

// All advanced rate limiting disabled for scalability
const templateRateLimit = (req, res, next) => next(); // No-op middleware

// IP-based suspicious activity detection
const suspiciousActivityDetection = (req, res, next) => {
  const suspiciousPatterns = [
    /bot|crawler|spider/i,
    /curl|wget|python|php/i,
    /scan|hack|exploit/i
  ];

  const userAgent = req.get('User-Agent') || '';
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));

  if (isSuspicious) {
    logger.warn({
      ip: req.ip,
      userAgent,
      url: req.originalUrl,
      method: req.method
    }, 'Suspicious activity detected');

    // Don't block immediately, but log for monitoring
    req.suspicious = true;
  }

  next();
};

// Request size limiting
const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    logger.warn({
      ip: req.ip,
      contentLength,
      maxSize,
      url: req.originalUrl
    }, 'Request size limit exceeded');

    return res.status(413).json({ error: 'Request too large' });
  }

  next();
};

// 2025: Additional security headers middleware
const additionalSecurityHeaders = (req, res, next) => {
  // 2025 OWASP recommendations
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Expect-CT', 'max-age=86400, enforce');
  res.setHeader('Feature-Policy',
    'camera \'none\'; microphone \'none\'; geolocation \'none\'; payment \'none\'');
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()');

  // 2025: Clear-Site-Data for logout endpoints
  if (req.path.includes('/logout') || req.path.includes('/disconnect')) {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }

  next();
};

// Security middleware factory - Enhanced for 2025
const createSecurityMiddleware = () => [
  helmet(helmetConfig),
  cors(corsOptions),
  additionalSecurityHeaders,
  suspiciousActivityDetection,
  requestSizeLimit
];

module.exports = {
  rateLimits,
  corsOptions,
  helmetConfig,
  validationSchemas,
  handleValidationErrors,
  createSecurityMiddleware,
  verifyWebhookSignature,
  templateRateLimit,
  suspiciousActivityDetection,
  requestSizeLimit
};
