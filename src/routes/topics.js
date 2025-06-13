const express = require('express');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all user topics with progress
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { include_archived = false } = req.query;
    
    let query = supabase
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
      .order('priority', { ascending: true });
    
    if (include_archived !== 'true') {
      query = query.eq('is_archived', false);
    }

    const { data: topics, error } = await query;

    if (error) {
      console.error('Fetch topics error:', error);
      return res.status(500).json({ error: 'Failed to fetch topics' });
    }

    // Get progress data for each topic efficiently
    const topicsWithProgress = await Promise.all(
      topics.map(async (topic) => {
        // Get documents for this topic
        const { data: documents } = await supabase
          .from('documents')
          .select('id, total_pages')
          .eq('topic_id', topic.id);

        if (!documents || documents.length === 0) {
          return {
            ...topic,
            total_documents: 0,
            total_pages: 0,
            completed_pages: 0,
            completion_percentage: 0,
            total_time_spent_seconds: 0
          };
        }

        const documentIds = documents.map(d => d.id);
        
        // Get pages progress for all documents in this topic
        const { data: pagesData } = await supabase
          .from('document_pages')
          .select('time_spent_seconds, is_completed')
          .in('document_id', documentIds);

        const totalPages = documents.reduce((sum, doc) => sum + doc.total_pages, 0);
        const completedPages = pagesData?.filter(p => p.is_completed).length || 0;
        const totalTimeSpent = pagesData?.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0) || 0;

        return {
          ...topic,
          total_documents: documents.length,
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

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Topic name is required' });
    }

    if (name.length > 255) {
      return res.status(400).json({ error: 'Topic name must be less than 255 characters' });
    }

    // Validate color format (hex)
    if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
      return res.status(400).json({ error: 'Color must be a valid hex code (e.g., #667eea)' });
    }

    // Validate priority range
    if (priority < 1 || priority > 5) {
      return res.status(400).json({ error: 'Priority must be between 1 and 5' });
    }

    // Validate target completion date
    if (target_completion_date) {
      const targetDate = new Date(target_completion_date);
      if (isNaN(targetDate.getTime()) || targetDate <= new Date()) {
        return res.status(400).json({ error: 'Target completion date must be a valid future date' });
      }
    }

    const { data, error } = await supabase
      .from('topics')
      .insert({
        user_id: req.user.id,
        name: name.trim(),
        description: description?.trim() || null,
        color,
        icon,
        target_completion_date,
        priority
      })
      .select()
      .single();

    if (error) {
      console.error('Create topic error:', error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'A topic with this name already exists' });
      }
      return res.status(500).json({ error: 'Failed to create topic' });
    }

    res.status(201).json({ 
      message: 'Topic created successfully',
      topic: {
        ...data,
        total_documents: 0,
        total_pages: 0,
        completed_pages: 0,
        completion_percentage: 0,
        total_time_spent_seconds: 0
      }
    });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific topic with detailed progress
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid topic ID format' });
    }

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
      return res.status(500).json({ error: 'Failed to fetch topic documents' });
    }

    // Calculate detailed progress
    const documentsWithProgress = documents?.map(doc => {
      const completedPages = doc.document_pages?.filter(p => p.is_completed).length || 0;
      const totalTimeSpent = doc.document_pages?.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0) || 0;
      
      return {
        id: doc.id,
        title: doc.title,
        total_pages: doc.total_pages,
        completed_pages: completedPages,
        completion_percentage: doc.total_pages > 0 ? Math.round((completedPages / doc.total_pages) * 100) : 0,
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
      .eq('is_completed', false)
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
        average_time_per_page: completedPages > 0 ? Math.round(totalTimeSpent / completedPages) : 0
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
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid topic ID format' });
    }

    const { 
      name, 
      description, 
      color, 
      icon, 
      target_completion_date,
      priority,
      is_archived 
    } = req.body;

    // Build updates object with validation
    const updates = {};
    
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Topic name cannot be empty' });
      }
      if (name.length > 255) {
        return res.status(400).json({ error: 'Topic name must be less than 255 characters' });
      }
      updates.name = name.trim();
    }
    
    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }
    
    if (color !== undefined) {
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return res.status(400).json({ error: 'Color must be a valid hex code' });
      }
      updates.color = color;
    }
    
    if (icon !== undefined) {
      updates.icon = icon;
    }
    
    if (target_completion_date !== undefined) {
      if (target_completion_date) {
        const targetDate = new Date(target_completion_date);
        if (isNaN(targetDate.getTime())) {
          return res.status(400).json({ error: 'Invalid target completion date' });
        }
        updates.target_completion_date = target_completion_date;
      } else {
        updates.target_completion_date = null;
      }
    }
    
    if (priority !== undefined) {
      if (priority < 1 || priority > 5) {
        return res.status(400).json({ error: 'Priority must be between 1 and 5' });
      }
      updates.priority = priority;
    }
    
    if (is_archived !== undefined) {
      updates.is_archived = Boolean(is_archived);
    }
    
    updates.updated_at = new Date().toISOString();

    // Check if topic exists and belongs to user
    const { data: existingTopic } = await supabase
      .from('topics')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!existingTopic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const { data, error } = await supabase
      .from('topics')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Update topic error:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A topic with this name already exists' });
      }
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
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid topic ID format' });
    }

    // Check if topic exists and belongs to user
    const { data: existingTopic } = await supabase
      .from('topics')
      .select('id, name')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!existingTopic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Check if topic has documents
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', req.params.id);

    if (count > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete topic with associated documents',
        details: `Topic "${existingTopic.name}" has ${count} document(s). Please move or delete documents first.`,
        document_count: count
      });
    }

    // Check if topic has exam goals
    const { count: examGoalsCount } = await supabase
      .from('exam_goals')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', req.params.id);

    if (examGoalsCount > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete topic with associated exam goals',
        details: `Topic "${existingTopic.name}" has ${examGoalsCount} exam goal(s). Please delete exam goals first.`,
        exam_goals_count: examGoalsCount
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

    res.json({ 
      message: 'Topic deleted successfully',
      deleted_topic: existingTopic.name
    });
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

    if (topic_orders.length === 0) {
      return res.status(400).json({ error: 'topic_orders cannot be empty' });
    }

    // Validate each order entry
    for (const order of topic_orders) {
      if (!order.id || typeof order.priority !== 'number') {
        return res.status(400).json({ 
          error: 'Each topic order must have id and priority fields' 
        });
      }
      
      if (order.priority < 1 || order.priority > 1000) {
        return res.status(400).json({ 
          error: 'Priority must be between 1 and 1000' 
        });
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(order.id)) {
        return res.status(400).json({ error: `Invalid topic ID format: ${order.id}` });
      }
    }

    // Verify all topics belong to the user
    const topicIds = topic_orders.map(order => order.id);
    const { data: userTopics } = await supabase
      .from('topics')
      .select('id')
      .eq('user_id', req.user.id)
      .in('id', topicIds);

    if (!userTopics || userTopics.length !== topicIds.length) {
      return res.status(403).json({ 
        error: 'One or more topics do not belong to you' 
      });
    }

    // Update all topics
    const updatePromises = topic_orders.map(({ id, priority }) => {
      return supabase
        .from('topics')
        .update({ 
          priority, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .eq('user_id', req.user.id);
    });

    const results = await Promise.allSettled(updatePromises);
    
    // Check for any failures
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.error('Some topic reorder updates failed:', failures);
      return res.status(500).json({ 
        error: 'Failed to update some topic priorities',
        failed_count: failures.length
      });
    }

    res.json({ 
      message: 'Topics reordered successfully',
      updated_count: topic_orders.length
    });
  } catch (error) {
    console.error('Reorder topics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;