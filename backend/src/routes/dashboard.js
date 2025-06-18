// Enhanced dashboard analytics with comprehensive time tracking
// File: backend/src/routes/enhanced-dashboard.js

const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Enhanced dashboard with comprehensive time summaries
router.get('/time-summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`📊 Generating comprehensive time summary for user ${userId}`);

    // Get user reading statistics
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!userStats) {
      return res.status(404).json({ error: 'User statistics not found' });
    }

    // Get all documents with detailed progress
    const { data: documents } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        total_pages,
        difficulty_level,
        estimated_reading_time_minutes,
        topic_id,
        created_at,
        topics (
          id,
          name,
          color,
          icon,
          priority
        ),
        document_pages (
          page_number,
          time_spent_seconds,
          is_completed,
          estimated_time_seconds
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Calculate comprehensive time metrics for each document
    const documentTimeAnalysis = documents.map(doc => {
      const pages = doc.document_pages || [];
      const completedPages = pages.filter(p => p.is_completed);
      const uncompletedPages = pages.filter(p => !p.is_completed);
      
      const timeSpent = completedPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
      
      // Calculate remaining time using multiple methods for accuracy
      let remainingTimeSeconds = 0;
      
      if (uncompletedPages.length > 0) {
        // Method 1: Use estimated times from PDF analysis
        remainingTimeSeconds = uncompletedPages.reduce((sum, page) => {
          const estimatedTime = page.estimated_time_seconds || userStats.average_reading_speed_seconds || 120;
          
          // Adjust for document difficulty
          const difficultyMultiplier = {
            1: 0.8, 2: 0.9, 3: 1.0, 4: 1.2, 5: 1.4
          }[doc.difficulty_level] || 1.0;
          
          return sum + (estimatedTime * difficultyMultiplier);
        }, 0);
        
        // Method 2: Adjust based on user's actual performance on this document
        if (completedPages.length > 0) {
          const actualAvgSpeed = timeSpent / completedPages.length;
          const expectedAvgSpeed = userStats.average_reading_speed_seconds || 120;
          const performanceRatio = actualAvgSpeed / expectedAvgSpeed;
          
          // Blend estimated with actual performance (60% actual, 40% estimated)
          if (performanceRatio > 0.1 && performanceRatio < 5) { // Sanity check
            remainingTimeSeconds = Math.round(remainingTimeSeconds * (0.6 * performanceRatio + 0.4));
          }
        }
      }

      return {
        document_id: doc.id,
        title: doc.title,
        topic: doc.topics,
        difficulty_level: doc.difficulty_level,
        total_pages: doc.total_pages,
        completed_pages: completedPages.length,
        remaining_pages: uncompletedPages.length,
        completion_percentage: Math.round((completedPages.length / doc.total_pages) * 100),
        time_spent_seconds: timeSpent,
        time_spent_formatted: formatDuration(timeSpent),
        remaining_time_seconds: Math.max(0, remainingTimeSeconds),
        remaining_time_formatted: formatDuration(remainingTimeSeconds),
        estimated_total_time: Math.max(timeSpent + remainingTimeSeconds, doc.estimated_reading_time_minutes * 60),
        reading_velocity_pages_per_hour: timeSpent > 0 ? Math.round((completedPages.length / (timeSpent / 3600)) * 10) / 10 : 0,
        priority_score: calculateDocumentPriority(doc, completedPages.length, doc.total_pages),
        created_at: doc.created_at
      };
    });

    // Calculate overall time summary
    const overallSummary = documentTimeAnalysis.reduce((acc, doc) => ({
      total_documents: acc.total_documents + 1,
      total_pages: acc.total_pages + doc.total_pages,
      completed_pages: acc.completed_pages + doc.completed_pages,
      total_time_spent_seconds: acc.total_time_spent_seconds + doc.time_spent_seconds,
      total_remaining_seconds: acc.total_remaining_seconds + doc.remaining_time_seconds,
      total_estimated_time_seconds: acc.total_estimated_time_seconds + doc.estimated_total_time
    }), {
      total_documents: 0,
      total_pages: 0,
      completed_pages: 0,
      total_time_spent_seconds: 0,
      total_remaining_seconds: 0,
      total_estimated_time_seconds: 0
    });

    // Add calculated fields to overall summary
    overallSummary.overall_completion_percentage = overallSummary.total_pages > 0 
      ? Math.round((overallSummary.completed_pages / overallSummary.total_pages) * 100) 
      : 0;
    
    overallSummary.total_time_spent_formatted = formatDuration(overallSummary.total_time_spent_seconds);
    overallSummary.total_remaining_formatted = formatDuration(overallSummary.total_remaining_seconds);
    overallSummary.total_estimated_formatted = formatDuration(overallSummary.total_estimated_time_seconds);

    // Calculate study schedule recommendations
    const studySchedule = await calculateOptimalStudySchedule(userId, overallSummary.total_remaining_seconds);

    // Group documents by topic for organized display
    const documentsByTopic = groupDocumentsByTopic(documentTimeAnalysis);

    // Calculate reading insights and predictions
    const readingInsights = await generateReadingInsights(userId, documentTimeAnalysis, userStats);

    // Get upcoming exam deadlines that affect time planning
    const { data: upcomingExams } = await supabase
      .from('exam_goals')
      .select(`
        id,
        title,
        exam_date,
        topic_id,
        topics (
          name,
          color
        )
      `)
      .eq('user_id', userId)
      .eq('is_completed', false)
      .gte('exam_date', new Date().toISOString().split('T')[0])
      .order('exam_date', { ascending: true })
      .limit(5);

    // Calculate time pressure indicators
    const timePressureAnalysis = calculateTimePressure(upcomingExams, documentsByTopic);

    res.json({
      overall_summary: overallSummary,
      documents: documentTimeAnalysis,
      documents_by_topic: documentsByTopic,
      study_schedule: studySchedule,
      reading_insights: readingInsights,
      upcoming_exams: upcomingExams || [],
      time_pressure_analysis: timePressureAnalysis,
      user_reading_stats: {
        average_speed_seconds_per_page: userStats.average_reading_speed_seconds,
        average_speed_formatted: formatDuration(userStats.average_reading_speed_seconds),
        total_study_time_formatted: formatDuration(userStats.total_time_spent_seconds),
        reading_streak_days: userStats.current_streak_days,
        total_pages_read: userStats.total_pages_read,
        focus_score_average: Math.round((userStats.focus_score_average || 0.7) * 100)
      }
    });
  } catch (error) {
    console.error('Enhanced dashboard time summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get time breakdown by topic
router.get('/time-by-topic', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: topicTimeBreakdown } = await supabase
      .from('topics')
      .select(`
        id,
        name,
        color,
        icon,
        priority,
        target_completion_date,
        documents (
          id,
          title,
          total_pages,
          document_pages (
            time_spent_seconds,
            is_completed,
            estimated_time_seconds
          )
        )
      `)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('priority', { ascending: true });

    const topicAnalysis = topicTimeBreakdown.map(topic => {
      const allPages = topic.documents.flatMap(doc => doc.document_pages || []);
      const completedPages = allPages.filter(p => p.is_completed);
      const uncompletedPages = allPages.filter(p => !p.is_completed);
      
      const timeSpent = completedPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
      const estimatedRemaining = uncompletedPages.reduce((sum, p) => sum + (p.estimated_time_seconds || 120), 0);
      
      const totalPages = allPages.length;
      const completedCount = completedPages.length;

      // Calculate urgency based on target date
      let urgencyLevel = 'low';
      let daysUntilTarget = null;
      
      if (topic.target_completion_date) {
        daysUntilTarget = Math.ceil((new Date(topic.target_completion_date) - new Date()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilTarget <= 0) urgencyLevel = 'overdue';
        else if (daysUntilTarget <= 3) urgencyLevel = 'critical';
        else if (daysUntilTarget <= 7) urgencyLevel = 'high';
        else if (daysUntilTarget <= 14) urgencyLevel = 'medium';
      }

      return {
        topic_id: topic.id,
        topic_name: topic.name,
        color: topic.color,
        icon: topic.icon,
        priority: topic.priority,
        total_documents: topic.documents.length,
        total_pages: totalPages,
        completed_pages: completedCount,
        completion_percentage: totalPages > 0 ? Math.round((completedCount / totalPages) * 100) : 0,
        time_spent_seconds: timeSpent,
        time_spent_formatted: formatDuration(timeSpent),
        estimated_remaining_seconds: estimatedRemaining,
        estimated_remaining_formatted: formatDuration(estimatedRemaining),
        target_completion_date: topic.target_completion_date,
        days_until_target: daysUntilTarget,
        urgency_level: urgencyLevel,
        recommended_daily_time: daysUntilTarget > 0 ? Math.ceil(estimatedRemaining / (daysUntilTarget * 3600)) : 0 // hours per day
      };
    });

    // Sort by urgency and priority
    topicAnalysis.sort((a, b) => {
      const urgencyOrder = { overdue: 5, critical: 4, high: 3, medium: 2, low: 1 };
      const urgencyDiff = urgencyOrder[b.urgency_level] - urgencyOrder[a.urgency_level];
      
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.priority - b.priority; // Lower priority number = higher priority
    });

    res.json({
      topics: topicAnalysis,
      summary: {
        total_topics: topicAnalysis.length,
        overdue_topics: topicAnalysis.filter(t => t.urgency_level === 'overdue').length,
        critical_topics: topicAnalysis.filter(t => t.urgency_level === 'critical').length,
        total_time_remaining: topicAnalysis.reduce((sum, t) => sum + t.estimated_remaining_seconds, 0),
        average_completion: Math.round(topicAnalysis.reduce((sum, t) => sum + t.completion_percentage, 0) / topicAnalysis.length)
      }
    });
  } catch (error) {
    console.error('Time by topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reading velocity trends over time
router.get('/velocity-trends', authMiddleware, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
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
    const { data: dailyAnalytics } = await supabase
      .from('reading_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('date', dateFilter.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Get study sessions for detailed velocity calculation
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select(`
        started_at,
        total_duration_seconds,
        pages_covered,
        focus_score
      `)
      .eq('user_id', userId)
      .gte('started_at', dateFilter.toISOString())
      .order('started_at', { ascending: true });

    // Calculate velocity trends
    const velocityTrends = calculateVelocityTrends(dailyAnalytics, sessions);

    // Calculate reading efficiency trends
    const efficiencyTrends = calculateEfficiencyTrends(sessions);

    // Generate predictive insights
    const predictions = generateVelocityPredictions(velocityTrends);

    res.json({
      velocity_trends: velocityTrends,
      efficiency_trends: efficiencyTrends,
      predictions: predictions,
      period: period,
      summary: {
        average_pages_per_hour: velocityTrends.length > 0 
          ? Math.round(velocityTrends.reduce((sum, v) => sum + v.pages_per_hour, 0) / velocityTrends.length * 10) / 10 
          : 0,
        trend_direction: predictions.trend_direction,
        improvement_rate: predictions.improvement_rate
      }
    });
  } catch (error) {
    console.error('Velocity trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get time optimization recommendations
router.get('/optimization-recommendations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Analyze user's reading patterns
    const readingPatterns = await analyzeReadingPatterns(userId);
    
    // Generate personalized recommendations
    const recommendations = generateTimeOptimizationRecommendations(readingPatterns);

    res.json({
      recommendations: recommendations,
      reading_patterns: readingPatterns,
      optimization_potential: calculateOptimizationPotential(readingPatterns)
    });
  } catch (error) {
    console.error('Optimization recommendations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================
// HELPER FUNCTIONS
// =====================================

function formatDuration(seconds) {
  if (seconds <= 0) return '0m';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function calculateDocumentPriority(document, completedPages, totalPages) {
  let score = 0;
  
  // Base priority from document settings
  score += (6 - (document.topics?.priority || 3)) * 2; // Higher priority = higher score
  
  // Boost recently started documents
  if (completedPages > 0 && completedPages < totalPages * 0.2) {
    score += 3; // Recently started boost
  }
  
  // Boost nearly completed documents
  if (completedPages > totalPages * 0.8) {
    score += 4; // Nearly done boost
  }
  
  // Difficulty factor
  score += (document.difficulty_level || 3) * 0.5;
  
  return Math.round(score);
}

function groupDocumentsByTopic(documents) {
  const grouped = documents.reduce((acc, doc) => {
    const topicName = doc.topic?.name || 'Uncategorized';
    const topicId = doc.topic?.id || 'uncategorized';
    
    if (!acc[topicId]) {
      acc[topicId] = {
        topic_info: doc.topic || { name: 'Uncategorized', color: '#gray', icon: '📄' },
        documents: [],
        totals: {
          total_pages: 0,
          completed_pages: 0,
          time_spent_seconds: 0,
          remaining_time_seconds: 0
        }
      };
    }
    
    acc[topicId].documents.push(doc);
    acc[topicId].totals.total_pages += doc.total_pages;
    acc[topicId].totals.completed_pages += doc.completed_pages;
    acc[topicId].totals.time_spent_seconds += doc.time_spent_seconds;
    acc[topicId].totals.remaining_time_seconds += doc.remaining_time_seconds;
    
    return acc;
  }, {});

  // Calculate completion percentages for each topic
  Object.values(grouped).forEach(topic => {
    topic.totals.completion_percentage = topic.totals.total_pages > 0 
      ? Math.round((topic.totals.completed_pages / topic.totals.total_pages) * 100) 
      : 0;
    topic.totals.time_spent_formatted = formatDuration(topic.totals.time_spent_seconds);
    topic.totals.remaining_time_formatted = formatDuration(topic.totals.remaining_time_seconds);
  });

  return grouped;
}

async function calculateOptimalStudySchedule(userId, totalRemainingSeconds) {
  try {
    // Get user's study patterns
    const { data: recentSessions } = await supabase
      .from('study_sessions')
      .select('total_duration_seconds, started_at, focus_score')
      .eq('user_id', userId)
      .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false });

    // Calculate user's optimal session length and daily capacity
    let optimalSessionMinutes = 45; // Default
    let dailyCapacityMinutes = 60; // Default 1 hour

    if (recentSessions && recentSessions.length > 0) {
      const avgSessionMinutes = recentSessions.reduce((sum, s) => sum + (s.total_duration_seconds / 60), 0) / recentSessions.length;
      optimalSessionMinutes = Math.min(60, Math.max(20, avgSessionMinutes));

      // Calculate daily capacity based on recent activity
      const dailyMinutes = recentSessions.reduce((sum, s) => sum + (s.total_duration_seconds / 60), 0);
      const uniqueDays = new Set(recentSessions.map(s => s.started_at.split('T')[0])).size;
      dailyCapacityMinutes = uniqueDays > 0 ? dailyMinutes / uniqueDays : 60;
    }

    const totalRemainingMinutes = totalRemainingSeconds / 60;
    const sessionsNeeded = Math.ceil(totalRemainingMinutes / optimalSessionMinutes);
    const daysNeeded = Math.ceil(totalRemainingMinutes / dailyCapacityMinutes);

    return {
      optimal_session_length_minutes: Math.round(optimalSessionMinutes),
      daily_study_capacity_minutes: Math.round(dailyCapacityMinutes),
      sessions_needed: sessionsNeeded,
      estimated_days_to_completion: daysNeeded,
      recommended_sessions_per_day: Math.ceil(sessionsNeeded / Math.max(1, daysNeeded)),
      target_completion_date: new Date(Date.now() + daysNeeded * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      schedule_feasibility: daysNeeded <= 30 ? 'achievable' : daysNeeded <= 60 ? 'challenging' : 'ambitious'
    };
  } catch (error) {
    console.error('Error calculating study schedule:', error);
    return {
      optimal_session_length_minutes: 45,
      daily_study_capacity_minutes: 60,
      sessions_needed: Math.ceil(totalRemainingSeconds / (45 * 60)),
      estimated_days_to_completion: Math.ceil(totalRemainingSeconds / 3600),
      schedule_feasibility: 'estimated'
    };
  }
}

async function generateReadingInsights(userId, documents, userStats) {
  const insights = [];

  // Overall progress insight
  const totalCompletion = documents.reduce((sum, d) => sum + d.completion_percentage, 0) / documents.length;
  if (totalCompletion >= 80) {
    insights.push({
      type: 'progress',
      icon: '🎯',
      message: `Excellent progress! You're ${Math.round(totalCompletion)}% through your reading goals.`,
      priority: 'high'
    });
  } else if (totalCompletion >= 50) {
    insights.push({
      type: 'progress',
      icon: '📈',
      message: `Good momentum! You're halfway through your reading materials.`,
      priority: 'medium'
    });
  }

  // Reading speed insight
  const avgSpeed = userStats.average_reading_speed_seconds;
  if (avgSpeed < 90) {
    insights.push({
      type: 'speed',
      icon: '⚡',
      message: 'You\'re a fast reader! Consider tackling more challenging material.',
      priority: 'medium'
    });
  } else if (avgSpeed > 180) {
    insights.push({
      type: 'speed',
      icon: '🐌',
      message: 'You take time to understand deeply. Consider active reading techniques to boost speed while maintaining comprehension.',
      priority: 'low'
    });
  }

  // Time management insight
  const totalRemaining = documents.reduce((sum, d) => sum + d.remaining_time_seconds, 0);
  const totalHours = totalRemaining / 3600;
  
  if (totalHours > 100) {
    insights.push({
      type: 'time_management',
      icon: '⏰',
      message: `You have ${Math.round(totalHours)} hours of reading ahead. Consider prioritizing by difficulty and deadlines.`,
      priority: 'high'
    });
  }

  // Document variety insight
  const difficulties = documents.map(d => d.difficulty_level);
  const avgDifficulty = difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length;
  
  if (avgDifficulty > 4) {
    insights.push({
      type: 'difficulty',
      icon: '🧠',
      message: 'You\'re tackling challenging material! Remember to take breaks and use active learning strategies.',
      priority: 'medium'
    });
  }

  return insights;
}

function calculateTimePressure(upcomingExams, documentsByTopic) {
  if (!upcomingExams || upcomingExams.length === 0) {
    return { pressure_level: 'low', urgent_topics: [], recommendations: [] };
  }

  const urgentTopics = [];
  let maxPressure = 0;

  upcomingExams.forEach(exam => {
    const daysUntilExam = Math.ceil((new Date(exam.exam_date) - new Date()) / (1000 * 60 * 60 * 24));
    const topicData = documentsByTopic[exam.topic_id];
    
    if (topicData && daysUntilExam > 0) {
      const remainingHours = topicData.totals.remaining_time_seconds / 3600;
      const hoursPerDay = remainingHours / daysUntilExam;
      
      let pressureLevel = 'low';
      if (hoursPerDay > 6) pressureLevel = 'critical';
      else if (hoursPerDay > 4) pressureLevel = 'high';
      else if (hoursPerDay > 2) pressureLevel = 'medium';
      
      urgentTopics.push({
        exam: exam,
        topic_data: topicData,
        days_until_exam: daysUntilExam,
        remaining_hours: Math.round(remainingHours),
        required_hours_per_day: Math.round(hoursPerDay * 10) / 10,
        pressure_level: pressureLevel
      });
      
      maxPressure = Math.max(maxPressure, hoursPerDay);
    }
  });

  const overallPressure = maxPressure > 6 ? 'critical' : 
                         maxPressure > 4 ? 'high' : 
                         maxPressure > 2 ? 'medium' : 'low';

  const recommendations = [];
  if (overallPressure === 'critical') {
    recommendations.push('Consider extending exam dates if possible');
    recommendations.push('Focus only on essential material');
    recommendations.push('Increase daily study time significantly');
  } else if (overallPressure === 'high') {
    recommendations.push('Prioritize high-yield material');
    recommendations.push('Consider longer study sessions');
    recommendations.push('Minimize distractions');
  }

  return {
    pressure_level: overallPressure,
    urgent_topics: urgentTopics.sort((a, b) => a.days_until_exam - b.days_until_exam),
    recommendations: recommendations
  };
}

function calculateVelocityTrends(dailyAnalytics, sessions) {
  // Group sessions by date and calculate daily velocity
  const dailyVelocity = {};
  
  sessions.forEach(session => {
    const date = session.started_at.split('T')[0];
    if (!dailyVelocity[date]) {
      dailyVelocity[date] = {
        date,
        total_pages: 0,
        total_time_hours: 0,
        pages_per_hour: 0
      };
    }
    
    dailyVelocity[date].total_pages += session.pages_covered || 0;
    dailyVelocity[date].total_time_hours += (session.total_duration_seconds || 0) / 3600;
  });
  
  // Calculate pages per hour for each day
  Object.values(dailyVelocity).forEach(day => {
    day.pages_per_hour = day.total_time_hours > 0 ? day.total_pages / day.total_time_hours : 0;
  });
  
  return Object.values(dailyVelocity).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function calculateEfficiencyTrends(sessions) {
  return sessions.map(session => ({
    date: session.started_at.split('T')[0],
    efficiency_score: Math.round(((session.pages_covered || 0) / ((session.total_duration_seconds || 1) / 3600)) * (session.focus_score || 0.7) * 100) / 100,
    focus_score: session.focus_score || 0.7,
    pages_covered: session.pages_covered || 0,
    duration_hours: (session.total_duration_seconds || 0) / 3600
  }));
}

function generateVelocityPredictions(velocityTrends) {
  if (velocityTrends.length < 3) {
    return {
      trend_direction: 'insufficient_data',
      improvement_rate: 0,
      predicted_velocity: 0
    };
  }
  
  const recent = velocityTrends.slice(-7); // Last 7 days
  const earlier = velocityTrends.slice(-14, -7); // Previous 7 days
  
  const recentAvg = recent.reduce((sum, day) => sum + day.pages_per_hour, 0) / recent.length;
  const earlierAvg = earlier.length > 0 ? earlier.reduce((sum, day) => sum + day.pages_per_hour, 0) / earlier.length : recentAvg;
  
  const improvementRate = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;
  
  return {
    trend_direction: improvementRate > 5 ? 'improving' : improvementRate < -5 ? 'declining' : 'stable',
    improvement_rate: Math.round(improvementRate * 10) / 10,
    predicted_velocity: Math.round(recentAvg * 10) / 10
  };
}

async function analyzeReadingPatterns(userId) {
  try {
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false });

    if (!sessions || sessions.length === 0) {
      return { sufficient_data: false };
    }

    // Analyze time-of-day patterns
    const hourlyPerformance = {};
    sessions.forEach(session => {
      const hour = new Date(session.started_at).getHours();
      if (!hourlyPerformance[hour]) {
        hourlyPerformance[hour] = { sessions: 0, totalPages: 0, totalFocus: 0 };
      }
      hourlyPerformance[hour].sessions += 1;
      hourlyPerformance[hour].totalPages += session.pages_covered || 0;
      hourlyPerformance[hour].totalFocus += session.focus_score || 0.7;
    });

    // Find peak performance hours
    const peakHour = Object.entries(hourlyPerformance)
      .filter(([hour, data]) => data.sessions >= 2)
      .sort(([,a], [,b]) => (b.totalPages / b.sessions) - (a.totalPages / a.sessions))[0];

    return {
      sufficient_data: true,
      total_sessions: sessions.length,
      average_session_length: sessions.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0) / sessions.length / 60,
      peak_performance_hour: peakHour ? parseInt(peakHour[0]) : null,
      average_focus_score: sessions.reduce((sum, s) => sum + (s.focus_score || 0.7), 0) / sessions.length,
      session_consistency: sessions.length / 30 // sessions per day over last 30 days
    };
  } catch (error) {
    console.error('Error analyzing reading patterns:', error);
    return { sufficient_data: false };
  }
}

function generateTimeOptimizationRecommendations(patterns) {
  const recommendations = [];

  if (!patterns.sufficient_data) {
    recommendations.push({
      type: 'data_collection',
      priority: 'high',
      title: 'Build Your Reading Profile',
      description: 'Complete more study sessions to get personalized time optimization recommendations.',
      action: 'Continue studying regularly for better insights'
    });
    return recommendations;
  }

  // Session length optimization
  if (patterns.average_session_length < 25) {
    recommendations.push({
      type: 'session_length',
      priority: 'medium',
      title: 'Extend Your Study Sessions',
      description: `Your average session is ${Math.round(patterns.average_session_length)} minutes. Research shows 25-45 minute sessions optimize retention.`,
      action: 'Try aiming for 30-minute focused sessions'
    });
  } else if (patterns.average_session_length > 90) {
    recommendations.push({
      type: 'session_length',
      priority: 'medium',
      title: 'Break Up Long Sessions',
      description: 'Very long sessions can lead to fatigue and reduced comprehension.',
      action: 'Try 45-60 minute sessions with 10-15 minute breaks'
    });
  }

  // Peak hour optimization
  if (patterns.peak_performance_hour !== null) {
    recommendations.push({
      type: 'timing',
      priority: 'high',
      title: 'Optimize Your Study Schedule',
      description: `You perform best around ${patterns.peak_performance_hour}:00. Schedule important reading during this time.`,
      action: `Plan challenging material for ${patterns.peak_performance_hour}:00`
    });
  }

  // Focus improvement
  if (patterns.average_focus_score < 0.7) {
    recommendations.push({
      type: 'focus',
      priority: 'high',
      title: 'Improve Focus Quality',
      description: 'Your focus score suggests room for improvement in concentration.',
      action: 'Try eliminating distractions and using the Pomodoro technique'
    });
  }

  // Consistency improvement
  if (patterns.session_consistency < 0.5) {
    recommendations.push({
      type: 'consistency',
      priority: 'medium',
      title: 'Build Reading Consistency',
      description: 'Regular daily reading, even in short bursts, is more effective than sporadic long sessions.',
      action: 'Aim for at least 20 minutes of reading daily'
    });
  }

  // Advanced recommendations based on patterns
  if (patterns.average_focus_score > 0.8 && patterns.average_session_length > 30) {
    recommendations.push({
      type: 'advanced',
      priority: 'low',
      title: 'Consider Intensive Reading Blocks',
      description: 'Your high focus and good session length suggest you could handle longer, intensive reading periods.',
      action: 'Try 90-120 minute deep reading sessions for complex material'
    });
  }

  return recommendations;
}

function calculateOptimizationPotential(patterns) {
  if (!patterns.sufficient_data) {
    return {
      overall_score: 0,
      areas_for_improvement: ['Insufficient data']
    };
  }

  let score = 50; // Base score
  const improvements = [];

  // Session length scoring
  if (patterns.average_session_length >= 25 && patterns.average_session_length <= 60) {
    score += 15;
  } else {
    improvements.push('Session length optimization');
  }

  // Focus scoring
  if (patterns.average_focus_score >= 0.8) {
    score += 20;
  } else if (patterns.average_focus_score >= 0.7) {
    score += 10;
  } else {
    improvements.push('Focus improvement');
  }

  // Consistency scoring
  if (patterns.session_consistency >= 0.8) {
    score += 15;
  } else if (patterns.session_consistency >= 0.5) {
    score += 8;
  } else {
    improvements.push('Study consistency');
  }

  // Peak hour utilization (if we have the data)
  if (patterns.peak_performance_hour !== null) {
    score += 10; // Bonus for having identifiable peak hours
  }

  return {
    overall_score: Math.min(100, score),
    potential_rating: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'needs_improvement',
    areas_for_improvement: improvements
  };
}

module.exports = router;