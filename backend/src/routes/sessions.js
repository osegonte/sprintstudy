const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Start a new study session
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const {
      document_id,
      topic_id,
      sprint_id,
      starting_page,
      energy_level = 3,
      session_type = 'reading',
      environment_notes
    } = req.body;

    const userId = req.user.id;

    // Validation
    if (!document_id) {
      return res.status(400).json({ error: 'document_id is required' });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(document_id)) {
      return res.status(400).json({ error: 'Invalid document_id format' });
    }

    if (starting_page && (starting_page < 1 || starting_page > 10000)) {
      return res.status(400).json({ error: 'starting_page must be between 1 and 10000' });
    }

    if (energy_level < 1 || energy_level > 5) {
      return res.status(400).json({ error: 'energy_level must be between 1 and 5' });
    }

    const validSessionTypes = ['reading', 'review', 'practice', 'exam_prep'];
    if (!validSessionTypes.includes(session_type)) {
      return res.status(400).json({ 
        error: 'Invalid session_type',
        valid_types: validSessionTypes
      });
    }

    // Verify document ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, topic_id, total_pages')
      .eq('id', document_id)
      .eq('user_id', userId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Validate starting page against document
    if (starting_page && starting_page > document.total_pages) {
      return res.status(400).json({ 
        error: `starting_page cannot exceed document pages (${document.total_pages})` 
      });
    }

    // Check if user has an active session
    const { data: activeSessions } = await supabase
      .from('study_sessions')
      .select('id, started_at, documents(title)')
      .eq('user_id', userId)
      .is('ended_at', null);

    if (activeSessions && activeSessions.length > 0) {
      return res.status(409).json({ 
        error: 'You have an active session. Please end it before starting a new one.',
        active_session: {
          id: activeSessions[0].id,
          document: activeSessions[0].documents?.title,
          started_at: activeSessions[0].started_at
        }
      });
    }

    // Validate sprint_id if provided
    if (sprint_id) {
      if (!uuidRegex.test(sprint_id)) {
        return res.status(400).json({ error: 'Invalid sprint_id format' });
      }

      const { data: sprint } = await supabase
        .from('sprints')
        .select('id, document_id')
        .eq('id', sprint_id)
        .eq('user_id', userId)
        .single();

      if (!sprint) {
        return res.status(404).json({ error: 'Sprint not found' });
      }

      if (sprint.document_id !== document_id) {
        return res.status(400).json({ error: 'Sprint does not belong to the specified document' });
      }
    }

    // Create new session
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        document_id,
        topic_id: topic_id || document.topic_id,
        sprint_id,
        started_at: new Date().toISOString(),
        starting_page: starting_page || 1,
        energy_level,
        session_type,
        notes: environment_notes?.trim() || null
      })
      .select(`
        *,
        documents (
          title,
          total_pages,
          topics (
            name,
            color
          )
        )
      `)
      .single();

    if (sessionError) {
      console.error('Create session error:', sessionError);
      return res.status(500).json({ error: 'Failed to create study session' });
    }

    res.status(201).json({
      message: 'Study session started successfully! 📚',
      session: session,
      tips: generateSessionTips(session_type, energy_level),
      activity_tracking: {
        focus_reminders: true,
        break_suggestions: true,
        productivity_monitoring: true
      }
    });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update session activity (for real-time tracking)
