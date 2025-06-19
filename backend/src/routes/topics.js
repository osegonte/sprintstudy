const express = require('express');
const { supabase } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Enhanced UUID validation function
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Enhanced error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Get all user topics with progress
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { include_archived = false } = req.query;
  
  console.log(`📖 Fetching topics for user ${req.user.id}, archived: ${include_archived}`);
  
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
    console.error('❌ Fetch topics error:', error);
    return res.status(500).json({ error: 'Failed to fetch topics' });
  }

  // Optimized progress calculation with batched queries
  const topicsWithProgress = await Promise.all(
    topics.map(async (topic) => {
      try {
        // Single query to get all document and page data
        const { data: topicData } = await supabase
          .from('documents')
          .select(`
            id,
            total_pages,
            document_pages!inner (
              time_spent_seconds,
              is_completed
            )
          `)
          .eq('topic_id', topic.id);

        if (!topicData || topicData.length === 0) {
          return {
            ...topic,
            total_documents: 0,
            total_pages: 0,
            completed_pages: 0,
            completion_percentage: 0,
            total_time_spent_seconds: 0
          };
        }

        // Flatten and calculate totals
        const allPages = topicData.flatMap(doc => doc.document_pages || []);
        const totalPages = topicData.reduce((sum, doc) => sum + doc.total_pages, 0);
        const completedPages = allPages.filter(p => p.is_completed).length;
        const totalTimeSpent = allPages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);

        return {
          ...topic,
          total_documents: topicData.length,
          total_pages: totalPages,
          completed_pages: completedPages,
          completion_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0,
          total_time_spent_seconds: totalTimeSpent
        };
      } catch (progressError) {
        console.error(`❌ Error calculating progress for topic ${topic.id}:`, progressError);
        // Return topic with zero progress on error
        return {
          ...topic,
          total_documents: 0,
          total_pages: 0,
          completed_pages: 0,
          completion_percentage: 0,
          total_time_spent_seconds: 0
        };
      }
    })
  );

  console.log(`✅ Retrieved ${topics.length} topics with progress`);
  res.json({ topics: topicsWithProgress });
}));

// Create new topic with enhanced validation
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { 
    name, 
    description, 
    color = '#667eea', 
    icon = '📚', 
    target_completion_date,
    priority = 3 
  } = req.body;

  console.log(`📁 Creating topic: "${name}" for user ${req.user.id}`);

  // Enhanced validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Topic name is required and must be a non-empty string' });
  }

  if (name.length > 255) {
    return res.status(400).json({ error: 'Topic name must be less than 255 characters' });
  }

  // Enhanced color validation
  if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
    return res.status(400).json({ error: 'Color must be a valid hex code (e.g., #667eea)' });
  }

  // Enhanced priority validation
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    return res.status(400).json({ error: 'Priority must be an integer between 1 and 5' });
  }

  // Enhanced date validation
  if (target_completion_date) {
    const targetDate = new Date(target_completion_date);
    const now = new Date();
    
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Target completion date must be a valid date' });
    }
    
    // Allow dates from today onwards (not just future)
    if (targetDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      return res.status(400).json({ error: 'Target completion date cannot be in the past' });
    }
  }

  // Check for duplicate names (case-insensitive)
  const { data: existingTopic } = await supabase
    .from('topics')
    .select('id')
    .eq('user_id', req.user.id)
    .ilike('name', name.trim())
    .single();

  if (existingTopic) {
    return res.status(409).json({ error: 'A topic with this name already exists' });
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
    console.error('❌ Create topic error:', error);
    return res.status(500).json({ error: 'Failed to create topic' });
  }

  console.log(`✅ Topic created: ${data.id}`);

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
}));

// Get specific topic with detailed progress
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid topic ID format' });
  }

  console.log(`📖 Fetching topic details: ${req.params.id}`);

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
    console.error('❌ Fetch topic error:', error);
    return res.status(500).json({ error: 'Failed to fetch topic' });
  }

  // Get associated documents with progress using optimized query
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
    console.error('❌ Fetch topic documents error:', docsError);
    return res.status(500).json({ error: 'Failed to fetch topic documents' });
  }

  // Calculate progress with error handling
  const documentsWithProgress = (documents || []).map(doc => {
    try {
      const pages = doc.document_pages || [];
      const completedPages = pages.filter(p => p.is_completed).length;
      const totalTimeSpent = pages.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);
      
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
    } catch (docError) {
      console.error(`❌ Error processing document ${doc.id}:`, docError);
      return {
        id: doc.id,
        title: doc.title,
        total_pages: doc.total_pages,
        completed_pages: 0,
        completion_percentage: 0,
        total_time_spent_seconds: 0,
        difficulty_level: doc.difficulty_level,
        priority: doc.priority,
        created_at: doc.created_at
      };
    }
  });

  // Get exam goals
  const { data: examGoals } = await supabase
    .from('exam_goals')
    .select('*')
    .eq('topic_id', topic.id)
    .eq('is_completed', false)
    .order('exam_date', { ascending: true });

  // Calculate overall stats
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

  console.log(`✅ Topic details retrieved: ${documentsWithProgress.length} documents`);
  res.json({ topic: topicWithDetails });
}));

