const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const logger = require('../logger');
const config = require('../config');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    }, 'Rate limit exceeded');
    res.status(429).json({ error: message });
  }
});

// Different rate limits for different endpoints
const rateLimits = {
  webhook: createRateLimit(
    60 * 1000, // 1 minute
    100, // 100 requests per minute per IP
    'Too many webhook requests'
  ),
  api: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    1000, // 1000 requests per 15 minutes per IP
    'Too many API requests'
  ),
  auth: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5, // 5 auth attempts per 15 minutes per IP
    'Too many authentication attempts'
  )
};

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-hub-signature-256'],
  credentials: false,
  maxAge: 86400 // 24 hours
};

// Helmet security configuration
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
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

// Webhook signature verification for Meta/Facebook
const verifyWebhookSignature = (req, res, next) => {
  if (!req.originalUrl.includes('/meta/webhook')) {
    return next(); // Skip verification for non-Meta webhooks
  }

  const signature = req.get('x-hub-signature-256');
  const expectedSignature = crypto
    .createHmac('sha256', config.META_APP_SECRET || '')
    .update(req.rawBody || '')
    .digest('hex');

  if (!signature || !crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  )) {
    logger.warn({
      ip: req.ip,
      signature,
      url: req.originalUrl
    }, 'Invalid webhook signature');

    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

// Enhanced rate limiting with sliding window
const createAdvancedRateLimit = (windowMs, max, message, keyGenerator = null) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGenerator || ((req) => req.ip),
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.originalUrl === '/health' || req.originalUrl === '/ready';
  },
  handler: (req, res) => {
    logger.warn({
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      key: keyGenerator ? keyGenerator(req) : req.ip
    }, 'Advanced rate limit exceeded');
    res.status(429).json({
      error: message,
      retryAfter: Math.round(windowMs / 1000)
    });
  }
});

// Template-specific rate limiting
const templateRateLimit = createAdvancedRateLimit(
  60 * 60 * 1000, // 1 hour
  20, // 20 template messages per hour per phone number
  'Template message rate limit exceeded',
  (req) => req.body?.phoneNumber || req.ip
);

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

// Security middleware factory
const createSecurityMiddleware = () => [
  helmet(helmetConfig),
  cors(corsOptions),
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
  createAdvancedRateLimit,
  suspiciousActivityDetection,
  requestSizeLimit
};
