// Enhanced page time tracking routes
// File: backend/src/routes/page-time-tracking.js

const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Start page reading session
router.post('/start-page/:document_id/:page_number', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number } = req.params;
    const { session_id } = req.body;
    const userId = req.user.id;

    console.log(`⏱️ Starting page timer: User ${userId}, Doc ${document_id}, Page ${page_number}`);

    // Validate document ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, total_pages')
      .eq('id', document_id)
      .eq('user_id', userId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Validate page number
    const pageNum = parseInt(page_number);
    if (pageNum < 1 || pageNum > document.total_pages) {
      return res.status(400).json({ 
        error: `Invalid page number. Must be between 1 and ${document.total_pages}` 
      });
    }

    // Get or create page tracking record
    const { data: existingPage, error: pageError } = await supabase
      .from('document_pages')
      .select('*')
      .eq('document_id', document_id)
      .eq('page_number', pageNum)
      .eq('user_id', userId)
      .single();

    if (pageError && pageError.code !== 'PGRST116') {
      console.error('Error fetching page:', pageError);
      return res.status(500).json({ error: 'Failed to fetch page data' });
    }

    // Create page tracking record if it doesn't exist
    if (!existingPage) {
      const { error: createError } = await supabase
        .from('document_pages')
        .insert({
          document_id,
          user_id: userId,
          page_number: pageNum,
          time_spent_seconds: 0,
          is_completed: false,
          estimated_time_seconds: 120, // Default 2 minutes
          created_at: new Date().toISOString()
        });

      if (createError) {
        console.error('Error creating page record:', createError);
        return res.status(500).json({ error: 'Failed to create page tracking' });
      }
    }

    // Record the start time in page_reading_sessions table
    const { data: readingSession, error: sessionError } = await supabase
      .from('page_reading_sessions')
      .insert({
        user_id: userId,
        document_id,
        page_number: pageNum,
        session_id,
        started_at: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating reading session:', sessionError);
      return res.status(500).json({ error: 'Failed to start page session' });
    }

    // Get user's average reading speed for this document/difficulty
    const avgSpeed = await getUserAverageSpeedForPage(userId, document_id, pageNum);

    res.json({
      message: 'Page reading session started',
      session: readingSession,
      page_info: {
        document_title: document.title,
        page_number: pageNum,
        total_pages: document.total_pages,
        estimated_time_seconds: avgSpeed,
        current_progress: Math.round((pageNum / document.total_pages) * 100)
      }
    });
  } catch (error) {
    console.error('Start page session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update page reading progress (called periodically)
router.patch('/update-progress/:session_id', authMiddleware, async (req, res) => {
  try {
    const { session_id } = req.params;
    const { 
      current_time_seconds, 
      activity_level = 1.0,
      scroll_events = 0,
      focus_events = 0,
      pause_count = 0
    } = req.body;

    const userId = req.user.id;

    // Get active session
    const { data: session, error: sessionError } = await supabase
      .from('page_reading_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Calculate elapsed time
    const startTime = new Date(session.started_at);
    const now = new Date();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);

    // Update session with current progress
    const { error: updateError } = await supabase
      .from('page_reading_sessions')
      .update({
        current_time_seconds: elapsedSeconds,
        activity_level,
        scroll_events,
        focus_events,
        pause_count,
        last_activity_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', session_id)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return res.status(500).json({ error: 'Failed to update session' });
    }

    // Generate real-time feedback
    const feedback = await generatePageReadingFeedback(
      userId, 
      session.document_id, 
      session.page_number, 
      elapsedSeconds,
      activity_level
    );

    res.json({
      message: 'Progress updated',
      elapsed_seconds: elapsedSeconds,
      feedback: feedback,
      activity_metrics: {
        activity_level,
        scroll_events,
        focus_events,
        pause_count
      }
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete page reading session
router.post('/complete-page/:session_id', authMiddleware, async (req, res) => {
  try {
    const { session_id } = req.params;
    const { 
      comprehension_rating,
      difficulty_rating,
      notes,
      completed_reading = true
    } = req.body;

    const userId = req.user.id;

    // Get active session
    const { data: session, error: sessionError } = await supabase
      .from('page_reading_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Calculate final elapsed time
    const startTime = new Date(session.started_at);
    const endTime = new Date();
    const totalTimeSeconds = Math.floor((endTime - startTime) / 1000);

    // Update page_reading_sessions
    const { error: sessionUpdateError } = await supabase
      .from('page_reading_sessions')
      .update({
        ended_at: endTime.toISOString(),
        total_time_seconds: totalTimeSeconds,
        is_active: false,
        comprehension_rating,
        difficulty_rating,
        notes: notes?.trim() || null,
        updated_at: endTime.toISOString()
      })
      .eq('id', session_id);

    if (sessionUpdateError) {
      console.error('Error updating session:', sessionUpdateError);
      return res.status(500).json({ error: 'Failed to complete session' });
    }

    // Update document_pages with accumulated time
    const { data: currentPage, error: pageError } = await supabase
      .from('document_pages')
      .select('time_spent_seconds, is_completed')
      .eq('document_id', session.document_id)
      .eq('page_number', session.page_number)
      .eq('user_id', userId)
      .single();

    if (!pageError && currentPage) {
      const newTotalTime = (currentPage.time_spent_seconds || 0) + totalTimeSeconds;
      
      const { error: pageUpdateError } = await supabase
        .from('document_pages')
        .update({
          time_spent_seconds: newTotalTime,
          is_completed: completed_reading || currentPage.is_completed,
          last_read_at: endTime.toISOString(),
          difficulty_rating: difficulty_rating || null,
          comprehension_rating: comprehension_rating || null,
          notes: notes?.trim() || null,
          updated_at: endTime.toISOString()
        })
        .eq('document_id', session.document_id)
        .eq('page_number', session.page_number)
        .eq('user_id', userId);

      if (pageUpdateError) {
        console.error('Error updating page:', pageUpdateError);
      }
    }

    // Update user reading speed statistics
    await updateUserReadingSpeed(userId, totalTimeSeconds, 1);

    // Calculate remaining time for document
    const remainingTimeEstimate = await calculateRemainingTime(userId, session.document_id);

    // Check for achievements
    const achievements = await checkPageReadingAchievements(userId, session, totalTimeSeconds);

    res.json({
      message: 'Page reading completed successfully! 📖',
      session_summary: {
        total_time_seconds: totalTimeSeconds,
        page_number: session.page_number,
        comprehension_rating,
        difficulty_rating,
        reading_speed_wpm: calculateWordsPerMinute(totalTimeSeconds)
      },
      document_progress: remainingTimeEstimate,
      achievements: achievements,
      performance_insights: generatePerformanceInsights(totalTimeSeconds, comprehension_rating, userId)
    });
  } catch (error) {
    console.error('Complete page session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reading time estimates for document or all documents
router.get('/estimates/:document_id?', authMiddleware, async (req, res) => {
  try {
    const { document_id } = req.params;
    const { include_completed = false } = req.query;
    const userId = req.user.id;

    if (document_id) {
      // Get estimates for specific document
      const estimate = await calculateRemainingTime(userId, document_id, include_completed === 'true');
      res.json({ document_estimate: estimate });
    } else {
      // Get estimates for all user documents
      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, title, total_pages')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch documents' });
      }

      const estimates = await Promise.all(
        documents.map(async (doc) => {
          const estimate = await calculateRemainingTime(userId, doc.id, include_completed === 'true');
          return {
            document_id: doc.id,
            document_title: doc.title,
            total_pages: doc.total_pages,
            ...estimate
          };
        })
      );

      // Calculate total remaining time across all documents
      const totalRemainingSeconds = estimates.reduce((sum, est) => sum + est.remaining_time_seconds, 0);
      const totalCompletedPages = estimates.reduce((sum, est) => sum + est.completed_pages, 0);
      const totalPages = estimates.reduce((sum, est) => sum + est.total_pages, 0);

      res.json({
        document_estimates: estimates,
        overall_summary: {
          total_documents: documents.length,
          total_pages: totalPages,
          completed_pages: totalCompletedPages,
          completion_percentage: totalPages > 0 ? Math.round((totalCompletedPages / totalPages) * 100) : 0,
          total_remaining_time_seconds: totalRemainingSeconds,
          total_remaining_time_formatted: formatDuration(totalRemainingSeconds),
          estimated_completion_date: calculateEstimatedCompletionDate(totalRemainingSeconds, userId)
        }
      });
    }
  } catch (error) {
    console.error('Get estimates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reading session history for a page
router.get('/history/:document_id/:page_number', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number } = req.params;
    const { limit = 10 } = req.query;
    const userId = req.user.id;

    const { data: sessions, error } = await supabase
      .from('page_reading_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('document_id', document_id)
      .eq('page_number', parseInt(page_number))
      .eq('is_active', false)
      .order('started_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error('Error fetching session history:', error);
      return res.status(500).json({ error: 'Failed to fetch session history' });
    }

    // Calculate statistics
    const stats = sessions.length > 0 ? {
      total_sessions: sessions.length,
      total_time_seconds: sessions.reduce((sum, s) => sum + (s.total_time_seconds || 0), 0),
      average_time_seconds: Math.round(sessions.reduce((sum, s) => sum + (s.total_time_seconds || 0), 0) / sessions.length),
      best_time_seconds: Math.min(...sessions.map(s => s.total_time_seconds || Infinity)),
      average_comprehension: sessions.filter(s => s.comprehension_rating).length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + (s.comprehension_rating || 0), 0) / sessions.filter(s => s.comprehension_rating).length * 10) / 10
        : null
    } : null;

    res.json({
      sessions: sessions,
      statistics: stats
    });
  } catch (error) {
    console.error('Get session history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================
// HELPER FUNCTIONS
// =====================================

async function getUserAverageSpeedForPage(userId, documentId, pageNumber) {
  try {
    // Get user's overall average speed
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('average_reading_speed_seconds')
      .eq('user_id', userId)
      .single();

    // Get difficulty-specific estimate if available
    const { data: pageAnalysis } = await supabase
      .from('pdf_content_analysis')
      .select('estimated_reading_seconds, difficulty_level')
      .eq('document_id', documentId)
      .eq('page_number', pageNumber)
      .single();

    if (pageAnalysis) {
      return pageAnalysis.estimated_reading_seconds;
    }

    return userStats?.average_reading_speed_seconds || 120;
  } catch (error) {
    console.warn('Error getting user average speed:', error);
    return 120; // Default 2 minutes
  }
}

async function generatePageReadingFeedback(userId, documentId, pageNumber, elapsedSeconds, activityLevel) {
  try {
    const userAverage = await getUserAverageSpeedForPage(userId, documentId, pageNumber);
    const difference = elapsedSeconds - userAverage;
    
    let feedbackType = 'neutral';
    let message = '';
    let icon = '📖';

    if (Math.abs(difference) <= 15) {
      feedbackType = 'perfect';
      icon = '🎯';
      message = 'Perfect pace! You\'re right on track.';
    } else if (difference < -30) {
      feedbackType = 'fast';
      icon = '⚡';
      message = `Great speed! You're ${Math.abs(Math.round(difference))}s faster than your average.`;
    } else if (difference < -15) {
      feedbackType = 'good';
      icon = '👍';
      message = 'Good pace! You\'re reading efficiently.';
    } else if (difference <= 60) {
      feedbackType = 'slow';
      icon = '🐢';
      message = 'Take your time to understand. Comprehension matters more than speed.';
    } else {
      feedbackType = 'very_slow';
      icon = '🤔';
      message = 'This seems challenging. Consider taking notes or re-reading if needed.';
    }

    // Activity level adjustments
    if (activityLevel < 0.6) {
      message += ' Try to minimize distractions for better focus.';
    } else if (activityLevel > 0.9) {
      message += ' Great focus level!';
    }

    return {
      type: feedbackType,
      icon: icon,
      message: message,
      comparison: {
        current_time: elapsedSeconds,
        user_average: userAverage,
        difference_seconds: difference,
        pace_description: difference < -15 ? 'faster than usual' :
                         difference > 30 ? 'slower than usual' : 'typical pace'
      }
    };
  } catch (error) {
    console.error('Error generating feedback:', error);
    return {
      type: 'neutral',
      icon: '📖',
      message: 'Keep reading at your own pace!',
      comparison: null
    };
  }
}

async function calculateRemainingTime(userId, documentId, includeCompleted = false) {
  try {
    // Get document info
    const { data: document } = await supabase
      .from('documents')
      .select('id, title, total_pages')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (!document) {
      throw new Error('Document not found');
    }

    // Get page progress
    const { data: pages } = await supabase
      .from('document_pages')
      .select('page_number, time_spent_seconds, is_completed, estimated_time_seconds')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .order('page_number');

    // Get user's average reading speed
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('average_reading_speed_seconds')
      .eq('user_id', userId)
      .single();

    const avgSpeed = userStats?.average_reading_speed_seconds || 120;

    // Calculate progress
    const completedPages = pages?.filter(p => p.is_completed).length || 0;
    const totalPages = document.total_pages;
    const remainingPages = totalPages - completedPages;

    // Calculate time spent
    const totalTimeSpent = pages?.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0) || 0;

    // Estimate remaining time using multiple methods
    let remainingTimeSeconds = 0;

    if (pages && pages.length > 0) {
      // Method 1: Use estimated times for unread pages
      remainingTimeSeconds = pages
        .filter(p => !p.is_completed)
        .reduce((sum, p) => sum + (p.estimated_time_seconds || avgSpeed), 0);
    } else {
      // Method 2: Use average speed for all remaining pages
      remainingTimeSeconds = remainingPages * avgSpeed;
    }

    // Adjust based on user's actual reading speed if we have data
    if (completedPages > 0 && totalTimeSpent > 0) {
      const actualAvgSpeed = totalTimeSpent / completedPages;
      const speedRatio = actualAvgSpeed / avgSpeed;
      remainingTimeSeconds = Math.round(remainingTimeSeconds * speedRatio);
    }

    return {
      document_id: documentId,
      document_title: document.title,
      total_pages: totalPages,
      completed_pages: completedPages,
      remaining_pages: remainingPages,
      completion_percentage: Math.round((completedPages / totalPages) * 100),
      total_time_spent_seconds: totalTimeSpent,
      remaining_time_seconds: Math.max(0, remainingTimeSeconds),
      remaining_time_formatted: formatDuration(remainingTimeSeconds),
      estimated_completion_date: calculateEstimatedCompletionDate(remainingTimeSeconds, userId)
    };
  } catch (error) {
    console.error('Error calculating remaining time:', error);
    return {
      error: 'Failed to calculate remaining time'
    };
  }
}

function formatDuration(seconds) {
  if (seconds <= 0) return '0 minutes';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function calculateEstimatedCompletionDate(remainingSeconds, userId) {
  // This would use user's study patterns to estimate completion
  // For now, assume 1 hour of reading per day
  const assumedDailyStudySeconds = 3600; // 1 hour
  const daysNeeded = Math.ceil(remainingSeconds / assumedDailyStudySeconds);
  
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + daysNeeded);
  
  return completionDate.toISOString().split('T')[0];
}

function calculateWordsPerMinute(timeSeconds) {
  // Rough estimate: 250 words per page, adjust based on time
  const assumedWordsPerPage = 250;
  const minutes = timeSeconds / 60;
  return minutes > 0 ? Math.round(assumedWordsPerPage / minutes) : 0;
}

async function updateUserReadingSpeed(userId, timeSeconds, pagesRead) {
  try {
    const { data: currentStats } = await supabase
      .from('user_stats')
      .select('total_pages_read, total_time_spent_seconds, average_reading_speed_seconds')
      .eq('user_id', userId)
      .single();

    if (currentStats) {
      const newTotalPages = currentStats.total_pages_read + pagesRead;
      const newTotalTime = currentStats.total_time_spent_seconds + timeSeconds;
      const newAvgSpeed = newTotalPages > 0 ? newTotalTime / newTotalPages : currentStats.average_reading_speed_seconds;

      await supabase
        .from('user_stats')
        .update({
          total_pages_read: newTotalPages,
          total_time_spent_seconds: newTotalTime,
          average_reading_speed_seconds: newAvgSpeed,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    }
  } catch (error) {
    console.error('Error updating user reading speed:', error);
  }
}

async function checkPageReadingAchievements(userId, session, timeSeconds) {
  // This would check for various achievements
  // Implementation would depend on existing achievement system
  return [];
}

function generatePerformanceInsights(timeSeconds, comprehensionRating, userId) {
  const insights = [];
  
  if (timeSeconds < 60) {
    insights.push('⚡ Lightning fast! You completed this page quickly.');
  } else if (timeSeconds > 300) {
    insights.push('🔍 Deep reading detected. You took time to understand the content.');
  }
  
  if (comprehensionRating >= 4) {
    insights.push('🧠 High comprehension! You understand the material well.');
  }
  
  return insights;
}

module.exports = router;