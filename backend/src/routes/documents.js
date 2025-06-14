// src/routes/documents.js (FIXED VERSION)
const express = require('express');
const multer = require('multer');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const PDFProcessorService = require('../services/pdfProcessor');

const router = express.Router();

// Initialize PDF processor
const pdfProcessor = new PDFProcessorService();

// Configure multer for file uploads with enhanced validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Single file upload
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      if (file.size > 50 * 1024 * 1024) {
        cb(new Error('File too large. Maximum size is 50MB.'));
        return;
      }
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed. Please select a PDF document.'));
    }
  }
});

// Enhanced PDF upload with intelligent processing
router.post('/upload', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No PDF file provided',
        details: 'Please select a PDF file to upload'
      });
    }

    const { title, topic_id, priority = 3, notes } = req.body;
    const userId = req.user.id;
    
    console.log(`📤 Processing enhanced PDF upload for user ${userId}: ${req.file.originalname}`);
    
    // Validate input parameters
    if (title && title.length > 255) {
      return res.status(400).json({ 
        error: 'Title too long',
        details: 'Document title must be less than 255 characters'
      });
    }

    if (priority && (priority < 1 || priority > 5)) {
      return res.status(400).json({ 
        error: 'Invalid priority',
        details: 'Priority must be between 1 (highest) and 5 (lowest)'
      });
    }

    // Validate topic_id if provided
    if (topic_id) {
      const { data: topic, error: topicError } = await supabase
        .from('topics')
        .select('id, name')
        .eq('id', topic_id)
        .eq('user_id', userId)
        .single();

      if (topicError || !topic) {
        return res.status(400).json({ 
          error: 'Invalid topic',
          details: 'The specified topic does not exist or does not belong to you'
        });
      }
    }

    // Step 1: Process PDF with intelligent analysis
    console.log('🧠 Starting intelligent PDF analysis...');
    const startTime = Date.now();
    
    const analysisData = await pdfProcessor.processUploadedPDF(
      req.file.buffer, 
      req.file.originalname, 
      userId, 
      title || req.file.originalname.replace('.pdf', '')
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`⚡ PDF analysis completed in ${processingTime}ms`);

    // Step 2: Generate unique filename and upload to storage
    const fileName = `${userId}/${Date.now()}_${req.file.originalname}`;
    
    const { data: storageData, error: storageError } = await supabase.storage
      .from('pdf-documents')
      .upload(fileName, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
        cacheControl: '31536000' // 1 year cache
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      return res.status(500).json({ 
        error: 'Failed to upload file to storage',
        details: 'Please try again. If the problem persists, contact support.'
      });
    }

    console.log(`💾 File uploaded to storage: ${storageData.path}`);

    // Step 3: Save document metadata with intelligent insights
    const documentData = {
      user_id: userId,
      title: title || req.file.originalname.replace('.pdf', ''),
      file_name: req.file.originalname,
      file_path: storageData.path,
      total_pages: analysisData.totalPages,
      topic_id: topic_id || null,
      difficulty_level: Math.round(analysisData.documentMetrics.averageDifficulty),
      estimated_reading_time_minutes: Math.round(analysisData.timeEstimates.totalSeconds / 60),
      content_type: pdfProcessor.getDominantContentType(analysisData.documentMetrics.contentTypeDistribution),
      priority: parseInt(priority),
      notes: notes?.trim() || null,
      processing_metadata: {
        ...analysisData.processingMetadata,
        processing_time_ms: processingTime,
        api_version: '2.0.0'
      }
    };

    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Clean up uploaded file
      await supabase.storage.from('pdf-documents').remove([fileName]);
      return res.status(500).json({ 
        error: 'Failed to save document metadata',
        details: 'The file was uploaded but could not be processed. Please try again.'
      });
    }

    console.log(`📝 Document saved to database: ${document.id}`);

    // Step 4: Save detailed PDF analysis
    try {
      await pdfProcessor.savePDFAnalysisToDatabase(document.id, userId, analysisData);
    } catch (analysisError) {
      console.error('PDF analysis save error:', analysisError);
      // Don't fail the whole operation, but log the issue
    }

    // Step 5: Initialize page tracking with intelligent estimates
    const pageInserts = Array.from({ length: analysisData.totalPages }, (_, i) => {
      const pageNum = i + 1;
      const pageEstimate = analysisData.timeEstimates.pageEstimates.find(e => e.pageNumber === pageNum);
      const pageAnalysis = analysisData.pageAnalysis.find(p => p.pageNumber === pageNum);
      
      return {
        document_id: document.id,
        user_id: userId,
        page_number: pageNum,
        time_spent_seconds: 0,
        is_completed: false,
        estimated_time_seconds: pageEstimate?.estimatedSeconds || 120,
        difficulty_rating: pageAnalysis?.difficultyLevel || 3
      };
    });

    const { error: pagesError } = await supabase
      .from('document_pages')
      .insert(pageInserts);

    if (pagesError) {
      console.error('Pages insert error:', pagesError);
      // Don't fail the whole operation
    }

    // Step 6: Update user document count and stats
    await updateUserDocumentStats(userId, analysisData);

    // Step 7: Generate intelligent reading recommendations
    const userReadingSpeed = await pdfProcessor.getUserReadingSpeed(userId);
    const recommendations = pdfProcessor.generateReadingRecommendations(analysisData, userReadingSpeed);

    // Prepare response with comprehensive insights
    const response = {
      message: 'PDF uploaded and analyzed successfully! 🎉',
      document: {
        id: document.id,
        title: document.title,
        total_pages: document.total_pages,
        difficulty_level: document.difficulty_level,
        estimated_reading_time_minutes: document.estimated_reading_time_minutes,
        content_type: document.content_type,
        created_at: document.created_at
      },
      intelligent_insights: {
        processing_time_ms: processingTime,
        analysis_summary: {
          total_words: analysisData.documentMetrics.totalWords,
          average_difficulty: analysisData.documentMetrics.averageDifficulty,
          structural_complexity: analysisData.documentMetrics.structuralComplexity,
          dominant_content_type: pdfProcessor.getDominantContentType(analysisData.documentMetrics.contentTypeDistribution)
        },
        time_estimates: {
          total_reading_time: `${Math.round(analysisData.timeEstimates.totalSeconds / 3600 * 10) / 10} hours`,
          average_per_page: `${Math.round(analysisData.timeEstimates.averageSecondsPerPage / 60)} minutes`,
          difficulty_breakdown: Object.entries(analysisData.timeEstimates.difficultyBasedTotals)
            .filter(([_, time]) => time > 0)
            .map(([level, time]) => ({
              difficulty_level: parseInt(level),
              estimated_minutes: Math.round(time / 60),
              page_count: analysisData.pageAnalysis.filter(p => p.difficultyLevel === parseInt(level)).length
            }))
        },
        document_structure: {
          chapters: analysisData.documentStructure.chapters.length,
          sections: analysisData.documentStructure.sections.length,
          has_table_of_contents: analysisData.documentStructure.tableOfContents.length > 0,
          has_bibliography: analysisData.documentStructure.bibliography.length > 0
        },
        recommendations: recommendations.slice(0, 3) // Top 3 recommendations
      },
      next_steps: [
        {
          action: 'start_reading',
          description: 'Begin reading from page 1',
          estimated_time: `${Math.round(analysisData.timeEstimates.pageEstimates[0]?.estimatedSeconds / 60)} minutes`
        },
        {
          action: 'create_study_plan',
          description: 'Set up a study schedule based on difficulty analysis',
          recommended: recommendations.some(r => r.type === 'time')
        },
        {
          action: 'generate_sprint',
          description: 'Create your first intelligent study sprint',
          url: `/api/sprints/generate?document_id=${document.id}`
        }
      ]
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('Enhanced upload error:', error);
    
    // Provide specific error messages based on error type
    if (error.message.includes('Failed to process PDF')) {
      return res.status(422).json({ 
        error: 'PDF processing failed',
        details: 'The PDF file appears to be corrupted or in an unsupported format. Please try a different file.',
        suggestion: 'Ensure the PDF is not password-protected and is a standard PDF format.'
      });
    }
    
    if (error.message.includes('pdf-parse')) {
      return res.status(422).json({ 
        error: 'PDF parsing error',
        details: 'Could not extract content from the PDF. The file may be image-based or corrupted.',
        suggestion: 'Try converting the PDF to a text-based format or use OCR if it contains scanned images.'
      });
    }

    res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred while processing your PDF. Please try again.',
      support_info: 'If this problem continues, please contact support with the filename and upload time.'
    });
  }
});

