const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const progressRoutes = require('./routes/progress');
const dashboardRoutes = require('./routes/dashboard');
const sprintRoutes = require('./routes/sprints');
const topicsRoutes = require('./routes/topics');
const examGoalsRoutes = require('./routes/exam-goals');
const achievementsRoutes = require('./routes/achievements');
const analyticsRoutes = require('./routes/analytics');
const sessionsRoutes = require('./routes/sessions');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for deployment platforms
app.set('trust proxy', 1);

// FIXED CORS for Lovable - Updated patterns to match your specific URL
const corsOptions = {
  origin: function (origin, callback) {
    console.log(`🔍 CORS Check - Origin: ${origin}`);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ Allowing request with no origin');
      return callback(null, true);
    }
    
    // Enhanced Lovable domain patterns - FIXED for your specific URL format
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      'https://lovable.dev',
      'https://www.lovable.dev',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Updated Lovable patterns to match your specific subdomain format
    const lovablePatterns = [
      /^https:\/\/.*\.lovable\.dev$/,
      /^https:\/\/.*\.lovable\.app$/,  // Added .app domain
      /^https:\/\/projects\.lovable\.dev$/,
      /^https:\/\/lovable\.dev$/,
      /^https:\/\/.*\.projects\.lovable\.dev$/,
      /^https:\/\/id-preview--.*\.lovable\.app$/,  // Specific pattern for your URL
      /^https:\/\/.*--.*\.lovable\.app$/,  // General pattern for Lovable preview URLs
    ];

    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ Allowing exact match: ${origin}`);
      return callback(null, true);
    }

    // Check Lovable patterns
    for (const pattern of lovablePatterns) {
      if (pattern.test(origin)) {
        console.log(`✅ Allowing Lovable pattern match: ${origin}`);
        return callback(null, true);
      }
    }

    // Development mode - allow all localhost
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      console.log(`✅ Allowing localhost in development: ${origin}`);
      return callback(null, true);
    }

    // If we get here, the origin is not allowed
    console.log(`❌ Blocked origin: ${origin}`);
    console.log('📋 Allowed patterns:');
    lovablePatterns.forEach((pattern, index) => {
      console.log(`  ${index + 1}. ${pattern}`);
    });
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'User-Agent',
    'DNT',
    'Cache-Control',
    'X-Mx-ReqToken',
    'Keep-Alive',
    'X-Requested-With',
    'If-Modified-Since'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  console.log(`🔧 Preflight request from: ${req.get('Origin')}`);
  cors(corsOptions)(req, res, () => {
    res.status(204).send();
  });
});

// Security middleware with Lovable-friendly settings
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "*.lovable.dev", "*.lovable.app"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "*.lovable.dev", "*.lovable.app"],
      connectSrc: ["'self'", "*.lovable.dev", "*.lovable.app", "*.supabase.co"],
      frameSrc: ["'self'", "*.lovable.dev", "*.lovable.app"],
      fontSrc: ["'self'", "data:", "*.lovable.dev", "*.lovable.app"]
    }
  }
}));

// Rate limiting with generous limits for development
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for Lovable development
      const origin = req.get('Origin');
      return origin && (origin.includes('lovable.dev') || origin.includes('lovable.app'));
    },
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retry_after: Math.ceil(windowMs / 1000),
        limit: max
      });
    }
  });
};

const generalLimiter = createRateLimiter(15 * 60 * 1000, 200, 'Too many requests');
const authLimiter = createRateLimiter(15 * 60 * 1000, 20, 'Too many auth attempts');
const uploadLimiter = createRateLimiter(60 * 60 * 1000, 30, 'Upload limit exceeded');

app.use('/api/auth', authLimiter);
app.use('/api/documents/upload', uploadLimiter);
app.use('/api', generalLimiter);

// Body parsing middleware
app.use((req, res, next) => {
  if (req.path === '/api/documents/upload' || req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  
  express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({ error: 'Invalid JSON format' });
        throw new Error('Invalid JSON');
      }
    }
  })(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const origin = req.get('Origin') || 'No Origin';
  console.log(`${timestamp} - ${req.method} ${req.path} - Origin: ${origin}`);
  next();
});

// Enhanced health check
app.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '2.1.0-lovable-fixed',
      environment: process.env.NODE_ENV || 'development',
      port: PORT,
      cors_enabled: true,
      lovable_ready: true,
      specific_lovable_support: 'https://id-preview--d60cae03-32c1-4bb7-ba2c-d07967b8e43a.lovable.app',
      features: {
        authentication: 'active',
        document_upload: 'active',
        progress_tracking: 'active',
        topics_management: 'active',
        achievements: 'active',
        analytics: 'active'
      }
    };

    // Test database connection
    try {
      const { supabase } = require('./config/supabase');
      const { data, error } = await supabase.from('user_profiles').select('count').limit(1);
      
      if (error) {
        healthStatus.database = 'error';
        healthStatus.status = 'DEGRADED';
      } else {
        healthStatus.database = 'connected';
      }
    } catch (dbError) {
      healthStatus.database = 'error';
      healthStatus.status = 'DEGRADED';
    }

    res.json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Lovable integration status endpoint
app.get('/api/lovable/status', (req, res) => {
  const origin = req.get('Origin');
  console.log(`💖 Lovable status check from: ${origin}`);
  
  res.json({
    lovable_integration: 'ready',
    backend_version: '2.1.0-lovable-fixed',
    cors_configured: true,
    your_origin: origin,
    origin_allowed: true,
    endpoints_available: [
      '/api/auth/login',
      '/api/auth/signup', 
      '/api/topics',
      '/api/documents',
      '/api/analytics/dashboard',
      '/api/achievements',
      '/api/sprints'
    ],
    test_credentials: {
      email: 'test@example.com',
      password: 'password123'
    },
    ready_for_frontend: true,
    cors_patterns_matching: [
      'https://id-preview--*.lovable.app',
      'https://*.lovable.dev',
      'https://*.lovable.app'
    ]
  });
});

// Enhanced test login endpoint
app.post('/api/test-login', async (req, res) => {
  try {
    const origin = req.get('Origin');
    console.log('🔧 Test login attempt from:', origin);
    console.log('🔧 Request body:', req.body);
    
    const { supabase } = require('./config/supabase');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'password123'
    });

    if (error) {
      console.log('❌ Test login failed:', error);
      return res.status(401).json({ 
        error: error.message, 
        debug: true,
        origin: origin
      });
    }

    console.log('✅ Test login successful from:', origin);
    res.json({ 
      message: 'Test login successful',
      user: data.user,
      session: data.session,
      origin: origin,
      debug: true
    });
  } catch (error) {
    console.error('Test login error:', error);
    res.status(500).json({ 
      error: 'Test login failed', 
      details: error.message,
      debug: true 
    });
  }
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  const origin = req.get('Origin');
  console.log(`🧪 CORS test from: ${origin}`);
  
  res.json({
    message: 'CORS is working!',
    your_origin: origin,
    timestamp: new Date().toISOString(),
    success: true
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/exam-goals', examGoalsRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sessions', sessionsRoutes);

// Enhanced error handling
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const origin = req.get('Origin');
  console.error('API Error:', {
    message: error.message,
    origin: origin,
    path: req.path,
    method: req.method
  });

  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS policy violation',
      origin: origin,
      your_url: origin,
      needed_patterns: [
        'https://id-preview--*.lovable.app',
        'https://*.lovable.dev'
      ],
      contact_support: 'If this persists, please check the CORS configuration'
    });
  }

  res.status(error.status || 500).json({ 
    error: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    available: ['/health', '/api/lovable/status', '/api/cors-test', '/api/test-login', '/api/auth/*']
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ENHANCED STUDY PLANNER API - LOVABLE READY (CORS FIXED)');
  console.log(`📊 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`💖 Lovable status: http://localhost:${PORT}/api/lovable/status`);
  console.log(`🧪 CORS test: http://localhost:${PORT}/api/cors-test`);
  console.log(`🧪 Test login: http://localhost:${PORT}/api/test-login`);
  console.log('');
  console.log('✨ LOVABLE INTEGRATION FEATURES (FIXED):');
  console.log('  🌐 Enhanced CORS for your specific Lovable URL');
  console.log('  🎯 Pattern: https://id-preview--*.lovable.app');
  console.log('  🔧 Test endpoints for debugging');
  console.log('  📡 Real-time connection status');
  console.log('');
  console.log('🔑 TEST CREDENTIALS:');
  console.log('  📧 Email: test@example.com');
  console.log('  🔒 Password: password123');
  console.log('');
  console.log('🎯 Your Lovable URL is now supported!');
  console.log('   https://id-preview--d60cae03-32c1-4bb7-ba2c-d07967b8e43a.lovable.app');
  console.log('');
  console.log('Ready for Lovable frontend! 🎉');
});

module.exports = app;