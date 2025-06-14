const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get dashboard overview
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`📊 Fetching dashboard data for user ${userId}`);

    // Get user stats
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get documents with progress
    const { data: documents } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        total_pages,
        created_at,
        document_pages (
          page_number,
          time_spent_seconds,
          is_completed
        )
      `)
      .eq('user_id', userId);

    // Calculate aggregate stats
    let totalDocuments = documents?.length || 0;
    let totalPages = 0;
    let completedPages = 0;
    let totalTimeSpent = 0;
    let estimatedTimeRemaining = 0;

    if (documents) {
      documents.forEach(doc => {
        totalPages += doc.total_pages;
        const docCompleted = doc.document_pages.filter(p => p.is_completed).length;
        completedPages += docCompleted;
        totalTimeSpent += doc.document_pages.reduce((sum, p) => sum + p.time_spent_seconds, 0);
        
        // Calculate remaining time for this document
        const remainingPages = doc.total_pages - docCompleted;
        const avgSpeed = userStats?.average_reading_speed_seconds || 120; // 2 minutes default
        estimatedTimeRemaining += remainingPages * avgSpeed;
      });
    }

    // Get today's sprint if any
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySprint } = await supabase
      .from('sprints')
      .select('*')
      .eq('user_id', userId)
      .eq('target_date', today)
      .order('created_at', { ascending: false })
      .limit(1);

    // Recent activity (last 5 pages read)
    const { data: recentActivity } = await supabase
      .from('document_pages')
      .select(`
        page_number,
        time_spent_seconds,
        last_read_at,
        documents (
          title
        )
      `)
      .eq('user_id', userId)
      .not('last_read_at', 'is', null)
      .order('last_read_at', { ascending: false })
      .limit(5);

    const dashboardData = {
      overview: {
        total_documents: totalDocuments,
        total_pages: totalPages,
        completed_pages: completedPages,
        completion_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0,
        total_time_spent_seconds: totalTimeSpent,
        estimated_time_remaining_seconds: estimatedTimeRemaining,
        average_reading_speed_seconds: userStats?.average_reading_speed_seconds || 0
      },
      user_stats: userStats || {
        total_pages_read: 0,
        total_time_spent_seconds: 0,
        average_reading_speed_seconds: 0,
        total_documents: 0
      },
      today_sprint: todaySprint?.[0] || null,
      recent_activity: recentActivity || [],
      reading_insights: generateReadingInsights(userStats, totalPages, completedPages)
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reading trends (last 30 days)
router.get('/trends', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: dailyProgress } = await supabase
      .from('document_pages')
      .select('last_read_at, time_spent_seconds')
      .eq('user_id', userId)
      .gte('last_read_at', thirtyDaysAgo)
      .not('last_read_at', 'is', null)
      .order('last_read_at', { ascending: true });

    // Group by date
    const dailyStats = {};
    dailyProgress?.forEach(page => {
      const date = page.last_read_at.split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          pages_read: 0,
          total_time_seconds: 0
        };
      }
      dailyStats[date].pages_read += 1;
      dailyStats[date].total_time_seconds += page.time_spent_seconds;
    });

    const trendsData = Object.values(dailyStats).map(day => ({
      ...day,
      average_time_per_page: day.pages_read > 0 ? Math.round(day.total_time_seconds / day.pages_read) : 0
    }));

    res.json({ trends: trendsData });
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate reading insights
function generateReadingInsights(userStats, totalPages, completedPages) {
  const insights = [];

  if (!userStats) {
    insights.push({
      type: 'welcome',
      message: 'Welcome! Upload your first PDF to start tracking your reading progress.',
      icon: '📚'
    });
    return insights;
  }

  const avgSpeed = userStats.average_reading_speed_seconds;
  const completionRate = totalPages > 0 ? (completedPages / totalPages) * 100 : 0;

  // Speed insights
  if (avgSpeed > 0) {
    if (avgSpeed < 60) {
      insights.push({
        type: 'speed',
        message: 'You\'re a speed reader! Average of less than 1 minute per page.',
        icon: '🚀'
      });
    } else if (avgSpeed < 120) {
      insights.push({
        type: 'speed',
        message: 'Great reading pace! About 1-2 minutes per page.',
        icon: '⚡'
      });
    } else if (avgSpeed < 300) {
      insights.push({
        type: 'speed',
        message: 'Steady reader! Taking time to absorb the content.',
        icon: '📖'
      });
    } else {
      insights.push({
        type: 'speed',
        message: 'Deep reader! You really focus on understanding every detail.',
        icon: '🔍'
      });
    }
  }

  // Progress insights
  if (completionRate > 75) {
    insights.push({
      type: 'progress',
      message: 'Excellent progress! You\'ve completed most of your reading material.',
      icon: '🏆'
    });
  } else if (completionRate > 50) {
    insights.push({
      type: 'progress',
      message: 'Good momentum! You\'re halfway through your reading goals.',
      icon: '📈'
    });
  } else if (completionRate > 25) {
    insights.push({
      type: 'progress',
      message: 'Keep going! You\'ve made a solid start on your reading.',
      icon: '💪'
    });
  }

  // Consistency insights
  if (userStats.total_pages_read > 50) {
    insights.push({
      type: 'consistency',
      message: `Impressive! You've read ${userStats.total_pages_read} pages total.`,
      icon: '🌟'
    });
  }

  return insights;
}

module.exports = router;