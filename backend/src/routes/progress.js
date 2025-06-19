// Enhanced progress tracking routes to replace/extend existing ones
// File: backend/src/routes/enhanced-progress.js

const express = require('express');
const { supabase } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Enhanced page completion with real-time time tracking
router.post('/page/complete', authMiddleware, async (req, res) => {
  try {
    const { 
      document_id, 
      page_number, 
      time_spent_seconds,
      comprehension_rating,
      difficulty_rating,
      notes,
      focus_events = 0,
      interruptions = 0
    } = req.body;
    
    const userId = req.user.id;

    if (!document_id || !page_number || time_spent_seconds === undefined) {
      return res.status(400).json({ 
        error: 'document_id, page_number, and time_spent_seconds are required' 
      });
    }

    console.log(`📚 Enhanced page completion: User ${userId}, Doc ${document_id}, Page ${page_number}, Time ${time_spent_seconds}s`);

    // Update page with enhanced data
    const { data: updatedPage, error: updateError } = await supabase
      .from('document_pages')
      .update({
        time_spent_seconds: time_spent_seconds,
        is_completed: true,
        last_read_at: new Date().toISOString(),
        difficulty_rating: difficulty_rating || null,
        comprehension_rating: comprehension_rating || null,
        notes: notes?.trim() || null,
        focus_events: focus_events,
        pause_count: interruptions,
        updated_at: new Date().toISOString()
      })
      .eq('document_id', document_id)
      .eq('page_number', page_number)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Update page error:', updateError);
      return res.status(500).json({ error: 'Failed to update page progress' });
    }

    // Update user stats with new page
    await updateUserStatsFromPage(userId, time_spent_seconds);

    // Get updated document progress
    const documentProgress = await getDocumentProgress(userId, document_id);

    // Calculate remaining time estimates
    const remainingTimeEstimate = await calculateDocumentRemainingTime(userId, document_id);

    // Generate performance feedback
    const performanceFeedback = await generateEnhancedPerformanceFeedback(
      userId, 
      document_id, 
      page_number, 
      time_spent_seconds,
      comprehension_rating,
      focus_events,
      interruptions
    );

    // Check if this completes the document
    const isDocumentComplete = documentProgress.completion_percentage === 100;
    if (isDocumentComplete) {
      await handleDocumentCompletion(userId, document_id);
    }

    res.json({
      message: 'Page completed successfully with enhanced tracking! 📖',
      page_summary: {
        page_number: parseInt(page_number),
        time_spent_seconds: time_spent_seconds,
        comprehension_rating: comprehension_rating,
        difficulty_rating: difficulty_rating,
        focus_events: focus_events,
        interruptions: interruptions,
        reading_speed_wpm: calculateWordsPerMinute(time_spent_seconds)
      },
      document_progress: {
        ...documentProgress,
        document_complete: isDocumentComplete,
        ...remainingTimeEstimate
      },
      performance_feedback: performanceFeedback,
      next_recommendations: generateNextPageRecommendations(
        parseInt(page_number), 
        documentProgress.total_pages, 
        performanceFeedback,
        time_spent_seconds
      )
    });
  } catch (error) {
    console.error('Enhanced page completion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comprehensive progress for a document including time estimates
router.get('/document/:id/comprehensive', authMiddleware, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    // Get document with all page data
    const { data: document, error: docError } = await supabase
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
        )
      `)
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get all page progress with detailed metrics
    const { data: pages, error: pagesError } = await supabase
      .from('document_pages')
      .select('*')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .order('page_number');

    if (pagesError) {
      console.error('Fetch pages error:', pagesError);
      return res.status(500).json({ error: 'Failed to fetch page progress' });
    }

    // Get PDF content analysis for better estimates
    const { data: contentAnalysis } = await supabase
      .from('pdf_content_analysis')
      .select('*')
      .eq('document_id', documentId)
      .order('page_number');

    // Calculate comprehensive metrics
    const comprehensiveProgress = calculateComprehensiveProgress(document, pages, contentAnalysis);

    // Get reading velocity trends for this document
    const velocityTrends = calculateDocumentVelocityTrends(pages);

    // Generate reading strategy recommendations
    const readingStrategy = generateReadingStrategy(document, pages, contentAnalysis);

    res.json({
      document: {
        ...document,
        comprehensive_progress: comprehensiveProgress,
        velocity_trends: velocityTrends,
        reading_strategy: readingStrategy
      },
      pages: pages || [],
      content_analysis: contentAnalysis || [],
      insights: generateDocumentInsights(comprehensiveProgress, velocityTrends)
    });
  } catch (error) {
    console.error('Get comprehensive progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Real-time reading session tracking
router.post('/session/start', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number, session_type = 'reading' } = req.body;
    const userId = req.user.id;

    // Create session tracking record
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sessionData = {
      session_id: sessionId,
      user_id: userId,
      document_id: document_id,
      page_number: parseInt(page_number),
      session_type: session_type,
      started_at: new Date().toISOString(),
      is_active: true
    };

    // Get expected reading time for this page
    const { data: pageAnalysis } = await supabase
      .from('pdf_content_analysis')
      .select('estimated_reading_seconds, difficulty_level, word_count')
      .eq('document_id', document_id)
      .eq('page_number', page_number)
      .single();

    const expectedTime = pageAnalysis?.estimated_reading_seconds || 120;

    res.json({
      message: 'Reading session started with enhanced tracking',
      session_id: sessionId,
      session_data: sessionData,
      page_context: {
        expected_reading_time_seconds: expectedTime,
        difficulty_level: pageAnalysis?.difficulty_level || 3,
        word_count: pageAnalysis?.word_count || 250,
        estimated_wpm: pageAnalysis?.word_count ? Math.round((pageAnalysis.word_count * 60) / expectedTime) : 150
      },
      tracking_tips: generateSessionTrackingTips(session_type, pageAnalysis?.difficulty_level)
    });
  } catch (error) {
    console.error('Start reading session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update session with real-time metrics
router.post('/session/update', authMiddleware, async (req, res) => {
  try {
    const { 
      session_id,
      current_time_seconds,
      focus_level = 1.0,
      scroll_events = 0,
      tab_switches = 0,
      estimated_completion_percentage = 0
    } = req.body;

    const userId = req.user.id;

    // Generate real-time feedback
    const realTimeFeedback = await generateRealTimeSessionFeedback(
      userId,
      session_id,
      current_time_seconds,
      focus_level,
      scroll_events,
      tab_switches
    );

    res.json({
      message: 'Session updated',
      current_time_seconds: current_time_seconds,
      real_time_feedback: realTimeFeedback,
      session_metrics: {
        focus_level: focus_level,
        scroll_events: scroll_events,
        tab_switches: tab_switches,
        estimated_completion: estimated_completion_percentage
      },
      recommendations: generateRealTimeRecommendations(realTimeFeedback, current_time_seconds)
    });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's comprehensive reading statistics
router.get('/stats/comprehensive', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get enhanced user stats
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get reading analytics for trends
    const { data: readingAnalytics } = await supabase
      .from('reading_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    // Calculate advanced metrics
    const advancedMetrics = await calculateAdvancedUserMetrics(userId, userStats, readingAnalytics);

    // Generate personalized insights
    const personalizedInsights = generatePersonalizedReadingInsights(userStats, advancedMetrics);

    res.json({
      basic_stats: userStats || {
        total_pages_read: 0,
        total_time_spent_seconds: 0,
        average_reading_speed_seconds: 0,
        current_streak_days: 0
      },
      advanced_metrics: advancedMetrics,
      reading_trends: readingAnalytics || [],
      personalized_insights: personalizedInsights,
      performance_summary: generatePerformanceSummary(userStats, advancedMetrics)
    });
  } catch (error) {
    console.error('Get comprehensive stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================
// HELPER FUNCTIONS
// =====================================

async function updateUserStatsFromPage(userId, timeSeconds) {
  try {
    const { data: currentStats } = await supabase
      .from('user_stats')
      .select('total_pages_read, total_time_spent_seconds, average_reading_speed_seconds')
      .eq('user_id', userId)
      .single();

    if (currentStats) {
      const newTotalPages = currentStats.total_pages_read + 1;
      const newTotalTime = currentStats.total_time_spent_seconds + timeSeconds;
      const newAvgSpeed = newTotalTime / newTotalPages;

      await supabase
        .from('user_stats')
        .update({
          total_pages_read: newTotalPages,
          total_time_spent_seconds: newTotalTime,
          average_reading_speed_seconds: newAvgSpeed,
          last_activity_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      console.log(`📊 Enhanced stats update: ${newTotalPages} pages, ${Math.round(newAvgSpeed)}s avg speed`);
    }
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
}

async function getDocumentProgress(userId, documentId) {
  const { data: pages } = await supabase
    .from('document_pages')
    .select('is_completed, time_spent_seconds')
    .eq('document_id', documentId)
    .eq('user_id', userId);

  if (!pages) return { total_pages: 0, completed_pages: 0, completion_percentage: 0 };

  const totalPages = pages.length;
  const completedPages = pages.filter(p => p.is_completed).length;
  const totalTimeSpent = pages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);

  return {
    total_pages: totalPages,
    completed_pages: completedPages,
    completion_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0,
    total_time_spent_seconds: totalTimeSpent,
    average_time_per_page: completedPages > 0 ? Math.round(totalTimeSpent / completedPages) : 0
  };
}

async function calculateDocumentRemainingTime(userId, documentId) {
  try {
    // Get document info
    const { data: document } = await supabase
      .from('documents')
      .select('total_pages, difficulty_level')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (!document) return { remaining_time_seconds: 0 };

    // Get page progress
    const { data: pages } = await supabase
      .from('document_pages')
      .select('is_completed, estimated_time_seconds')
      .eq('document_id', documentId)
      .eq('user_id', userId);

    // Get user average speed
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('average_reading_speed_seconds')
      .eq('user_id', userId)
      .single();

    const userAvgSpeed = userStats?.average_reading_speed_seconds || 120;
    const uncompletedPages = pages?.filter(p => !p.is_completed) || [];

    let remainingTimeSeconds = 0;
    
    if (uncompletedPages.length > 0) {
      remainingTimeSeconds = uncompletedPages.reduce((sum, page) => {
        const estimatedTime = page.estimated_time_seconds || userAvgSpeed;
        
        // Adjust for document difficulty
        const difficultyMultiplier = {
          1: 0.8, 2: 0.9, 3: 1.0, 4: 1.2, 5: 1.4
        }[document.difficulty_level] || 1.0;
        
        return sum + (estimatedTime * difficultyMultiplier);
      }, 0);
    }

    return {
      remaining_time_seconds: remainingTimeSeconds,
      remaining_time_formatted: formatDuration(remainingTimeSeconds),
      remaining_pages: uncompletedPages.length
    };
  } catch (error) {
    console.error('Error calculating remaining time:', error);
    return { remaining_time_seconds: 0, remaining_time_formatted: '0m', remaining_pages: 0 };
  }
}

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

function calculateWordsPerMinute(timeSeconds) {
  const assumedWordsPerPage = 250;
  const minutes = timeSeconds / 60;
  return minutes > 0 ? Math.round(assumedWordsPerPage / minutes) : 0;
}

async function generateEnhancedPerformanceFeedback(userId, documentId, pageNumber, actualTime, comprehension, focusEvents, interruptions) {
  // Get expected time for this page
  const { data: userStats } = await supabase
    .from('user_stats')
    .select('average_reading_speed_seconds')
    .eq('user_id', userId)
    .single();

  const expectedTime = userStats?.average_reading_speed_seconds || 120;
  const timeDifference = actualTime - expectedTime;
  const speedRatio = expectedTime > 0 ? actualTime / expectedTime : 1;

  let feedback = {
    overall_rating: 'good',
    speed_feedback: '',
    comprehension_feedback: '',
    focus_feedback: '',
    improvements: [],
    strengths: []
  };

  // Speed analysis
  if (speedRatio < 0.8) {
    feedback.speed_feedback = `Excellent speed! You read ${Math.round((1 - speedRatio) * 100)}% faster than your average.`;
    feedback.overall_rating = 'excellent';
    feedback.strengths.push('Fast reading pace');
  } else if (speedRatio < 1.2) {
    feedback.speed_feedback = 'Good pace! You\'re reading at your optimal speed.';
    feedback.strengths.push('Consistent reading pace');
  } else if (speedRatio < 1.5) {
    feedback.speed_feedback = 'Taking time to understand - that\'s good for retention.';
    feedback.improvements.push('Consider active reading techniques to maintain pace');
  } else {
    feedback.speed_feedback = 'Slower pace detected. This might be challenging material.';
    feedback.overall_rating = 'needs_improvement';
    feedback.improvements.push('Try skimming first, then detailed reading');
  }

  // Comprehension analysis
  if (comprehension >= 4) {
    feedback.comprehension_feedback = 'Excellent comprehension! You understand the material very well.';
    feedback.strengths.push('High comprehension');
  } else if (comprehension >= 3) {
    feedback.comprehension_feedback = 'Good understanding. You\'re grasping the key concepts.';
    feedback.strengths.push('Good comprehension');
  } else if (comprehension >= 2) {
    feedback.comprehension_feedback = 'Moderate understanding. Consider re-reading or taking notes.';
    feedback.improvements.push('Try summarizing key points after reading');
  } else {
    feedback.comprehension_feedback = 'Low comprehension detected. This material may need more attention.';
    feedback.overall_rating = 'needs_improvement';
    feedback.improvements.push('Consider breaking this into smaller sections');
    feedback.improvements.push('Try active reading techniques like questioning and note-taking');
  }

  // Focus analysis
  if (interruptions === 0 && focusEvents > 5) {
    feedback.focus_feedback = 'Excellent focus! You maintained attention throughout.';
    feedback.strengths.push('Great focus and attention');
  } else if (interruptions <= 2) {
    feedback.focus_feedback = 'Good focus with minimal distractions.';
    feedback.strengths.push('Good concentration');
  } else if (interruptions <= 5) {
    feedback.focus_feedback = 'Some distractions detected. Try to minimize interruptions.';
    feedback.improvements.push('Create a distraction-free environment');
  } else {
    feedback.focus_feedback = 'Many interruptions detected. Focus improvement needed.';
    feedback.improvements.push('Use website blockers or study in a quieter location');
    if (feedback.overall_rating === 'good') feedback.overall_rating = 'needs_improvement';
  }

  return feedback;
}

function generateNextPageRecommendations(currentPage, totalPages, performanceFeedback, timeSpent) {
  const recommendations = [];

  if (currentPage < totalPages) {
    const nextPage = currentPage + 1;
    let estimatedTime = '2-3 minutes';
    
    // Adjust estimate based on current performance
    if (performanceFeedback.overall_rating === 'excellent') {
      estimatedTime = '1-2 minutes';
    } else if (performanceFeedback.overall_rating === 'needs_improvement') {
      estimatedTime = '3-5 minutes';
    }

    recommendations.push({
      action: 'continue_reading',
      message: `Continue to page ${nextPage}`,
      estimated_time: estimatedTime,
      priority: 'high'
    });
  }

  // Break recommendations based on performance and time spent
  if (timeSpent > 300) { // 5+ minutes
    recommendations.push({
      action: 'take_break',
      message: 'Consider a 5-10 minute break to maintain focus',
      estimated_time: '5-10 minutes',
      priority: 'medium'
    });
  }

  // Review recommendations
  if (performanceFeedback.overall_rating === 'needs_improvement' || 
      (performanceFeedback.comprehension_feedback && performanceFeedback.comprehension_feedback.includes('Low'))) {
    recommendations.push({
      action: 'review_page',
      message: 'Review this page to improve comprehension',
      estimated_time: '2-3 minutes',
      priority: 'high'
    });
  }

  // Section completion recommendations
  if (currentPage % 5 === 0 && currentPage < totalPages) {
    recommendations.push({
      action: 'review_section',
      message: 'Quick review of the last 5 pages',
      estimated_time: '3-5 minutes',
      priority: 'low'
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

async function handleDocumentCompletion(userId, documentId) {
  try {
    // Award completion XP and update streak
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('total_xp_points, current_level, current_streak_days, total_documents')
      .eq('user_id', userId)
      .single();

    if (userStats) {
      const completionXP = 100; // Bonus XP for completing a document
      const newTotalXP = userStats.total_xp_points + completionXP;
      const newLevel = Math.floor(Math.sqrt(newTotalXP / 100)) + 1;
      const newTotalDocuments = userStats.total_documents + 1;

      await supabase
        .from('user_stats')
        .update({
          total_xp_points: newTotalXP,
          current_level: newLevel,
          total_documents: newTotalDocuments,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      console.log(`🎉 Document completion: +${completionXP} XP, Level ${newLevel}`);
    }
  } catch (error) {
    console.error('Error handling document completion:', error);
  }
}

function calculateComprehensiveProgress(document, pages, contentAnalysis) {
  const totalPages = document.total_pages;
  const completedPages = pages?.filter(p => p.is_completed) || [];
  const uncompletedPages = pages?.filter(p => !p.is_completed) || [];

  // Basic metrics
  const completionPercentage = totalPages > 0 ? Math.round((completedPages.length / totalPages) * 100) : 0;
  const timeSpent = completedPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);

  // Advanced metrics
  const averageComprehension = completedPages.length > 0 
    ? completedPages
        .filter(p => p.comprehension_rating)
        .reduce((sum, p) => sum + p.comprehension_rating, 0) / completedPages.filter(p => p.comprehension_rating).length
    : null;

  const averageDifficulty = completedPages.length > 0 
    ? completedPages
        .filter(p => p.difficulty_rating)
        .reduce((sum, p) => sum + p.difficulty_rating, 0) / completedPages.filter(p => p.difficulty_rating).length
    : null;

  // Calculate reading velocity trends
  const velocityTrend = calculateReadingVelocityTrend(completedPages);

  // Estimate remaining time using content analysis
  let remainingTimeSeconds = 0;
  if (contentAnalysis && uncompletedPages.length > 0) {
    remainingTimeSeconds = uncompletedPages.reduce((sum, page) => {
      const analysis = contentAnalysis.find(a => a.page_number === page.page_number);
      return sum + (analysis?.estimated_reading_seconds || 120);
    }, 0);
  } else {
    remainingTimeSeconds = uncompletedPages.length * 120; // Default 2 min per page
  }

  return {
    completion_percentage: completionPercentage,
    completed_pages: completedPages.length,
    remaining_pages: uncompletedPages.length,
    total_time_spent_seconds: timeSpent,
    remaining_time_seconds: remainingTimeSeconds,
    remaining_time_formatted: formatDuration(remainingTimeSeconds),
    average_comprehension: averageComprehension ? Math.round(averageComprehension * 10) / 10 : null,
    average_difficulty: averageDifficulty ? Math.round(averageDifficulty * 10) / 10 : null,
    reading_velocity_trend: velocityTrend,
    estimated_completion_date: calculateCompletionDate(remainingTimeSeconds)
  };
}

function calculateDocumentVelocityTrends(pages) {
  const completedPages = pages?.filter(p => p.is_completed && p.last_read_at && p.time_spent_seconds) || [];
  
  if (completedPages.length < 3) {
    return { trend: 'insufficient_data', data_points: completedPages.length };
  }

  // Sort by completion date
  completedPages.sort((a, b) => new Date(a.last_read_at) - new Date(b.last_read_at));

  // Calculate velocity for each page (pages per hour equivalent)
  const velocityData = completedPages.map((page, index) => ({
    page_number: page.page_number,
    time_spent: page.time_spent_seconds,
    velocity: 3600 / page.time_spent_seconds, // pages per hour
    completion_date: page.last_read_at
  }));

  // Calculate trend (simple linear regression)
  const n = velocityData.length;
  const sumX = velocityData.reduce((sum, _, i) => sum + i, 0);
  const sumY = velocityData.reduce((sum, d) => sum + d.velocity, 0);
  const sumXY = velocityData.reduce((sum, d, i) => sum + (i * d.velocity), 0);
  const sumXX = velocityData.reduce((sum, _, i) => sum + (i * i), 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  return {
    trend: slope > 0.1 ? 'improving' : slope < -0.1 ? 'declining' : 'stable',
    slope: Math.round(slope * 1000) / 1000,
    data_points: n,
    latest_velocity: Math.round(velocityData[velocityData.length - 1].velocity * 10) / 10,
    average_velocity: Math.round((sumY / n) * 10) / 10
  };
}

function generateReadingStrategy(document, pages, contentAnalysis) {
  const strategy = {
    recommended_approach: 'sequential',
    session_length: 30,
    break_frequency: 25,
    focus_areas: [],
    tips: []
  };

  // Analyze document characteristics
  const avgDifficulty = document.difficulty_level || 3;
  const completedPages = pages?.filter(p => p.is_completed) || [];
  const avgTimePerPage = completedPages.length > 0 
    ? completedPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0) / completedPages.length
    : 120;

  // Adjust strategy based on difficulty
  if (avgDifficulty >= 4) {
    strategy.session_length = 25;
    strategy.break_frequency = 20;
    strategy.tips.push('Break complex concepts into smaller chunks');
    strategy.tips.push('Take notes while reading to improve retention');
  } else if (avgDifficulty <= 2) {
    strategy.session_length = 45;
    strategy.break_frequency = 30;
    strategy.tips.push('You can handle longer sessions with this material');
  }

  // Adjust based on actual reading speed
  if (avgTimePerPage > 300) { // 5+ minutes per page
    strategy.session_length = Math.min(strategy.session_length, 20);
    strategy.tips.push('Consider skimming first, then detailed reading');
    strategy.tips.push('Focus on key concepts and main ideas');
  } else if (avgTimePerPage < 60) { // Less than 1 minute per page
    strategy.tips.push('Great speed! Ensure you\'re retaining information');
    strategy.tips.push('Consider occasional comprehension checks');
  }

  // Content-based recommendations
  if (contentAnalysis) {
    const hasEquations = contentAnalysis.some(a => a.has_equations);
    const hasCode = contentAnalysis.some(a => a.has_code);
    const avgWordCount = contentAnalysis.reduce((sum, a) => sum + (a.word_count || 0), 0) / contentAnalysis.length;

    if (hasEquations) {
      strategy.focus_areas.push('Mathematical content');
      strategy.tips.push('Have paper ready for working through equations');
    }

    if (hasCode) {
      strategy.focus_areas.push('Code examples');
      strategy.tips.push('Consider having a code editor open to test examples');
    }

    if (avgWordCount > 400) {
      strategy.tips.push('Dense text detected - take your time');
    }
  }

  return strategy;
}

function generateDocumentInsights(comprehensiveProgress, velocityTrends) {
  const insights = [];

  // Progress insights
  if (comprehensiveProgress.completion_percentage >= 80) {
    insights.push({
      type: 'progress',
      icon: '🎯',
      message: 'Almost done! You\'re in the final stretch.',
      priority: 'high'
    });
  } else if (comprehensiveProgress.completion_percentage >= 50) {
    insights.push({
      type: 'progress',
      icon: '📈',
      message: 'Great progress! You\'re halfway through.',
      priority: 'medium'
    });
  }

  // Velocity insights
  if (velocityTrends.trend === 'improving') {
    insights.push({
      type: 'velocity',
      icon: '⚡',
      message: 'Your reading speed is improving! Keep up the momentum.',
      priority: 'medium'
    });
  } else if (velocityTrends.trend === 'declining') {
    insights.push({
      type: 'velocity',
      icon: '⚠️',
      message: 'Reading speed is slowing down. Consider shorter sessions or breaks.',
      priority: 'high'
    });
  }

  // Comprehension insights
  if (comprehensiveProgress.average_comprehension >= 4) {
    insights.push({
      type: 'comprehension',
      icon: '🧠',
      message: 'Excellent comprehension! You\'re understanding the material very well.',
      priority: 'low'
    });
  } else if (comprehensiveProgress.average_comprehension < 3) {
    insights.push({
      type: 'comprehension',
      icon: '📝',
      message: 'Consider taking more notes or reviewing difficult sections.',
      priority: 'high'
    });
  }

  return insights;
}

function generateSessionTrackingTips(sessionType, difficultyLevel) {
  const tips = [];

  // Base tips for all sessions
  tips.push('📱 Put your phone in airplane mode or another room');
  tips.push('💡 Ensure good lighting to reduce eye strain');

  // Session type specific tips
  if (sessionType === 'reading') {
    tips.push('📖 Have a notebook ready for key concepts');
    tips.push('🎵 Try instrumental music if it helps focus');
  } else if (sessionType === 'review') {
    tips.push('📝 Test yourself on key concepts');
    tips.push('🔄 Summarize each section in your own words');
  }

  // Difficulty-based tips
  if (difficultyLevel >= 4) {
    tips.push('🧠 Break complex concepts into smaller parts');
    tips.push('⏰ Consider shorter 20-25 minute sessions');
  } else if (difficultyLevel <= 2) {
    tips.push('⚡ You can handle longer sessions with this material');
    tips.push('🎯 Focus on maintaining good pace');
  }

  return tips.slice(0, 4); // Return top 4 tips
}

async function generateRealTimeSessionFeedback(userId, sessionId, currentTime, focusLevel, scrollEvents, tabSwitches) {
  // Get user's average reading speed for context
  const { data: userStats } = await supabase
    .from('user_stats')
    .select('average_reading_speed_seconds')
    .eq('user_id', userId)
    .single();

  const expectedTime = userStats?.average_reading_speed_seconds || 120;
  const progressRatio = currentTime / expectedTime;

  let feedback = {
    pace_status: 'on_track',
    focus_status: 'good',
    overall_status: 'good',
    message: '',
    suggestions: []
  };

  // Pace analysis
  if (progressRatio < 0.8) {
    feedback.pace_status = 'fast';
    feedback.message = 'Great pace! You\'re reading efficiently.';
  } else if (progressRatio > 1.3) {
    feedback.pace_status = 'slow';
    feedback.message = 'Take your time to understand the content.';
    feedback.suggestions.push('Consider taking notes if the material is complex');
  } else {
    feedback.pace_status = 'on_track';
    feedback.message = 'Good reading pace!';
  }

  // Focus analysis
  if (focusLevel < 0.7 || tabSwitches > 3) {
    feedback.focus_status = 'distracted';
    feedback.overall_status = 'needs_attention';
    feedback.suggestions.push('Try to minimize distractions');
    feedback.suggestions.push('Consider using a website blocker');
  } else if (focusLevel > 0.9 && tabSwitches === 0) {
    feedback.focus_status = 'excellent';
    feedback.message += ' Excellent focus!';
  }

  // Time-based suggestions
  if (currentTime > 300) { // 5+ minutes
    feedback.suggestions.push('Consider taking a short break soon');
  }

  return feedback;
}

function generateRealTimeRecommendations(feedback, currentTime) {
  const recommendations = [];

  if (feedback.focus_status === 'distracted') {
    recommendations.push({
      type: 'focus',
      message: 'Try to refocus on the content',
      urgency: 'high'
    });
  }

  if (feedback.pace_status === 'slow' && currentTime > 180) {
    recommendations.push({
      type: 'pace',
      message: 'Consider active reading techniques',
      urgency: 'medium'
    });
  }

  if (currentTime > 600) { // 10+ minutes
    recommendations.push({
      type: 'break',
      message: 'Time for a short break',
      urgency: 'high'
    });
  }

  return recommendations;
}

function calculateReadingVelocityTrend(completedPages) {
  if (completedPages.length < 3) return 'insufficient_data';

  const velocities = completedPages
    .filter(p => p.time_spent_seconds > 0)
    .map(p => 3600 / p.time_spent_seconds); // pages per hour

  if (velocities.length < 3) return 'insufficient_data';

  const recent = velocities.slice(-3);
  const earlier = velocities.slice(0, -3);

  if (earlier.length === 0) return 'stable';

  const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
  const earlierAvg = earlier.reduce((sum, v) => sum + v, 0) / earlier.length;

  const improvementRatio = recentAvg / earlierAvg;

  if (improvementRatio > 1.1) return 'improving';
  if (improvementRatio < 0.9) return 'declining';
  return 'stable';
}

function calculateCompletionDate(remainingSeconds) {
  const dailyStudyTime = 3600; // Assume 1 hour per day
  const daysNeeded = Math.ceil(remainingSeconds / dailyStudyTime);
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + daysNeeded);
  return completionDate.toISOString().split('T')[0];
}

async function calculateAdvancedUserMetrics(userId, userStats, readingAnalytics) {
  // Calculate reading consistency
  const activeDays = readingAnalytics?.filter(day => day.total_pages_read > 0).length || 0;
  const totalDays = readingAnalytics?.length || 1;
  const consistency = Math.round((activeDays / totalDays) * 100);

  // Calculate velocity trends
  const velocityTrend = readingAnalytics?.length > 7 
    ? calculateOverallVelocityTrend(readingAnalytics)
    : 'insufficient_data';

  // Calculate peak performance metrics
  const peakMetrics = calculatePeakPerformanceMetrics(readingAnalytics);

  return {
    reading_consistency_percentage: consistency,
    velocity_trend: velocityTrend,
    peak_performance: peakMetrics,
    advanced_stats: {
      pages_per_day_average: activeDays > 0 
        ? Math.round((readingAnalytics?.reduce((sum, day) => sum + day.total_pages_read, 0) || 0) / activeDays)
        : 0,
      study_sessions_per_day: activeDays > 0
        ? Math.round((readingAnalytics?.reduce((sum, day) => sum + day.study_sessions_count, 0) || 0) / activeDays)
        : 0,
      focus_score_trend: calculateFocusTrend(readingAnalytics)
    }
  };
}

function generatePersonalizedReadingInsights(userStats, advancedMetrics) {
  const insights = [];

  // Consistency insights
  if (advancedMetrics.reading_consistency_percentage >= 80) {
    insights.push({
      type: 'consistency',
      icon: '🔥',
      message: 'Outstanding consistency! You\'re building a strong reading habit.',
      impact: 'high'
    });
  } else if (advancedMetrics.reading_consistency_percentage < 50) {
    insights.push({
      type: 'consistency',
      icon: '⚠️',
      message: 'Try to read more consistently. Even 15 minutes daily makes a big difference.',
      impact: 'high'
    });
  }

  // Speed insights
  const avgSpeed = userStats?.average_reading_speed_seconds || 120;
  if (avgSpeed < 90) {
    insights.push({
      type: 'speed',
      icon: '⚡',
      message: 'You\'re a naturally fast reader! Consider tackling more challenging material.',
      impact: 'medium'
    });
  } else if (avgSpeed > 180) {
    insights.push({
      type: 'speed',
      icon: '🎯',
      message: 'You take time to understand deeply. Consider speed reading techniques to boost efficiency.',
      impact: 'medium'
    });
  }

  // Progress insights
  if (userStats?.current_streak_days >= 7) {
    insights.push({
      type: 'streak',
      icon: '🏆',
      message: `Amazing ${userStats.current_streak_days}-day streak! Consistency is your superpower.`,
      impact: 'high'
    });
  }

  return insights;
}

function generatePerformanceSummary(userStats, advancedMetrics) {
  return {
    overall_rating: calculateOverallRating(userStats, advancedMetrics),
    strengths: identifyStrengths(userStats, advancedMetrics),
    improvement_areas: identifyImprovementAreas(userStats, advancedMetrics),
    next_milestones: calculateNextMilestones(userStats)
  };
}

function calculateOverallRating(userStats, advancedMetrics) {
  let score = 0;
  
  // Consistency scoring (0-40 points)
  score += Math.min(40, advancedMetrics.reading_consistency_percentage * 0.4);
  
  // Speed scoring (0-30 points)
  const avgSpeed = userStats?.average_reading_speed_seconds || 120;
  if (avgSpeed < 60) score += 30;
  else if (avgSpeed < 120) score += 25;
  else if (avgSpeed < 180) score += 20;
  else score += 15;
  
  // Streak scoring (0-30 points)
  const streak = userStats?.current_streak_days || 0;
  score += Math.min(30, streak * 2);

  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'fair';
  return 'needs_improvement';
}

function identifyStrengths(userStats, advancedMetrics) {
  const strengths = [];
  
  if (advancedMetrics.reading_consistency_percentage >= 70) {
    strengths.push('Consistent reading habit');
  }
  
  if ((userStats?.average_reading_speed_seconds || 120) < 90) {
    strengths.push('Fast reading speed');
  }
  
  if ((userStats?.current_streak_days || 0) >= 7) {
    strengths.push('Strong daily routine');
  }
  
  if (advancedMetrics.advanced_stats.focus_score_trend === 'improving') {
    strengths.push('Improving focus quality');
  }

  return strengths;
}

function identifyImprovementAreas(userStats, advancedMetrics) {
  const areas = [];
  
  if (advancedMetrics.reading_consistency_percentage < 50) {
    areas.push('Reading consistency');
  }
  
  if ((userStats?.average_reading_speed_seconds || 120) > 200) {
    areas.push('Reading speed');
  }
  
  if ((userStats?.current_streak_days || 0) < 3) {
    areas.push('Daily habit formation');
  }

  return areas;
}

function calculateNextMilestones(userStats) {
  const milestones = [];
  
  const pagesRead = userStats?.total_pages_read || 0;
  const nextPageMilestone = Math.ceil((pagesRead + 1) / 100) * 100;
  milestones.push(`Read ${nextPageMilestone} pages`);
  
  const currentStreak = userStats?.current_streak_days || 0;
  const nextStreakMilestone = currentStreak >= 30 ? 60 : currentStreak >= 7 ? 30 : 7;
  milestones.push(`Reach ${nextStreakMilestone}-day streak`);
  
  return milestones;
}

function calculateOverallVelocityTrend(analytics) {
  if (analytics.length < 7) return 'insufficient_data';
  
  const recent = analytics.slice(-7);
  const earlier = analytics.slice(-14, -7);
  
  if (earlier.length === 0) return 'stable';
  
  const recentAvg = recent.reduce((sum, day) => sum + day.total_pages_read, 0) / recent.length;
  const earlierAvg = earlier.reduce((sum, day) => sum + day.total_pages_read, 0) / earlier.length;
  
  const ratio = recentAvg / (earlierAvg || 1);
  
  if (ratio > 1.2) return 'improving';
  if (ratio < 0.8) return 'declining';
  return 'stable';
}

function calculatePeakPerformanceMetrics(analytics) {
  if (!analytics || analytics.length === 0) {
    return { best_day: null, average_daily_pages: 0 };
  }
  
  const bestDay = analytics.reduce((best, day) => 
    day.total_pages_read > (best?.total_pages_read || 0) ? day : best
  );
  
  const averageDailyPages = analytics.reduce((sum, day) => sum + day.total_pages_read, 0) / analytics.length;
  
  return {
    best_day: {
      date: bestDay.date,
      pages_read: bestDay.total_pages_read
    },
    average_daily_pages: Math.round(averageDailyPages * 10) / 10
  };
}

function calculateFocusTrend(analytics) {
  if (!analytics || analytics.length < 5) return 'insufficient_data';
  
  const recent = analytics.slice(-5);
  const earlier = analytics.slice(-10, -5);
  
  if (earlier.length === 0) return 'stable';
  
  const recentAvg = recent.reduce((sum, day) => sum + (day.focus_score_average || 0.7), 0) / recent.length;
  const earlierAvg = earlier.reduce((sum, day) => sum + (day.focus_score_average || 0.7), 0) / earlier.length;
  
  const ratio = recentAvg / earlierAvg;
  
  if (ratio > 1.1) return 'improving';
  if (ratio < 0.9) return 'declining';
  return 'stable';
}

module.exports = router;