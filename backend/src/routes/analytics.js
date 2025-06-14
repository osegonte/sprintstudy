const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Enhanced dashboard with comprehensive analytics
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`📊 Fetching enhanced dashboard for user ${userId}`);

    // Get user stats
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get topic progress
    const { data: topics } = await supabase
      .from('topics')
      .select(`
        id,
        name,
        color,
        icon,
        target_completion_date
      `)
      .eq('user_id', userId)
      .eq('is_archived', false);

    // Get documents with detailed progress
    const { data: documents } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        total_pages,
        topic_id,
        difficulty_level,
        created_at,
        document_pages (
          page_number,
          time_spent_seconds,
          is_completed,
          last_read_at
        )
      `)
      .eq('user_id', userId);

    // Get recent study sessions
    const { data: recentSessions } = await supabase
      .from('study_sessions')
      .select(`
        id,
        started_at,
        total_duration_seconds,
        pages_covered,
        focus_score,
        comprehension_rating,
        documents (
          title,
          topics (
            name,
            color
          )
        )
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(10);

    // Get exam goals with urgency
    const { data: examGoals } = await supabase
      .from('exam_goals')
      .select(`
        id,
        title,
        exam_date,
        target_score,
        is_completed,
        topics (
          name,
          color
        )
      `)
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('exam_date', { ascending: true });

    // Get today's sprint
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySprint } = await supabase
      .from('sprints')
      .select(`
        *,
        documents (
          title,
          topics (
            name,
            color
          )
        )
      `)
      .eq('user_id', userId)
      .eq('target_date', today)
      .order('created_at', { ascending: false })
      .limit(1);

    // Calculate comprehensive statistics
    const analytics = calculateDashboardAnalytics(userStats, documents, recentSessions, examGoals);

    // Get reading trends (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: readingTrends } = await supabase
      .from('reading_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Get recent achievements
    const { data: recentAchievements } = await supabase
      .from('user_achievements')
      .select(`
        earned_at,
        achievements (
          title,
          icon,
          points,
          rarity
        )
      `)
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })
      .limit(5);

    // Calculate topic progress
    const topicProgress = await calculateTopicProgress(topics, documents);

    // Generate personalized insights
    const insights = generatePersonalizedInsights(userStats, analytics, examGoals, readingTrends);

    const dashboardData = {
      overview: {
        total_documents: documents?.length || 0,
        total_topics: topics?.length || 0,
        total_pages: analytics.totalPages,
        completed_pages: analytics.completedPages,
        completion_percentage: analytics.overallCompletionPercentage,
        total_time_spent_seconds: userStats?.total_time_spent_seconds || 0,
        current_streak_days: userStats?.current_streak_days || 0,
        current_level: userStats?.current_level || 1,
        total_xp_points: userStats?.total_xp_points || 0
      },
      performance: {
        average_reading_speed_seconds: userStats?.average_reading_speed_seconds || 0,
        focus_score_average: userStats?.focus_score_average || 0,
        productivity_score: analytics.productivityScore,
        reading_consistency: analytics.readingConsistency,
        improvement_trend: analytics.improvementTrend
      },
      today: {
        sprint: todaySprint?.[0] || null,
        recommended_study_time: analytics.recommendedStudyTime,
        priority_documents: analytics.priorityDocuments,
        urgent_goals: examGoals?.filter(goal => {
          const daysUntilExam = Math.ceil((new Date(goal.exam_date) - new Date()) / (1000 * 60 * 60 * 24));
          return daysUntilExam <= 7;
        }) || []
      },
      topics: topicProgress,
      recent_activity: recentSessions?.map(session => ({
        id: session.id,
        document_title: session.documents?.title,
        topic_name: session.documents?.topics?.name,
        topic_color: session.documents?.topics?.color,
        duration_minutes: Math.round(session.total_duration_seconds / 60),
        pages_covered: session.pages_covered,
        focus_score: session.focus_score,
        date: session.started_at
      })) || [],
      achievements: recentAchievements?.map(achievement => ({
        title: achievement.achievements.title,
        icon: achievement.achievements.icon,
        points: achievement.achievements.points,
        rarity: achievement.achievements.rarity,
        earned_at: achievement.earned_at
      })) || [],
      trends: {
        reading_velocity: readingTrends || [],
        weekly_summary: analytics.weeklySummary,
        monthly_goals: analytics.monthlyGoals
      },
      insights: insights,
      recommendations: generateDashboardRecommendations(analytics, examGoals, userStats)
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Enhanced dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Real-time feedback endpoint
router.post('/feedback', authMiddleware, async (req, res) => {
  try {
    const {
      document_id,
      page_number,
      current_page_time,
      session_id,
      activity_level = 1.0 // 0.0 to 1.0, indicating focus/activity
    } = req.body;

    const userId = req.user.id;

    if (!document_id || !page_number || current_page_time === undefined) {
      return res.status(400).json({ 
        error: 'document_id, page_number, and current_page_time are required' 
      });
    }

    console.log(`💬 Generating real-time feedback for user ${userId}, page ${page_number}, time ${current_page_time}s`);

    // Get user's reading statistics
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('average_reading_speed_seconds, focus_score_average')
      .eq('user_id', userId)
      .single();

    // Get historical data for this document/page type
    const { data: historicalData } = await supabase
      .from('document_pages')
      .select('time_spent_seconds, difficulty_rating')
      .eq('user_id', userId)
      .eq('document_id', document_id)
      .not('time_spent_seconds', 'eq', 0);

    // Get document difficulty
    const { data: document } = await supabase
      .from('documents')
      .select('difficulty_level, title')
      .eq('id', document_id)
      .single();

    // Calculate personalized feedback
    const feedback = generateRealTimeFeedback(
      current_page_time,
      userStats,
      historicalData,
      document,
      activity_level
    );

    // Store feedback for analytics
    const { error: feedbackError } = await supabase
      .from('reading_feedback')
      .insert({
        user_id: userId,
        session_id,
        document_id,
        page_number: parseInt(page_number),
        page_time_seconds: current_page_time,
        personal_average_seconds: userStats?.average_reading_speed_seconds || 120,
        difference_from_average_seconds: current_page_time - (userStats?.average_reading_speed_seconds || 120),
        feedback_type: feedback.type,
        feedback_message: feedback.message,
        encouragement_level: feedback.encouragement_level,
        time_of_day: new Date().toTimeString().split(' ')[0],
        day_of_week: new Date().getDay()
      });

    if (feedbackError) {
      console.error('Store feedback error:', feedbackError);
    }

    res.json({
      feedback: feedback,
      performance_context: {
        your_average: userStats?.average_reading_speed_seconds || 120,
        document_difficulty: document?.difficulty_level || 3,
        current_pace: current_page_time > (userStats?.average_reading_speed_seconds || 120) ? 'slower' : 'faster',
        focus_indicator: activity_level >= 0.8 ? 'high' : activity_level >= 0.6 ? 'medium' : 'low'
      }
    });
  } catch (error) {
    console.error('Real-time feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Performance trends analysis
router.get('/trends', authMiddleware, async (req, res) => {
  try {
    const { period = '30d', metric = 'speed' } = req.query;
    const userId = req.user.id;

    let dateFilter = new Date();
    switch (period) {
      case '7d':
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case '30d':
        dateFilter.setDate(dateFilter.getDate() - 30);
        break;
      case '90d':
        dateFilter.setDate(dateFilter.getDate() - 90);
        break;
    }

    // Get reading analytics data
    const { data: analyticsData } = await supabase
      .from('reading_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('date', dateFilter.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Get study sessions for detailed analysis
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select(`
        started_at,
        total_duration_seconds,
        pages_covered,
        focus_score,
        comprehension_rating,
        difficulty_rating
      `)
      .eq('user_id', userId)
      .gte('started_at', dateFilter.toISOString())
      .order('started_at', { ascending: true });

    // Calculate trends based on requested metric
    const trends = calculatePerformanceTrends(analyticsData, sessions, metric);

    res.json({
      trends: trends,
      period: period,
      metric: metric,
      summary: {
        total_study_days: analyticsData?.length || 0,
        total_sessions: sessions?.length || 0,
        average_daily_pages: trends.averageDailyPages,
        improvement_percentage: trends.improvementPercentage,
        consistency_score: trends.consistencyScore
      }
    });
  } catch (error) {
    console.error('Performance trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Study pattern analysis
router.get('/patterns', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get study sessions with time data
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select(`
        started_at,
        ended_at,
        total_duration_seconds,
        pages_covered,
        focus_score,
        energy_level,
        comprehension_rating
      `)
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(100);

    if (!sessions || sessions.length === 0) {
      return res.json({
        patterns: {
          peak_hours: [],
          best_session_length: 30,
          optimal_break_frequency: 25,
          productivity_by_day: {},
          focus_patterns: [],
          recommendations: ['Collect more study data to generate personalized patterns']
        }
      });
    }

    // Analyze patterns
    const patterns = analyzeStudyPatterns(sessions);

    res.json({ patterns: patterns });
  } catch (error) {
    console.error('Study patterns error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update daily analytics (called by background job or trigger)
router.post('/update-daily', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date = new Date().toISOString().split('T')[0] } = req.body;

    await updateDailyAnalytics(userId, date);

    res.json({ message: 'Daily analytics updated successfully' });
  } catch (error) {
    console.error('Update daily analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================
// HELPER FUNCTIONS
// =====================================

function calculateDashboardAnalytics(userStats, documents, recentSessions, examGoals) {
  const totalPages = documents?.reduce((sum, doc) => sum + doc.total_pages, 0) || 0;
  const completedPages = documents?.reduce((sum, doc) => 
    sum + doc.document_pages.filter(p => p.is_completed).length, 0) || 0;

  const overallCompletionPercentage = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;

  // Calculate productivity score (0-100)
  const speedScore = userStats?.average_reading_speed_seconds ? Math.max(0, 100 - (userStats.average_reading_speed_seconds - 60)) : 50;
  const focusScore = (userStats?.focus_score_average || 0.7) * 100;
  const consistencyScore = Math.min(100, (userStats?.current_streak_days || 0) * 10);
  const productivityScore = Math.round((speedScore + focusScore + consistencyScore) / 3);

  // Reading consistency (based on recent activity)
  const last7Days = recentSessions?.filter(session => {
    const sessionDate = new Date(session.started_at);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return sessionDate >= weekAgo;
  }) || [];

  const uniqueDaysStudied = new Set(last7Days.map(session => 
    new Date(session.started_at).toDateString()
  )).size;
  const readingConsistency = Math.round((uniqueDaysStudied / 7) * 100);

  // Improvement trend
  const recentAvgFocus = last7Days.length > 0 
    ? last7Days.reduce((sum, s) => sum + (s.focus_score || 0.7), 0) / last7Days.length
    : 0.7;
  const overallAvgFocus = userStats?.focus_score_average || 0.7;
  const improvementTrend = recentAvgFocus > overallAvgFocus ? 'improving' : 
                          recentAvgFocus < overallAvgFocus ? 'declining' : 'stable';

  // Recommended study time (based on goals and current pace)
  const urgentGoals = examGoals?.filter(goal => {
    const daysUntilExam = Math.ceil((new Date(goal.exam_date) - new Date()) / (1000 * 60 * 60 * 24));
    return daysUntilExam <= 14;
  }) || [];

  const recommendedStudyTime = Math.max(30, urgentGoals.length * 45); // 45 min per urgent goal, min 30 min

  // Priority documents (incomplete with recent activity or high priority)
  const priorityDocuments = documents?.filter(doc => {
    const completionPercentage = doc.document_pages.filter(p => p.is_completed).length / doc.total_pages * 100;
    const hasRecentActivity = doc.document_pages.some(p => 
      p.last_read_at && new Date(p.last_read_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    return completionPercentage < 100 && (hasRecentActivity || doc.difficulty_level >= 4);
  }).slice(0, 3) || [];

  // Weekly summary
  const weeklyPages = last7Days.reduce((sum, session) => sum + (session.pages_covered || 0), 0);
  const weeklyTime = last7Days.reduce((sum, session) => sum + (session.total_duration_seconds || 0), 0);
  
  return {
    totalPages,
    completedPages,
    overallCompletionPercentage,
    productivityScore,
    readingConsistency,
    improvementTrend,
    recommendedStudyTime,
    priorityDocuments: priorityDocuments.map(doc => ({
      id: doc.id,
      title: doc.title,
      completion_percentage: Math.round(doc.document_pages.filter(p => p.is_completed).length / doc.total_pages * 100),
      difficulty_level: doc.difficulty_level
    })),
    weeklySummary: {
      pages_read: weeklyPages,
      time_spent_minutes: Math.round(weeklyTime / 60),
      sessions_completed: last7Days.length,
      average_session_minutes: last7Days.length > 0 ? Math.round(weeklyTime / last7Days.length / 60) : 0
    },
    monthlyGoals: {
      target_pages: Math.max(100, userStats?.total_pages_read || 0) * 0.1, // 10% more than current
      target_hours: 20,
      target_streak: Math.max(7, userStats?.longest_streak_days || 0)
    }
  };
}

async function calculateTopicProgress(topics, documents) {
  if (!topics || !documents) return [];

  return topics.map(topic => {
    const topicDocuments = documents.filter(doc => doc.topic_id === topic.id);
    const totalPages = topicDocuments.reduce((sum, doc) => sum + doc.total_pages, 0);
    const completedPages = topicDocuments.reduce((sum, doc) => 
      sum + doc.document_pages.filter(p => p.is_completed).length, 0);
    
    const completionPercentage = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;
    
    // Calculate urgency based on target date
    let urgencyLevel = 'low';
    if (topic.target_completion_date) {
      const daysUntilTarget = Math.ceil((new Date(topic.target_completion_date) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilTarget <= 0) urgencyLevel = 'overdue';
      else if (daysUntilTarget <= 3) urgencyLevel = 'critical';
      else if (daysUntilTarget <= 7) urgencyLevel = 'high';
      else if (daysUntilTarget <= 14) urgencyLevel = 'medium';
    }

    return {
      id: topic.id,
      name: topic.name,
      color: topic.color,
      icon: topic.icon,
      total_documents: topicDocuments.length,
      total_pages: totalPages,
      completed_pages: completedPages,
      completion_percentage: completionPercentage,
      urgency_level: urgencyLevel,
      target_date: topic.target_completion_date
    };
  });
}

function generatePersonalizedInsights(userStats, analytics, examGoals, readingTrends) {
  const insights = [];

  // Performance insights
  if (analytics.productivityScore >= 80) {
    insights.push({
      type: 'performance',
      icon: '🚀',
      title: 'Excellent Performance!',
      message: `Your productivity score of ${analytics.productivityScore}% puts you in the top tier of learners.`,
      action: 'Consider taking on more challenging material or helping others.'
    });
  } else if (analytics.productivityScore >= 60) {
    insights.push({
      type: 'performance',
      icon: '📈',
      title: 'Good Progress',
      message: `You're performing well with a ${analytics.productivityScore}% productivity score.`,
      action: 'Focus on maintaining consistency to reach the next level.'
    });
  } else {
    insights.push({
      type: 'performance',
      icon: '💪',
      title: 'Room for Improvement',
      message: 'Your reading efficiency could be enhanced with some adjustments.',
      action: 'Try shorter, more frequent study sessions to build momentum.'
    });
  }

  // Streak insights
  const currentStreak = userStats?.current_streak_days || 0;
  if (currentStreak >= 7) {
    insights.push({
      type: 'consistency',
      icon: '🔥',
      title: 'Streak Master!',
      message: `Amazing ${currentStreak}-day streak! Consistency is your superpower.`,
      action: 'Keep the momentum going - you\'re building a strong habit.'
    });
  } else if (currentStreak >= 3) {
    insights.push({
      type: 'consistency',
      icon: '⭐',
      title: 'Building Momentum',
      message: `Great ${currentStreak}-day streak! You\'re developing excellent habits.`,
      action: 'Aim for 7 days to unlock your next achievement milestone.'
    });
  } else {
    insights.push({
      type: 'consistency',
      icon: '🎯',
      title: 'Consistency Challenge',
      message: 'Building a daily reading habit will accelerate your progress.',
      action: 'Start with just 10 minutes daily to establish your routine.'
    });
  }

  // Exam urgency insights
  const urgentExams = examGoals?.filter(goal => {
    const daysUntilExam = Math.ceil((new Date(goal.exam_date) - new Date()) / (1000 * 60 * 60 * 24));
    return daysUntilExam <= 14 && daysUntilExam > 0;
  }) || [];

  if (urgentExams.length > 0) {
    const nextExam = urgentExams[0];
    const daysLeft = Math.ceil((new Date(nextExam.exam_date) - new Date()) / (1000 * 60 * 60 * 24));
    
    insights.push({
      type: 'urgency',
      icon: '⏰',
      title: 'Exam Approaching',
      message: `${nextExam.title} is in ${daysLeft} days. Time to intensify your preparation!`,
      action: 'Focus on high-priority topics and increase daily study time.'
    });
  }

  // Reading speed insights
  const avgSpeed = userStats?.average_reading_speed_seconds || 120;
  if (avgSpeed < 60) {
    insights.push({
      type: 'speed',
      icon: '⚡',
      title: 'Speed Reader',
      message: 'Your reading speed is impressive! You average less than a minute per page.',
      action: 'Consider taking on more challenging or comprehensive material.'
    });
  } else if (avgSpeed > 300) {
    insights.push({
      type: 'speed',
      icon: '🐌',
      title: 'Deep Reader',
      message: 'You take time to thoroughly understand content - that\'s valuable!',
      action: 'Try active reading techniques like summarizing to maintain comprehension while building speed.'
    });
  }

  // Trend insights
  if (readingTrends && readingTrends.length >= 7) {
    const recentWeek = readingTrends.slice(-7);
    const previousWeek = readingTrends.slice(-14, -7);
    
    if (recentWeek.length > 0 && previousWeek.length > 0) {
      const recentAvg = recentWeek.reduce((sum, day) => sum + day.total_pages_read, 0) / recentWeek.length;
      const previousAvg = previousWeek.reduce((sum, day) => sum + day.total_pages_read, 0) / previousWeek.length;
      
      if (recentAvg > previousAvg * 1.2) {
        insights.push({
          type: 'trend',
          icon: '📊',
          title: 'Accelerating Progress',
          message: 'Your reading pace has increased significantly this week!',
          action: 'This momentum is perfect for tackling challenging material.'
        });
      } else if (recentAvg < previousAvg * 0.8) {
        insights.push({
          type: 'trend',
          icon: '📉',
          title: 'Pace Declining',
          message: 'Your reading activity has slowed down recently.',
          action: 'Consider shorter sessions or easier material to rebuild momentum.'
        });
      }
    }
  }

  return insights.slice(0, 5); // Return top 5 insights
}

function generateDashboardRecommendations(analytics, examGoals, userStats) {
  const recommendations = [];

  // Time-based recommendations
  const currentHour = new Date().getHours();
  if (currentHour >= 6 && currentHour <= 10) {
    recommendations.push({
      type: 'timing',
      icon: '🌅',
      title: 'Morning Power Hour',
      description: 'Research shows morning study sessions improve retention by 25%.',
      action: 'Start your day with your most challenging material.',
      priority: 'high'
    });
  }

  // Goal-based recommendations
  if (examGoals && examGoals.length > 0) {
    const nextExam = examGoals[0];
    const daysLeft = Math.ceil((new Date(nextExam.exam_date) - new Date()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 7) {
      recommendations.push({
        type: 'exam_prep',
        icon: '🎯',
        title: 'Exam Sprint Mode',
        description: `${nextExam.title} is in ${daysLeft} days. Focus on active recall and practice.`,
        action: 'Switch to review mode and practice questions.',
        priority: 'critical'
      });
    }
  }

  // Performance-based recommendations
  if (analytics.readingConsistency < 50) {
    recommendations.push({
      type: 'consistency',
      icon: '📅',
      title: 'Build Your Habit',
      description: 'Consistent daily practice, even for 15 minutes, beats long irregular sessions.',
      action: 'Set a daily reminder and start with just 15 minutes.',
      priority: 'medium'
    });
  }

  // Speed optimization
  const avgSpeed = userStats?.average_reading_speed_seconds || 120;
  if (avgSpeed > 180) {
    recommendations.push({
      type: 'speed',
      icon: '⚡',
      title: 'Speed Reading Opportunity',
      description: 'Your reading pace suggests you might benefit from speed reading techniques.',
      action: 'Try the pointer method or chunking to increase reading speed.',
      priority: 'low'
    });
  }

  return recommendations.slice(0, 4); // Return top 4 recommendations
}

function generateRealTimeFeedback(currentTime, userStats, historicalData, document, activityLevel) {
  const personalAverage = userStats?.average_reading_speed_seconds || 120;
  const difference = currentTime - personalAverage;
  const difficultyMultiplier = (document?.difficulty_level || 3) / 3; // Adjust expectations for difficulty

  let feedbackType = 'neutral';
  let message = '';
  let encouragementLevel = 3;
  let icon = '📖';

  // Adjust expectations based on document difficulty
  const adjustedAverage = personalAverage * difficultyMultiplier;
  const adjustedDifference = currentTime - adjustedAverage;

  // Determine feedback type
  if (Math.abs(adjustedDifference) <= 15) {
    feedbackType = 'perfect';
    icon = '🎯';
    message = 'Perfect pace! You\'re right on track.';
    encouragementLevel = 5;
  } else if (adjustedDifference < -30) {
    feedbackType = 'fast';
    icon = '⚡';
    message = `Great speed! You're ${Math.abs(Math.round(adjustedDifference))}s faster than your average.`;
    encouragementLevel = 4;
  } else if (adjustedDifference < -15) {
    feedbackType = 'good';
    icon = '👍';
    message = 'Good pace! You\'re reading efficiently.';
    encouragementLevel = 4;
  } else if (adjustedDifference <= 60) {
    feedbackType = 'slow';
    icon = '🐢';
    message = 'Take your time to understand. Comprehension matters more than speed.';
    encouragementLevel = 3;
  } else {
    feedbackType = 'very_slow';
    icon = '🤔';
    message = 'This seems challenging. Consider taking notes or re-reading if needed.';
    encouragementLevel = 2;
  }

  // Activity level adjustments
  if (activityLevel < 0.6) {
    message += ' Try to minimize distractions for better focus.';
    encouragementLevel = Math.max(1, encouragementLevel - 1);
  }

  // Historical context
  if (historicalData && historicalData.length > 0) {
    const documentAverage = historicalData.reduce((sum, page) => sum + page.time_spent_seconds, 0) / historicalData.length;
    if (currentTime < documentAverage * 0.8) {
      message += ' You\'re getting faster with this material!';
    }
  }

  // Time of day context
  const currentHour = new Date().getHours();
  if (currentHour < 10 && feedbackType === 'fast') {
    message += ' Morning reading session paying off!';
  } else if (currentHour > 20 && feedbackType !== 'very_slow') {
    message += ' Great focus for evening study!';
  }

  return {
    type: feedbackType,
    icon: icon,
    message: message,
    encouragement_level: encouragementLevel,
    time_comparison: {
      current_time: currentTime,
      personal_average: personalAverage,
      difference_seconds: difference,
      difficulty_adjusted_average: Math.round(adjustedAverage),
      pace_description: adjustedDifference < -15 ? 'faster than usual' :
                       adjustedDifference > 30 ? 'slower than usual' : 'typical pace'
    },
    suggestions: generateFeedbackSuggestions(feedbackType, currentTime, personalAverage, activityLevel)
  };
}

function generateFeedbackSuggestions(feedbackType, currentTime, average, activityLevel) {
  const suggestions = [];

  switch (feedbackType) {
    case 'very_slow':
      suggestions.push('Try breaking down complex sentences into smaller parts');
      suggestions.push('Consider highlighting key concepts as you read');
      if (activityLevel < 0.7) {
        suggestions.push('Remove distractions and focus solely on reading');
      }
      break;
      
    case 'slow':
      suggestions.push('You\'re being thorough - that\'s good for comprehension!');
      if (currentTime > average * 2) {
        suggestions.push('Consider setting a soft time goal for each page');
      }
      break;
      
    case 'fast':
      suggestions.push('Excellent speed! Make sure you\'re retaining the information');
      suggestions.push('Quick self-check: can you summarize what you just read?');
      break;
      
    case 'perfect':
      suggestions.push('Perfect balance of speed and comprehension!');
      suggestions.push('This is your optimal reading pace - try to maintain it');
      break;
  }

  if (activityLevel < 0.8) {
    suggestions.push('Try the Pomodoro technique: 25 minutes focused reading, 5 minute break');
  }

  return suggestions.slice(0, 3);
}

function calculatePerformanceTrends(analyticsData, sessions, metric) {
  if (!analyticsData || analyticsData.length === 0) {
    return {
      data: [],
      improvementPercentage: 0,
      averageDailyPages: 0,
      consistencyScore: 0
    };
  }

  // Calculate based on requested metric
  let trendData = [];
  
  switch (metric) {
    case 'speed':
      trendData = analyticsData.map(day => ({
        date: day.date,
        value: day.average_page_time_seconds || 120,
        label: 'Avg. seconds per page'
      }));
      break;
      
    case 'pages':
      trendData = analyticsData.map(day => ({
        date: day.date,
        value: day.total_pages_read || 0,
        label: 'Pages read'
      }));
      break;
      
    case 'focus':
      trendData = analyticsData.map(day => ({
        date: day.date,
        value: Math.round((day.focus_score_average || 0.7) * 100),
        label: 'Focus score %'
      }));
      break;
      
    case 'time':
      trendData = analyticsData.map(day => ({
        date: day.date,
        value: Math.round((day.total_time_seconds || 0) / 60),
        label: 'Minutes studied'
      }));
      break;
  }

  // Calculate improvement percentage
  const firstWeek = trendData.slice(0, 7);
  const lastWeek = trendData.slice(-7);
  
  let improvementPercentage = 0;
  if (firstWeek.length > 0 && lastWeek.length > 0) {
    const firstAvg = firstWeek.reduce((sum, day) => sum + day.value, 0) / firstWeek.length;
    const lastAvg = lastWeek.reduce((sum, day) => sum + day.value, 0) / lastWeek.length;
    
    if (metric === 'speed') {
      // For speed, lower is better
      improvementPercentage = firstAvg > 0 ? Math.round(((firstAvg - lastAvg) / firstAvg) * 100) : 0;
    } else {
      // For other metrics, higher is better
      improvementPercentage = firstAvg > 0 ? Math.round(((lastAvg - firstAvg) / firstAvg) * 100) : 0;
    }
  }

  // Calculate consistency score (how many days had activity)
  const activeDays = analyticsData.filter(day => day.total_pages_read > 0).length;
  const consistencyScore = Math.round((activeDays / analyticsData.length) * 100);

  // Average daily pages
  const averageDailyPages = analyticsData.length > 0 
    ? Math.round(analyticsData.reduce((sum, day) => sum + (day.total_pages_read || 0), 0) / analyticsData.length)
    : 0;

  return {
    data: trendData,
    improvementPercentage: improvementPercentage,
    averageDailyPages: averageDailyPages,
    consistencyScore: consistencyScore,
    totalActiveDays: activeDays
  };
}

function analyzeStudyPatterns(sessions) {
  // Analyze peak performance hours
  const hourlyPerformance = {};
  const dailyPerformance = {};

  sessions.forEach(session => {
    const hour = new Date(session.started_at).getHours();
    const day = new Date(session.started_at).getDay(); // 0 = Sunday
    const duration = session.total_duration_seconds / 60; // Convert to minutes
    const efficiency = session.pages_covered / (duration || 1); // Pages per minute
    
    // Hourly analysis
    if (!hourlyPerformance[hour]) {
      hourlyPerformance[hour] = { sessions: 0, totalEfficiency: 0, totalFocus: 0 };
    }
    hourlyPerformance[hour].sessions += 1;
    hourlyPerformance[hour].totalEfficiency += efficiency;
    hourlyPerformance[hour].totalFocus += session.focus_score || 0.7;
    
    // Daily analysis
    if (!dailyPerformance[day]) {
      dailyPerformance[day] = { sessions: 0, totalDuration: 0, totalPages: 0 };
    }
    dailyPerformance[day].sessions += 1;
    dailyPerformance[day].totalDuration += duration;
    dailyPerformance[day].totalPages += session.pages_covered || 0;
  });

  // Find peak hours
  const peakHours = Object.entries(hourlyPerformance)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      avgEfficiency: data.totalEfficiency / data.sessions,
      avgFocus: data.totalFocus / data.sessions,
      sessionCount: data.sessions
    }))
    .filter(h => h.sessionCount >= 3) // Only include hours with sufficient data
    .sort((a, b) => (b.avgEfficiency * b.avgFocus) - (a.avgEfficiency * a.avgFocus))
    .slice(0, 3);

  // Best session length analysis
  const sessionLengths = sessions.map(s => s.total_duration_seconds / 60);
  const avgSessionLength = sessionLengths.reduce((sum, len) => sum + len, 0) / sessionLengths.length;
  
  // Optimal session length (sessions with above-average focus and efficiency)
  const goodSessions = sessions.filter(s => 
    (s.focus_score || 0.7) >= 0.8 && 
    (s.pages_covered / (s.total_duration_seconds / 60)) >= 0.5
  );
  
  const optimalLength = goodSessions.length > 0 
    ? goodSessions.reduce((sum, s) => sum + (s.total_duration_seconds / 60), 0) / goodSessions.length
    : avgSessionLength;

  // Day of week preferences
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const productivityByDay = Object.entries(dailyPerformance)
    .map(([day, data]) => ({
      day: dayNames[parseInt(day)],
      avgDuration: data.totalDuration / data.sessions,
      avgPages: data.totalPages / data.sessions,
      sessionCount: data.sessions
    }))
    .sort((a, b) => b.avgPages - a.avgPages);

  // Focus patterns
  const focusPatterns = sessions
    .filter(s => s.focus_score !== null)
    .map(s => ({
      hour: new Date(s.started_at).getHours(),
      focus: s.focus_score,
      energy: s.energy_level
    }));

  // Generate recommendations
  const recommendations = [];
  
  if (peakHours.length > 0) {
    const bestHour = peakHours[0];
    recommendations.push(`Your peak performance hour is ${bestHour.hour}:00. Schedule important study sessions then.`);
  }
  
  if (optimalLength > 0) {
    recommendations.push(`Your optimal session length is ${Math.round(optimalLength)} minutes for best focus and efficiency.`);
  }
  
  if (productivityByDay.length > 0) {
    const bestDay = productivityByDay[0];
    recommendations.push(`${bestDay.day}s are your most productive day - plan challenging material then.`);
  }

  return {
    peak_hours: peakHours,
    best_session_length: Math.round(optimalLength),
    optimal_break_frequency: Math.round(optimalLength * 0.8), // Suggest breaks at 80% of optimal length
    productivity_by_day: productivityByDay,
    focus_patterns: focusPatterns,
    recommendations: recommendations,
    analysis_summary: {
      total_sessions_analyzed: sessions.length,
      avg_session_minutes: Math.round(avgSessionLength),
      peak_focus_score: Math.max(...sessions.map(s => s.focus_score || 0)),
      most_productive_hour: peakHours[0]?.hour || null
    }
  };
}

async function updateDailyAnalytics(userId, date) {
  try {
    // Get all study sessions for the date
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const { data: sessions } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', startOfDay.toISOString())
      .lt('started_at', endOfDay.toISOString());

    if (!sessions || sessions.length === 0) {
      return; // No activity for this date
    }

    // Calculate daily metrics
    const totalPages = sessions.reduce((sum, s) => sum + (s.pages_covered || 0), 0);
    const totalTime = sessions.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0);
    const avgPageTime = totalPages > 0 ? totalTime / totalPages : 0;
    const avgFocus = sessions.reduce((sum, s) => sum + (s.focus_score || 0.7), 0) / sessions.length;

    // Time distribution
    const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    sessions.forEach(session => {
      const hour = new Date(session.started_at).getHours();
      const duration = session.total_duration_seconds / 60; // Convert to minutes
      
      if (hour >= 6 && hour < 12) timeDistribution.morning += duration;
      else if (hour >= 12 && hour < 18) timeDistribution.afternoon += duration;
      else if (hour >= 18 && hour < 22) timeDistribution.evening += duration;
      else timeDistribution.night += duration;
    });

    // Calculate productivity score
    const speedScore = avgPageTime > 0 ? Math.max(0, 100 - (avgPageTime - 60)) : 50;
    const focusScore = avgFocus * 100;
    const productivityScore = (speedScore + focusScore) / 2;

    // Upsert daily analytics
    await supabase
      .from('reading_analytics')
      .upsert({
        user_id: userId,
        date: date,
        total_pages_read: totalPages,
        total_time_seconds: totalTime,
        average_page_time_seconds: avgPageTime,
        study_sessions_count: sessions.length,
        focus_score_average: avgFocus,
        productivity_score: productivityScore / 100,
        morning_minutes: Math.round(timeDistribution.morning),
        afternoon_minutes: Math.round(timeDistribution.afternoon),
        evening_minutes: Math.round(timeDistribution.evening),
        night_minutes: Math.round(timeDistribution.night)
      });

    console.log(`📊 Updated daily analytics for ${userId} on ${date}`);
  } catch (error) {
    console.error('Update daily analytics error:', error);
  }
}

module.exports = router;