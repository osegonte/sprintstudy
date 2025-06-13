const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all user topics with progress
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { include_archived = false } = req.query;
    
    let query = supabase
      .from('topic_progress')
      .select('*')
      .eq('user_id', req.user.id);
    
    if (include_archived !== 'true') {
      // We'll need to join with topics table to filter archived
      query = supabase
        .from('topics')
        .select(`
          id,
          name,
          description,
          color,
          icon,
          target_completion_date,
          priority,
          is_archived,
          created_at,
          updated_at
        `)
        .eq('user_id', req.user.id)
        .eq('is_archived', false)
        .order('priority', { ascending: true });
    }

    const { data: topics, error } = await query;

    if (error) {
      console.error('Fetch topics error:', error);
      return res.status(500).json({ error: 'Failed to fetch topics' });
    }

    // Get progress data for each topic
    const topicsWithProgress = await Promise.all(
      topics.map(async (topic) => {
        // Get documents count
        const { count: documentsCount } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topic.id);

        // Get pages progress
        const { data: pagesData } = await supabase
          .from('document_pages')
          .select('time_spent_seconds, is_completed')
          .in('document_id', 
            supabase
              .from('documents')
              .select('id')
              .eq('topic_id', topic.id)
          );

        const totalPages = pagesData?.length || 0;
        const completedPages = pagesData?.filter(p => p.is_completed).length || 0;
        const totalTimeSpent = pagesData?.reduce((sum, p) => sum + p.time_spent_seconds, 0) || 0;

        return {
          ...topic,
          total_documents: documentsCount || 0,
          total_pages: totalPages,
          completed_pages: completedPages,
          completion_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0,
          total_time_spent_seconds: totalTimeSpent
        };
      })
    );

    res.json({ topics: topicsWithProgress });
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new topic
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      color = '#667eea', 
      icon = '📚', 
      target_completion_date,
      priority = 3 
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Topic name is required' });
    }

    const { data, error } = await supabase
      .from('topics')
      .insert({
        user_id: req.user.id,
        name,
        description,
        color,
        icon,
        target_completion_date,
        priority
      })
      .select()
      .single();

    if (error) {
      console.error('Create topic error:', error);
      return res.status(500).json({ error: 'Failed to create topic' });
    }

    res.status(201).json({ 
      message: 'Topic created successfully',
      topic: data 
    });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific topic with detailed progress
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: topic, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Topic not found' });
      }
      return res.status(500).json({ error: 'Failed to fetch topic' });
    }

    // Get associated documents with progress
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        total_pages,
        difficulty_level,
        priority,
        created_at,
        document_pages (
          page_number,
          time_spent_seconds,
          is_completed
        )
      `)
      .eq('topic_id', topic.id)
      .order('priority', { ascending: true });

    if (docsError) {
      console.error('Fetch topic documents error:', docsError);
    }

    // Calculate detailed progress
    const documentsWithProgress = documents?.map(doc => {
      const completedPages = doc.document_pages.filter(p => p.is_completed).length;
      const totalTimeSpent = doc.document_pages.reduce((sum, p) => sum + p.time_spent_seconds, 0);
      
      return {
        id: doc.id,
        title: doc.title,
        total_pages: doc.total_pages,
        completed_pages: completedPages,
        completion_percentage: Math.round((completedPages / doc.total_pages) * 100),
        total_time_spent_seconds: totalTimeSpent,
        difficulty_level: doc.difficulty_level,
        priority: doc.priority,
        created_at: doc.created_at
      };
    }) || [];

    // Get exam goals for this topic
    const { data: examGoals } = await supabase
      .from('exam_goals')
      .select('*')
      .eq('topic_id', topic.id)
      .order('exam_date', { ascending: true });

    // Calculate overall topic stats
    const totalPages = documentsWithProgress.reduce((sum, doc) => sum + doc.total_pages, 0);
    const completedPages = documentsWithProgress.reduce((sum, doc) => sum + doc.completed_pages, 0);
    const totalTimeSpent = documentsWithProgress.reduce((sum, doc) => sum + doc.total_time_spent_seconds, 0);

    const topicWithDetails = {
      ...topic,
      documents: documentsWithProgress,
      exam_goals: examGoals || [],
      progress: {
        total_documents: documentsWithProgress.length,
        total_pages: totalPages,
        completed_pages: completedPages,
        completion_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0,
        total_time_spent_seconds: totalTimeSpent,
        average_time_per_page: totalPages > 0 ? Math.round(totalTimeSpent / totalPages) : 0
      }
    };

    res.json({ topic: topicWithDetails });
  } catch (error) {
    console.error('Get topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update topic
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      color, 
      icon, 
      target_completion_date,
      priority,
      is_archived 
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (target_completion_date !== undefined) updates.target_completion_date = target_completion_date;
    if (priority !== undefined) updates.priority = priority;
    if (is_archived !== undefined) updates.is_archived = is_archived;
    
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('topics')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Update topic error:', error);
      return res.status(500).json({ error: 'Failed to update topic' });
    }

    res.json({ 
      message: 'Topic updated successfully',
      topic: data 
    });
  } catch (error) {
    console.error('Update topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete topic
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if topic has documents
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', req.params.id);

    if (count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete topic with associated documents. Please move or delete documents first.' 
      });
    }

    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Delete topic error:', error);
      return res.status(500).json({ error: 'Failed to delete topic' });
    }

    res.json({ message: 'Topic deleted successfully' });
  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder topics (update priorities)
router.patch('/reorder', authMiddleware, async (req, res) => {
  try {
    const { topic_orders } = req.body; // Array of {id, priority}

    if (!Array.isArray(topic_orders)) {
      return res.status(400).json({ error: 'topic_orders must be an array' });
    }

    // Update all topics in a transaction-like manner
    const updates = topic_orders.map(async ({ id, priority }) => {
      return supabase
        .from('topics')
        .update({ priority, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', req.user.id);
    });

    await Promise.all(updates);

    res.json({ message: 'Topics reordered successfully' });
  } catch (error) {
    console.error('Reorder topics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;