// Load environment variables FIRST - using explicit path from backend directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Debug environment variables (now should work correctly)
console.log('🔍 Environment Variables Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
console.log('SUPABASE_SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_KEY);
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('Looking for .env at:', path.join(__dirname, '../.env'));

// Import routes and config after dotenv is loaded
const authRoutes = require('./routes/auth');
const documentsRoutes = require('./routes/documents');
const topicsRoutes = require('./routes/topics');
const progressRoutes = require('./routes/progress');
const sprintsRoutes = require('./routes/sprints');
const sessionsRoutes = require('./routes/sessions');
const analyticsRoutes = require('./routes/analytics');
const achievementsRoutes = require('./routes/achievements');
const examGoalsRoutes = require('./routes/exam-goals');

// Check if optional routes exist before requiring them
let pageTimeTrackingRoutes = null;
let enhancedDashboardRoutes = null;

try {
  pageTimeTrackingRoutes = require('./routes/page-time-tracking');
  console.log('✅ Page time tracking routes loaded');
} catch (error) {
  console.log('⚠️ Page time tracking routes not found:', error.message);
}

try {
  enhancedDashboardRoutes = require('./routes/dashboard');
  console.log('✅ Enhanced dashboard routes loaded');
} catch (error) {
  console.log('⚠️ Enhanced dashboard routes not found:', error.message);
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Disable CSP for API
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration - more permissive for development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow Lovable domains
    if (origin.includes('lovable.dev')) {
      return callback(null, true);
    }
    
    // Allow specific origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
      'http://localhost:4173',
      'https://lovable.dev',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: process.env.PORT || 3000,
    supabase_configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    message: 'CORS is working',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    environment_loaded: !!process.env.SUPABASE_URL
  });
});

// Test login endpoint for debugging
app.post('/api/test-login', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    environment_configured: !!process.env.SUPABASE_URL,
    body_received: !!req.body,
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/sprints', sprintsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/exam-goals', examGoalsRoutes);

// Optional routes (only if they exist)
if (pageTimeTrackingRoutes) {
  app.use('/api/page-tracking', pageTimeTrackingRoutes);
}

if (enhancedDashboardRoutes) {
  app.use('/api/dashboard-enhanced', enhancedDashboardRoutes);
}

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Study Planner API',
    version: '2.1.0',
    environment: process.env.NODE_ENV,
    environment_configured: !!process.env.SUPABASE_URL,
    endpoints: {
      auth: '/api/auth/*',
      documents: '/api/documents/*',
      topics: '/api/topics/*',
      progress: '/api/progress/*',
      sprints: '/api/sprints/*',
      sessions: '/api/sessions/*',
      analytics: '/api/analytics/*',
      achievements: '/api/achievements/*',
      examGoals: '/api/exam-goals/*',
      ...(pageTimeTrackingRoutes && { pageTracking: '/api/page-tracking/*' }),
      ...(enhancedDashboardRoutes && { dashboard: '/api/dashboard-enhanced/*' })
    },
    cors: {
      enabled: true,
      development_mode: process.env.NODE_ENV === 'development'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Server Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message, stack: error.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    available_routes: [
      '/health',
      '/api/cors-test',
      '/api/test-login',
      '/api/docs',
      '/api/auth/*',
      '/api/topics/*'
    ]
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Study Planner API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
  console.log(`🧪 CORS test: http://localhost:${PORT}/api/cors-test`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔧 Supabase configured: ${!!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)}`);
});

module.exports = app;