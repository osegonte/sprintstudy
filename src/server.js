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

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting with different limits for different endpoint types
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth attempts per windowMs
  message: { error: 'Too many authentication attempts, please try again later' }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 uploads per hour
  message: { error: 'Upload limit exceeded, please try again later' }
});

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api/documents/upload', uploadLimiter);
app.use('/api', generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint with detailed system status
app.get('/health', async (req, res) => {
  try {
    // Basic health check
    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      message: 'Enhanced Study Planner API is running',
      features: {
        authentication: 'active',
        document_upload: 'active',
        progress_tracking: 'active',
        sprint_system: 'enhanced',
        topics_management: 'new',
        exam_goals: 'new',
        achievements: 'new',
        analytics: 'enhanced',
        study_sessions: 'new'
      },
      database: 'connected',
      storage: 'connected'
    };

    // Optional: Test database connection
    try {
      const { supabase } = require('./config/supabase');
      const { data, error } = await supabase
        .from('user_stats')
        .select('count')
        .limit(1);
      
      if (error) {
        healthStatus.database = 'error';
        healthStatus.database_error = error.message;
      }
    } catch (dbError) {
      healthStatus.database = 'error';
      healthStatus.database_error = dbError.message;
    }

    const statusCode = healthStatus.database === 'connected' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: error.message
    });
  }
});

// API version info
app.get('/api/version', (req, res) => {
  res.json({
    version: '2.0.0',
    name: 'Enhanced Study Planner API',
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
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sprints', sprintRoutes);

// New enhanced routes
app.use('/api/topics', topicsRoutes);
app.use('/api/exam-goals', examGoalsRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sessions', sessionsRoutes);

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
        body: {
          document_id: 'uuid',
          starting_page: 1,
          energy_level: 4,
          session_type: 'reading'
        }
      },
      generate_sprint: {
        method: 'POST',
        url: '/api/sprints/generate',
        body: {
          document_id: 'uuid',
          preferred_duration_minutes: 30,
          difficulty_preference: 'adaptive',
          session_type: 'reading'
        }
      }
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Handle specific error types
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
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

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    });
  }
  
  // Generic server error
  res.status(500).json({ 
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    available_endpoints: [
      '/health',
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
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Enhanced Study Planner API Server Started');
  console.log(`📊 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
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
});

module.exports = app;