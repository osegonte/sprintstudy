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

// Import new enhanced routes
const topicsRoutes = require('./routes/topics');
const examGoalsRoutes = require('./routes/exam-goals');
const achievementsRoutes = require('./routes/achievements');
const analyticsRoutes = require('./routes/analytics');
const sessionsRoutes = require('./routes/sessions');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Rate limiting with different limits for different endpoint types
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retry_after: Math.ceil(windowMs / 1000),
        limit: max
      });
    }
  });
};

const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // requests per window
  'Too many requests, please try again later'
);

const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // requests per window
  'Too many authentication attempts, please try again later'
);

const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  20, // requests per window
  'Upload limit exceeded, please try again later'
);

const analyticsLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  30, // requests per window
  'Too many analytics requests, please slow down'
);

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api/documents/upload', uploadLimiter);
app.use('/api/analytics', analyticsLimiter);
app.use('/api', generalLimiter);

// Body parsing middleware with size limits - FIXED VERSION
// Skip JSON parsing for file upload routes
app.use((req, res, next) => {
  // Skip JSON parsing for file uploads
  if (req.path === '/api/documents/upload' || req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  
  // Apply JSON parsing for other routes
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

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userAgent = req.get('User-Agent') || 'Unknown';
  const forwarded = req.get('X-Forwarded-For') || req.ip;
  
  console.log(`${timestamp} - ${req.method} ${req.path} - ${forwarded} - ${userAgent}`);
  
  // Add request start time for performance monitoring
  req.startTime = Date.now();
  
  // Log response time
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    if (duration > 1000) { // Log slow requests
      console.log(`⚠️  Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
    return originalSend.call(this, data);
  };
  
  next();
});

// Health check endpoint with comprehensive system status
app.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Basic health check
    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      message: 'Enhanced Study Planner API is running',
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

    // Test database connection
    try {
      const { supabase } = require('./config/supabase');
      const { data, error } = await supabase
        .from('user_stats')
        .select('count')
        .limit(1);
      
      if (error) {
        healthStatus.database = 'error';
        healthStatus.database_error = error.message;
        healthStatus.status = 'DEGRADED';
      } else {
        healthStatus.database = 'connected';
      }
    } catch (dbError) {
      healthStatus.database = 'error';
      healthStatus.database_error = dbError.message;
      healthStatus.status = 'DEGRADED';
    }

    // Test storage connection
    try {
      const { supabase } = require('./config/supabase');
      const { data, error } = await supabase.storage
        .from('pdf-documents')
        .list('', { limit: 1 });
      
      if (error) {
        healthStatus.storage = 'error';
        healthStatus.storage_error = error.message;
        healthStatus.status = 'DEGRADED';
      } else {
        healthStatus.storage = 'connected';
      }
    } catch (storageError) {
      healthStatus.storage = 'error';
      healthStatus.storage_error = storageError.message;
      healthStatus.status = 'DEGRADED';
    }

    healthStatus.response_time_ms = Date.now() - startTime;
    
    const statusCode = healthStatus.status === 'OK' ? 200 : 503;
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

// Metrics endpoint for monitoring
app.get('/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
    memory_usage: process.memoryUsage(),
    cpu_usage: process.cpuUsage(),
    nodejs_version: process.version,
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.json(metrics);
});

// API version info
app.get('/api/version', (req, res) => {
  res.json({
    version: '2.0.0',
    name: 'Enhanced Study Planner API',
    description: 'Comprehensive PDF study management with intelligent features',
    features: [
      'JWT Authentication',
      'PDF Upload & Processing',
      'Progress Tracking',
      'Intelligent Sprint System',
      'Topics Management',
      'Exam Goals & Deadlines',
      'Achievement System',
      'Real-time Analytics',
      'Study Session Tracking',
      'Performance Feedback'
    ],
    endpoints: {
      auth: '/api/auth/*',
      documents: '/api/documents/*',
      progress: '/api/progress/*',
      dashboard: '/api/dashboard',
      sprints: '/api/sprints/*',
      topics: '/api/topics/*',
      exam_goals: '/api/exam-goals/*',
      achievements: '/api/achievements/*',
      analytics: '/api/analytics/*',
      sessions: '/api/sessions/*'
    },
    rate_limits: {
      general: '100 requests per 15 minutes',
      auth: '10 requests per 15 minutes',
      upload: '20 requests per hour',
      analytics: '30 requests per minute'
    }
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Study Planner API Documentation',
    version: '2.0.0',
    description: 'Comprehensive API for intelligent PDF study management',
    base_url: `${req.protocol}://${req.get('host')}/api`,
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      endpoints: {
        signup: 'POST /auth/signup',
        login: 'POST /auth/login',
        me: 'GET /auth/me',
        logout: 'POST /auth/logout'
      }
    },
    endpoints: {
      documents: {
        upload: 'POST /documents/upload',
        list: 'GET /documents',
        get: 'GET /documents/:id',
        delete: 'DELETE /documents/:id'
      },
      topics: {
        list: 'GET /topics',
        create: 'POST /topics',
        get: 'GET /topics/:id',
        update: 'PATCH /topics/:id',
        delete: 'DELETE /topics/:id',
        reorder: 'PATCH /topics/reorder'
      },
      exam_goals: {
        list: 'GET /exam-goals',
        create: 'POST /exam-goals',
        get: 'GET /exam-goals/:id',
        update: 'PATCH /exam-goals/:id',
        delete: 'DELETE /exam-goals/:id',
        schedule: 'POST /exam-goals/:id/generate-schedule'
      },
      sprints: {
        generate: 'POST /sprints/generate',
        create: 'POST /sprints',
        list: 'GET /sprints',
        today: 'GET /sprints/today',
        start: 'PATCH /sprints/:id/start',
        complete: 'PATCH /sprints/:id/complete',
        analytics: 'GET /sprints/analytics'
      },
      achievements: {
        list: 'GET /achievements',
        check: 'POST /achievements/check',
        recent: 'GET /achievements/recent',
        leaderboard: 'GET /achievements/leaderboard'
      },
      analytics: {
        dashboard: 'GET /analytics/dashboard',
        feedback: 'POST /analytics/feedback',
        trends: 'GET /analytics/trends',
        patterns: 'GET /analytics/patterns'
      },
      sessions: {
        start: 'POST /sessions/start',
        list: 'GET /sessions',
        get: 'GET /sessions/:id',
        activity: 'PATCH /sessions/:id/activity',
        pause: 'PATCH /sessions/:id/pause',
        resume: 'PATCH /sessions/:id/resume',
        end: 'PATCH /sessions/:id/end'
      }
    },
    examples: {
      create_topic: {
        method: 'POST',
        url: '/api/topics',
        headers: {
          'Authorization': 'Bearer <token>',
          'Content-Type': 'application/json'
        },
        body: {
          name: 'Mathematics',
          description: 'Advanced calculus and algebra',
          color: '#667eea',
          icon: '🔢',
          priority: 1
        }
      },
      start_session: {
        method: 'POST',
        url: '/api/sessions/start',
        headers: {
          'Authorization': 'Bearer <token>',
          'Content-Type': 'application/json'
        },
        body: {
          document_id: 'uuid-here',
          starting_page: 1,
          energy_level: 4,
          session_type: 'reading'
        }
      },
      generate_sprint: {
        method: 'POST',
        url: '/api/sprints/generate',
        headers: {
          'Authorization': 'Bearer <token>',
          'Content-Type': 'application/json'
        },
        body: {
          document_id: 'uuid-here',
          preferred_duration_minutes: 30,
          difficulty_preference: 'adaptive',
          session_type: 'reading'
        }
      }
    },
    error_codes: {
      400: 'Bad Request - Invalid input data',
      401: 'Unauthorized - Missing or invalid authentication',
      403: 'Forbidden - Insufficient permissions',
      404: 'Not Found - Resource does not exist',
      409: 'Conflict - Resource already exists or constraint violation',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Server-side error'
    }
  });
});

