const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Generate daily sprint suggestion
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { document_id } = req.body;
    const userId = req.user.id;

    // Call the database function to generate sprint
    const { data, error } = await supabase.rpc('generate_daily_sprint', {
      user_uuid: userId,
      doc_id: document_id
    });

    if (error) {
      console.error('Generate sprint error:', error);
      return res.status(500).json({ error: 'Failed to generate sprint' });
    }

    res.json({ sprint_suggestion: data });
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
      estimated_time_seconds,
      target_date 
    } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('sprints')
      .insert({
        user_id: userId,
        document_id,
        start_page,
        end_page,
        estimated_time_seconds,
        target_date: target_date || new Date().toISOString().split('T')[0],
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Create sprint error:', error);
      return res.status(500).json({ error: 'Failed to create sprint' });
    }

    res.status(201).json({ sprint: data });
  } catch (error) {
    console.error('Create sprint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's sprints
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, date, document_id } = req.query;
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
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (date) {
      query = query.eq('target_date', date);
    }

    if (document_id) {
      query = query.eq('document_id', document_id);
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

    // Update sprint status and create study session
    const { data: sprint, error: sprintError } = await supabase
      .from('sprints')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
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
        sprint_id: id,
        start_time: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Create session error:', sessionError);
    }

    res.json({ 
      sprint, 
      session: session || null,
      message: 'Sprint started successfully' 
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
        actual_time_seconds,
        completed_at: new Date().toISOString(),
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

    // Update user stats
    await updateUserStatsOnSprintComplete(req.user.id);

    // Check for achievements
    await checkAndAwardAchievements(req.user.id, 'sprint_completed');

    res.json({ sprint: data, message: 'Sprint completed successfully' });
  } catch (error) {
    console.error('Complete sprint error:', error);
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

// Helper functions
async function updateUserStatsOnSprintComplete(userId) {
  try {
    const { data: currentStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    const today = new Date().toISOString().split('T')[0];
    const lastStudyDate = currentStats?.last_study_date;
    
    let newStreak = 1;
    if (lastStudyDate) {
      const lastDate = new Date(lastStudyDate);
      const todayDate = new Date(today);
      const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        newStreak = (currentStats.study_streak_days || 0) + 1;
      } else if (daysDiff === 0) {
        newStreak = currentStats.study_streak_days || 1;
      }
    }

    await supabase
      .from('user_stats')
      .upsert({
        user_id: userId,
        total_sprints_completed: (currentStats?.total_sprints_completed || 0) + 1,
        study_streak_days: newStreak,
        longest_streak_days: Math.max(newStreak, currentStats?.longest_streak_days || 0),
        last_study_date: today,
        updated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Update user stats error:', error);
  }
}

async function checkAndAwardAchievements(userId, achievementType) {
  try {
    if (achievementType === 'sprint_completed') {
      const { data: stats } = await supabase
        .from('user_stats')
        .select('total_sprints_completed, study_streak_days')
        .eq('user_id', userId)
        .single();

      const achievements = [];

      // First sprint achievement
      if (stats.total_sprints_completed === 1) {
        achievements.push({
          user_id: userId,
          achievement_type: 'first_sprint',
          achievement_name: 'First Sprint',
          description: 'Completed your first study sprint!'
        });
      }

      // Sprint milestones
      if ([10, 25, 50, 100].includes(stats.total_sprints_completed)) {
        achievements.push({
          user_id: userId,
          achievement_type: 'sprint_milestone',
          achievement_name: `${stats.total_sprints_completed} Sprints`,
          description: `Completed ${stats.total_sprints_completed} study sprints!`
        });
      }

      // Streak achievements
      if ([3, 7, 14, 30].includes(stats.study_streak_days)) {
        achievements.push({
          user_id: userId,
          achievement_type: 'study_streak',
          achievement_name: `${stats.study_streak_days} Day Streak`,
          description: `Studied for ${stats.study_streak_days} consecutive days!`
        });
      }

      if (achievements.length > 0) {
        await supabase.from('achievements').insert(achievements);
      }
    }
  } catch (error) {
    console.error('Check achievements error:', error);
  }
}

module.exports = router;
