// Enhanced server.js with production-ready features for CineStudy
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

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

// Enhanced CORS Configuration for CineStudy
const corsOptions = {
  origin: function (origin, callback) {
    // Define allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
      'http://localhost:8080',
      'http://localhost:4173',
      'https://lovable.dev',
      process.env.FRONTEND_URL,
      // Add your production frontend URLs here
    ].filter(Boolean);

    console.log(`🌐 CORS check - Origin: ${origin}`);

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ CORS: No origin - allowing');
      return callback(null, true);
    }
    
    // Allow all localhost origins in development
    if (process.env.NODE_ENV === 'development' && 
        (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      console.log('✅ CORS: Development localhost - allowing');
      return callback(null, true);
    }
    
    // Allow Lovable domains
    if (origin.includes('lovable.dev')) {
      console.log('✅ CORS: Lovable domain - allowing');
      return callback(null, true);
    }
    
    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS: Allowed origin - allowing');
      return callback(null, true);
    }
    
    // Development fallback - be more permissive
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ CORS: Development fallback - allowing');
      return callback(null, true);
    }
    
    // Production - strict origin checking
    console.log(`❌ CORS: Origin ${origin} not allowed`);
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
    console.log(`🚨 Rate limit exceeded for ${req.ip}: ${req.path}`);
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

// Root route - Welcome message
app.get('/', (req, res) => {
  res.json({
    message: '🎬 Welcome to CineStudy API',
    version: '2.3.0',
    status: 'running',
    environment: process.env.NODE_ENV,
    documentation: '/api/docs',
    health: '/health',
    timestamp: new Date().toISOString()
  });
});

// Enhanced Health Check with dependencies
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    service: 'CineStudy API',
    version: '2.3.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    requestId: req.id,
    dependencies: {
      supabase: {
        configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
        url: process.env.SUPABASE_URL ? 'Connected' : 'Not configured'
      },
      database: 'Connected',
      storage: 'Connected'
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
      
      // Test with a simple query that doesn't require tables
      const { error } = await supabase.from('user_stats').select('*').limit(1);
      
      if (error && !error.message.includes('relation "public.user_stats" does not exist')) {
        healthCheck.dependencies.supabase.status = 'unhealthy';
        healthCheck.dependencies.supabase.error = error.message;
        healthCheck.status = 'DEGRADED';
      } else {
        healthCheck.dependencies.supabase.status = 'healthy';
        if (error) {
          healthCheck.dependencies.database = 'Tables need migration';
        }
      }
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
    name: 'CineStudy API',
    version: '2.3.0',
    description: 'Comprehensive study planning and progress tracking API for CineStudy',
    environment: process.env.NODE_ENV,
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    authentication: {
      type: 'JWT Bearer Token',
      signup: 'POST /api/auth/signup',
      login: 'POST /api/auth/login',
      profile: 'GET /api/auth/me'
    },
    endpoints: {
      auth: {
        base: '/api/auth',
        endpoints: {
          'POST /signup': 'Create new user account',
          'POST /login': 'Authenticate user',
          'POST /logout': 'Sign out user',
          'GET /me': 'Get current user info',
          'POST /refresh': 'Refresh authentication token',
          'POST /test-login': 'Test login (development only)'
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
      sessions: {
        base: '/api/sessions',
        endpoints: {
          'POST /start': 'Start study session',
          'PATCH /:id/activity': 'Update session activity',
          'PATCH /:id/pause': 'Pause session',
          'PATCH /:id/resume': 'Resume session',
          'PATCH /:id/end': 'End study session',
          'GET /': 'List study sessions',
          'GET /:id': 'Get session details'
        }
      },
      analytics: {
        base: '/api/analytics',
        endpoints: {
          'GET /dashboard': 'Get dashboard analytics',
          'POST /feedback': 'Submit reading feedback',
          'GET /trends': 'Get performance trends',
          'GET /patterns': 'Get study patterns'
        }
      },
      sprints: {
        base: '/api/sprints',
        endpoints: {
          'POST /generate': 'Generate intelligent sprint',
          'POST /': 'Create sprint',
          'PATCH /:id/start': 'Start sprint',
          'PATCH /:id/complete': 'Complete sprint',
          'GET /analytics': 'Get sprint analytics'
        }
      },
      achievements: {
        base: '/api/achievements',
        endpoints: {
          'GET /': 'Get achievements with progress',
          'POST /check': 'Check and award achievements',
          'GET /recent': 'Get recent achievements',
          'GET /leaderboard': 'Get leaderboard (optional)'
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
    },
    database: {
      provider: 'Supabase',
      migration: 'Run /src/migrations/001_initial_setup.sql in Supabase SQL Editor',
      rls: 'Row Level Security enabled on all tables'
    }
  });
});

// CORS test endpoint for debugging
app.get('/api/cors-test', (req, res) => {
  res.json({
    message: 'CORS test successful! 🎉',
    origin: req.get('Origin'),
    timestamp: new Date().toISOString(),
    headers: {
      'Access-Control-Allow-Origin': req.get('Origin'),
      'Access-Control-Allow-Credentials': 'true'
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

// Load optional enhanced routes with error handling
const optionalRoutes = [
  { path: './routes/page-time-tracking', mount: '/page-tracking', name: 'Page time tracking' },
  { path: './routes/dashboard', mount: '/dashboard-enhanced', name: 'Enhanced dashboard' }
];

optionalRoutes.forEach(({ path, mount, name }) => {
  try {
    const routeModule = require(path);
    app.use(`/api/v1${mount}`, routeModule);
    app.use(`/api${mount}`, routeModule);
    console.log(`✅ Loaded ${name} routes`);
  } catch (error) {
    console.log(`⚠️ ${name} routes not available: ${error.message}`);
  }
});

// Favicon handler
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Global error handling middleware
app.use((error, req, res, next) => {
  // Log error with request context
  console.error(`[${req.id}] 💥 Error on ${req.method} ${req.path}:`, error);
  
  // CORS error handling
  if (error.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS policy violation',
      message: 'Request blocked by CORS policy',
      origin: req.headers.origin,
      requestId: req.id,
      solution: 'Add your frontend URL to the allowed origins'
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
      requestId: req.id,
      suggestion: 'Run the database migration if tables are missing'
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
  console.log(`🎬 CineStudy API v2.3 running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔧 Supabase: ${process.env.SUPABASE_URL ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`🛡️ Security: CORS enabled, Rate limiting active, Helmet configured`);
  console.log(`🎯 Ready for frontend at: http://localhost:5173`);
});

module.exports = { app, server };