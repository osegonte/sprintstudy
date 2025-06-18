// Updated server.js to include new time tracking routes
// Add these lines to your existing backend/src/server.js

// Add the new route imports at the top with your existing imports:
const pageTimeTrackingRoutes = require('./routes/page-time-tracking');
const enhancedDashboardRoutes = require('./routes/enhanced-dashboard');

// Add the new routes with your existing API routes section:
app.use('/api/page-tracking', pageTimeTrackingRoutes);
app.use('/api/dashboard-enhanced', enhancedDashboardRoutes);

// Also update your existing dashboard route to include basic time info
// Modify your existing backend/src/routes/dashboard.js by adding this function:

// Enhanced dashboard endpoint that works with your frontend
router.get('/time-overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`📊 Fetching time overview for user ${userId}`);

    // Get all documents with their progress
    const { data: documents } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        total_pages,
        difficulty_level,
        estimated_reading_time_minutes,
        topic_id,
        topics (
          name,
          color,
          icon
        ),
        document_pages (
          page_number,
          time_spent_seconds,
          is_completed,
          estimated_time_seconds
        )
      `)
      .eq('user_id', userId);

    // Get user reading stats
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!documents) {
      return res.json({
        total_reading_time_remaining: 0,
        total_reading_time_remaining_formatted: '0m',
        documents: [],
        user_reading_speed: userStats?.average_reading_speed_seconds || 120
      });
    }

    // Calculate remaining time for each document
    const documentsWithTime = documents.map(doc => {
      const pages = doc.document_pages || [];
      const completedPages = pages.filter(p => p.is_completed);
      const uncompletedPages = pages.filter(p => !p.is_completed);
      
      const timeSpent = completedPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
      
      // Calculate remaining time
      let remainingTimeSeconds = 0;
      if (uncompletedPages.length > 0) {
        remainingTimeSeconds = uncompletedPages.reduce((sum, page) => {
          const estimatedTime = page.estimated_time_seconds || userStats?.average_reading_speed_seconds || 120;
          
          // Adjust for document difficulty
          const difficultyMultiplier = {
            1: 0.8, 2: 0.9, 3: 1.0, 4: 1.2, 5: 1.4
          }[doc.difficulty_level] || 1.0;
          
          return sum + (estimatedTime * difficultyMultiplier);
        }, 0);
      }

      return {
        id: doc.id,
        title: doc.title,
        topic: doc.topics,
        total_pages: doc.total_pages,
        completed_pages: completedPages.length,
        completion_percentage: Math.round((completedPages.length / doc.total_pages) * 100),
        time_spent_seconds: timeSpent,
        remaining_time_seconds: remainingTimeSeconds,
        remaining_time_formatted: formatDuration(remainingTimeSeconds)
      };
    });

    // Calculate total remaining time
    const totalRemainingSeconds = documentsWithTime.reduce((sum, doc) => sum + doc.remaining_time_seconds, 0);

    res.json({
      total_reading_time_remaining: totalRemainingSeconds,
      total_reading_time_remaining_formatted: formatDuration(totalRemainingSeconds),
      documents: documentsWithTime,
      user_reading_speed: userStats?.average_reading_speed_seconds || 120,
      summary: {
        total_documents: documentsWithTime.length,
        completed_documents: documentsWithTime.filter(d => d.completion_percentage === 100).length,
        average_completion: Math.round(documentsWithTime.reduce((sum, d) => sum + d.completion_percentage, 0) / documentsWithTime.length),
        estimated_completion_date: calculateEstimatedCompletionDate(totalRemainingSeconds, userId)
      }
    });
  } catch (error) {
    console.error('Time overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function formatDuration(seconds) {
  if (seconds <= 0) return '0m';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

async function calculateEstimatedCompletionDate(remainingSeconds, userId) {
  try {
    // Get user's recent study patterns
    const { data: recentSessions } = await supabase
      .from('study_sessions')
      .select('total_duration_seconds, started_at')
      .eq('user_id', userId)
      .gte('started_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
      .order('started_at', { ascending: false });

    let dailyStudyTime = 3600; // Default 1 hour per day

    if (recentSessions && recentSessions.length > 0) {
      const totalTime = recentSessions.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0);
      const uniqueDays = new Set(recentSessions.map(s => s.started_at.split('T')[0])).size;
      
      if (uniqueDays > 0) {
        dailyStudyTime = totalTime / uniqueDays;
      }
    }

    const daysNeeded = Math.ceil(remainingSeconds / dailyStudyTime);
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + daysNeeded);
    
    return completionDate.toISOString().split('T')[0];
  } catch (error) {
    console.warn('Error calculating completion date:', error);
    // Fallback calculation
    const fallbackDays = Math.ceil(remainingSeconds / 3600);
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + fallbackDays);
    return completionDate.toISOString().split('T')[0];
  }
}