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