// Enhanced update topic with partial updates
router.patch('/:id', authMiddleware, asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid topic ID format' });
  }

  console.log(`📝 Updating topic: ${req.params.id}`);

  const { 
    name, 
    description, 
    color, 
    icon, 
    target_completion_date,
    priority,
    is_archived 
  } = req.body;

  // Check if topic exists first
  const { data: existingTopic, error: fetchError } = await supabase
    .from('topics')
    .select('id, name')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (fetchError || !existingTopic) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  // Build updates object with enhanced validation
  const updates = { updated_at: new Date().toISOString() };
  
  if (name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Topic name cannot be empty' });
    }
    if (name.length > 255) {
      return res.status(400).json({ error: 'Topic name must be less than 255 characters' });
    }
    
    // Check for duplicate names (excluding current topic)
    const { data: duplicateTopic } = await supabase
      .from('topics')
      .select('id')
      .eq('user_id', req.user.id)
      .ilike('name', name.trim())
      .neq('id', req.params.id)
      .single();

    if (duplicateTopic) {
      return res.status(409).json({ error: 'A topic with this name already exists' });
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
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
      return res.status(400).json({ error: 'Priority must be an integer between 1 and 5' });
    }
    updates.priority = priority;
  }
  
  if (is_archived !== undefined) {
    updates.is_archived = Boolean(is_archived);
  }

  const { data, error } = await supabase
    .from('topics')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Update topic error:', error);
    return res.status(500).json({ error: 'Failed to update topic' });
  }

  console.log(`✅ Topic updated: ${data.id}`);
  res.json({ 
    message: 'Topic updated successfully',
    topic: data 
  });
}));

// Enhanced delete with better dependency checking
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid topic ID format' });
  }

  console.log(`🗑️ Deleting topic: ${req.params.id}`);

  // Check if topic exists
  const { data: existingTopic } = await supabase
    .from('topics')
    .select('id, name')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (!existingTopic) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  // Check dependencies in parallel
  const [documentsResult, examGoalsResult] = await Promise.all([
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', req.params.id),
    supabase
      .from('exam_goals')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', req.params.id)
  ]);

  const documentCount = documentsResult.count || 0;
  const examGoalsCount = examGoalsResult.count || 0;

  if (documentCount > 0 || examGoalsCount > 0) {
    return res.status(409).json({ 
      error: 'Cannot delete topic with dependencies',
      details: `Topic "${existingTopic.name}" has ${documentCount} document(s) and ${examGoalsCount} exam goal(s). Please remove these first.`,
      dependencies: {
        documents: documentCount,
        exam_goals: examGoalsCount
      }
    });
  }

  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) {
    console.error('❌ Delete topic error:', error);
    return res.status(500).json({ error: 'Failed to delete topic' });
  }

  console.log(`✅ Topic deleted: ${existingTopic.name}`);
  res.json({ 
    message: 'Topic deleted successfully',
    deleted_topic: existingTopic.name
  });
}));

// Enhanced reorder with transaction-like behavior
router.patch('/reorder', authMiddleware, asyncHandler(async (req, res) => {
  const { topic_orders } = req.body;

  console.log(`🔄 Reordering ${topic_orders?.length || 0} topics`);

  if (!Array.isArray(topic_orders) || topic_orders.length === 0) {
    return res.status(400).json({ error: 'topic_orders must be a non-empty array' });
  }

  // Enhanced validation
  const errors = [];
  const topicIds = new Set();

  topic_orders.forEach((order, index) => {
    if (!order.id || typeof order.priority !== 'number') {
      errors.push(`Item ${index}: missing id or priority`);
    }
    
    if (!isValidUUID(order.id)) {
      errors.push(`Item ${index}: invalid UUID format`);
    }
    
    if (!Number.isInteger(order.priority) || order.priority < 1 || order.priority > 1000) {
      errors.push(`Item ${index}: priority must be integer between 1-1000`);
    }
    
    if (topicIds.has(order.id)) {
      errors.push(`Item ${index}: duplicate topic ID ${order.id}`);
    }
    
    topicIds.add(order.id);
  });

  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Validation errors',
      details: errors
    });
  }

  // Verify ownership
  const { data: userTopics } = await supabase
    .from('topics')
    .select('id')
    .eq('user_id', req.user.id)
    .in('id', Array.from(topicIds));

  if (!userTopics || userTopics.length !== topicIds.size) {
    return res.status(403).json({ 
      error: 'One or more topics do not belong to you' 
    });
  }

  // Batch update with better error handling
  const updatePromises = topic_orders.map(({ id, priority }) => 
    supabase
      .from('topics')
      .update({ 
        priority, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
  );

  const results = await Promise.allSettled(updatePromises);
  
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length > 0) {
    console.error('❌ Topic reorder failures:', failures);
    return res.status(500).json({ 
      error: 'Failed to update some topic priorities',
      failed_count: failures.length,
      success_count: results.length - failures.length
    });
  }

  console.log(`✅ Successfully reordered ${topic_orders.length} topics`);
  res.json({ 
    message: 'Topics reordered successfully',
    updated_count: topic_orders.length
  });
}));

// Global error handler
router.use((error, req, res, next) => {
  console.error('❌ Topics route error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

module.exports = router;