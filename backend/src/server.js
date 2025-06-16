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

// Trust proxy for deployment
app.set('trust proxy', 1);

// Enhanced security middleware for production
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co"],
    },
  },
}));

// Enhanced CORS configuration for Lovable frontend
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      // Development
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      // Lovable preview domains
      'https://lovable.dev',
      'https://*.lovable.dev',
      'https://projects.lovable.dev',
      // Your deployed frontend
      process.env.FRONTEND_URL,
      process.env.LOVABLE_PREVIEW_URL
    ].filter(Boolean);
    
    // Check if origin matches allowed patterns
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Rate limiting optimized for Lovable development
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks and docs
      return req.path === '/health' || req.path === '/api/docs';
    },
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retry_after: Math.ceil(windowMs / 1000),
        limit: max,
        endpoint: req.path
      });
    }
  });
};

// More generous limits for development
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  200, // increased for frontend development
  'Too many requests, please try again later'
);

const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  20, // increased for testing
  'Too many authentication attempts, please try again later'
);

const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  50, // increased for testing
  'Upload limit exceeded, please try again later'
);

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api/documents/upload', uploadLimiter);
app.use('/api', generalLimiter);

// Enhanced body parsing middleware
app.use((req, res, next) => {
  // Skip JSON parsing for file uploads
  if (req.path === '/api/documents/upload' || 
      req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  
  // Apply JSON parsing for other routes
  express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({ 
          error: 'Invalid JSON format',
          details: 'Please ensure your request body contains valid JSON'
        });
        throw new Error('Invalid JSON');
      }
    }
  })(req, res, next);
});

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Enhanced request logging for development
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userAgent = req.get('User-Agent') || 'Unknown';
  const forwarded = req.get('X-Forwarded-For') || req.ip;
  const origin = req.get('Origin') || 'No origin';
  
  console.log(`${timestamp} - ${req.method} ${req.path} - ${forwarded} - Origin: ${origin}`);
  
  // Add request timing
  req.startTime = Date.now();
  
  // Enhanced response logging
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    
    // Log slow requests
    if (duration > 1000) {
      console.log(`⚠️  Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
    
    // Log errors
    if (res.statusCode >= 400) {
      console.error(`❌ Error ${res.statusCode}: ${req.method} ${req.path} - ${duration}ms`);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Comprehensive health check for Lovable integration
app.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '2.1.0-lovable',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      message: 'Enhanced Study Planner API is running (Lovable Compatible)',
      lovable_features: {
        cors_enabled: true,
        supabase_integration: 'active',
        file_upload: 'active',
        real_time_features: 'active'
      },
      features: {
        authentication: 'active',
        document_upload: 'active',
        progress_tracking: 'active',
        sprint_system: 'enhanced',
        topics_management: 'active',
        exam_goals: 'active',
        achievements: 'active',
        analytics: 'enhanced',
        study_sessions: 'active'
      }
    };

    // Test Supabase connection
    try {
      const { supabase } = require('./config/supabase');
      
      // Test database connection
      const { data: dbTest, error: dbError } = await supabase
        .from('user_stats')
        .select('count')
        .limit(1);
      
      if (dbError) {
        healthStatus.database = 'error';
        healthStatus.database_error = dbError.message;
        healthStatus.status = 'DEGRADED';
      } else {
        healthStatus.database = 'connected';
      }

      // Test storage connection
      const { data: storageTest, error: storageError } = await supabase.storage
        .from('pdf-documents')
        .list('', { limit: 1 });
      
      if (storageError) {
        healthStatus.storage = 'error';
        healthStatus.storage_error = storageError.message;
        if (healthStatus.status !== 'DEGRADED') {
          healthStatus.status = 'DEGRADED';
        }
      } else {
        healthStatus.storage = 'connected';
      }
    } catch (supabaseError) {
      healthStatus.supabase = 'error';
      healthStatus.supabase_error = supabaseError.message;
      healthStatus.status = 'ERROR';
    }

    healthStatus.response_time_ms = Date.now() - startTime;
    
    const statusCode = healthStatus.status === 'OK' ? 200 : 
                      healthStatus.status === 'DEGRADED' ? 503 : 500;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Enhanced API documentation for Lovable developers
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Study Planner API - Lovable Compatible',
    version: '2.1.0-lovable',
    description: 'Enhanced API designed for Lovable frontend integration',
    base_url: `${req.protocol}://${req.get('host')}/api`,
    cors_info: {
      enabled: true,
      supports_lovable: true,
      allowed_origins: ['https://*.lovable.dev', 'http://localhost:*']
    },
    authentication: {
      type: 'Supabase Auth + JWT',
      header: 'Authorization: Bearer <supabase_jwt_token>',
      endpoints: {
        signup: 'POST /auth/signup',
        login: 'POST /auth/login',
        me: 'GET /auth/me',
        logout: 'POST /auth/logout'
      }
    },
    endpoints: {
      documents: {
        upload: 'POST /documents/upload - (multipart/form-data)',
        list: 'GET /documents - (with filtering & pagination)',
        get: 'GET /documents/:id - (detailed analysis)',
        delete: 'DELETE /documents/:id'
      },
      topics: {
        list: 'GET /topics - (with progress)',
        create: 'POST /topics',
        get: 'GET /topics/:id - (with documents)',
        update: 'PATCH /topics/:id',
        delete: 'DELETE /topics/:id',
        reorder: 'PATCH /topics/reorder'
      },
      sprints: {
        generate: 'POST /sprints/generate - (AI-powered)',
        create: 'POST /sprints',
        list: 'GET /sprints',
        start: 'PATCH /sprints/:id/start',
        complete: 'PATCH /sprints/:id/complete',
        analytics: 'GET /sprints/analytics'
      },
      analytics: {
        dashboard: 'GET /analytics/dashboard - (comprehensive)',
        feedback: 'POST /analytics/feedback - (real-time)',
        trends: 'GET /analytics/trends',
        patterns: 'GET /analytics/patterns'
      },
      sessions: {
        start: 'POST /sessions/start',
        list: 'GET /sessions',
        get: 'GET /sessions/:id',
        activity: 'PATCH /sessions/:id/activity',
        end: 'PATCH /sessions/:id/end'
      }
    },
    frontend_integration: {
      lovable_compatible: true,
      real_time_ready: true,
      file_upload_ready: true,
      authentication_ready: true
    },
    examples: {
      lovable_auth_flow: {
        description: 'Complete authentication flow for Lovable frontend',
        steps: [
          '1. User signs up: POST /api/auth/signup',
          '2. Supabase creates user and returns JWT',
          '3. Frontend stores JWT for subsequent requests',
          '4. All API calls include: Authorization: Bearer <jwt>'
        ]
      },
      upload_pdf: {
        method: 'POST',
        url: '/api/documents/upload',
        headers: {
          'Authorization': 'Bearer <supabase_jwt>',
          'Content-Type': 'multipart/form-data'
        },
        body: 'FormData with pdf file and optional topic_id'
      }
    },
    rate_limits: {
      general: '200 requests per 15 minutes',
      auth: '20 requests per 15 minutes',
      upload: '50 requests per hour'
    }
  });
});

