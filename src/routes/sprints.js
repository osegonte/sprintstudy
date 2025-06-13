const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Enhanced sprint generation with intelligent scheduling
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { 
      document_id, 
      topic_id, 
      exam_goal_id,
      preferred_duration_minutes = 30,
      difficulty_preference = 'adaptive', // easy, medium, hard, adaptive
      session_type = 'reading' // reading, review, practice
    } = req.body;

    const userId = req.user.id;

    console.log(`🎯 Generating intelligent sprint for user ${userId}`);

    // Get user stats and preferences
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    const avgSpeed = userStats?.average_reading_speed_seconds || 120;
    const preferredDuration = userStats?.preferred_session_duration_minutes || preferred_duration_minutes;
    const currentLevel = userStats?.current_level || 1;

    // Determine target document(s)
    let targetDocuments = [];
    
    if (document_id) {
      // Specific document requested
      const { data: document } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          total_pages,
          difficulty_level,
          topic_id,
          document_pages (
            page_number,
            is_completed,
            time_spent_seconds,
            difficulty_rating
          )
        `)
        .eq('id', document_id)
        .eq('user_id', userId)
        .single();

      if (document) targetDocuments = [document];
    } else if (topic_id) {
      // Topic-based selection
      const { data: documents } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          total_pages,
          difficulty_level,
          priority,
          document_pages (
            page_number,
            is_completed,
            time_spent_seconds,
            difficulty_rating
          )
        `)
        .eq('topic_id', topic_id)
        .eq('user_id', userId)
        .order('priority', { ascending: true });

      targetDocuments = documents || [];
    } else if (exam_goal_id) {
      // Exam-focused selection
      const { data: examGoal } = await supabase
        .from('exam_goals')
        .select('topic_id, exam_date, difficulty_level')
        .eq('id', exam_goal_id)
        .eq('user_id', userId)
        .single();

      if (examGoal && examGoal.topic_id) {
        const { data: documents } = await supabase
          .from('documents')
          .select(`
            id,
            title,
            total_pages,
            difficulty_level,
            priority,
            document_pages (
              page_number,
              is_completed,
              time_spent_seconds,
              difficulty_rating
            )
          `)
          .eq('topic_id', examGoal.topic_id)
          .eq('user_id', userId)
          .order('priority', { ascending: true });

        targetDocuments = documents || [];
      }
    } else {
      // Smart selection based on user activity
      const { data: documents } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          total_pages,
          difficulty_level,
          priority,
          updated_at,
          document_pages (
            page_number,
            is_completed,
            time_spent_seconds,
            last_read_at,
            difficulty_rating
          )
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5);

      targetDocuments = documents || [];
    }

    if (targetDocuments.length === 0) {
      return res.status(400).json({ error: 'No suitable documents found for sprint generation' });
    }

    // Intelligent page selection algorithm
    const sprintSuggestions = generateIntelligentSprints(
      targetDocuments, 
      userStats, 
      preferredDuration, 
      difficulty_preference,
      session_type
    );

    if (sprintSuggestions.length === 0) {
      return res.status(400).json({ error: 'No suitable pages found for sprint' });
    }

    // Select best sprint based on user context
    const recommendedSprint = selectOptimalSprint(sprintSuggestions, userStats);

    res.json({ 
      sprint_suggestions: sprintSuggestions,
      recommended_sprint: recommendedSprint,
      user_context: {
        current_level: currentLevel,
        average_speed_seconds: avgSpeed,
        preferred_duration_minutes: preferredDuration,
        peak_performance_hour: userStats?.peak_performance_hour
      }
    });
  } catch (error) {
    console.error('Generate intelligent sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create sprint from suggestion
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      document_id,
      topic_id,
      exam_goal_id,
      title,
      start_page, 
      end_page, 
      estimated_time_seconds,
      target_date,
      target_start_time,
      target_end_time,
      difficulty_level = 3,
      sprint_type = 'reading',
      auto_generated = true
    } = req.body;
    
    const userId = req.user.id;

    if (!document_id || !start_page || !end_page) {
      return res.status(400).json({ 
        error: 'document_id, start_page, and end_page are required' 
      });
    }

    // Validate document ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, topic_id')
      .eq('id', document_id)
      .eq('user_id', userId)
      .single();

    if (docError || !document) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Generate intelligent title if not provided
    const sprintTitle = title || generateSprintTitle(document.title, start_page, end_page, sprint_type);

    const { data, error } = await supabase
      .from('sprints')
      .insert({
        user_id: userId,
        document_id,
        topic_id: topic_id || document.topic_id,
        exam_goal_id,
        title: sprintTitle,
        start_page: parseInt(start_page),
        end_page: parseInt(end_page),
        estimated_time_seconds: estimated_time_seconds || calculateEstimatedTime(start_page, end_page, userId),
        target_date: target_date || new Date().toISOString().split('T')[0],
        target_start_time,
        target_end_time,
        difficulty_level,
        sprint_type,
        auto_generated,
        status: 'pending'
      })
      .select(`
        *,
        documents (
          title,
          total_pages,
          difficulty_level
        ),
        topics (
          name,
          color,
          icon
        )
      `)
      .single();

    if (error) {
      console.error('Create sprint error:', error);
      return res.status(500).json({ error: 'Failed to create sprint' });
    }

    res.status(201).json({ 
      message: 'Sprint created successfully',
      sprint: data 
    });
  } catch (error) {
    console.error('Create sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start sprint with enhanced tracking
router.patch('/:id/start', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { energy_level, environment_notes } = req.body;

    // Update sprint status
    const { data: sprint, error: sprintError } = await supabase
      .from('sprints')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('*')
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
        sprint_id: sprint.id,
        topic_id: sprint.topic_id,
        started_at: new Date().toISOString(),
        starting_page: sprint.start_page,
        session_type: sprint.sprint_type,
        energy_level: energy_level,
        notes: environment_notes
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Create session error:', sessionError);
    }

    res.json({ 
      message: 'Sprint started successfully! 🚀',
      sprint: sprint,
      session: session,
      tracking_tips: generateTrackingTips(sprint.sprint_type)
    });
  } catch (error) {
    console.error('Start sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete sprint with performance analysis
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      actual_time_seconds,
      pages_actually_completed,
      completion_quality,
      comprehension_rating,
      difficulty_rating,
      notes
    } = req.body;

    const userId = req.user.id;

    // Get sprint details
    const { data: sprint, error: sprintError } = await supabase
      .from('sprints')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (sprintError || !sprint) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    // Update sprint completion
    const { data: completedSprint, error: updateError } = await supabase
      .from('sprints')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        actual_time_seconds: actual_time_seconds,
        pages_actually_completed: pages_actually_completed || (sprint.end_page - sprint.start_page + 1),
        completion_quality: completion_quality,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Complete sprint error:', updateError);
      return res.status(500).json({ error: 'Failed to complete sprint' });
    }

    // Update associated study session
    const { error: sessionUpdateError } = await supabase
      .from('study_sessions')
      .update({
        ended_at: new Date().toISOString(),
        total_duration_seconds: actual_time_seconds,
        active_reading_seconds: actual_time_seconds, // Will be enhanced with activity tracking
        pages_covered: pages_actually_completed || (sprint.end_page - sprint.start_page + 1),
        ending_page: sprint.start_page + (pages_actually_completed || (sprint.end_page - sprint.start_page + 1)) - 1,
        comprehension_rating: comprehension_rating,
        difficulty_rating: difficulty_rating,
        completion_status: 'completed',
        notes: notes
      })
      .eq('sprint_id', id)
      .eq('user_id', userId);

    if (sessionUpdateError) {
      console.error('Update session error:', sessionUpdateError);
    }

    // Calculate performance metrics
    const performanceAnalysis = calculatePerformanceMetrics(sprint, completedSprint);

    // Update user stats
    await updateUserStatsFromSprint(userId, completedSprint, performanceAnalysis);

    // Check for achievements
    const newAchievements = await checkSprintAchievements(userId, completedSprint);

    // Generate celebration message
    const celebration = generateCelebrationMessage(performanceAnalysis, newAchievements);

    res.json({ 
      message: 'Sprint completed successfully! 🎉',
      sprint: completedSprint,
      performance: performanceAnalysis,
      achievements: newAchievements,
      celebration: celebration,
      next_suggestions: await generateNextSprintSuggestions(userId, completedSprint)
    });
  } catch (error) {
    console.error('Complete sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sprint analytics and insights
router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const userId = req.user.id;

    let dateFilter = new Date();
    switch (timeframe) {
      case '7d':
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case '30d':
        dateFilter.setDate(dateFilter.getDate() - 30);
        break;
      case '90d':
        dateFilter.setDate(dateFilter.getDate() - 90);
        break;
      default:
        dateFilter.setDate(dateFilter.getDate() - 30);
    }

    // Get sprint data
    const { data: sprints, error } = await supabase
      .from('sprints')
      .select(`
        *,
        documents (
          title,
          topic_id,
          topics (
            name,
            color
          )
        )
      `)
      .eq('user_id', userId)
      .gte('created_at', dateFilter.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch sprint analytics error:', error);
      return res.status(500).json({ error: 'Failed to fetch sprint analytics' });
    }

    // Calculate analytics
    const analytics = calculateSprintAnalytics(sprints);

    res.json({ 
      analytics: analytics,
      timeframe: timeframe,
      total_sprints: sprints.length
    });
  } catch (error) {
    console.error('Get sprint analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================
// HELPER FUNCTIONS
// =====================================

function generateIntelligentSprints(documents, userStats, preferredDuration, difficultyPreference, sessionType) {
  const suggestions = [];
  const avgSpeed = userStats?.average_reading_speed_seconds || 120;
  const targetPages = Math.floor((preferredDuration * 60) / avgSpeed);

  documents.forEach(doc => {
    // Find next unread pages
    const unreadPages = doc.document_pages
      .filter(p => !p.is_completed)
      .sort((a, b) => a.page_number - b.page_number);

    if (unreadPages.length === 0) return;

    // Different sprint strategies
    const strategies = [];

    // 1. Sequential Reading Strategy
    const startPage = unreadPages[0].page_number;
    const endPage = Math.min(startPage + targetPages - 1, doc.total_pages);
    
    strategies.push({
      strategy: 'sequential',
      document_id: doc.id,
      document_title: doc.title,
      start_page: startPage,
      end_page: endPage,
      estimated_time_seconds: (endPage - startPage + 1) * avgSpeed,
      difficulty_score: calculateDifficultyScore(doc, startPage, endPage),
      priority_score: calculatePriorityScore(doc, userStats),
      description: `Continue reading from page ${startPage}`
    });

    // 2. Difficulty-based Strategy
    if (difficultyPreference !== 'adaptive') {
      const filteredPages = filterPagesByDifficulty(unreadPages, difficultyPreference);
      if (filteredPages.length > 0) {
        const diffStartPage = filteredPages[0].page_number;
        const diffEndPage = Math.min(diffStartPage + targetPages - 1, doc.total_pages);
        
        strategies.push({
          strategy: 'difficulty_focused',
          document_id: doc.id,
          document_title: doc.title,
          start_page: diffStartPage,
          end_page: diffEndPage,
          estimated_time_seconds: (diffEndPage - diffStartPage + 1) * avgSpeed * getDifficultyMultiplier(difficultyPreference),
          difficulty_score: calculateDifficultyScore(doc, diffStartPage, diffEndPage),
          priority_score: calculatePriorityScore(doc, userStats),
          description: `${difficultyPreference.charAt(0).toUpperCase() + difficultyPreference.slice(1)} difficulty pages`
        });
      }
    }

    // 3. Review Strategy (if sessionType is review)
    if (sessionType === 'review') {
      const recentlyRead = doc.document_pages
        .filter(p => p.is_completed && p.last_read_at)
        .sort((a, b) => new Date(b.last_read_at) - new Date(a.last_read_at))
        .slice(0, targetPages);

      if (recentlyRead.length > 0) {
        strategies.push({
          strategy: 'review',
          document_id: doc.id,
          document_title: doc.title,
          start_page: Math.min(...recentlyRead.map(p => p.page_number)),
          end_page: Math.max(...recentlyRead.map(p => p.page_number)),
          estimated_time_seconds: recentlyRead.length * avgSpeed * 0.7, // Review is faster
          difficulty_score: 2, // Review is easier
          priority_score: calculatePriorityScore(doc, userStats) + 1, // Boost review priority
          description: `Review recently read pages`
        });
      }
    }

    suggestions.push(...strategies);
  });

  return suggestions
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 5); // Return top 5 suggestions
}

function selectOptimalSprint(suggestions, userStats) {
  if (suggestions.length === 0) return null;

  // Score each suggestion based on user context
  const scoredSuggestions = suggestions.map(suggestion => {
    let score = suggestion.priority_score;
    
    // Adjust for user level
    const userLevel = userStats?.current_level || 1;
    if (userLevel < 3 && suggestion.difficulty_score > 3) {
      score -= 2; // Avoid hard content for beginners
    } else if (userLevel > 5 && suggestion.difficulty_score < 2) {
      score -= 1; // Slightly prefer challenging content for advanced users
    }

    // Adjust for recent performance
    const focusScore = userStats?.focus_score_average || 0.8;
    if (focusScore < 0.7 && suggestion.estimated_time_seconds > 1800) {
      score -= 1; // Prefer shorter sessions for users with focus issues
    }

    // Time of day preference
    const currentHour = new Date().getHours();
    const peakHour = userStats?.peak_performance_hour;
    if (peakHour && Math.abs(currentHour - peakHour) <= 2) {
      score += 1; // Boost during peak hours
    }

    return { ...suggestion, final_score: score };
  });

  return scoredSuggestions.sort((a, b) => b.final_score - a.final_score)[0];
}

function calculateDifficultyScore(document, startPage, endPage) {
  const docDifficulty = document.difficulty_level || 3;
  const pageRange = endPage - startPage + 1;
  
  // Pages in the range with difficulty ratings
  const pagesWithRatings = document.document_pages
    .filter(p => p.page_number >= startPage && p.page_number <= endPage && p.difficulty_rating)
    .map(p => p.difficulty_rating);

  if (pagesWithRatings.length > 0) {
    const avgPageDifficulty = pagesWithRatings.reduce((sum, rating) => sum + rating, 0) / pagesWithRatings.length;
    return Math.round((docDifficulty + avgPageDifficulty) / 2);
  }

  return docDifficulty;
}

function calculatePriorityScore(document, userStats) {
  let score = 5 - (document.priority || 3); // Higher priority = higher score
  
  // Boost recently updated documents
  const daysSinceUpdate = (new Date() - new Date(document.updated_at)) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 1) score += 2;
  else if (daysSinceUpdate < 7) score += 1;

  return score;
}

function filterPagesByDifficulty(pages, preference) {
  const thresholds = {
    easy: [1, 2],
    medium: [3],
    hard: [4, 5]
  };
  
  return pages.filter(page => {
    const rating = page.difficulty_rating || 3;
    return thresholds[preference]?.includes(rating);
  });
}

function getDifficultyMultiplier(difficulty) {
  const multipliers = {
    easy: 0.8,
    medium: 1.0,
    hard: 1.3
  };
  return multipliers[difficulty] || 1.0;
}

function generateSprintTitle(docTitle, startPage, endPage, sprintType) {
  const pageRange = endPage === startPage ? `Page ${startPage}` : `Pages ${startPage}-${endPage}`;
  const typeEmoji = {
    reading: '📖',
    review: '📝',
    practice: '🎯'
  };
  
  return `${typeEmoji[sprintType] || '📖'} ${docTitle}: ${pageRange}`;
}

async function calculateEstimatedTime(startPage, endPage, userId) {
  const { data: userStats } = await supabase
    .from('user_stats')
    .select('average_reading_speed_seconds')
    .eq('user_id', userId)
    .single();

  const avgSpeed = userStats?.average_reading_speed_seconds || 120;
  return (endPage - startPage + 1) * avgSpeed;
}

function generateTrackingTips(sprintType) {
  const tips = {
    reading: [
      "📱 Keep your phone in another room for better focus",
      "☕ Have water nearby to stay hydrated",
      "🎵 Try instrumental music or white noise if it helps",
      "⏱️ Take a 5-minute break every 25 minutes (Pomodoro technique)"
    ],
    review: [
      "📝 Take notes on key concepts you want to remember",
      "🔄 Test yourself by covering text and recalling information",
      "🎯 Focus on areas you found challenging during first reading",
      "💭 Make connections between different concepts"
    ],
    practice: [
      "✍️ Work through problems step by step",
      "❌ Don't check answers until you've attempted all problems",
      "🤔 Identify patterns in your mistakes",
      "📊 Track which types of problems you find most difficult"
    ]
  };

  return tips[sprintType] || tips.reading;
}

function calculatePerformanceMetrics(originalSprint, completedSprint) {
  const estimatedTime = originalSprint.estimated_time_seconds;
  const actualTime = completedSprint.actual_time_seconds || estimatedTime;
  const plannedPages = originalSprint.end_page - originalSprint.start_page + 1;
  const actualPages = completedSprint.pages_actually_completed || plannedPages;

  const timeEfficiency = estimatedTime > 0 ? Math.round((estimatedTime / actualTime) * 100) : 100;
  const completionRate = Math.round((actualPages / plannedPages) * 100);
  const averageTimePerPage = actualPages > 0 ? Math.round(actualTime / actualPages) : 0;

  let performanceLevel = 'good';
  if (timeEfficiency >= 120 || completionRate >= 120) performanceLevel = 'excellent';
  else if (timeEfficiency >= 90 && completionRate >= 90) performanceLevel = 'good';
  else if (timeEfficiency >= 70 && completionRate >= 70) performanceLevel = 'fair';
  else performanceLevel = 'needs_improvement';

  return {
    time_efficiency_percentage: timeEfficiency,
    completion_rate_percentage: completionRate,
    average_time_per_page_seconds: averageTimePerPage,
    performance_level: performanceLevel,
    pages_completed: actualPages,
    total_time_seconds: actualTime,
    pace_comparison: timeEfficiency >= 100 ? 'faster_than_expected' : 'slower_than_expected'
  };
}

async function updateUserStatsFromSprint(userId, sprint, performance) {
  try {
    // Get current stats
    const { data: currentStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!currentStats) return;

    const newTotalPages = currentStats.total_pages_read + performance.pages_completed;
    const newTotalTime = currentStats.total_time_spent_seconds + performance.total_time_seconds;
    const newAvgSpeed = newTotalPages > 0 ? newTotalTime / newTotalPages : currentStats.average_reading_speed_seconds;
    const newTotalSessions = currentStats.total_study_sessions + 1;
    const newAvgSessionDuration = Math.round(newTotalTime / newTotalSessions);

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const lastActivity = currentStats.last_activity_date;
    let newStreak = currentStats.current_streak_days;
    
    if (lastActivity !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastActivity === yesterdayStr) {
        newStreak += 1; // Continue streak
      } else {
        newStreak = 1; // Reset streak
      }
    }

    const newLongestStreak = Math.max(currentStats.longest_streak_days, newStreak);

    // Award XP based on performance
    let xpGained = 10; // Base XP
    if (performance.performance_level === 'excellent') xpGained = 25;
    else if (performance.performance_level === 'good') xpGained = 15;
    
    // Bonus XP for streaks
    if (newStreak >= 7) xpGained += 5;
    if (newStreak >= 30) xpGained += 10;

    const newTotalXP = currentStats.total_xp_points + xpGained;

    // Update stats
    await supabase
      .from('user_stats')
      .update({
        total_pages_read: newTotalPages,
        total_time_spent_seconds: newTotalTime,
        average_reading_speed_seconds: newAvgSpeed,
        total_study_sessions: newTotalSessions,
        average_session_duration_seconds: newAvgSessionDuration,
        current_streak_days: newStreak,
        longest_streak_days: newLongestStreak,
        last_activity_date: today,
        total_xp_points: newTotalXP,
        current_level: calculateUserLevel(newTotalXP),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

  } catch (error) {
    console.error('Update user stats error:', error);
  }
}

function calculateUserLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

async function checkSprintAchievements(userId, sprint) {
  // This would implement achievement checking logic
  // For now, return empty array
  return [];
}

function generateCelebrationMessage(performance, achievements) {
  const messages = {
    excellent: [
      { emoji: '🚀', text: 'Outstanding performance! You\'re on fire!' },
      { emoji: '⭐', text: 'Stellar work! Your focus is incredible!' },
      { emoji: '🏆', text: 'Champion level reading! Keep dominating!' }
    ],
    good: [
      { emoji: '🎯', text: 'Great job! You hit your targets!' },
      { emoji: '💪', text: 'Solid performance! Your consistency is paying off!' },
      { emoji: '📈', text: 'Excellent progress! You\'re building momentum!' }
    ],
    fair: [
      { emoji: '👍', text: 'Good effort! Every step counts!' },
      { emoji: '🌱', text: 'Nice work! You\'re growing stronger!' },
      { emoji: '⚡', text: 'Keep going! Your dedication is admirable!' }
    ],
    needs_improvement: [
      { emoji: '💪', text: 'Don\'t give up! Progress takes time!' },
      { emoji: '🌟', text: 'Every attempt makes you stronger!' },
      { emoji: '🎯', text: 'Focus on consistency! You\'ve got this!' }
    ]
  };

  const levelMessages = messages[performance.performance_level] || messages.good;
  const randomMessage = levelMessages[Math.floor(Math.random() * levelMessages.length)];

  return {
    ...randomMessage,
    achievements_earned: achievements.length,
    xp_gained: 15 // This would be calculated based on performance
  };
}

async function generateNextSprintSuggestions(userId, completedSprint) {
  // Generate 2-3 suggestions for the next sprint
  // This would use the same intelligent algorithm as the main generate function
  return [
    {
      suggestion: 'Continue where you left off',
      description: 'Keep the momentum going with the next section',
      estimated_duration: '20-30 minutes'
    },
    {
      suggestion: 'Quick review session',
      description: 'Reinforce what you just learned',
      estimated_duration: '10-15 minutes'
    }
  ];
}

function calculateSprintAnalytics(sprints) {
  const completed = sprints.filter(s => s.status === 'completed');
  const totalSprints = sprints.length;
  const completionRate = totalSprints > 0 ? Math.round((completed.length / totalSprints) * 100) : 0;

  // Calculate average performance
  const avgTimeEfficiency = completed.length > 0 
    ? completed.reduce((sum, s) => {
        const efficiency = s.estimated_time_seconds > 0 
          ? (s.estimated_time_seconds / (s.actual_time_seconds || s.estimated_time_seconds)) * 100
          : 100;
        return sum + efficiency;
      }, 0) / completed.length
    : 0;

  // Sprint type distribution
  const typeDistribution = sprints.reduce((acc, sprint) => {
    acc[sprint.sprint_type] = (acc[sprint.sprint_type] || 0) + 1;
    return acc;
  }, {});

  // Performance trends
  const recentSprints = completed.slice(0, 10);
  const performanceTrend = recentSprints.length > 1 
    ? (recentSprints[0].completion_quality || 3) > (recentSprints[recentSprints.length - 1].completion_quality || 3) 
      ? 'improving' : 'stable'
    : 'insufficient_data';

  return {
    total_sprints: totalSprints,
    completed_sprints: completed.length,
    completion_rate_percentage: completionRate,
    average_time_efficiency_percentage: Math.round(avgTimeEfficiency),
    sprint_type_distribution: typeDistribution,
    performance_trend: performanceTrend,
    total_pages_in_sprints: completed.reduce((sum, s) => sum + (s.pages_actually_completed || 0), 0),
    total_time_in_sprints: completed.reduce((sum, s) => sum + (s.actual_time_seconds || 0), 0)
  };
}

module.exports = router;