router.patch('/:id/activity', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tab_switches = 0,
      app_minimized_count = 0,
      inactivity_periods = 0,
      current_page,
      pages_covered = 0,
      focus_events = 0,
      break_time_seconds = 0
    } = req.body;

    const userId = req.user.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    // Validate input ranges
    if (tab_switches < 0 || tab_switches > 10000) {
      return res.status(400).json({ error: 'tab_switches must be between 0 and 10000' });
    }

    if (app_minimized_count < 0 || app_minimized_count > 1000) {
      return res.status(400).json({ error: 'app_minimized_count must be between 0 and 1000' });
    }

    if (pages_covered < 0 || pages_covered > 1000) {
      return res.status(400).json({ error: 'pages_covered must be between 0 and 1000' });
    }

    if (break_time_seconds < 0 || break_time_seconds > 86400) { // Max 24 hours
      return res.status(400).json({ error: 'break_time_seconds must be between 0 and 86400' });
    }

    // Get current session
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .select('started_at, total_duration_seconds, active_reading_seconds, ended_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.ended_at) {
      return res.status(400).json({ error: 'Cannot update activity for ended session' });
    }

    const currentDuration = Math.floor((new Date() - new Date(session.started_at)) / 1000);
    const activeTime = Math.max(0, currentDuration - break_time_seconds);

    // Calculate focus score based on activity
    const focusScore = calculateFocusScore(
      currentDuration,
      tab_switches,
      app_minimized_count,
      inactivity_periods,
      focus_events
    );

    // Update session with activity data
    const { data: updatedSession, error } = await supabase
      .from('study_sessions')
      .update({
        total_duration_seconds: currentDuration,
        active_reading_seconds: activeTime,
        break_time_seconds: break_time_seconds,
        pages_covered: pages_covered,
        ending_page: current_page,
        tab_switches: tab_switches,
        app_minimized_count: app_minimized_count,
        inactivity_periods: inactivity_periods,
        focus_score: Math.round(focusScore * 100) / 100, // Round to 2 decimal places
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update session activity error:', error);
      return res.status(500).json({ error: 'Failed to update session activity' });
    }

    // Generate real-time feedback
    const feedback = generateRealTimeSessionFeedback(updatedSession, focusScore);

    res.json({
      message: 'Session activity updated',
      session: updatedSession,
      focus_score: Math.round(focusScore * 100),
      feedback: feedback,
      recommendations: generateActivityRecommendations(updatedSession)
    });
  } catch (error) {
    console.error('Update session activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Pause session
router.patch('/:id/pause', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'break' } = req.body;

    const userId = req.user.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    const validReasons = ['break', 'interruption', 'bathroom', 'snack', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ 
        error: 'Invalid pause reason',
        valid_reasons: validReasons
      });
    }

    // Get current session
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.ended_at) {
      return res.status(400).json({ error: 'Session is already ended' });
    }

    // Record pause time in session metadata
    let pauseData;
    try {
      pauseData = session.pause_data ? JSON.parse(session.pause_data) : { pauses: [] };
    } catch (e) {
      pauseData = { pauses: [] };
    }

    pauseData.pauses.push({
      timestamp: new Date().toISOString(),
      reason: reason,
      type: 'pause'
    });

    const { error } = await supabase
      .from('study_sessions')
      .update({
        pause_data: JSON.stringify(pauseData),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Pause session error:', error);
      return res.status(500).json({ error: 'Failed to pause session' });
    }

    res.json({
      message: 'Session paused successfully',
      break_suggestions: generateBreakSuggestions(reason, session),
      optimal_break_duration: calculateOptimalBreakDuration(session)
    });
  } catch (error) {
    console.error('Pause session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resume session
router.patch('/:id/resume', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { energy_level } = req.body;

    const userId = req.user.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    if (energy_level && (energy_level < 1 || energy_level > 5)) {
      return res.status(400).json({ error: 'energy_level must be between 1 and 5' });
    }

    // Get current session
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.ended_at) {
      return res.status(400).json({ error: 'Cannot resume ended session' });
    }

    // Record resume time
    let pauseData;
    try {
      pauseData = session.pause_data ? JSON.parse(session.pause_data) : { pauses: [] };
    } catch (e) {
      pauseData = { pauses: [] };
    }

    pauseData.pauses.push({
      timestamp: new Date().toISOString(),
      type: 'resume',
      energy_level: energy_level
    });

    const updateData = {
      pause_data: JSON.stringify(pauseData),
      updated_at: new Date().toISOString()
    };

    if (energy_level) {
      updateData.energy_level = energy_level;
    }

    const { error } = await supabase
      .from('study_sessions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Resume session error:', error);
      return res.status(500).json({ error: 'Failed to resume session' });
    }

    res.json({
      message: 'Session resumed! 🎯',
      refocus_tips: generateRefocusTips(energy_level, session),
      target_duration: calculateRemainingOptimalTime(session)
    });
  } catch (error) {
    console.error('Resume session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End study session
router.patch('/:id/end', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ending_page,
      pages_covered,
      comprehension_rating,
      difficulty_rating,
      completion_status = 'completed',
      notes
    } = req.body;

    const userId = req.user.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    // Validate input ranges
    if (ending_page && (ending_page < 1 || ending_page > 10000)) {
      return res.status(400).json({ error: 'ending_page must be between 1 and 10000' });
    }

    if (pages_covered && (pages_covered < 0 || pages_covered > 1000)) {
      return res.status(400).json({ error: 'pages_covered must be between 0 and 1000' });
    }

    if (comprehension_rating && (comprehension_rating < 1 || comprehension_rating > 5)) {
      return res.status(400).json({ error: 'comprehension_rating must be between 1 and 5' });
    }

    if (difficulty_rating && (difficulty_rating < 1 || difficulty_rating > 5)) {
      return res.status(400).json({ error: 'difficulty_rating must be between 1 and 5' });
    }

    const validCompletionStatuses = ['completed', 'interrupted', 'abandoned'];
    if (!validCompletionStatuses.includes(completion_status)) {
      return res.status(400).json({ 
        error: 'Invalid completion_status',
        valid_statuses: validCompletionStatuses
      });
    }

    // Get current session
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.ended_at) {
      return res.status(400).json({ error: 'Session is already ended' });
    }

    const endTime = new Date().toISOString();
    const totalDuration = Math.floor((new Date(endTime) - new Date(session.started_at)) / 1000);

    // Calculate final metrics
    const finalPages = pages_covered || session.pages_covered || 0;
    const focusStreak = calculateLongestFocusStreak(session);
    
    // Update session
    const { data: completedSession, error: updateError } = await supabase
      .from('study_sessions')
      .update({
        ended_at: endTime,
        total_duration_seconds: totalDuration,
        pages_covered: finalPages,
        ending_page: ending_page || session.ending_page,
        comprehension_rating: comprehension_rating,
        difficulty_rating: difficulty_rating,
        completion_status: completion_status,
        longest_focus_streak_seconds: focusStreak,
        notes: notes?.trim() || session.notes,
        updated_at: endTime
      })
      .eq('id', id)
      .eq('user_id', userId)
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
      .single();

    if (updateError) {
      console.error('End session error:', updateError);
      return res.status(500).json({ error: 'Failed to end session' });
    }

    // Update user stats
    await updateUserStatsFromSession(userId, completedSession);

    // Update daily analytics
    const today = new Date().toISOString().split('T')[0];
    await updateDailyAnalyticsFromSession(userId, today, completedSession);

    // Check for achievements (import the function properly)
    let newAchievements = [];
    try {
      const { checkAndAwardAchievements } = require('./achievements');
      newAchievements = await checkAndAwardAchievements(userId);
    } catch (error) {
      console.error('Achievement check error:', error);
    }

    // Calculate session performance
    const performance = analyzeSessionPerformance(completedSession);

    // Generate session summary
    const summary = generateSessionSummary(completedSession, performance, newAchievements);

    res.json({
      message: 'Study session completed! 🎉',
      session: completedSession,
      performance: performance,
      achievements: newAchievements,
      summary: summary,
      next_recommendations: await generateNextSessionRecommendations(userId, completedSession)
    });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's study sessions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { 
      limit = 20, 
      status = 'all', 
      document_id,
      topic_id,
      date_from,
      date_to,
      offset = 0
    } = req.query;

    const userId = req.user.id;

    // Validate limit and offset
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100); // Max 100 items
    const offsetNum = Math.max(0, parseInt(offset) || 0);

    let query = supabase
      .from('study_sessions')
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
      .eq('user_id', userId);

    // Apply filters
    if (status === 'active') {
      query = query.is('ended_at', null);
    } else if (status === 'completed') {
      query = query.not('ended_at', 'is', null);
    }

    if (document_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(document_id)) {
        return res.status(400).json({ error: 'Invalid document_id format' });
      }
      query = query.eq('document_id', document_id);
    }

    if (topic_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(topic_id)) {
        return res.status(400).json({ error: 'Invalid topic_id format' });
      }
      query = query.eq('topic_id', topic_id);
    }

    if (date_from) {
      const fromDate = new Date(date_from);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date_from format' });
      }
      query = query.gte('started_at', fromDate.toISOString());
    }

    if (date_to) {
      const toDate = new Date(date_to);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date_to format' });
      }
      query = query.lte('started_at', toDate.toISOString());
    }

    query = query
      .order('started_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    const { data: sessions, error, count } = await query;

    if (error) {
      console.error('Fetch sessions error:', error);
      return res.status(500).json({ error: 'Failed to fetch study sessions' });
    }

    // Calculate session statistics
    const stats = calculateSessionStatistics(sessions || []);

    res.json({
      sessions: sessions || [],
      statistics: stats,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: count,
        has_more: count > offsetNum + limitNum
      }
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific session details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    const { data: session, error } = await supabase
      .from('study_sessions')
      .select(`
        *,
        documents (
          title,
          total_pages,
          topics (
            name,
            color,
            icon
          )
        ),
        sprints (
          title,
          start_page,
          end_page
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Session not found' });
      }
      return res.status(500).json({ error: 'Failed to fetch session' });
    }

    // Get related feedback for this session
    const { data: feedback } = await supabase
      .from('reading_feedback')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    // Calculate detailed performance metrics
    const detailedPerformance = analyzeSessionPerformance(session, true);

    res.json({
      session: session,
      feedback: feedback || [],
      performance: detailedPerformance,
      insights: generateSessionInsights(session, feedback)
    });
  } catch (error) {
    console.error('Get session details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================
// HELPER FUNCTIONS
// =====================================

function generateSessionTips(sessionType, energyLevel) {
  const baseTips = {
    reading: [
      "📱 Put your phone in airplane mode or another room",
      "💡 Ensure good lighting to reduce eye strain",
      "🎵 Try instrumental music or white noise if it helps focus"
    ],
    review: [
      "📝 Have a notepad ready for key concepts",
      "🤔 Quiz yourself as you go through the material",
      "🔄 Use active recall techniques"
    ],
    practice: [
      "✏️ Work through problems step-by-step",
      "❌ Don't check answers until completing each section",
      "📊 Keep track of problem types you find challenging"
    ],
    exam_prep: [
      "⏰ Simulate exam conditions",
      "📋 Practice with time constraints",
      "🎯 Focus on weak areas identified in previous sessions"
    ]
  };

  let tips = [...(baseTips[sessionType] || baseTips.reading)];

  // Add energy-level specific tips
  if (energyLevel <= 2) {
    tips.push("☕ Consider a light snack or caffeine if needed");
    tips.push("🚶 Take a 5-minute walk before starting");
  } else if (energyLevel >= 4) {
    tips.push("🎯 Use this high energy for challenging material");
    tips.push("⚡ Consider longer study blocks while energy is high");
  }

  return tips.slice(0, 4);
}

function calculateFocusScore(duration, tabSwitches, minimized, inactivity, focusEvents) {
  if (duration <= 0) return 1.0;

  // Base score starts at 1.0 (perfect focus)
  let score = 1.0;

  // Penalize distractions
  const tabSwitchPenalty = Math.min(0.3, (tabSwitches * 0.05)); // Max 30% penalty
  const minimizedPenalty = Math.min(0.2, (minimized * 0.08)); // Max 20% penalty
  const inactivityPenalty = Math.min(0.25, (inactivity * 0.06)); // Max 25% penalty

  score -= (tabSwitchPenalty + minimizedPenalty + inactivityPenalty);

  // Bonus for sustained focus (based on focus events)
  const focusBonus = Math.min(0.1, (focusEvents * 0.01));
  score += focusBonus;

  // Ensure score is between 0.1 and 1.0
  return Math.max(0.1, Math.min(1.0, score));
}

function generateRealTimeSessionFeedback(session, focusScore) {
  const durationMinutes = Math.round((session.total_duration_seconds || 0) / 60);
  const pagesPerMinute = (session.pages_covered || 0) / (durationMinutes || 1);

  let message = '';
  let type = 'neutral';
  let icon = '📚';

  if (focusScore >= 0.9) {
    type = 'excellent';
    icon = '🎯';
    message = 'Excellent focus! You\'re in the zone!';
  } else if (focusScore >= 0.7) {
    type = 'good';
    icon = '👍';
    message = 'Good concentration. Keep it up!';
  } else if (focusScore >= 0.5) {
    type = 'fair';
    icon = '⚠️';
    message = 'Some distractions detected. Try to refocus.';
  } else {
    type = 'poor';
    icon = '🚨';
    message = 'Many distractions. Consider taking a break or changing environment.';
  }

  // Add pace feedback
  if (pagesPerMinute > 1.5) {
    message += ' Great reading pace!';
  } else if (pagesPerMinute < 0.5 && (session.pages_covered || 0) > 0) {
    message += ' Taking time to understand is good.';
  }

  return {
    type: type,
    icon: icon,
    message: message,
    focus_score: Math.round(focusScore * 100),
    duration_minutes: durationMinutes,
    pages_per_minute: Math.round(pagesPerMinute * 10) / 10
  };
}

function generateActivityRecommendations(session) {
  const recommendations = [];
  const durationMinutes = (session.total_duration_seconds || 0) / 60;
  const focusScore = session.focus_score || 0.7;

  // Duration-based recommendations
  if (durationMinutes >= 45 && !(session.break_time_seconds > 0)) {
    recommendations.push({
      type: 'break',
      message: 'Consider taking a 10-15 minute break to maintain focus',
      priority: 'high'
    });
  }

  // Focus-based recommendations
  if (focusScore < 0.6) {
    recommendations.push({
      type: 'environment',
      message: 'Try changing your study environment or removing distractions',
      priority: 'medium'
    });
  }

  // Activity-based recommendations
  if ((session.tab_switches || 0) > 10) {
    recommendations.push({
      type: 'distraction',
      message: 'Too many tab switches. Consider using a website blocker',
      priority: 'high'
    });
  }

  return recommendations;
}

function generateBreakSuggestions(reason, session) {
  const suggestions = {
    break: [
      "🚶 Take a short walk to refresh your mind",
      "💧 Drink some water and stretch your body",
      "👁️ Look away from the screen and focus on distant objects"
    ],
    interruption: [
      "📝 Jot down where you left off before handling the interruption",
      "🎯 Set a specific time to return to studying",
      "🔄 Do a quick review when you resume"
    ],
    bathroom: [
      "🚶 Take your time, no rush",
      "💧 Drink some water while you're up",
      "🧘 Take a few deep breaths"
    ],
    snack: [
      "🍎 Choose brain-healthy snacks like nuts or fruit",
      "💧 Stay hydrated",
      "⏰ Keep it brief to maintain momentum"
    ],
    other: [
      "🧘 Take a few deep breaths to center yourself",
      "📖 Quickly review what you just learned",
      "⏰ Set a timer for your break duration"
    ]
  };

  return suggestions[reason] || suggestions.break;
}

function calculateOptimalBreakDuration(session) {
  const durationMinutes = (session.total_duration_seconds || 0) / 60;
  const focusScore = session.focus_score || 0.7;

  // Base break duration on session length and focus level
  if (durationMinutes < 30) return 5; // 5-minute break
  if (durationMinutes < 60) return focusScore > 0.7 ? 10 : 15;
  return focusScore > 0.7 ? 15 : 20; // Longer break for longer sessions or poor focus
}

function generateRefocusTips(energyLevel, session) {
  const tips = [
    "🎯 Review your session goals before continuing",
    "📝 Quickly summarize what you learned so far"
  ];

  if (energyLevel && energyLevel <= 2) {
    tips.push("☕ Consider a light energizing snack");
    tips.push("🚶 Do some light stretching or movement");
  }

  if ((session.focus_score || 0.7) < 0.6) {
    tips.push("🔇 Eliminate any remaining distractions");
    tips.push("⏰ Set shorter focus intervals (15-20 minutes)");
  }

  return tips;
}

function calculateRemainingOptimalTime(session) {
  const currentDuration = (session.total_duration_seconds || 0) / 60;
  const optimalTotal = 45; // 45 minutes optimal session
  
  return Math.max(10, optimalTotal - currentDuration);
}

function calculateLongestFocusStreak(session) {
  // This would analyze the pause data to find longest continuous focus period
  // For now, return a simplified calculation
  const totalDuration = session.total_duration_seconds || 0;
  const breakTime = session.break_time_seconds || 0;
  const distractionCount = (session.tab_switches || 0) + (session.app_minimized_count || 0);
  
  if (distractionCount === 0) return totalDuration - breakTime;
  
  // Estimate longest streak based on distractions
  return Math.round((totalDuration - breakTime) / (distractionCount + 1));
}

async function updateUserStatsFromSession(userId, session) {
  try {
    const { data: currentStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!currentStats) return;

    const newTotalPages = currentStats.total_pages_read + (session.pages_covered || 0);
    const newTotalTime = currentStats.total_time_spent_seconds + (session.total_duration_seconds || 0);
    const newAvgSpeed = newTotalPages > 0 ? newTotalTime / newTotalPages : currentStats.average_reading_speed_seconds;
    const newTotalSessions = (currentStats.total_study_sessions || 0) + 1;
    const newAvgSessionDuration = Math.round(newTotalTime / newTotalSessions);

    // Update focus score average
    const currentFocusAvg = currentStats.focus_score_average || 0.7;
    const sessionFocus = session.focus_score || 0.7;
    const newFocusAvg = ((currentFocusAvg * (newTotalSessions - 1)) + sessionFocus) / newTotalSessions;

    await supabase
      .from('user_stats')
      .update({
        total_pages_read: newTotalPages,
        total_time_spent_seconds: newTotalTime,
        average_reading_speed_seconds: newAvgSpeed,
        total_study_sessions: newTotalSessions,
        average_session_duration_seconds: newAvgSessionDuration,
        focus_score_average: newFocusAvg,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

  } catch (error) {
    console.error('Update user stats from session error:', error);
  }
}

async function updateDailyAnalyticsFromSession(userId, date, session) {
  try {
    // Get existing daily analytics
    const { data: existingAnalytics } = await supabase
      .from('reading_analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    const sessionPages = session.pages_covered || 0;
    const sessionTime = session.total_duration_seconds || 0;

    if (existingAnalytics) {
      // Update existing analytics
      await supabase
        .from('reading_analytics')
        .update({
          total_pages_read: existingAnalytics.total_pages_read + sessionPages,
          total_time_seconds: existingAnalytics.total_time_seconds + sessionTime,
          study_sessions_count: existingAnalytics.study_sessions_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('date', date);
    } else {
      // Create new analytics record
      await supabase
        .from('reading_analytics')
        .insert({
          user_id: userId,
          date: date,
          total_pages_read: sessionPages,
          total_time_seconds: sessionTime,
          study_sessions_count: 1
        });
    }
  } catch (error) {
    console.error('Update daily analytics from session error:', error);
  }
}

function analyzeSessionPerformance(session, detailed = false) {
  const duration = session.total_duration_seconds || 0;
  const pages = session.pages_covered || 0;
  const focusScore = session.focus_score || 0.7;
  
  const durationMinutes = Math.round(duration / 60);
  const averageTimePerPage = pages > 0 ? duration / pages : 0;
  const efficiency = pages / (durationMinutes || 1);

  let performanceLevel = 'good';
  if (focusScore >= 0.8 && efficiency >= 1.0) performanceLevel = 'excellent';
  else if (focusScore >= 0.6 && efficiency >= 0.5) performanceLevel = 'good';
  else if (focusScore >= 0.4 || efficiency >= 0.3) performanceLevel = 'fair';
  else performanceLevel = 'needs_improvement';

  const performance = {
    duration_minutes: durationMinutes,
    pages_covered: pages,
    focus_score_percentage: Math.round(focusScore * 100),
    efficiency_pages_per_minute: Math.round(efficiency * 10) / 10,
    average_time_per_page_seconds: Math.round(averageTimePerPage),
    performance_level: performanceLevel,
    break_time_percentage: duration > 0 ? Math.round(((session.break_time_seconds || 0) / duration) * 100) : 0
  };

  if (detailed) {
    performance.detailed_metrics = {
      tab_switches: session.tab_switches || 0,
      app_minimized_count: session.app_minimized_count || 0,
      inactivity_periods: session.inactivity_periods || 0,
      longest_focus_streak_minutes: Math.round((session.longest_focus_streak_seconds || 0) / 60),
      comprehension_rating: session.comprehension_rating,
      difficulty_rating: session.difficulty_rating,
      energy_level: session.energy_level
    };
  }

  return performance;
}

function generateSessionSummary(session, performance, achievements) {
  const summary = {
    duration: `${performance.duration_minutes} minutes`,
    productivity: `${performance.pages_covered} pages covered`,
    focus: `${performance.focus_score_percentage}% focus score`,
    performance_level: performance.performance_level,
    achievements_earned: achievements.length,
    key_insights: []
  };

  // Generate key insights
  if (performance.focus_score_percentage >= 80) {
    summary.key_insights.push('Excellent concentration throughout the session');
  }
  
  if (performance.efficiency_pages_per_minute >= 1.0) {
    summary.key_insights.push('Great reading pace and efficiency');
  }

  if (session.break_time_seconds > 0) {
    summary.key_insights.push('Good use of breaks to maintain energy');
  }

  if (achievements.length > 0) {
    summary.key_insights.push(`Earned ${achievements.length} new achievement${achievements.length > 1 ? 's' : ''}!`);
  }

  return summary;
}

async function generateNextSessionRecommendations(userId, completedSession) {
  // Generate personalized recommendations for the next session
  const recommendations = [
    {
      type: 'continuation',
      title: 'Continue Reading',
      description: `Pick up where you left off in "${completedSession.documents?.title}"`,
      estimated_duration: '30-45 minutes'
    }
  ];

  // Add review recommendation if session was long enough
  if ((completedSession.total_duration_seconds || 0) >= 1200) { // 20+ minutes
    recommendations.push({
      type: 'review',
      title: 'Quick Review',
      description: 'Review the pages you just completed to reinforce learning',
      estimated_duration: '15-20 minutes'
    });
  }

  // Add break recommendation if session was very long
  if ((completedSession.total_duration_seconds || 0) >= 3600) { // 60+ minutes
    recommendations.unshift({
      type: 'break',
      title: 'Take a Break',
      description: 'You\'ve been studying for a while. Take a longer break before your next session.',
      estimated_duration: '30-60 minutes'
    });
  }

  return recommendations;
}

function calculateSessionStatistics(sessions) {
  if (!sessions || sessions.length === 0) {
    return {
      total_sessions: 0,
      completed_sessions: 0,
      total_time_minutes: 0,
      total_pages: 0,
      average_session_duration: 0,
      average_focus_score: 0,
      most_productive_time: null,
      session_completion_rate: 0
    };
  }

  const completedSessions = sessions.filter(s => s.ended_at);
  
  const totalTime = completedSessions.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0);
  const totalPages = completedSessions.reduce((sum, s) => sum + (s.pages_covered || 0), 0);
  const avgFocus = completedSessions.length > 0 
    ? completedSessions.reduce((sum, s) => sum + (s.focus_score || 0.7), 0) / completedSessions.length
    : 0.7;

  // Find most productive hour
  const hourlyStats = {};
  completedSessions.forEach(session => {
    const hour = new Date(session.started_at).getHours();
    if (!hourlyStats[hour]) {
      hourlyStats[hour] = { sessions: 0, totalPages: 0 };
    }
    hourlyStats[hour].sessions += 1;
    hourlyStats[hour].totalPages += session.pages_covered || 0;
  });

  let mostProductiveTime = null;
  let maxProductivity = 0;
  Object.entries(hourlyStats).forEach(([hour, stats]) => {
    const productivity = stats.totalPages / stats.sessions;
    if (productivity > maxProductivity) {
      maxProductivity = productivity;
      mostProductiveTime = `${hour}:00`;
    }
  });

  return {
    total_sessions: sessions.length,
    completed_sessions: completedSessions.length,
    total_time_minutes: Math.round(totalTime / 60),
    total_pages: totalPages,
    average_session_duration: completedSessions.length > 0 ? Math.round(totalTime / completedSessions.length / 60) : 0,
    average_focus_score: Math.round(avgFocus * 100),
    most_productive_time: mostProductiveTime,
    session_completion_rate: sessions.length > 0 ? Math.round((completedSessions.length / sessions.length) * 100) : 0
  };
}

function generateSessionInsights(session, feedback) {
  const insights = [];
  const focusScore = session.focus_score || 0.7;
  const duration = (session.total_duration_seconds || 0) / 60;

  // Focus insights
  if (focusScore >= 0.9) {
    insights.push({
      type: 'focus',
      icon: '🎯',
      message: 'Outstanding focus! You maintained excellent concentration.',
      recommendation: 'This level of focus is perfect for tackling challenging material.'
    });
  } else if (focusScore < 0.5) {
    insights.push({
      type: 'focus',
      icon: '🚨',
      message: 'Focus was below optimal. Consider environmental changes.',
      recommendation: 'Try using website blockers or studying in a quieter location.'
    });
  }

  // Duration insights
  if (duration >= 45 && duration <= 60) {
    insights.push({
      type: 'duration',
      icon: '⏰',
      message: 'Perfect session length for optimal learning and retention.',
      recommendation: 'This duration appears to work well for you - stick with it!'
    });
  } else if (duration > 90) {
    insights.push({
      type: 'duration',
      icon: '⚠️',
      message: 'Very long session. Consider breaking into smaller chunks.',
      recommendation: 'Try 45-60 minute sessions with breaks for better retention.'
    });
  }

  // Performance insights
  const pagesPerMinute = (session.pages_covered || 0) / duration;
  if (pagesPerMinute > 1.5) {
    insights.push({
      type: 'speed',
      icon: '⚡',
      message: 'Fast reading pace! Make sure comprehension is maintained.',
      recommendation: 'Consider occasional self-checks to ensure understanding.'
    });
  }

  // Feedback patterns
  if (feedback && feedback.length > 0) {
    const encouragingFeedback = feedback.filter(f => (f.encouragement_level || 3) >= 4).length;
    const totalFeedback = feedback.length;
    
    if (encouragingFeedback / totalFeedback >= 0.7) {
      insights.push({
        type: 'consistency',
        icon: '📈',
        message: 'Consistent good performance throughout the session.',
        recommendation: 'Your reading rhythm is well-established!'
      });
    }
  }

  return insights;
}

module.exports = router;