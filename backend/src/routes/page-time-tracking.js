// Enhanced page time tracking routes
// File: backend/src/routes/page-time-tracking.js

const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Start page reading session with enhanced tracking
router.post('/start-page/:document_id/:page_number', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number } = req.params;
    const { session_id } = req.body;
    const userId = req.user.id;

    console.log(`⏱️ Starting enhanced page timer: User ${userId}, Doc ${document_id}, Page ${page_number}`);

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

    // Get or create page tracking record with estimated time
    const { data: existingPage, error: pageError } = await supabase
      .from('document_pages')
      .select('*')
      .eq('document_id', document_id)
      .eq('page_number', pageNum)
      .eq('user_id', userId)
      .single();

    let estimatedTime = 120; // Default 2 minutes

    // Get estimated time from PDF analysis if available
    const { data: pageAnalysis } = await supabase
      .from('pdf_content_analysis')
      .select('estimated_reading_seconds')
      .eq('document_id', document_id)
      .eq('page_number', pageNum)
      .single();

    if (pageAnalysis?.estimated_reading_seconds) {
      estimatedTime = pageAnalysis.estimated_reading_seconds;
    } else {
      // Fallback to user's average speed
      const { data: userStats } = await supabase
        .from('user_stats')
        .select('average_reading_speed_seconds')
        .eq('user_id', userId)
        .single();
      
      if (userStats?.average_reading_speed_seconds) {
        estimatedTime = userStats.average_reading_speed_seconds;
      }
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
          estimated_time_seconds: estimatedTime,
          created_at: new Date().toISOString()
        });

      if (createError) {
        console.error('Error creating page record:', createError);
        return res.status(500).json({ error: 'Failed to create page tracking' });
      }
    }

    // Get user's reading performance for context
    const avgSpeed = await getUserAverageSpeedForPage(userId, document_id, pageNum);

    res.json({
      message: 'Enhanced page reading session started',
      page_info: {
        document_title: document.title,
        page_number: pageNum,
        total_pages: document.total_pages,
        estimated_time_seconds: estimatedTime,
        user_average_seconds: avgSpeed,
        current_progress: Math.round((pageNum / document.total_pages) * 100)
      },
      session_context: {
        start_time: new Date().toISOString(),
        session_id: session_id || `session_${Date.now()}`,
        tracking_active: true
      }
    });
  } catch (error) {
    console.error('Start enhanced page session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced page completion with detailed time tracking
router.post('/complete-page/:document_id/:page_number', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number } = req.params;
    const { 
      actual_time_seconds,
      comprehension_rating,
      difficulty_rating,
      notes,
      reading_interruptions = 0,
      focus_score = 1.0
    } = req.body;

    const userId = req.user.id;
    const pageNum = parseInt(page_number);

    if (!actual_time_seconds || actual_time_seconds < 0) {
      return res.status(400).json({ error: 'actual_time_seconds is required and must be positive' });
    }

    console.log(`✅ Completing page ${pageNum} with ${actual_time_seconds}s reading time`);

    // Update document_pages with accumulated time and completion
    const { data: updatedPage, error: pageUpdateError } = await supabase
      .from('document_pages')
      .update({
        time_spent_seconds: actual_time_seconds,
        is_completed: true,
        last_read_at: new Date().toISOString(),
        difficulty_rating: difficulty_rating || null,
        comprehension_rating: comprehension_rating || null,
        notes: notes?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('document_id', document_id)
      .eq('page_number', pageNum)
      .eq('user_id', userId)
      .select()
      .single();

    if (pageUpdateError) {
      console.error('Error updating page:', pageUpdateError);
      return res.status(500).json({ error: 'Failed to update page progress' });
    }

    // Update user reading speed statistics
    await updateUserReadingSpeedFromPage(userId, actual_time_seconds);

    // Calculate remaining time for document
    const remainingTimeEstimate = await calculateDocumentRemainingTime(userId, document_id);

    // Generate performance feedback
    const performanceFeedback = await generatePagePerformanceFeedback(
      userId, 
      document_id, 
      pageNum, 
      actual_time_seconds,
      comprehension_rating,
      focus_score
    );

    // Check if document is now complete
    const { data: documentProgress } = await supabase
      .from('document_pages')
      .select('is_completed')
      .eq('document_id', document_id)
      .eq('user_id', userId);

    const totalPages = documentProgress?.length || 0;
    const completedPages = documentProgress?.filter(p => p.is_completed).length || 0;
    const documentCompleted = totalPages > 0 && completedPages === totalPages;

    if (documentCompleted) {
      console.log(`🎉 Document ${document_id} completed!`);
      // Award completion bonus or trigger achievement
      await handleDocumentCompletion(userId, document_id);
    }

    res.json({
      message: 'Page reading completed successfully! 📖',
      page_summary: {
        page_number: pageNum,
        actual_time_seconds: actual_time_seconds,
        comprehension_rating,
        difficulty_rating,
        reading_speed_wpm: calculateWordsPerMinute(actual_time_seconds)
      },
      document_progress: {
        completed_pages: completedPages,
        total_pages: totalPages,
        completion_percentage: Math.round((completedPages / totalPages) * 100),
        document_completed: documentCompleted,
        ...remainingTimeEstimate
      },
      performance_feedback: performanceFeedback,
      next_recommendations: generateNextPageRecommendations(pageNum, totalPages, performanceFeedback)
    });
  } catch (error) {
    console.error('Complete page session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comprehensive reading time estimates for all documents
router.get('/estimates/all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { include_completed = false } = req.query;

    console.log(`📊 Calculating comprehensive time estimates for user ${userId}`);

    // Get all user documents with progress
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        total_pages,
        topic_id,
        difficulty_level,
        topics (
          name,
          color
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    // Calculate estimates for each document
    const documentEstimates = await Promise.all(
      documents.map(async (doc) => {
        const estimate = await calculateDocumentRemainingTime(userId, doc.id, include_completed === 'true');
        
        return {
          document_id: doc.id,
          document_title: doc.title,
          topic: doc.topics,
          difficulty_level: doc.difficulty_level,
          ...estimate
        };
      })
    );

    // Calculate totals across all documents
    const totalStats = documentEstimates.reduce((acc, doc) => ({
      total_documents: acc.total_documents + 1,
      total_pages: acc.total_pages + doc.total_pages,
      completed_pages: acc.completed_pages + doc.completed_pages,
      total_time_spent_seconds: acc.total_time_spent_seconds + doc.total_time_spent_seconds,
      total_remaining_seconds: acc.total_remaining_seconds + doc.remaining_time_seconds
    }), {
      total_documents: 0,
      total_pages: 0,
      completed_pages: 0,
      total_time_spent_seconds: 0,
      total_remaining_seconds: 0
    });

    // Calculate completion date based on user's study patterns
    const estimatedCompletionDate = await calculateGlobalCompletionDate(userId, totalStats.total_remaining_seconds);

    // Group by topic for better organization
    const byTopic = documentEstimates.reduce((acc, doc) => {
      const topicName = doc.topic?.name || 'Uncategorized';
      if (!acc[topicName]) {
        acc[topicName] = {
          topic_info: doc.topic,
          documents: [],
          topic_totals: {
            total_pages: 0,
            completed_pages: 0,
            remaining_seconds: 0
          }
        };
      }
      acc[topicName].documents.push(doc);
      acc[topicName].topic_totals.total_pages += doc.total_pages;
      acc[topicName].topic_totals.completed_pages += doc.completed_pages;
      acc[topicName].topic_totals.remaining_seconds += doc.remaining_time_seconds;
      return acc;
    }, {});

    res.json({
      overall_summary: {
        ...totalStats,
        overall_completion_percentage: totalStats.total_pages > 0 
          ? Math.round((totalStats.completed_pages / totalStats.total_pages) * 100) 
          : 0,
        total_remaining_time_formatted: formatDuration(totalStats.total_remaining_seconds),
        estimated_completion_date: estimatedCompletionDate,
        average_daily_study_recommendation: await calculateDailyStudyRecommendation(userId, totalStats.total_remaining_seconds)
      },
      documents: documentEstimates,
      by_topic: byTopic,
      study_insights: await generateStudyInsights(userId, documentEstimates)
    });
  } catch (error) {
    console.error('Get comprehensive estimates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get detailed time breakdown for a specific document
router.get('/estimates/:document_id/detailed', authMiddleware, async (req, res) => {
  try {
    const { document_id } = req.params;
    const userId = req.user.id;

    const detailedEstimate = await calculateDetailedDocumentEstimate(userId, document_id);
    
    if (!detailedEstimate.success) {
      return res.status(404).json({ error: detailedEstimate.error });
    }

    res.json(detailedEstimate);
  } catch (error) {
    console.error('Get detailed estimates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update reading pace in real-time (for live estimates)
router.post('/update-pace/:document_id/:page_number', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number } = req.params;
    const { current_time_seconds, is_focused = true } = req.body;
    const userId = req.user.id;

    // Generate real-time feedback and pace estimates
    const realTimeFeedback = await generateRealTimeReadingFeedback(
      userId,
      document_id,
      parseInt(page_number),
      current_time_seconds,
      is_focused
    );

    // Update live estimates for remaining time
    const updatedEstimates = await calculateLiveRemainingTime(userId, document_id, current_time_seconds);

    res.json({
      real_time_feedback: realTimeFeedback,
      updated_estimates: updatedEstimates,
      current_pace: {
        current_time_seconds,
        pace_status: realTimeFeedback.pace_status,
        estimated_completion_for_page: realTimeFeedback.estimated_completion
      }
    });
  } catch (error) {
    console.error('Update pace error:', error);
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

    // Get page-specific estimate if available
    const { data: pageAnalysis } = await supabase
      .from('pdf_content_analysis')
      .select('estimated_reading_seconds')
      .eq('document_id', documentId)
      .eq('page_number', pageNumber)
      .single();

    if (pageAnalysis?.estimated_reading_seconds) {
      return pageAnalysis.estimated_reading_seconds;
    }

    return userStats?.average_reading_speed_seconds || 120;
  } catch (error) {
    console.warn('Error getting user average speed:', error);
    return 120; // Default 2 minutes
  }
}

async function calculateDocumentRemainingTime(userId, documentId, includeCompleted = false) {
  try {
    // Get document info
    const { data: document } = await supabase
      .from('documents')
      .select('id, title, total_pages, difficulty_level')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (!document) {
      return { error: 'Document not found' };
    }

    // Get all page progress
    const { data: pages } = await supabase
      .from('document_pages')
      .select(`
        page_number, 
        time_spent_seconds, 
        is_completed, 
        estimated_time_seconds,
        difficulty_rating
      `)
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .order('page_number');

    // Get user's current reading speed
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('average_reading_speed_seconds')
      .eq('user_id', userId)
      .single();

    const userAvgSpeed = userStats?.average_reading_speed_seconds || 120;

    // Calculate metrics
    const totalPages = document.total_pages;
    const completedPages = pages?.filter(p => p.is_completed).length || 0;
    const totalTimeSpent = pages?.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0) || 0;

    // Calculate remaining time using multiple approaches
    let remainingTimeSeconds = 0;
    
    if (pages && pages.length > 0) {
      // Method 1: Use estimated times for unread pages
      const unreadPages = pages.filter(p => !p.is_completed);
      
      remainingTimeSeconds = unreadPages.reduce((sum, page) => {
        // Use estimated time if available, otherwise use user average
        const estimatedTime = page.estimated_time_seconds || userAvgSpeed;
        
        // Adjust for difficulty if known
        if (page.difficulty_rating) {
          const difficultyMultiplier = {
            1: 0.8, 2: 0.9, 3: 1.0, 4: 1.2, 5: 1.4
          }[page.difficulty_rating] || 1.0;
          return sum + (estimatedTime * difficultyMultiplier);
        }
        
        return sum + estimatedTime;
      }, 0);
    } else {
      // Fallback: estimate all remaining pages
      const remainingPages = totalPages - completedPages;
      remainingTimeSeconds = remainingPages * userAvgSpeed;
    }

    // Adjust based on user's actual performance if we have data
    if (completedPages > 0 && totalTimeSpent > 0) {
      const actualAvgSpeed = totalTimeSpent / completedPages;
      const speedRatio = actualAvgSpeed / userAvgSpeed;
      
      // Blend actual performance with estimates (70% actual, 30% estimates)
      if (speedRatio > 0.1 && speedRatio < 10) { // Sanity check
        remainingTimeSeconds = Math.round(remainingTimeSeconds * (0.7 * speedRatio + 0.3));
      }
    }

    return {
      success: true,
      document_id: documentId,
      document_title: document.title,
      total_pages: totalPages,
      completed_pages: completedPages,
      remaining_pages: totalPages - completedPages,
      completion_percentage: Math.round((completedPages / totalPages) * 100),
      total_time_spent_seconds: totalTimeSpent,
      remaining_time_seconds: Math.max(0, remainingTimeSeconds),
      remaining_time_formatted: formatDuration(remainingTimeSeconds),
      estimated_completion_date: await calculateCompletionDate(userId, remainingTimeSeconds),
      reading_velocity: completedPages > 0 ? Math.round((completedPages / (totalTimeSpent / 3600)) * 10) / 10 : 0 // pages per hour
    };
  } catch (error) {
    console.error('Error calculating remaining time:', error);
    return { success: false, error: 'Failed to calculate remaining time' };
  }
}

async function updateUserReadingSpeedFromPage(userId, timeSeconds) {
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
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      console.log(`📊 Updated user reading speed: ${Math.round(newAvgSpeed)}s/page`);
    }
  } catch (error) {
    console.error('Error updating user reading speed:', error);
  }
}

function formatDuration(seconds) {
  if (seconds <= 0) return '0 minutes';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function calculateWordsPerMinute(timeSeconds) {
  // Rough estimate: 250 words per page
  const assumedWordsPerPage = 250;
  const minutes = timeSeconds / 60;
  return minutes > 0 ? Math.round(assumedWordsPerPage / minutes) : 0;
}

async function calculateCompletionDate(userId, remainingSeconds) {
  try {
    // Get user's study patterns to estimate daily study time
    const { data: recentSessions } = await supabase
      .from('study_sessions')
      .select('total_duration_seconds, started_at')
      .eq('user_id', userId)
      .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('started_at', { ascending: false })
      .limit(20);

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
    const fallbackDays = Math.ceil(remainingSeconds / 3600); // 1 hour per day fallback
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + fallbackDays);
    return completionDate.toISOString().split('T')[0];
  }
}

async function generatePagePerformanceFeedback(userId, documentId, pageNumber, actualTime, comprehension, focusScore) {
  const expectedTime = await getUserAverageSpeedForPage(userId, documentId, pageNumber);
  const timeDifference = actualTime - expectedTime;
  const performanceRatio = expectedTime > 0 ? actualTime / expectedTime : 1;

  let feedback = {
    speed_feedback: '',
    comprehension_feedback: '',
    overall_rating: 'good',
    improvements: []
  };

  // Speed feedback
  if (performanceRatio < 0.8) {
    feedback.speed_feedback = 'Excellent speed! You read faster than expected.';
    feedback.overall_rating = 'excellent';
  } else if (performanceRatio < 1.2) {
    feedback.speed_feedback = 'Good pace! Right on target.';
  } else if (performanceRatio < 1.5) {
    feedback.speed_feedback = 'Taking time to understand - that\'s good for retention.';
    feedback.improvements.push('Consider active reading techniques to maintain pace');
  } else {
    feedback.speed_feedback = 'Slower pace detected. Focus on key concepts.';
    feedback.overall_rating = 'needs_improvement';
    feedback.improvements.push('Try skimming first, then detailed reading');
  }

  // Comprehension feedback
  if (comprehension >= 4) {
    feedback.comprehension_feedback = 'Great comprehension! You understand the material well.';
  } else if (comprehension >= 3) {
    feedback.comprehension_feedback = 'Good understanding. Keep it up!';
  } else if (comprehension >= 2) {
    feedback.comprehension_feedback = 'Consider re-reading or taking notes.';
    feedback.improvements.push('Try summarizing each section as you read');
  }

  // Focus score integration
  if (focusScore < 0.7) {
    feedback.improvements.push('Try eliminating distractions for better focus');
  }

  return feedback;
}

function generateNextPageRecommendations(currentPage, totalPages, performanceFeedback) {
  const recommendations = [];

  if (currentPage < totalPages) {
    recommendations.push({
      action: 'continue_reading',
      message: `Continue to page ${currentPage + 1}`,
      estimated_time: '2-3 minutes'
    });
  }

  if (performanceFeedback.overall_rating === 'needs_improvement') {
    recommendations.push({
      action: 'take_break',
      message: 'Consider a 5-10 minute break to refocus',
      estimated_time: '5-10 minutes'
    });
  }

  if (currentPage % 5 === 0 && currentPage < totalPages) {
    recommendations.push({
      action: 'review_section',
      message: 'Quick review of the last 5 pages',
      estimated_time: '3-5 minutes'
    });
  }

  return recommendations;
}

async function handleDocumentCompletion(userId, documentId) {
  try {
    // Award completion XP
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('total_xp_points, current_level')
      .eq('user_id', userId)
      .single();

    if (userStats) {
      const completionXP = 50; // Bonus XP for completing a document
      const newTotalXP = userStats.total_xp_points + completionXP;
      const newLevel = Math.floor(Math.sqrt(newTotalXP / 100)) + 1;

      await supabase
        .from('user_stats')
        .update({
          total_xp_points: newTotalXP,
          current_level: newLevel,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      console.log(`🎉 Document completion bonus: +${completionXP} XP`);
    }

    // Check for achievements
    // This would integrate with your existing achievement system
    
  } catch (error) {
    console.error('Error handling document completion:', error);
  }
}

module.exports = router;