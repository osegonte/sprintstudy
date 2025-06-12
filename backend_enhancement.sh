#!/bin/bash

# SprintStudy Backend Enhancement Script
# This script updates the backend to support sprint tracking, gamification, and enhanced analytics

echo "🚀 Starting SprintStudy Backend Enhancement..."

# Create backup directory
echo "📁 Creating backup of current backend..."
mkdir -p backup
cp -r src backup/src_backup_$(date +%Y%m%d_%H%M%S)

# Create new database migration file
echo "🗃️ Creating database migration for new features..."
cat > src/migrations/001_sprint_features.sql << 'EOF'
-- Migration: Add Sprint Tracking and Gamification Features
-- Run this in your Supabase SQL Editor

-- 1. Create Sprints Table
CREATE TABLE sprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  estimated_time_seconds INTEGER NOT NULL,
  actual_time_seconds INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  target_date DATE DEFAULT CURRENT_DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for sprints
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own sprints
CREATE POLICY "Users can manage own sprints" ON sprints
  FOR ALL USING (auth.uid() = user_id);

-- 2. Create Study Sessions Table (for detailed tracking)
CREATE TABLE study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  pages_read INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  average_speed_seconds FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for study sessions
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own sessions
CREATE POLICY "Users can manage own sessions" ON study_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 3. Create Achievements Table
CREATE TABLE achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type VARCHAR(50) NOT NULL,
  achievement_name VARCHAR(100) NOT NULL,
  description TEXT,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS for achievements
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own achievements
CREATE POLICY "Users can view own achievements" ON achievements
  FOR ALL USING (auth.uid() = user_id);

-- 4. Update user_stats table with new fields
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS study_streak_days INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS longest_streak_days INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS total_sprints_completed INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS last_study_date DATE;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS preferred_session_length INTEGER DEFAULT 600; -- 10 minutes default

