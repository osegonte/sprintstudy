
// src/routes/progress.js
const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Record time spent on a page
router.post('/page', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number, time_spent_seconds } = req.body;
    const userId = req.user.id;

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

    res.json({ message: 'Progress recorded successfully' });
  } catch (error) {
    console.error('Record progress error:', error);
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
    const masteredPages = data.filter(page => page.is_mastered).length;
    const totalTimeSpent = data.reduce((sum, page) => sum + page.time_spent_seconds, 0);

    res.json({
      pages: data,
      summary: {
        total_pages: totalPages,
        mastered_pages: masteredPages,
        completion_percentage: totalPages > 0 ? (masteredPages / totalPages) * 100 : 0,
        total_time_spent_seconds: totalTimeSpent
      }
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark page as mastered
router.put('/page/:document_id/:page_number/master', authMiddleware, async (req, res) => {
  try {
    const { document_id, page_number } = req.params;
    const { is_mastered } = req.body;

    const { error } = await supabase
      .from('document_pages')
      .update({
        is_mastered: is_mastered,
        updated_at: new Date().toISOString()
      })
      .eq('document_id', document_id)
      .eq('page_number', parseInt(page_number))
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Update mastery error:', error);
      return res.status(500).json({ error: 'Failed to update mastery status' });
    }

    res.json({ message: 'Mastery status updated successfully' });
  } catch (error) {
    console.error('Update mastery error:', error);
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
            average_reading_speed_seconds: 0,
            total_pages_read: 0,
            total_time_spent_seconds: 0
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
        average_reading_speed_seconds: newAverageSpeed,
        total_pages_read: newTotalPagesRead,
        total_time_spent_seconds: newTotalTimeSpent,
        updated_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('Error updating user stats:', upsertError);
    }
  } catch (error) {
    console.error('Update stats helper error:', error);
  }
}

module.exports = router;