// API routes with proper middleware order
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

// Error handling middleware - FIXED VERSION
app.use((error, req, res, next) => {
  // Check if response has already been sent
  if (res.headersSent) {
    return next(error);
  }

  // Log error details
  console.error('Unhandled error:', {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.url,
    method: req.method,
    user_agent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  // Handle specific error types
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      error: 'File too large',
      max_size: '50MB',
      code: 'FILE_SIZE_LIMIT'
    });
  }
  
  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({ 
      error: 'Only PDF files are allowed',
      accepted_types: ['application/pdf'],
      code: 'INVALID_FILE_TYPE'
    });
  }

  if (error.message === 'Invalid JSON') {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    });
  }

  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS policy violation',
      code: 'CORS_ERROR'
    });
  }

  if (error.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_ERROR'
    });
  }
  
  // Generic server error
  const statusCode = error.statusCode || error.status || 500;
  res.status(statusCode).json({ 
    error: statusCode === 500 ? 'Internal server error' : error.message,
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    request_id: req.id || 'unknown'
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    requested_path: req.originalUrl,
    method: req.method,
    available_endpoints: [
      '/health',
      '/metrics',
      '/api/version',
      '/api/docs',
      '/api/auth/*',
      '/api/documents/*',
      '/api/topics/*',
      '/api/exam-goals/*',
      '/api/sprints/*',
      '/api/achievements/*',
      '/api/analytics/*',
      '/api/sessions/*'
    ],
    code: 'ROUTE_NOT_FOUND'
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  
  // Close server
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database connections, etc.
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
  console.log('🚀 Enhanced Study Planner API Server Started');
  console.log(`📊 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`⚡ Version: 2.0.0 - Enhanced Features`);
  console.log('');
  console.log('✨ New Features Available:');
  console.log('  🏷️  Topics & Categories Management');
  console.log('  🎯 Exam Goals & Deadline Tracking');
  console.log('  🏆 Achievement & Gamification System');
  console.log('  📊 Real-time Analytics & Feedback');
  console.log('  ⏱️  Enhanced Study Session Tracking');
  console.log('  🧠 Intelligent Sprint Generation');
  console.log('  📈 Performance Pattern Analysis');
  console.log('');
  console.log('🔒 Security Features:');
  console.log('  🛡️  Helmet security headers');
  console.log('  🚦 Rate limiting by endpoint type');
  console.log('  🔐 CORS protection');
  console.log('  📝 Request logging & monitoring');
  console.log('  ⚡ Performance tracking');
  console.log('');
  console.log('Ready to handle requests! 🎉');
  console.log('');
});

module.exports = app;