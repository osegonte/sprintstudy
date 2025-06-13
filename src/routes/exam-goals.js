const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all user exam goals
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status = 'active', include_completed = false } = req.query;
    
    let query = supabase
      .from('exam_goals')
      .select(`
        *,
        topics (
          id,
          name,
          color,
          icon
        )
      `)
      .eq('user_id', req.user.id);

    if (include_completed !== 'true') {
      query = query.eq('is_completed', false);
    }

    query = query.order('exam_date', { ascending: true });

    const { data: examGoals, error } = await query;

    if (error) {
      console.error('Fetch exam goals error:', error);
      return res.status(500).json({ error: 'Failed to fetch exam goals' });
    }

    // Calculate progress and urgency for each goal
    const goalsWithProgress = await Promise.all(
      examGoals.map(async (goal) => {
        // Get topic progress if associated with a topic
        let topicProgress = null;
        if (goal.topic_id) {
          const { data: documents } = await supabase
            .from('documents')
            .select(`
              id,
              total_pages,
              document_pages (
                is_completed,
                time_spent_seconds
              )
            `)
            .eq('topic_id', goal.topic_id);

          if (documents && documents.length > 0) {
            const totalPages = documents.reduce((sum, doc) => sum + doc.total_pages, 0);
            const completedPages = documents.reduce((sum, doc) => 
              sum + doc.document_pages.filter(p => p.is_completed).length, 0
            );
            const totalTimeSpent = documents.reduce((sum, doc) => 
              sum + doc.document_pages.reduce((pageSum, p) => pageSum + p.time_spent_seconds, 0), 0
            );

            topicProgress = {
              total_pages: totalPages,
              completed_pages: completedPages,
              completion_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0,
              total_time_spent_seconds: totalTimeSpent
            };
          }
        }

        // Calculate time-based metrics
        const today = new Date();
        const examDate = new Date(goal.exam_date);
        const daysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
        
        // Calculate required daily pace
        const remainingPages = topicProgress ? (topicProgress.total_pages - topicProgress.completed_pages) : 0;
        const requiredPagesPerDay = daysUntilExam > 0 ? Math.ceil(remainingPages / daysUntilExam) : 0;
        
        // Get user's average reading speed
        const { data: userStats } = await supabase
          .from('user_stats')
          .select('average_reading_speed_seconds')
          .eq('user_id', req.user.id)
          .single();

        const avgSpeed = userStats?.average_reading_speed_seconds || 120;
        const requiredStudyTimePerDay = requiredPagesPerDay * avgSpeed;

        // Determine urgency level
        let urgencyLevel = 'low';
        if (daysUntilExam <= 0) urgencyLevel = 'overdue';
        else if (daysUntilExam <= 3) urgencyLevel = 'critical';
        else if (daysUntilExam <= 7) urgencyLevel = 'high';
        else if (daysUntilExam <= 14) urgencyLevel = 'medium';

        // Check if on track
        const targetCompletionRate = Math.max(0, 100 - ((daysUntilExam / Math.ceil((examDate - new Date(goal.created_at)) / (1000 * 60 * 60 * 24))) * 100));
        const currentCompletionRate = topicProgress?.completion_percentage || 0;
        const onTrack = currentCompletionRate >= (targetCompletionRate - 10); // 10% tolerance

        return {
          ...goal,
          topic_progress: topicProgress,
          time_metrics: {
            days_until_exam: daysUntilExam,
            required_pages_per_day: requiredPagesPerDay,
            required_study_time_seconds_per_day: requiredStudyTimePerDay,
            urgency_level: urgencyLevel,
            on_track: onTrack,
            target_completion_rate: Math.round(targetCompletionRate),
            current_completion_rate: currentCompletionRate
          }
        };
      })
    );

    res.json({ exam_goals: goalsWithProgress });
  } catch (error) {
    console.error('Get exam goals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new exam goal
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      exam_date, 
      topic_id,
      target_score,
      study_hours_per_day = 1.0,
      difficulty_level = 3
    } = req.body;

    if (!title || !exam_date) {
      return res.status(400).json({ error: 'Title and exam date are required' });
    }

    // Validate exam date is in the future
    const examDateObj = new Date(exam_date);
    if (examDateObj <= new Date()) {
      return res.status(400).json({ error: 'Exam date must be in the future' });
    }

    // Validate topic_id exists if provided
    if (topic_id) {
      const { data: topic, error: topicError } = await supabase
        .from('topics')
        .select('id')
        .eq('id', topic_id)
        .eq('user_id', req.user.id)
        .single();

      if (topicError || !topic) {
        return res.status(400).json({ error: 'Invalid topic ID' });
      }
    }

    const { data, error } = await supabase
      .from('exam_goals')
      .insert({
        user_id: req.user.id,
        title,
        description,
        exam_date,
        topic_id,
        target_score,
        study_hours_per_day,
        difficulty_level
      })
      .select(`
        *,
        topics (
          id,
          name,
          color,
          icon
        )
      `)
      .single();

    if (error) {
      console.error('Create exam goal error:', error);
      return res.status(500).json({ error: 'Failed to create exam goal' });
    }

    res.status(201).json({ 
      message: 'Exam goal created successfully',
      exam_goal: data 
    });
  } catch (error) {
    console.error('Create exam goal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific exam goal with detailed analytics
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: examGoal, error } = await supabase
      .from('exam_goals')
      .select(`
        *,
        topics (
          id,
          name,
          color,
          icon,
          description
        )
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Exam goal not found' });
      }
      return res.status(500).json({ error: 'Failed to fetch exam goal' });
    }

    // Get detailed progress data
    let progressData = null;
    if (examGoal.topic_id) {
      const { data: documents } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          total_pages,
          difficulty_level,
          document_pages (
            page_number,
            is_completed,
            time_spent_seconds,
            last_read_at
          )
        `)
        .eq('topic_id', examGoal.topic_id)
        .order('created_at', { ascending: true });

      if (documents) {
        const totalPages = documents.reduce((sum, doc) => sum + doc.total_pages, 0);
        const completedPages = documents.reduce((sum, doc) => 
          sum + doc.document_pages.filter(p => p.is_completed).length, 0
        );
        const totalTimeSpent = documents.reduce((sum, doc) => 
          sum + doc.document_pages.reduce((pageSum, p) => pageSum + p.time_spent_seconds, 0), 0
        );

        // Calculate reading velocity (pages per day over last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentPages = documents.flatMap(doc => 
          doc.document_pages.filter(p => 
            p.last_read_at && new Date(p.last_read_at) >= sevenDaysAgo
          )
        );

        const readingVelocity = recentPages.length / 7; // pages per day

        progressData = {
          documents: documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            total_pages: doc.total_pages,
            completed_pages: doc.document_pages.filter(p => p.is_completed).length,
            completion_percentage: Math.round((doc.document_pages.filter(p => p.is_completed).length / doc.total_pages) * 100),
            difficulty_level: doc.difficulty_level
          })),
          summary: {
            total_pages: totalPages,
            completed_pages: completedPages,
            completion_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0,
            total_time_spent_seconds: totalTimeSpent,
            reading_velocity_pages_per_day: readingVelocity
          }
        };
      }
    }

    // Calculate study plan recommendations
    const today = new Date();
    const examDate = new Date(examGoal.exam_date);
    const daysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
    
    let studyPlan = null;
    if (progressData && daysUntilExam > 0) {
      const remainingPages = progressData.summary.total_pages - progressData.summary.completed_pages;
      const requiredPagesPerDay = Math.ceil(remainingPages / daysUntilExam);
      
      // Get user's reading speed
      const { data: userStats } = await supabase
        .from('user_stats')
        .select('average_reading_speed_seconds')
        .eq('user_id', req.user.id)
        .single();

      const avgSpeed = userStats?.average_reading_speed_seconds || 120;
      const requiredMinutesPerDay = Math.round((requiredPagesPerDay * avgSpeed) / 60);

      studyPlan = {
        remaining_pages: remainingPages,
        required_pages_per_day: requiredPagesPerDay,
        required_minutes_per_day: requiredMinutesPerDay,
        recommended_sessions_per_day: Math.ceil(requiredMinutesPerDay / 30), // 30-min sessions
        difficulty_adjustment: examGoal.difficulty_level >= 4 ? 1.2 : 1.0, // 20% extra time for hard exams
        feasibility: requiredMinutesPerDay <= (examGoal.study_hours_per_day * 60) ? 'achievable' : 'challenging'
      };
    }

    const examGoalWithDetails = {
      ...examGoal,
      progress_data: progressData,
      study_plan: studyPlan,
      time_metrics: {
        days_until_exam: daysUntilExam,
        is_overdue: daysUntilExam <= 0,
        urgency_level: daysUntilExam <= 0 ? 'overdue' : 
                      daysUntilExam <= 3 ? 'critical' :
                      daysUntilExam <= 7 ? 'high' :
                      daysUntilExam <= 14 ? 'medium' : 'low'
      }
    };

    res.json({ exam_goal: examGoalWithDetails });
  } catch (error) {
    console.error('Get exam goal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update exam goal
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      exam_date, 
      topic_id,
      target_score,
      study_hours_per_day,
      difficulty_level,
      is_completed,
      actual_score
    } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (exam_date !== undefined) {
      // Validate future date
      const examDateObj = new Date(exam_date);
      if (examDateObj <= new Date() && !is_completed) {
        return res.status(400).json({ error: 'Exam date must be in the future unless marking as completed' });
      }
      updates.exam_date = exam_date;
    }
    if (topic_id !== undefined) updates.topic_id = topic_id;
    if (target_score !== undefined) updates.target_score = target_score;
    if (study_hours_per_day !== undefined) updates.study_hours_per_day = study_hours_per_day;
    if (difficulty_level !== undefined) updates.difficulty_level = difficulty_level;
    if (is_completed !== undefined) updates.is_completed = is_completed;
    if (actual_score !== undefined) updates.actual_score = actual_score;
    
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('exam_goals')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select(`
        *,
        topics (
          id,
          name,
          color,
          icon
        )
      `)
      .single();

    if (error) {
      console.error('Update exam goal error:', error);
      return res.status(500).json({ error: 'Failed to update exam goal' });
    }

    res.json({ 
      message: 'Exam goal updated successfully',
      exam_goal: data 
    });
  } catch (error) {
    console.error('Update exam goal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete exam goal
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('exam_goals')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Delete exam goal error:', error);
      return res.status(500).json({ error: 'Failed to delete exam goal' });
    }

    res.json({ message: 'Exam goal deleted successfully' });
  } catch (error) {
    console.error('Delete exam goal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate study schedule for exam goal
router.post('/:id/generate-schedule', authMiddleware, async (req, res) => {
  try {
    const { sessions_per_day = 2, session_duration_minutes = 30 } = req.body;

    const { data: examGoal, error } = await supabase
      .from('exam_goals')
      .select(`
        *,
        topics (
          id,
          name
        )
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Exam goal not found' });
    }

    if (!examGoal.topic_id) {
      return res.status(400).json({ error: 'Exam goal must be associated with a topic to generate schedule' });
    }

    // Get documents and their progress
    const { data: documents } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        total_pages,
        document_pages (
          page_number,
          is_completed
        )
      `)
      .eq('topic_id', examGoal.topic_id)
      .order('priority', { ascending: true });

    if (!documents || documents.length === 0) {
      return res.status(400).json({ error: 'No documents found for this topic' });
    }

    // Calculate remaining pages
    const allPages = documents.flatMap(doc => 
      doc.document_pages.map(page => ({
        document_id: doc.id,
        document_title: doc.title,
        page_number: page.page_number,
        is_completed: page.is_completed
      }))
    );

    const remainingPages = allPages.filter(page => !page.is_completed);

    if (remainingPages.length === 0) {
      return res.status(200).json({ 
        message: 'All pages completed!',
        schedule: []
      });
    }

    // Calculate schedule
    const today = new Date();
    const examDate = new Date(examGoal.exam_date);
    const daysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 1000));

    if (daysUntilExam <= 0) {
      return res.status(400).json({ error: 'Exam date has passed' });
    }

    const totalSessionsAvailable = daysUntilExam * sessions_per_day;
    const pagesPerSession = Math.ceil(remainingPages.length / totalSessionsAvailable);

    // Generate schedule
    const schedule = [];
    let pageIndex = 0;
    
    for (let day = 0; day < daysUntilExam && pageIndex < remainingPages.length; day++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(scheduleDate.getDate() + day);
      
      for (let session = 0; session < sessions_per_day && pageIndex < remainingPages.length; session++) {
        const sessionPages = remainingPages.slice(pageIndex, pageIndex + pagesPerSession);
        
        if (sessionPages.length > 0) {
          // Group pages by document for better organization
          const pagesByDocument = sessionPages.reduce((acc, page) => {
            if (!acc[page.document_id]) {
              acc[page.document_id] = {
                document_id: page.document_id,
                document_title: page.document_title,
                pages: []
              };
            }
            acc[page.document_id].pages.push(page.page_number);
            return acc;
          }, {});

          schedule.push({
            date: scheduleDate.toISOString().split('T')[0],
            session_number: session + 1,
            estimated_duration_minutes: session_duration_minutes,
            documents: Object.values(pagesByDocument),
            total_pages: sessionPages.length
          });

          pageIndex += sessionPages.length;
        }
      }
    }

    res.json({ 
      schedule,
      summary: {
        total_days: daysUntilExam,
        total_sessions: schedule.length,
        total_pages: remainingPages.length,
        pages_per_session: pagesPerSession,
        estimated_total_hours: Math.round((schedule.length * session_duration_minutes) / 60)
      }
    });
  } catch (error) {
    console.error('Generate schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;