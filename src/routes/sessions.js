const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Start a study session
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { document_id, sprint_id } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        document_id,
        sprint_id,
        start_time: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Start session error:', error);
      return res.status(500).json({ error: 'Failed to start study session' });
    }

    res.status(201).json({ session: data });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End a study session
router.patch('/:id/end', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { pages_read, total_time_seconds } = req.body;

    const average_speed = pages_read > 0 ? total_time_seconds / pages_read : 0;

    const { data, error } = await supabase
      .from('study_sessions')
      .update({
        end_time: new Date().toISOString(),
        pages_read,
        total_time_seconds,
        average_speed_seconds: average_speed
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('End session error:', error);
      return res.status(500).json({ error: 'Failed to end study session' });
    }

    res.json({ session: data });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's study sessions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 10, document_id } = req.query;
    
    let query = supabase
      .from('study_sessions')
      .select(`
        *,
        documents (
          title
        ),
        sprints (
          start_page,
          end_page
        )
      `)
      .eq('user_id', req.user.id)
      .order('start_time', { ascending: false })
      .limit(parseInt(limit));

    if (document_id) {
      query = query.eq('document_id', document_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch sessions error:', error);
      return res.status(500).json({ error: 'Failed to fetch study sessions' });
    }

    res.json({ sessions: data });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
