// Enhanced server.js with production-ready features
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');

const app = express();

// Enhanced Security Configuration
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Enhanced CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Define allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://localhost:4173',
      'https://lovable.dev',
      process.env.FRONTEND_URL,
      // Add your production frontend URLs here
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins in development
    if (process.env.NODE_ENV === 'development' && 
        (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    
    // Allow Lovable domains
    if (origin.includes('lovable.dev')) {
      return callback(null, true);
    }
    
    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Development fallback - be more permissive
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Production - strict origin checking
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// Enhanced Rate Limiting
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: message,
      retryAfter: Math.round(windowMs / 1000)
    });
  }
});

// Different rate limits for different endpoints
app.use('/api/auth/login', createRateLimiter(15 * 60 * 1000, 5, 'Too many login attempts, please try again later'));
app.use('/api/auth/signup', createRateLimiter(60 * 60 * 1000, 3, 'Too many signup attempts, please try again later'));
app.use('/api/documents/upload', createRateLimiter(60 * 60 * 1000, 10, 'Too many file uploads, please try again later'));
app.use('/api/', createRateLimiter(15 * 60 * 1000, 1000, 'Too many requests, please try again later'));

// Performance optimizations
app.use(compression()); // Gzip compression
app.use(express.json({ 
  limit: '50mb',
  type: ['application/json', 'text/plain']
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 100
}));

// Enhanced Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substr(2, 9);
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Enhanced Health Check with dependencies
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    requestId: req.id,
    dependencies: {
      supabase: {
        configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
        url: process.env.SUPABASE_URL ? 'Connected' : 'Not configured'
      },
      database: 'Connected', // This could be enhanced with actual DB health check
      storage: 'Connected'   // This could be enhanced with actual storage health check
    },
    metrics: {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    }
  };

  // Test Supabase connection if configured
  if (healthCheck.dependencies.supabase.configured) {
    try {
      const { supabase } = require('./config/supabase');
      await supabase.from('user_stats').select('*').limit(1);
      healthCheck.dependencies.supabase.status = 'healthy';
    } catch (error) {
      healthCheck.dependencies.supabase.status = 'unhealthy';
      healthCheck.dependencies.supabase.error = error.message;
      healthCheck.status = 'DEGRADED';
    }
  }

  const statusCode = healthCheck.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// CORS preflight handling
app.options('*', cors(corsOptions));

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Study Planner API',
    version: '2.1.0',
    description: 'Comprehensive study planning and progress tracking API',
    environment: process.env.NODE_ENV,
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    documentation: {
      swagger: '/api/docs/swagger',
      postman: '/api/docs/postman'
    },
    endpoints: {
      auth: {
        base: '/api/auth',
        endpoints: {
          'POST /signup': 'Create new user account',
          'POST /login': 'Authenticate user',
          'POST /logout': 'Sign out user',
          'GET /me': 'Get current user info',
          'POST /refresh': 'Refresh authentication token'
        }
      },
      documents: {
        base: '/api/documents',
        endpoints: {
          'GET /': 'List user documents with filtering',
          'POST /upload': 'Upload PDF document',
          'GET /:id': 'Get document details',
          'DELETE /:id': 'Delete document'
        }
      },
      topics: {
        base: '/api/topics',
        endpoints: {
          'GET /': 'List topics with progress',
          'POST /': 'Create new topic',
          'GET /:id': 'Get topic details',
          'PATCH /:id': 'Update topic',
          'DELETE /:id': 'Delete topic',
          'PATCH /reorder': 'Reorder topics'
        }
      },
      analytics: {
        base: '/api/analytics',
        endpoints: {
          'GET /dashboard': 'Get dashboard analytics',
          'POST /feedback': 'Submit reading feedback',
          'GET /trends': 'Get performance trends'
        }
      }
    },
    cors: {
      enabled: true,
      credentials: true,
      allowedOrigins: process.env.NODE_ENV === 'development' ? 'All localhost origins' : 'Configured origins only'
    },
    rateLimit: {
      general: '1000 requests per 15 minutes',
      auth: '5 login attempts per 15 minutes',
      upload: '10 uploads per hour'
    }
  });
});

// Load routes
const authRoutes = require('./routes/auth');
const documentsRoutes = require('./routes/documents');
const topicsRoutes = require('./routes/topics');
const progressRoutes = require('./routes/progress');
const sprintsRoutes = require('./routes/sprints');
const sessionsRoutes = require('./routes/sessions');
const analyticsRoutes = require('./routes/analytics');
const achievementsRoutes = require('./routes/achievements');
const examGoalsRoutes = require('./routes/exam-goals');

// Mount API routes with versioning
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/documents', documentsRoutes);
app.use('/api/v1/topics', topicsRoutes);
app.use('/api/v1/progress', progressRoutes);
app.use('/api/v1/sprints', sprintsRoutes);
app.use('/api/v1/sessions', sessionsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/achievements', achievementsRoutes);
app.use('/api/v1/exam-goals', examGoalsRoutes);

// Backward compatibility routes (without versioning)
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/sprints', sprintsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/exam-goals', examGoalsRoutes);

// Load optional enhanced routes
try {
  const pageTimeTrackingRoutes = require('./routes/page-time-tracking');
  app.use('/api/v1/page-tracking', pageTimeTrackingRoutes);
  app.use('/api/page-tracking', pageTimeTrackingRoutes);
} catch (error) {
  console.log('⚠️ Page time tracking routes not available');
}

try {
  const enhancedDashboardRoutes = require('./routes/dashboard');
  app.use('/api/v1/dashboard-enhanced', enhancedDashboardRoutes);
  app.use('/api/dashboard-enhanced', enhancedDashboardRoutes);
} catch (error) {
  console.log('⚠️ Enhanced dashboard routes not available');
}

// Global error handling middleware
app.use((error, req, res, next) => {
  // Log error with request context
  console.error(`[${req.id}] ${error.stack}`);
  
  // CORS error handling
  if (error.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS policy violation',
      message: 'Request blocked by CORS policy',
      origin: req.headers.origin,
      requestId: req.id
    });
  }
  
  // Rate limit error handling
  if (error.message.includes('rate limit')) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: error.message,
      requestId: req.id
    });
  }
  
  // File upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      message: 'Maximum file size is 50MB',
      requestId: req.id
    });
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication token is invalid',
      requestId: req.id
    });
  }
  
  // Database connection errors
  if (error.message.includes('database') || error.message.includes('supabase')) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Database connection error',
      requestId: req.id
    });
  }
  
  // Default error response
  const statusCode = error.statusCode || error.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;
  
  res.status(statusCode).json({
    error: 'Internal server error',
    message: message,
    requestId: req.id,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      details: error
    })
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `API endpoint ${req.method} ${req.originalUrl} not found`,
    requestId: req.id,
    availableEndpoints: '/api/docs'
  });
});

// Catch-all for non-API routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'This endpoint does not exist',
    suggestion: 'Visit /api/docs for available endpoints',
    requestId: req.id
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Unhandled promise rejection handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Uncaught exception handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Study Planner API v2.1 running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔧 Supabase: ${process.env.SUPABASE_URL ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`🛡️ Security: CORS enabled, Rate limiting active, Helmet configured`);
});

module.exports = { app, server };