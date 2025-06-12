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
