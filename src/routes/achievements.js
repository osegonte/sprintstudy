const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all available achievements with user progress
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { category } = req.query;
    const userId = req.user.id;

    // Get all achievements
    let query = supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('requirement_value', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: achievements, error } = await query;

    if (error) {
      console.error('Fetch achievements error:', error);
      return res.status(500).json({ error: 'Failed to fetch achievements' });
    }

    // Get user's earned achievements
    const { data: userAchievements, error: userError } = await supabase
      .from('user_achievements')
      .select('achievement_id, earned_at, progress_value')
      .eq('user_id', userId);

    if (userError) {
      console.error('Fetch user achievements error:', userError);
    }

    // Get user stats for progress calculation
    const { data: userStats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (statsError) {
      console.error('Fetch user stats error:', statsError);
    }

    // Get additional metrics for achievements
    const { data: sprintData } = await supabase
      .from('sprints')
      .select('status, completion_quality')
      .eq('user_id', userId);

    const completedSprints = sprintData?.filter(s => s.status === 'completed').length || 0;
    const perfectSprints = sprintData?.filter(s => s.completion_quality === 5).length || 0;

    // Create user achievements map
    const earnedMap = new Map();
    userAchievements?.forEach(ua => {
      earnedMap.set(ua.achievement_id, {
        earned_at: ua.earned_at,
        progress_value: ua.progress_value
      });
    });

    // Calculate progress for each achievement
    const achievementsWithProgress = achievements.map(achievement => {
      const isEarned = earnedMap.has(achievement.id);
      let currentProgress = 0;
      let progressPercentage = 0;

      if (!isEarned) {
        // Calculate current progress based on achievement type
        switch (achievement.requirement_type) {
          case 'documents_uploaded':
            currentProgress = userStats?.total_documents || 0;
            break;
          case 'pages_read':
            currentProgress = userStats?.total_pages_read || 0;
            break;
          case 'streak_days':
            currentProgress = userStats?.current_streak_days || 0;
            break;
          case 'total_time_hours':
            currentProgress = Math.floor((userStats?.total_time_spent_seconds || 0) / 3600);
            break;
          case 'sprints_completed':
            currentProgress = completedSprints;
            break;
          case 'perfect_focus_sprints':
            currentProgress = perfectSprints;
            break;
          case 'avg_page_time':
            currentProgress = userStats?.average_reading_speed_seconds || 0;
            // For speed achievements, reverse the logic (lower is better)
            if (currentProgress <= achievement.requirement_value && currentProgress > 0) {
              progressPercentage = 100;
            } else {
              progressPercentage = Math.min(100, (achievement.requirement_value / currentProgress) * 100);
            }
            break;
          default:
            currentProgress = 0;
        }

        // Calculate percentage for non-speed achievements
        if (achievement.requirement_type !== 'avg_page_time') {
          progressPercentage = Math.min(100, (currentProgress / achievement.requirement_value) * 100);
        }
      } else {
        currentProgress = achievement.requirement_value;
        progressPercentage = 100;
      }

      return {
        ...achievement,
        is_earned: isEarned,
        earned_at: earnedMap.get(achievement.id)?.earned_at || null,
        current_progress: currentProgress,
        progress_percentage: Math.round(progressPercentage),
        is_close: !isEarned && progressPercentage >= 80, // Close to earning
        is_new: isEarned && earnedMap.get(achievement.id)?.earned_at && 
          new Date(earnedMap.get(achievement.id).earned_at) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Earned in last 24h
      };
    });

    // Group by category
    const groupedAchievements = achievementsWithProgress.reduce((acc, achievement) => {
      if (!acc[achievement.category]) {
        acc[achievement.category] = [];
      }
      acc[achievement.category].push(achievement);
      return acc;
    }, {});

    // Calculate user achievement stats
    const earnedCount = achievementsWithProgress.filter(a => a.is_earned).length;
    const totalPoints = achievementsWithProgress
      .filter(a => a.is_earned)
      .reduce((sum, a) => sum + a.points, 0);

    res.json({
      achievements: groupedAchievements,
      user_progress: {
        total_achievements: achievements.length,
        earned_achievements: earnedCount,
        completion_percentage: Math.round((earnedCount / achievements.length) * 100),
        total_points: totalPoints,
        current_level: userStats?.current_level || 1,
        total_xp: userStats?.total_xp_points || 0
      }
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check and award achievements for a user
router.post('/check', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`🏆 Checking achievements for user ${userId}`);

    const newAchievements = await checkAndAwardAchievements(userId);

    res.json({
      message: `Checked achievements for user`,
      new_achievements: newAchievements,
      count: newAchievements.length
    });
  } catch (error) {
    console.error('Check achievements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's recent achievements
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const userId = req.user.id;

    const { data: recentAchievements, error } = await supabase
      .from('user_achievements')
      .select(`
        earned_at,
        achievements (
          code,
          title,
          description,
          icon,
          category,
          points,
          rarity
        )
      `)
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error('Fetch recent achievements error:', error);
      return res.status(500).json({ error: 'Failed to fetch recent achievements' });
    }

    res.json({ recent_achievements: recentAchievements });
  } catch (error) {
    console.error('Get recent achievements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leaderboard (optional feature)
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const { type = 'xp', limit = 10 } = req.query;

    let orderColumn = 'total_xp_points';
    if (type === 'streak') orderColumn = 'longest_streak_days';
    else if (type === 'pages') orderColumn = 'total_pages_read';
    else if (type === 'time') orderColumn = 'total_time_spent_seconds';

    const { data: leaderboard, error } = await supabase
      .from('user_stats')
      .select(`
        user_id,
        ${orderColumn},
        current_level,
        current_streak_days,
        total_pages_read
      `)
      .order(orderColumn, { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error('Fetch leaderboard error:', error);
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }

    // Get user profiles for display names
    const userIds = leaderboard.map(entry => entry.user_id);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username')
      .in('id', userIds);

    const profileMap = new Map();
    profiles?.forEach(profile => {
      profileMap.set(profile.id, profile.username);
    });

    const leaderboardWithNames = leaderboard.map((entry, index) => ({
      rank: index + 1,
      user_id: entry.user_id,
      username: profileMap.get(entry.user_id) || 'Anonymous',
      value: entry[orderColumn],
      level: entry.current_level,
      current_streak: entry.current_streak_days,
      total_pages: entry.total_pages_read
    }));

    res.json({
      leaderboard: leaderboardWithNames,
      type: type,
      your_rank: leaderboardWithNames.findIndex(entry => entry.user_id === req.user.id) + 1 || null
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================
// ACHIEVEMENT CHECKING LOGIC
// =====================================

async function checkAndAwardAchievements(userId) {
  try {
    // Get user stats
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!userStats) return [];

    // Get additional metrics
    const { data: sprintData } = await supabase
      .from('sprints')
      .select('status, completion_quality, focus_score')
      .eq('user_id', userId);

    const { data: sessionData } = await supabase
      .from('study_sessions')
      .select('focus_score')
      .eq('user_id', userId)
      .not('focus_score', 'is', null);

    // Get already earned achievements
    const { data: earnedAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);

    const earnedIds = new Set(earnedAchievements?.map(ea => ea.achievement_id) || []);

    // Get all available achievements
    const { data: allAchievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true);

    const newAchievements = [];

    // Calculate metrics
    const completedSprints = sprintData?.filter(s => s.status === 'completed').length || 0;
    const perfectSprints = sprintData?.filter(s => s.completion_quality === 5).length || 0;
    const highFocusSessions = sessionData?.filter(s => s.focus_score >= 0.9).length || 0;
    const ultraFocusSessions = sessionData?.filter(s => s.focus_score >= 0.95).length || 0;
    const totalTimeHours = Math.floor(userStats.total_time_spent_seconds / 3600);

    // Check each achievement
    for (const achievement of allAchievements) {
      if (earnedIds.has(achievement.id)) continue; // Already earned

      let shouldAward = false;
      let currentValue = 0;

      switch (achievement.requirement_type) {
        case 'documents_uploaded':
          currentValue = userStats.total_documents;
          shouldAward = currentValue >= achievement.requirement_value;
          break;

        case 'pages_read':
          currentValue = userStats.total_pages_read;
          shouldAward = currentValue >= achievement.requirement_value;
          break;

        case 'streak_days':
          currentValue = userStats.current_streak_days;
          shouldAward = currentValue >= achievement.requirement_value;
          break;

        case 'total_time_hours':
          currentValue = totalTimeHours;
          shouldAward = currentValue >= achievement.requirement_value;
          break;

        case 'sprints_completed':
          currentValue = completedSprints;
          shouldAward = currentValue >= achievement.requirement_value;
          break;

        case 'perfect_focus_sprints':
          currentValue = perfectSprints;
          shouldAward = currentValue >= achievement.requirement_value;
          break;

        case 'high_focus_sessions':
          currentValue = highFocusSessions;
          shouldAward = currentValue >= achievement.requirement_value;
          break;

        case 'ultra_focus_sessions':
          currentValue = ultraFocusSessions;
          shouldAward = currentValue >= achievement.requirement_value;
          break;

        case 'avg_page_time':
          currentValue = userStats.average_reading_speed_seconds;
          shouldAward = currentValue > 0 && currentValue <= achievement.requirement_value;
          break;

        default:
          console.log(`Unknown achievement requirement type: ${achievement.requirement_type}`);
          continue;
      }

      if (shouldAward) {
        // Award the achievement
        const { error: awardError } = await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: achievement.id,
            progress_value: currentValue
          });

        if (!awardError) {
          newAchievements.push(achievement);
          
          // Award XP points
          if (achievement.points > 0) {
            await awardXP(userId, achievement.points);
          }

          console.log(`🏆 Awarded achievement "${achievement.title}" to user ${userId}`);
        } else {
          console.error('Error awarding achievement:', awardError);
        }
      }
    }

    return newAchievements;
  } catch (error) {
    console.error('Check and award achievements error:', error);
    return [];
  }
}

async function awardXP(userId, points) {
  try {
    const { data: currentStats } = await supabase
      .from('user_stats')
      .select('total_xp_points')
      .eq('user_id', userId)
      .single();

    if (currentStats) {
      const newXP = currentStats.total_xp_points + points;
      const newLevel = calculateUserLevel(newXP);

      await supabase
        .from('user_stats')
        .update({
          total_xp_points: newXP,
          current_level: newLevel,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      console.log(`✨ Awarded ${points} XP to user ${userId} (Total: ${newXP}, Level: ${newLevel})`);
    }
  } catch (error) {
    console.error('Award XP error:', error);
  }
}

function calculateUserLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

// Export the achievement checking function for use in other modules
module.exports = router;
module.exports.checkAndAwardAchievements = checkAndAwardAchievements;