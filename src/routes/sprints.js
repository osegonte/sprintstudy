const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Generate daily sprint suggestion
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { document_id } = req.body;
    const userId = req.user.id;

    if (!document_id) {
      return res.status(400).json({ error: 'document_id is required' });
    }

    console.log(`🎯 Generating sprint for user ${userId}, document ${document_id}`);

    // Get document info and user's reading progress
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        total_pages,
        document_pages (
          page_number,
          is_completed,
          time_spent_seconds
        )
      `)
      .eq('id', document_id)
      .eq('user_id', userId)
      .single();

    if (docError) {
      console.error('Document fetch error:', docError);
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get user's average reading speed
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('average_reading_speed_seconds')
      .eq('user_id', userId)
      .single();

    const avgSpeed = userStats?.average_reading_speed_seconds || 120; // 2 minutes default

    // Find next unread pages
    const completedPages = document.document_pages
      .filter(p => p.is_completed)
      .map(p => p.page_number)
      .sort((a, b) => a - b);

    let nextPage = 1;
    for (let i = 1; i <= document.total_pages; i++) {
      if (!completedPages.includes(i)) {
        nextPage = i;
        break;
      }
    }

    // Calculate sprint suggestion based on time constraints
    const targetStudyTime = 30 * 60; // 30 minutes default
    const pagesInSprint = Math.max(1, Math.floor(targetStudyTime / avgSpeed));
    const endPage = Math.min(nextPage + pagesInSprint - 1, document.total_pages);

    const sprintSuggestion = {
      document_id: document.id,
      document_title: document.title,
      start_page: nextPage,
      end_page: endPage,
      total_pages: endPage - nextPage + 1,
      estimated_time_seconds: (endPage - nextPage + 1) * avgSpeed,
      next_unread_page: nextPage,
      completion_status: {
        total_pages: document.total_pages,
        completed_pages: completedPages.length,
        remaining_pages: document.total_pages - completedPages.length,
        completion_percentage: Math.round((completedPages.length / document.total_pages) * 100)
      }
    };

    res.json({ sprint_suggestion: sprintSuggestion });
  } catch (error) {
    console.error('Generate sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new sprint
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      document_id, 
      start_page, 
      end_page, 
      target_date 
    } = req.body;
    const userId = req.user.id;

    if (!document_id || !start_page || !end_page) {
      return res.status(400).json({ 
        error: 'document_id, start_page, and end_page are required' 
      });
    }

    // Get user's average speed to estimate time
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('average_reading_speed_seconds')
      .eq('user_id', userId)
      .single();

    const avgSpeed = userStats?.average_reading_speed_seconds || 120;
    const estimatedTime = (end_page - start_page + 1) * avgSpeed;

    const { data, error } = await supabase
      .from('sprints')
      .insert({
        user_id: userId,
        document_id,
        start_page: parseInt(start_page),
        end_page: parseInt(end_page),
        estimated_time_seconds: estimatedTime,
        target_date: target_date || new Date().toISOString().split('T')[0],
        status: 'pending'
      })
      .select()
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

// Get today's sprint
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('sprints')
      .select(`
        *,
        documents (
          title,
          total_pages
        )
      `)
      .eq('user_id', req.user.id)
      .eq('target_date', today)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Fetch today sprint error:', error);
      return res.status(500).json({ error: 'Failed to fetch today\'s sprint' });
    }

    res.json({ 
      sprint: data.length > 0 ? data[0] : null,
      has_sprint_today: data.length > 0
    });
  } catch (error) {
    console.error('Get today sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's sprints
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 10 } = req.query;
    
    let query = supabase
      .from('sprints')
      .select(`
        *,
        documents (
          title,
          total_pages
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch sprints error:', error);
      return res.status(500).json({ error: 'Failed to fetch sprints' });
    }

    res.json({ sprints: data });
  } catch (error) {
    console.error('Get sprints error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start a sprint
router.patch('/:id/start', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('sprints')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Start sprint error:', error);
      return res.status(500).json({ error: 'Failed to start sprint' });
    }

    res.json({ 
      message: 'Sprint started successfully',
      sprint: data 
    });
  } catch (error) {
    console.error('Start sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete a sprint
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { actual_time_seconds } = req.body;

    const { data, error } = await supabase
      .from('sprints')
      .update({
        status: 'completed',
        actual_time_seconds: actual_time_seconds || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Complete sprint error:', error);
      return res.status(500).json({ error: 'Failed to complete sprint' });
    }

    res.json({ 
      message: 'Sprint completed successfully! 🎉',
      sprint: data,
      celebration: generateCelebrationMessage()
    });
  } catch (error) {
    console.error('Complete sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate celebration messages
function generateCelebrationMessage() {
  const messages = [
    { emoji: '🎉', text: 'Sprint completed! You\'re crushing your reading goals!' },
    { emoji: '🚀', text: 'Amazing work! Your reading momentum is building!' },
    { emoji: '🏆', text: 'Sprint champion! Keep up the excellent progress!' },
    { emoji: '📚', text: 'Knowledge gained! Another successful reading session!' },
    { emoji: '💪', text: 'Reading warrior! Your dedication is paying off!' }
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

module.exports = router;