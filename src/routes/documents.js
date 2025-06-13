const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Upload PDF
router.post('/upload', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const { title } = req.body;
    const userId = req.user.id;
    
    console.log(`📤 Processing PDF upload for user ${userId}`);
    
    // Parse PDF to get page count
    const pdfData = await pdf(req.file.buffer);
    const totalPages = pdfData.numpages;
    
    console.log(`📊 PDF parsed: ${totalPages} pages`);

    // Generate unique filename
    const fileName = `${userId}/${Date.now()}_${req.file.originalname}`;

    // Upload file to Supabase Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('pdf-documents')
      .upload(fileName, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }

    console.log(`💾 File uploaded to storage: ${storageData.path}`);

    // Save document metadata to database
    const { data: documentData, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        title: title || req.file.originalname.replace('.pdf', ''),
        file_name: req.file.originalname,
        file_path: storageData.path,
        total_pages: totalPages
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Clean up uploaded file
      await supabase.storage.from('pdf-documents').remove([fileName]);
      return res.status(500).json({ error: 'Failed to save document metadata' });
    }

    console.log(`📝 Document saved to database: ${documentData.id}`);

    // Initialize pages tracking
    const pageInserts = Array.from({ length: totalPages }, (_, i) => ({
      document_id: documentData.id,
      user_id: userId,
      page_number: i + 1,
      time_spent_seconds: 0,
      is_completed: false
    }));

    const { error: pagesError } = await supabase
      .from('document_pages')
      .insert(pageInserts);

    if (pagesError) {
      console.error('Pages insert error:', pagesError);
      // Don't fail the whole operation if page tracking fails
    }

    // Update user document count
    await updateUserDocumentCount(userId);

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: documentData.id,
        title: documentData.title,
        total_pages: documentData.total_pages,
        created_at: documentData.created_at
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all user documents
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        file_name,
        total_pages,
        created_at,
        updated_at,
        document_pages (
          page_number,
          time_spent_seconds,
          is_completed,
          last_read_at
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch documents error:', error);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    // Calculate progress for each document
    const documentsWithProgress = data.map(doc => {
      const totalPages = doc.total_pages;
      const completedPages = doc.document_pages.filter(page => page.is_completed).length;
      const totalTimeSpent = doc.document_pages.reduce((sum, page) => sum + page.time_spent_seconds, 0);
      
      return {
        id: doc.id,
        title: doc.title,
        file_name: doc.file_name,
        total_pages: totalPages,
        completed_pages: completedPages,
        completion_percentage: totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0,
        total_time_spent_seconds: totalTimeSpent,
        created_at: doc.created_at,
        updated_at: doc.updated_at
      };
    });

    res.json({ documents: documentsWithProgress });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific document
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        document_pages (
          page_number,
          time_spent_seconds,
          is_completed,
          last_read_at
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

    res.json({ document: data });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete document
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // First get the document to find the file path
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('file_path')
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
    }

    // Delete from database (cascading will handle pages)
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete document' });
    }

    // Update user document count
    await updateUserDocumentCount(req.user.id);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to update user document count
async function updateUserDocumentCount(userId) {
  try {
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    await supabase
      .from('user_stats')
      .upsert({
        user_id: userId,
        total_documents: count || 0,
        updated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Update document count error:', error);
  }
}

module.exports = router;