-- 5. Update document_pages table with session tracking
ALTER TABLE document_pages ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES study_sessions(id) ON DELETE SET NULL;
ALTER TABLE document_pages ADD COLUMN IF NOT EXISTS reading_speed_seconds FLOAT DEFAULT 0;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sprints_user_date ON sprints(user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_achievements_user_type ON achievements(user_id, achievement_type);
CREATE INDEX IF NOT EXISTS idx_document_pages_session ON document_pages(session_id);

-- 7. Create functions for sprint management
CREATE OR REPLACE FUNCTION generate_daily_sprint(user_uuid UUID, doc_id UUID)
RETURNS JSON AS $$
DECLARE
  user_speed FLOAT;
  total_pages INT;
  completed_pages INT;
  remaining_pages INT;
  preferred_length INT;
  suggested_pages INT;
  start_page INT;
  result JSON;
BEGIN
  -- Get user's average reading speed and preferences
  SELECT 
    COALESCE(average_reading_speed_seconds, 120) as speed,
    COALESCE(preferred_session_length, 600) as pref_length
  INTO user_speed, preferred_length
  FROM user_stats 
  WHERE user_id = user_uuid;
  
  -- Get document info
  SELECT total_pages INTO total_pages FROM documents WHERE id = doc_id;
  
  -- Get completed pages
  SELECT COUNT(*) INTO completed_pages 
  FROM document_pages 
  WHERE document_id = doc_id AND user_id = user_uuid AND is_mastered = true;
  
  -- Calculate remaining pages and suggested sprint
  remaining_pages := total_pages - completed_pages;
  suggested_pages := GREATEST(1, LEAST(remaining_pages, FLOOR(preferred_length / user_speed)));
  start_page := completed_pages + 1;
  
  -- Build result
  result := json_build_object(
    'start_page', start_page,
    'end_page', start_page + suggested_pages - 1,
    'estimated_time_seconds', suggested_pages * user_speed,
    'total_pages', total_pages,
    'completed_pages', completed_pages,
    'remaining_pages', remaining_pages
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_daily_sprint(UUID, UUID) TO authenticated;
EOF

# Update Supabase configuration
echo "⚙️ Updating Supabase configuration..."
cat > src/config/supabase.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Client for user operations (with RLS)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for service operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase, supabaseAdmin };
EOF

# Create Sprint Routes
echo "🏃 Creating sprint management routes..."
cat > src/routes/sprints.js << 'EOF'
const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Generate daily sprint suggestion
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { document_id } = req.body;
    const userId = req.user.id;

    // Call the database function to generate sprint
    const { data, error } = await supabase.rpc('generate_daily_sprint', {
      user_uuid: userId,
      doc_id: document_id
    });

    if (error) {
      console.error('Generate sprint error:', error);
      return res.status(500).json({ error: 'Failed to generate sprint' });
    }

    res.json({ sprint_suggestion: data });
  } catch (error) {
    console.error('Generate sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new sprint
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      document_id, 
      start_page, 
      end_page, 
      estimated_time_seconds,
      target_date 
    } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('sprints')
      .insert({
        user_id: userId,
        document_id,
        start_page,
        end_page,
        estimated_time_seconds,
        target_date: target_date || new Date().toISOString().split('T')[0],
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Create sprint error:', error);
      return res.status(500).json({ error: 'Failed to create sprint' });
    }

    res.status(201).json({ sprint: data });
  } catch (error) {
    console.error('Create sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's sprints
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, date, document_id } = req.query;
    let query = supabase
      .from('sprints')
      .select(`
        *,
        documents (
          title,
          total_pages
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (date) {
      query = query.eq('target_date', date);
    }

    if (document_id) {
      query = query.eq('document_id', document_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch sprints error:', error);
      return res.status(500).json({ error: 'Failed to fetch sprints' });
    }

    res.json({ sprints: data });
  } catch (error) {
    console.error('Get sprints error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start a sprint
router.patch('/:id/start', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Update sprint status and create study session
    const { data: sprint, error: sprintError } = await supabase
      .from('sprints')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (sprintError) {
      console.error('Start sprint error:', sprintError);
      return res.status(500).json({ error: 'Failed to start sprint' });
    }

    // Create study session
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .insert({
        user_id: req.user.id,
        document_id: sprint.document_id,
        sprint_id: id,
        start_time: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Create session error:', sessionError);
    }

    res.json({ 
      sprint, 
      session: session || null,
      message: 'Sprint started successfully' 
    });
  } catch (error) {
    console.error('Start sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete a sprint
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { actual_time_seconds } = req.body;

    const { data, error } = await supabase
      .from('sprints')
      .update({
        status: 'completed',
        actual_time_seconds,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Complete sprint error:', error);
      return res.status(500).json({ error: 'Failed to complete sprint' });
    }

    // Update user stats
    await updateUserStatsOnSprintComplete(req.user.id);

    // Check for achievements
    await checkAndAwardAchievements(req.user.id, 'sprint_completed');

    res.json({ sprint: data, message: 'Sprint completed successfully' });
  } catch (error) {
    console.error('Complete sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get today's sprint
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('sprints')
      .select(`
        *,
        documents (
          title,
          total_pages
        )
      `)
      .eq('user_id', req.user.id)
      .eq('target_date', today)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Fetch today sprint error:', error);
      return res.status(500).json({ error: 'Failed to fetch today\'s sprint' });
    }

    res.json({ 
      sprint: data.length > 0 ? data[0] : null,
      has_sprint_today: data.length > 0
    });
  } catch (error) {
    console.error('Get today sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
async function updateUserStatsOnSprintComplete(userId) {
  try {
    const { data: currentStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    const today = new Date().toISOString().split('T')[0];
    const lastStudyDate = currentStats?.last_study_date;
    
    let newStreak = 1;
    if (lastStudyDate) {
      const lastDate = new Date(lastStudyDate);
      const todayDate = new Date(today);
      const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        newStreak = (currentStats.study_streak_days || 0) + 1;
      } else if (daysDiff === 0) {
        newStreak = currentStats.study_streak_days || 1;
      }
    }

    await supabase
      .from('user_stats')
      .upsert({
        user_id: userId,
        total_sprints_completed: (currentStats?.total_sprints_completed || 0) + 1,
        study_streak_days: newStreak,
        longest_streak_days: Math.max(newStreak, currentStats?.longest_streak_days || 0),
        last_study_date: today,
        updated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Update user stats error:', error);
  }
}

async function checkAndAwardAchievements(userId, achievementType) {
  try {
    if (achievementType === 'sprint_completed') {
      const { data: stats } = await supabase
        .from('user_stats')
        .select('total_sprints_completed, study_streak_days')
        .eq('user_id', userId)
        .single();

      const achievements = [];

      // First sprint achievement
      if (stats.total_sprints_completed === 1) {
        achievements.push({
          user_id: userId,
          achievement_type: 'first_sprint',
          achievement_name: 'First Sprint',
          description: 'Completed your first study sprint!'
        });
      }

      // Sprint milestones
      if ([10, 25, 50, 100].includes(stats.total_sprints_completed)) {
        achievements.push({
          user_id: userId,
          achievement_type: 'sprint_milestone',
          achievement_name: `${stats.total_sprints_completed} Sprints`,
          description: `Completed ${stats.total_sprints_completed} study sprints!`
        });
      }

      // Streak achievements
      if ([3, 7, 14, 30].includes(stats.study_streak_days)) {
        achievements.push({
          user_id: userId,
          achievement_type: 'study_streak',
          achievement_name: `${stats.study_streak_days} Day Streak`,
          description: `Studied for ${stats.study_streak_days} consecutive days!`
        });
      }

      if (achievements.length > 0) {
        await supabase.from('achievements').insert(achievements);
      }
    }
  } catch (error) {
    console.error('Check achievements error:', error);
  }
}

module.exports = router;
EOF

# Create Analytics Routes
echo "📊 Creating enhanced analytics routes..."
cat > src/routes/analytics.js << 'EOF'
const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user stats
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get document count and progress
    const { data: documents } = await supabase
      .from('documents')
      .select(`
        id,
        total_pages,
        document_pages (
          is_mastered,
          time_spent_seconds
        )
      `)
      .eq('user_id', userId);

    // Calculate aggregate stats
    let totalDocuments = documents?.length || 0;
    let totalPages = 0;
    let masteredPages = 0;
    let totalTimeSpent = 0;
    let estimatedTimeRemaining = 0;

    if (documents) {
      documents.forEach(doc => {
        totalPages += doc.total_pages;
        const docMastered = doc.document_pages.filter(p => p.is_mastered).length;
        masteredPages += docMastered;
        totalTimeSpent += doc.document_pages.reduce((sum, p) => sum + p.time_spent_seconds, 0);
        
        // Calculate remaining time for this document
        const remainingPages = doc.total_pages - docMastered;
        const avgSpeed = userStats?.average_reading_speed_seconds || 120;
        estimatedTimeRemaining += remainingPages * avgSpeed;
      });
    }

    // Get today's sprint
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySprint } = await supabase
      .from('sprints')
      .select('*')
      .eq('user_id', userId)
      .eq('target_date', today)
      .order('created_at', { ascending: false })
      .limit(1);

    // Get recent achievements
    const { data: recentAchievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })
      .limit(3);

    res.json({
      stats: {
        total_documents: totalDocuments,
        total_pages: totalPages,
        mastered_pages: masteredPages,
        completion_percentage: totalPages > 0 ? (masteredPages / totalPages) * 100 : 0,
        total_time_spent_seconds: totalTimeSpent,
        estimated_time_remaining_seconds: estimatedTimeRemaining,
        average_reading_speed_seconds: userStats?.average_reading_speed_seconds || 0,
        study_streak_days: userStats?.study_streak_days || 0,
        longest_streak_days: userStats?.longest_streak_days || 0,
        total_sprints_completed: userStats?.total_sprints_completed || 0
      },
      today_sprint: todaySprint?.[0] || null,
      recent_achievements: recentAchievements || []
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reading speed over time
router.get('/reading-speed', authMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('study_sessions')
      .select('start_time, average_speed_seconds, pages_read')
      .eq('user_id', userId)
      .gte('start_time', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Reading speed analytics error:', error);
      return res.status(500).json({ error: 'Failed to fetch reading speed data' });
    }

    res.json({ reading_speed_data: data });
  } catch (error) {
    console.error('Reading speed analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get study habits (daily activity)
router.get('/study-habits', authMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('study_sessions')
      .select('start_time, total_time_seconds, pages_read')
      .eq('user_id', userId)
      .gte('start_time', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Study habits analytics error:', error);
      return res.status(500).json({ error: 'Failed to fetch study habits data' });
    }

    // Group by date
    const dailyStats = {};
    data?.forEach(session => {
      const date = session.start_time.split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          total_time_seconds: 0,
          pages_read: 0,
          sessions: 0
        };
      }
      dailyStats[date].total_time_seconds += session.total_time_seconds;
      dailyStats[date].pages_read += session.pages_read;
      dailyStats[date].sessions += 1;
    });

    res.json({ daily_stats: Object.values(dailyStats) });
  } catch (error) {
    console.error('Study habits analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get achievements
router.get('/achievements', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', req.user.id)
      .order('earned_at', { ascending: false });

    if (error) {
      console.error('Achievements error:', error);
      return res.status(500).json({ error: 'Failed to fetch achievements' });
    }

    res.json({ achievements: data });
  } catch (error) {
    console.error('Achievements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
EOF

# Create Study Sessions Routes
echo "📖 Creating study session tracking routes..."
cat > src/routes/sessions.js << 'EOF'
const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Start a study session
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { document_id, sprint_id } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        document_id,
        sprint_id,
        start_time: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Start session error:', error);
      return res.status(500).json({ error: 'Failed to start study session' });
    }

    res.status(201).json({ session: data });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End a study session
router.patch('/:id/end', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { pages_read, total_time_seconds } = req.body;

    const average_speed = pages_read > 0 ? total_time_seconds / pages_read : 0;

    const { data, error } = await supabase
      .from('study_sessions')
      .update({
        end_time: new Date().toISOString(),
        pages_read,
        total_time_seconds,
        average_speed_seconds: average_speed
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('End session error:', error);
      return res.status(500).json({ error: 'Failed to end study session' });
    }

    res.json({ session: data });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's study sessions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 10, document_id } = req.query;
    
    let query = supabase
      .from('study_sessions')
      .select(`
        *,
        documents (
          title
        ),
        sprints (
          start_page,
          end_page
        )
      `)
      .eq('user_id', req.user.id)
      .order('start_time', { ascending: false })
      .limit(parseInt(limit));

    if (document_id) {
      query = query.eq('document_id', document_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch sessions error:', error);
      return res.status(500).json({ error: 'Failed to fetch study sessions' });
    }

    res.json({ sessions: data });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
EOF

# Update main app.js to include new routes
echo "🔗 Updating main app.js with new routes..."
cat > src/app.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const progressRoutes = require('./routes/progress');
const sprintRoutes = require('./routes/sprints');
const analyticsRoutes = require('./routes/analytics');
const sessionRoutes = require('./routes/sessions');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['sprint_tracking', 'analytics', 'gamification']
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sessions', sessionRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 SprintStudy API v2.0 running on port ${PORT}`);
  console.log(`📊 Features: Sprint Tracking, Analytics, Gamification`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
EOF

# Update package.json with version bump
echo "📦 Updating package.json version..."
cat > package.json << 'EOF'
{
  "name": "sprintstudy-backend",
  "version": "2.0.0",
  "description": "Smart PDF Study Planner with Sprint Tracking and Analytics",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["study", "pdf", "sprint", "analytics", "education"],
  "author": "SprintStudy Team",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "@supabase/supabase-js": "^2.38.0",
    "multer": "^1.4.5-lts.1",
    "pdf-parse": "^1.1.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.1.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
EOF

# Create enhanced progress routes with session tracking
echo "⚡ Enhancing progress tracking with session integration..."
cat > src/routes/progress.js << 'EOF'
const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Record time spent on a page with session tracking
router.post('/page', authMiddleware, async (req, res) => {
  try {
    const { 
      document_id, 
      page_number, 
      time_spent_seconds, 
      session_id,
      reading_speed_feedback 
    } = req.body;
    const userId = req.user.id;

    // Update page data with session tracking
    const { error: updateError } = await supabase
      .from('document_pages')
      .update({
        time_spent_seconds: time_spent_seconds,
        reading_speed_seconds: time_spent_seconds, // Current page speed
        session_id: session_id,
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('document_id', document_id)
      .eq('page_number', page_number)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Update page error:', updateError);
      return res.status(500).json({ error: 'Failed to update page progress' });
    }

    // Update user stats with improved calculation
    const speedFeedback = await updateUserStatsWithFeedback(userId, time_spent_seconds);

    res.json({ 
      message: 'Progress recorded successfully',
      speed_feedback: speedFeedback
    });
  } catch (error) {
    console.error('Record progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reading progress for a document with analytics
router.get('/document/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('document_pages')
      .select(`
        *,
        study_sessions (
          start_time,
          total_time_seconds,
          average_speed_seconds
        )
      `)
      .eq('document_id', req.params.id)
      .eq('user_id', req.user.id)
      .order('page_number');

    if (error) {
      console.error('Fetch progress error:', error);
      return res.status(500).json({ error: 'Failed to fetch progress' });
    }

    const totalPages = data.length;
    const masteredPages = data.filter(page => page.is_mastered).length;
    const totalTimeSpent = data.reduce((sum, page) => sum + page.time_spent_seconds, 0);
    
    // Calculate reading speed trends
    const recentPages = data
      .filter(p => p.reading_speed_seconds > 0)
      .slice(-10); // Last 10 pages
    const avgRecentSpeed = recentPages.length > 0 
      ? recentPages.reduce((sum, p) => sum + p.reading_speed_seconds, 0) / recentPages.length
      : 0;

    res.json({
      pages: data,
      summary: {
        total_pages: totalPages,
        mastered_pages: masteredPages,
        completion_percentage: totalPages > 0 ? (masteredPages / totalPages) * 100 : 0,
        total_time_spent_seconds: totalTimeSpent,
        average_recent_speed_seconds: avgRecentSpeed,
        estimated_remaining_time: (totalPages - masteredPages) * avgRecentSpeed
      }
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark page as mastered with celebration
router.put('/page/:document_id/:page_number/master', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number } = req.params;
    const { is_mastered } = req.body;

    const { error } = await supabase
      .from('document_pages')
      .update({
        is_mastered: is_mastered,
        updated_at: new Date().toISOString()
      })
      .eq('document_id', document_id)
      .eq('page_number', parseInt(page_number))
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Update mastery error:', error);
      return res.status(500).json({ error: 'Failed to update mastery status' });
    }

    // Check for achievements when mastering pages
    if (is_mastered) {
      await checkPageMasteryAchievements(req.user.id);
    }

    res.json({ 
      message: 'Mastery status updated successfully',
      celebration: is_mastered ? generateCelebrationMessage() : null
    });
  } catch (error) {
    console.error('Update mastery error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user reading statistics with trends
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Create initial stats
        const { data: newStats, error: createError } = await supabase
          .from('user_stats')
          .insert({
            user_id: req.user.id,
            average_reading_speed_seconds: 0,
            total_pages_read: 0,
            total_time_spent_seconds: 0,
            study_streak_days: 0,
            longest_streak_days: 0,
            total_sprints_completed: 0
          })
          .select()
          .single();

        if (createError) {
          return res.status(500).json({ error: 'Failed to create user stats' });
        }

        return res.json({ stats: newStats });
      }

      console.error('Fetch stats error:', error);
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }

    // Get recent reading trend
    const { data: recentPages } = await supabase
      .from('document_pages')
      .select('reading_speed_seconds, last_read_at')
      .eq('user_id', req.user.id)
      .not('reading_speed_seconds', 'is', null)
      .gte('last_read_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('last_read_at', { ascending: false })
      .limit(20);

    const speedTrend = calculateSpeedTrend(recentPages || []);

    res.json({ 
      stats: {
        ...data,
        speed_trend: speedTrend
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get real-time reading feedback
router.post('/feedback', authMiddleware, async (req, res) => {
  try {
    const { current_page_time, document_id } = req.body;
    const userId = req.user.id;

    // Get user's average speed
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('average_reading_speed_seconds')
      .eq('user_id', userId)
      .single();

    const avgSpeed = userStats?.average_reading_speed_seconds || 120; // 2 minutes default
    const speedDiff = current_page_time - avgSpeed;
    const speedPercentage = ((avgSpeed - current_page_time) / avgSpeed) * 100;

    let feedback = generateSpeedFeedback(speedDiff, speedPercentage);

    res.json({ feedback });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to update user statistics with feedback
async function updateUserStatsWithFeedback(userId, additionalTimeSpent) {
  try {
    // Get current stats
    const { data: currentStats, error: fetchError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching current stats:', fetchError);
      return null;
    }

    // Calculate new stats
    const newTotalTimeSpent = (currentStats?.total_time_spent_seconds || 0) + additionalTimeSpent;
    const newTotalPagesRead = (currentStats?.total_pages_read || 0) + 1;
    const newAverageSpeed = newTotalTimeSpent / newTotalPagesRead;

    // Update stats
    const { error: upsertError } = await supabase
      .from('user_stats')
      .upsert({
        user_id: userId,
        average_reading_speed_seconds: newAverageSpeed,
        total_pages_read: newTotalPagesRead,
        total_time_spent_seconds: newTotalTimeSpent,
        updated_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('Error updating user stats:', upsertError);
      return null;
    }

    // Generate speed feedback
    const previousAvg = currentStats?.average_reading_speed_seconds || newAverageSpeed;
    const speedDiff = additionalTimeSpent - previousAvg;
    
    return generateSpeedFeedback(speedDiff, ((previousAvg - additionalTimeSpent) / previousAvg) * 100);
  } catch (error) {
    console.error('Update stats helper error:', error);
    return null;
  }
}

// Helper function to generate speed feedback
function generateSpeedFeedback(speedDiff, speedPercentage) {
  if (speedPercentage > 20) {
    return {
      type: 'fast',
      emoji: '🚀',
      message: `Flying through! ${Math.round(speedPercentage)}% faster than usual`,
      color: 'success'
    };
  } else if (speedPercentage > 5) {
    return {
      type: 'good',
      emoji: '⚡',
      message: `Great pace! ${Math.round(speedPercentage)}% above average`,
      color: 'success'
    };
  } else if (speedPercentage > -5) {
    return {
      type: 'normal',
      emoji: '🎯',
      message: 'Right on target! Steady as you go',
      color: 'primary'
    };
  } else if (speedPercentage > -20) {
    return {
      type: 'slow',
      emoji: '🐢',
      message: 'Taking your time - that\'s perfectly fine!',
      color: 'warning'
    };
  } else {
    return {
      type: 'very_slow',
      emoji: '📚',
      message: 'Deep reading mode - absorbing every detail!',
      color: 'info'
    };
  }
}

// Helper function to calculate speed trend
function calculateSpeedTrend(recentPages) {
  if (recentPages.length < 5) return 'insufficient_data';
  
  const halfway = Math.floor(recentPages.length / 2);
  const firstHalf = recentPages.slice(0, halfway);
  const secondHalf = recentPages.slice(halfway);
  
  const firstAvg = firstHalf.reduce((sum, p) => sum + p.reading_speed_seconds, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, p) => sum + p.reading_speed_seconds, 0) / secondHalf.length;
  
  const improvement = ((firstAvg - secondAvg) / firstAvg) * 100;
  
  if (improvement > 10) return 'improving';
  if (improvement < -10) return 'slowing';
  return 'stable';
}

// Helper function to generate celebration messages
function generateCelebrationMessage() {
  const messages = [
    { emoji: '🎉', text: 'Page mastered! You\'re on fire!' },
    { emoji: '⭐', text: 'Another one down! Keep it up!' },
    { emoji: '🚀', text: 'Mastery achieved! You\'re unstoppable!' },
    { emoji: '💪', text: 'Excellent work! Knowledge locked in!' },
    { emoji: '🏆', text: 'Champion! Another page conquered!' }
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

// Helper function to check page mastery achievements
async function checkPageMasteryAchievements(userId) {
  try {
    const { data: masteredCount } = await supabase
      .from('document_pages')
      .select('id')
      .eq('user_id', userId)
      .eq('is_mastered', true);

    const count = masteredCount?.length || 0;
    const milestones = [1, 10, 25, 50, 100, 250, 500, 1000];
    
    if (milestones.includes(count)) {
      await supabase.from('achievements').insert({
        user_id: userId,
        achievement_type: 'pages_mastered',
        achievement_name: `${count} Pages Mastered`,
        description: `Mastered ${count} pages! Your knowledge is growing!`
      });
    }
  } catch (error) {
    console.error('Check mastery achievements error:', error);
  }
}

module.exports = router;
EOF

# Create deployment script
echo "🚀 Creating deployment helper script..."
cat > deploy.sh << 'EOF'
#!/bin/bash

echo "🚀 Deploying SprintStudy Backend v2.0..."

# Install any new dependencies
echo "📦 Installing dependencies..."
npm install

# Check if Railway is connected
if ! railway status > /dev/null 2>&1; then
    echo "❌ Railway not connected. Please run 'railway login' first."
    exit 1
fi

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment initiated!"
echo "📊 Check logs: railway logs"
echo "🔗 Your API: https://sprintstudy-production.up.railway.app"
echo ""
echo "🆕 New API Endpoints Available:"
echo "  • POST /api/sprints/generate - Generate daily sprint"
echo "  • GET /api/sprints/today - Get today's sprint"
echo "  • GET /api/analytics/dashboard - Dashboard analytics"
echo "  • POST /api/sessions/start - Start study session"
echo "  • POST /api/progress/feedback - Real-time feedback"
echo ""
echo "🎯 Don't forget to run the SQL migration in Supabase!"
EOF

chmod +x deploy.sh

# Create migration reminder
echo "📋 Creating migration instructions..."
cat > MIGRATION_INSTRUCTIONS.md << 'EOF'
# 🗃️ Database Migration Instructions

## Step 1: Run SQL Migration
Copy and paste the SQL from `src/migrations/001_sprint_features.sql` into your Supabase SQL Editor and run it.

This will create:
- ✅ `sprints` table for sprint tracking
- ✅ `study_sessions` table for session management  
- ✅ `achievements` table for gamification
- ✅ Enhanced `user_stats` with streak tracking
- ✅ Database functions for sprint generation
- ✅ Proper indexes for performance

## Step 2: Verify Migration
Check that all new tables exist in your Supabase dashboard:
- sprints
- study_sessions  
- achievements

## Step 3: Test New Features
Use these new endpoints to test functionality:

### Sprint Management
```bash
# Generate daily sprint
curl -X POST https://sprintstudy-production.up.railway.app/api/sprints/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"document_id": "your-doc-id"}'

# Get today's sprint
curl https://sprintstudy-production.up.railway.app/api/sprints/today \
  -H "Authorization: Bearer <token>"
```

### Analytics Dashboard
```bash
# Get dashboard stats
curl https://sprintstudy-production.up.railway.app/api/analytics/dashboard \
  -H "Authorization: Bearer <token>"
```

### Real-time Feedback
```bash
# Get reading speed feedback
curl -X POST https://sprintstudy-production.up.railway.app/api/progress/feedback \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"current_page_time": 90, "document_id": "your-doc-id"}'
```

## Features Added:
🎯 **Sprint Tracking** - Daily study goals with smart recommendations
📊 **Enhanced Analytics** - Reading speed trends and study habits  
🏆 **Gamification** - Achievements, streaks, and milestones
⚡ **Real-time Feedback** - Speed comparisons and encouragement
📖 **Session Management** - Detailed study session tracking
EOF

# Create test script
echo "🧪 Creating API test script..."
cat > test_api.sh << 'EOF'
#!/bin/bash

API_URL="https://sprintstudy-production.up.railway.app"

echo "🧪 Testing SprintStudy API v2.0..."

# Test health endpoint
echo "🔍 Testing health endpoint..."
curl -s "$API_URL/health" | jq .

echo ""
echo "🎯 Testing new features requires authentication."
echo "💡 Use your JWT token from login to test protected endpoints:"
echo ""
echo "# Test sprint generation:"
echo "curl -X POST $API_URL/api/sprints/generate \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"document_id\": \"YOUR_DOC_ID\"}'"
echo ""
echo "# Test dashboard analytics:"
echo "curl $API_URL/api/analytics/dashboard \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\""
echo ""
echo "# Test real-time feedback:"
echo "curl -X POST $API_URL/api/progress/feedback \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"current_page_time\": 120, \"document_id\": \"YOUR_DOC_ID\"}'"
EOF

chmod +x test_api.sh

# Final summary
echo ""
echo "🎉 SprintStudy Backend Enhancement Complete!"
echo ""
echo "📁 Files Created/Updated:"
echo "  ✅ src/migrations/001_sprint_features.sql - Database migration"
echo "  ✅ src/routes/sprints.js - Sprint management endpoints"
echo "  ✅ src/routes/analytics.js - Enhanced analytics endpoints"
echo "  ✅ src/routes/sessions.js - Study session tracking"
echo "  ✅ src/routes/progress.js - Enhanced progress tracking"
echo "  ✅ src/app.js - Updated with new routes"
echo "  ✅ package.json - Version 2.0.0"
echo "  ✅ deploy.sh - Deployment helper"
echo "  ✅ test_api.sh - API testing script"
echo "  ✅ MIGRATION_INSTRUCTIONS.md - Setup guide"
echo ""
echo "🚀 Next Steps:"
echo "  1. Run the SQL migration in Supabase (see MIGRATION_INSTRUCTIONS.md)"
echo "  2. Deploy with: ./deploy.sh"
echo "  3. Test new features with: ./test_api.sh"
echo ""
echo "🆕 New Features Added:"
echo "  🎯 Sprint Tracking - Smart daily study goals"
echo "  📊 Enhanced Analytics - Reading trends and habits"
echo "  🏆 Gamification - Achievements and streaks"
echo "  ⚡ Real-time Feedback - Speed comparisons and encouragement"
echo "  📖 Session Management - Detailed study tracking"
echo ""
echo "Ready to power your SprintStudy frontend! 🚀"