// Enhanced document listing with intelligent filters - FIXED VERSION
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { 
      topic_id, 
      difficulty_level, 
      content_type, 
      sort_by = 'created_at', 
      sort_order = 'desc',
      include_analysis = 'false',
      limit = 50,
      offset = 0
    } = req.query;

    // Build query with filters
    let query = supabase
      .from('documents')
      .select(`
        id,
        title,
        file_name,
        total_pages,
        difficulty_level,
        estimated_reading_time_minutes,
        content_type,
        priority,
        created_at,
        updated_at,
        processing_metadata,
        topics (
          id,
          name,
          color,
          icon
        )
      `)
      .eq('user_id', req.user.id);

    // Apply filters
    if (topic_id) {
      query = query.eq('topic_id', topic_id);
    }
    
    if (difficulty_level) {
      query = query.eq('difficulty_level', parseInt(difficulty_level));
    }
    
    if (content_type) {
      query = query.eq('content_type', content_type);
    }

    // Apply sorting
    const validSortFields = ['created_at', 'updated_at', 'title', 'difficulty_level', 'total_pages', 'priority'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortAsc = sort_order.toLowerCase() === 'asc';
    
    query = query
      .order(sortField, { ascending: sortAsc })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: documents, error, count } = await query;

    if (error) {
      console.error('Fetch documents error:', error);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    // Get progress data for all documents
    const documentsWithProgress = await Promise.all(
      documents.map(async (doc) => {
        // Get basic progress
        const { data: pages } = await supabase
          .from('document_pages')
          .select('page_number, time_spent_seconds, is_completed, last_read_at, difficulty_rating')
          .eq('document_id', doc.id);

        const totalPages = doc.total_pages;
        const completedPages = pages?.filter(page => page.is_completed).length || 0;
        const totalTimeSpent = pages?.reduce((sum, page) => sum + (page.time_spent_seconds || 0), 0) || 0;
        
        // Calculate reading velocity (pages per hour)
        const readingVelocity = totalTimeSpent > 0 ? (completedPages / (totalTimeSpent / 3600)) : 0;
        
        // Find last read page
        const lastReadPage = pages?.filter(p => p.last_read_at)
          .sort((a, b) => new Date(b.last_read_at) - new Date(a.last_read_at))[0];

        const docWithProgress = {
          id: doc.id,
          title: doc.title,
          file_name: doc.file_name,
          total_pages: totalPages,
          completed_pages: completedPages,
          completion_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0,
          total_time_spent_seconds: totalTimeSpent,
          difficulty_level: doc.difficulty_level,
          estimated_reading_time_minutes: doc.estimated_reading_time_minutes,
          content_type: doc.content_type,
          priority: doc.priority,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          topic: doc.topics,
          reading_metrics: {
            reading_velocity_pages_per_hour: Math.round(readingVelocity * 10) / 10,
            average_time_per_page_seconds: completedPages > 0 ? Math.round(totalTimeSpent / completedPages) : 0,
            last_read_page: lastReadPage?.page_number || null,
            last_read_at: lastReadPage?.last_read_at || null,
            estimated_time_remaining_minutes: Math.round(((totalPages - completedPages) * (doc.estimated_reading_time_minutes || 120)) / totalPages)
          },
          intelligent_insights: {
            next_recommended_page: completedPages + 1,
            suggested_session_length: calculateSuggestedSessionLength(doc, pages),
            difficulty_trend: analyzeDifficultyTrend(pages),
            completion_prediction: predictCompletionDate(doc, pages, completedPages)
          }
        };

        // Include detailed analysis if requested
        if (include_analysis === 'true') {
          const { data: analysisData } = await supabase
            .from('pdf_content_analysis')
            .select('*')
            .eq('document_id', doc.id)
            .order('page_number');

          docWithProgress.detailed_analysis = {
            page_analysis: analysisData || [],
            content_distribution: analyzeContentDistribution(analysisData),
            difficulty_progression: analyzeDifficultyProgression(analysisData)
          };
        }

        return docWithProgress;
      })
    );

    // Calculate collection statistics
    const collectionStats = {
      total_documents: documents.length,
      difficulty_distribution: calculateDifficultyDistribution(documentsWithProgress),
      content_type_distribution: calculateContentTypeDistribution(documentsWithProgress),
      completion_statistics: calculateCompletionStatistics(documentsWithProgress),
      estimated_total_reading_time: documentsWithProgress.reduce(
        (sum, doc) => sum + (doc.estimated_reading_time_minutes || 0), 0
      )
    };

    res.json({ 
      documents: documentsWithProgress,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total: count,
        has_more: count > parseInt(offset) + parseInt(limit)
      },
      collection_stats: collectionStats,
      filters_applied: {
        topic_id: topic_id || null,
        difficulty_level: difficulty_level || null,
        content_type: content_type || null,
        sort_by: sortField,
        sort_order: sort_order
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific document details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { include_recommendations = 'true', include_sessions = 'false' } = req.query;
    
    // Get document with topic information
    const { data: document, error } = await supabase
      .from('documents')
      .select(`
        *,
        topics (
          id,
          name,
          color,
          icon,
          target_completion_date
        )
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Document not found' });
      }
      console.error('Fetch document error:', error);
      return res.status(500).json({ error: 'Failed to fetch document' });
    }

    // Get detailed page analysis
    const { data: pages } = await supabase
      .from('document_pages')
      .select('*')
      .eq('document_id', document.id)
      .order('page_number');

    // Get PDF content analysis
    const { data: contentAnalysis } = await supabase
      .from('pdf_content_analysis')
      .select('*')
      .eq('document_id', document.id)
      .order('page_number');

    // Calculate comprehensive progress metrics
    const progressMetrics = calculateComprehensiveProgress(document, pages, contentAnalysis);

    // Get study sessions if requested
    let studySessions = [];
    if (include_sessions === 'true') {
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('document_id', document.id)
        .eq('user_id', req.user.id)
        .order('started_at', { ascending: false })
        .limit(10);
      
      studySessions = sessions || [];
    }

    // Generate intelligent recommendations
    let recommendations = [];
    if (include_recommendations === 'true') {
      const userReadingSpeed = await pdfProcessor.getUserReadingSpeed(req.user.id);
      recommendations = await generateDocumentRecommendations(
        document, 
        pages, 
        contentAnalysis, 
        userReadingSpeed,
        studySessions
      );
    }

    // Build comprehensive response
    const response = {
      document: {
        ...document,
        progress_metrics: progressMetrics,
        content_analysis_summary: summarizeContentAnalysis(contentAnalysis),
        reading_path: generateOptimalReadingPath(pages, contentAnalysis)
      },
      pages: pages || [],
      study_sessions: studySessions,
      recommendations: recommendations,
      insights: {
        learning_velocity: calculateLearningVelocity(pages, studySessions),
        focus_patterns: analyzeFocusPatterns(studySessions),
        optimal_study_times: suggestOptimalStudyTimes(studySessions),
        difficulty_adaptation: assessDifficultyAdaptation(pages, contentAnalysis)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Get document details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete document with enhanced cleanup
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Get document details first
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('file_path, title, total_pages')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Document not found' });
      }
      return res.status(500).json({ error: 'Failed to fetch document' });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('pdf-documents')
      .remove([document.file_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      // Continue with database cleanup even if storage delete fails
    }

    // Delete PDF content analysis
    await supabase
      .from('pdf_content_analysis')
      .delete()
      .eq('document_id', req.params.id);

    // Delete from database (cascading will handle pages, sessions, etc.)
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete document' });
    }

    // Update user document count and stats
    await updateUserDocumentStats(req.user.id);

    res.json({ 
      message: 'Document deleted successfully',
      deleted_document: {
        title: document.title,
        pages: document.total_pages
      }
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// FIXED HELPER FUNCTIONS (moved outside of router)
// ========================================

function calculateSuggestedSessionLength(document, pages) {
  const avgDifficulty = document.difficulty_level || 3;
  const baseDuration = 30; // 30 minutes base
  
  // Adjust based on difficulty
  const difficultyMultiplier = {
    1: 0.8, 2: 0.9, 3: 1.0, 4: 1.2, 5: 1.4
  };
  
  return Math.round(baseDuration * (difficultyMultiplier[avgDifficulty] || 1.0));
}

function analyzeDifficultyTrend(pages) {
  if (!pages || pages.length < 3) return 'insufficient_data';
  
  const completedPages = pages.filter(p => p.is_completed && p.difficulty_rating);
  if (completedPages.length < 3) return 'insufficient_data';
  
  const recent = completedPages.slice(-5);
  const avgRecent = recent.reduce((sum, p) => sum + p.difficulty_rating, 0) / recent.length;
  const avgOverall = completedPages.reduce((sum, p) => sum + p.difficulty_rating, 0) / completedPages.length;
  
  const difference = avgRecent - avgOverall;
  if (difference > 0.5) return 'increasing';
  if (difference < -0.5) return 'decreasing';
  return 'stable';
}

function predictCompletionDate(document, pages, completedPages) {
  if (completedPages === 0) return null;
  
  const completedPagesData = pages.filter(p => p.is_completed && p.last_read_at);
  if (completedPagesData.length < 2) return null;
  
  // Calculate reading velocity
  const sorted = completedPagesData.sort((a, b) => new Date(a.last_read_at) - new Date(b.last_read_at));
  const firstRead = new Date(sorted[0].last_read_at);
  const lastRead = new Date(sorted[sorted.length - 1].last_read_at);
  const daysDiff = (lastRead - firstRead) / (1000 * 60 * 60 * 24);
  
  if (daysDiff <= 0) return null;
  
  const pagesPerDay = completedPages / daysDiff;
  const remainingPages = document.total_pages - completedPages;
  const estimatedDays = remainingPages / pagesPerDay;
  
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + estimatedDays);
  
  return completionDate.toISOString().split('T')[0];
}

function analyzeContentDistribution(analysisData) {
  if (!analysisData || analysisData.length === 0) return {};
  
  const distribution = {};
  analysisData.forEach(page => {
    distribution[page.content_type] = (distribution[page.content_type] || 0) + 1;
  });
  
  return distribution;
}

function analyzeDifficultyProgression(analysisData) {
  if (!analysisData || analysisData.length === 0) return [];
  
  return analysisData.map(page => ({
    page_number: page.page_number,
    difficulty_score: page.difficulty_score,
    difficulty_level: page.difficulty_level
  }));
}

function calculateDifficultyDistribution(documents) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  documents.forEach(doc => {
    if (doc.difficulty_level) {
      distribution[doc.difficulty_level]++;
    }
  });
  return distribution;
}

function calculateContentTypeDistribution(documents) {
  const distribution = {};
  documents.forEach(doc => {
    if (doc.content_type) {
      distribution[doc.content_type] = (distribution[doc.content_type] || 0) + 1;
    }
  });
  return distribution;
}

function calculateCompletionStatistics(documents) {
  const completed = documents.filter(doc => doc.completion_percentage === 100).length;
  const inProgress = documents.filter(doc => doc.completion_percentage > 0 && doc.completion_percentage < 100).length;
  const notStarted = documents.filter(doc => doc.completion_percentage === 0).length;
  
  return {
    completed,
    in_progress: inProgress,
    not_started: notStarted,
    completion_rate: documents.length > 0 ? Math.round((completed / documents.length) * 100) : 0
  };
}

function calculateComprehensiveProgress(document, pages, contentAnalysis) {
  // Placeholder implementation
  return {
    overall_completion: pages ? Math.round((pages.filter(p => p.is_completed).length / pages.length) * 100) : 0,
    reading_velocity: 'steady',
    difficulty_adaptation: 'good'
  };
}

function summarizeContentAnalysis(contentAnalysis) {
  if (!contentAnalysis || contentAnalysis.length === 0) return {};
  
  return {
    total_pages_analyzed: contentAnalysis.length,
    avg_difficulty: contentAnalysis.reduce((sum, page) => sum + (page.difficulty_score || 3), 0) / contentAnalysis.length,
    content_types: [...new Set(contentAnalysis.map(page => page.content_type))],
    has_complex_content: contentAnalysis.some(page => page.has_equations || page.has_code)
  };
}

function generateOptimalReadingPath(pages, contentAnalysis) {
  // Simple implementation - can be enhanced
  return {
    recommended_order: 'sequential',
    break_points: [Math.floor(pages.length / 3), Math.floor(pages.length * 2 / 3)],
    difficulty_peaks: pages.filter(p => p.difficulty_rating >= 4).map(p => p.page_number)
  };
}

async function generateDocumentRecommendations(document, pages, contentAnalysis, userReadingSpeed, studySessions) {
  // Placeholder implementation
  return [
    {
      type: 'pacing',
      message: 'Consider 30-minute study sessions for optimal retention',
      priority: 'medium'
    }
  ];
}

function calculateLearningVelocity(pages, studySessions) {
  return 'moderate'; // Placeholder
}

function analyzeFocusPatterns(studySessions) {
  return []; // Placeholder
}

function suggestOptimalStudyTimes(studySessions) {
  return []; // Placeholder
}

function assessDifficultyAdaptation(pages, contentAnalysis) {
  return 'adapting_well'; // Placeholder
}

// Helper function to update user document statistics
async function updateUserDocumentStats(userId, analysisData = null) {
  try {
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const updateData = {
      total_documents: count || 0,
      updated_at: new Date().toISOString()
    };

    // If we have analysis data, update additional metrics
    if (analysisData) {
      updateData.last_upload_analysis = {
        words_processed: analysisData.documentMetrics.totalWords,
        difficulty_processed: analysisData.documentMetrics.averageDifficulty,
        processing_time_ms: analysisData.processingMetadata.processing_time_ms
      };
    }

    await supabase
      .from('user_stats')
      .upsert({
        user_id: userId,
        ...updateData
      });
  } catch (error) {
    console.error('Update document stats error:', error);
  }
}

module.exports = router;