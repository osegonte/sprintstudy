const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Record time spent on a page
router.post('/page', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number, time_spent_seconds } = req.body;
    const userId = req.user.id;

    if (!document_id || !page_number || time_spent_seconds === undefined) {
      return res.status(400).json({ 
        error: 'document_id, page_number, and time_spent_seconds are required' 
      });
    }

    console.log(`📊 Recording progress: User ${userId}, Doc ${document_id}, Page ${page_number}, Time ${time_spent_seconds}s`);

    // Update page data
    const { error: updateError } = await supabase
      .from('document_pages')
      .update({
        time_spent_seconds: time_spent_seconds,
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('document_id', document_id)
      .eq('page_number', page_number)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Update page error:', updateError);
      return res.status(500).json({ error: 'Failed to update page progress' });
    }

    // Update user stats
    await updateUserStats(userId, time_spent_seconds);

    res.json({ 
      message: 'Progress recorded successfully',
      page_number: page_number,
      time_spent_seconds: time_spent_seconds
    });
  } catch (error) {
    console.error('Record progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark page as completed
router.patch('/page/:document_id/:page_number/complete', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number } = req.params;
    const { is_completed = true } = req.body;

    const { error } = await supabase
      .from('document_pages')
      .update({
        is_completed: is_completed,
        updated_at: new Date().toISOString()
      })
      .eq('document_id', document_id)
      .eq('page_number', parseInt(page_number))
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Update completion error:', error);
      return res.status(500).json({ error: 'Failed to update completion status' });
    }

    res.json({ 
      message: `Page ${is_completed ? 'completed' : 'uncompleted'} successfully`,
      page_number: parseInt(page_number),
      is_completed: is_completed
    });
  } catch (error) {
    console.error('Update completion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reading progress for a document
router.get('/document/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('document_pages')
      .select('*')
      .eq('document_id', req.params.id)
      .eq('user_id', req.user.id)
      .order('page_number');

    if (error) {
      console.error('Fetch progress error:', error);
      return res.status(500).json({ error: 'Failed to fetch progress' });
    }

    const totalPages = data.length;
    const completedPages = data.filter(page => page.is_completed).length;
    const totalTimeSpent = data.reduce((sum, page) => sum + page.time_spent_seconds, 0);

    res.json({
      pages: data,
      summary: {
        total_pages: totalPages,
        completed_pages: completedPages,
        completion_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0,
        total_time_spent_seconds: totalTimeSpent,
        average_time_per_page: totalPages > 0 ? Math.round(totalTimeSpent / totalPages) : 0
      }
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user reading statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Create initial stats if they don't exist
        const { data: newStats, error: createError } = await supabase
          .from('user_stats')
          .insert({
            user_id: req.user.id,
            total_pages_read: 0,
            total_time_spent_seconds: 0,
            average_reading_speed_seconds: 0,
            total_documents: 0
          })
          .select()
          .single();

        if (createError) {
          return res.status(500).json({ error: 'Failed to create user stats' });
        }

        return res.json({ stats: newStats });
      }

      console.error('Fetch stats error:', error);
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }

    res.json({ stats: data });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to update user statistics
async function updateUserStats(userId, additionalTimeSpent) {
  try {
    // Get current stats
    const { data: currentStats, error: fetchError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching current stats:', fetchError);
      return;
    }

    // Calculate new stats
    const newTotalTimeSpent = (currentStats?.total_time_spent_seconds || 0) + additionalTimeSpent;
    const newTotalPagesRead = (currentStats?.total_pages_read || 0) + 1;
    const newAverageSpeed = newTotalTimeSpent / newTotalPagesRead;

    // Update or insert stats
    const { error: upsertError } = await supabase
      .from('user_stats')
      .upsert({
        user_id: userId,
        total_pages_read: newTotalPagesRead,
        total_time_spent_seconds: newTotalTimeSpent,
        average_reading_speed_seconds: newAverageSpeed,
        total_documents: currentStats?.total_documents || 0,
        updated_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('Error updating user stats:', upsertError);
    } else {
      console.log(`📊 Updated stats: ${newTotalPagesRead} pages, ${Math.round(newAverageSpeed)}s avg`);
    }
  } catch (error) {
    console.error('Update stats helper error:', error);
  }
}

module.exports = router;