// Lovable-specific integration endpoint
app.get('/api/lovable/status', (req, res) => {
  res.json({
    lovable_compatible: true,
    version: '2.1.0-lovable',
    features: {
      supabase_auth: true,
      real_time_updates: true,
      file_uploads: true,
      cors_configured: true,
      rate_limiting: true
    },
    endpoints_ready: [
      '/api/auth/*',
      '/api/documents/*',
      '/api/topics/*',
      '/api/sprints/*',
      '/api/analytics/*',
      '/api/sessions/*'
    ],
    integration_notes: [
      'Use Supabase Auth JWT tokens for authentication',
      'All endpoints support CORS for Lovable domains',
      'File uploads use multipart/form-data',
      'Real-time features available via Supabase realtime'
    ]
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

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  // Enhanced error logging
  console.error('API Error:', {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString(),
    user_id: req.user?.id || 'anonymous'
  });
  
  // Handle specific error types
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      error: 'File too large',
      max_size: '50MB',
      code: 'FILE_SIZE_LIMIT',
      retry: false
    });
  }
  
  if (error.message.includes('PDF') || error.message.includes('pdf')) {
    return res.status(400).json({ 
      error: 'PDF processing error',
      details: error.message,
      code: 'PDF_ERROR',
      retry: true
    });
  }

  if (error.message === 'Invalid JSON') {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
      retry: false
    });
  }

  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS policy violation',
      code: 'CORS_ERROR',
      details: 'Origin not allowed. Contact support if using Lovable.',
      retry: false
    });
  }
  
  // Generic server error
  const statusCode = error.statusCode || error.status || 500;
  res.status(statusCode).json({ 
    error: statusCode === 500 ? 'Internal server error' : error.message,
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    request_id: req.id || 'unknown',
    retry: statusCode < 500
  });
});

// 404 handler with helpful information
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    requested_path: req.originalUrl,
    method: req.method,
    available_endpoints: [
      'GET /health - Health check',
      'GET /api/docs - API documentation',
      'GET /api/lovable/status - Lovable integration status',
      'POST /api/auth/signup - User registration',
      'POST /api/auth/login - User authentication',
      'GET /api/documents - List documents',
      'POST /api/documents/upload - Upload PDF',
      'GET /api/analytics/dashboard - Dashboard data',
      'POST /api/sprints/generate - Generate study sprint'
    ],
    code: 'ROUTE_NOT_FOUND',
    suggestion: 'Check /api/docs for complete API documentation'
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Enhanced Study Planner API Server Started (Lovable Compatible)');
  console.log(`📊 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
  console.log(`💖 Lovable status: http://localhost:${PORT}/api/lovable/status`);
  console.log(`⚡ Version: 2.1.0-lovable`);
  console.log('');
  console.log('✨ Lovable Integration Features:');
  console.log('  🔐 Supabase Auth Integration');
  console.log('  🌐 Enhanced CORS for Lovable domains');
  console.log('  📁 Optimized file upload handling');
  console.log('  ⚡ Real-time capabilities ready');
  console.log('  📊 Comprehensive analytics endpoints');
  console.log('  🧠 AI-powered sprint generation');
  console.log('  🏆 Achievement system');
  console.log('');
  console.log('🔒 Security & Performance:');
  console.log('  🛡️  Enhanced security headers');
  console.log('  🚦 Intelligent rate limiting');
  console.log('  🔐 Multi-origin CORS support');
  console.log('  📝 Detailed request logging');
  console.log('  ⚡ Performance monitoring');
  console.log('');
  console.log('Ready for Lovable frontend! 🎉');
  console.log('');
});

module.exports = app;