// src/routes/documents.js
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
    
    // Parse PDF to get page count
    const pdfData = await pdf(req.file.buffer);
    const totalPages = pdfData.numpages;

    // Generate unique filename
    const fileName = `${userId}/${Date.now()}_${req.file.originalname}`;

    // Upload file to Supabase Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('pdfs')
      .upload(fileName, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    // Save document metadata to database
    const { data: documentData, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        title: title || req.file.originalname,
        file_name: req.file.originalname,
        file_path: storageData.path,
        total_pages: totalPages
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Clean up uploaded file
      await supabase.storage.from('pdfs').remove([fileName]);
      return res.status(500).json({ error: 'Failed to save document metadata' });
    }

    // Initialize pages tracking
    const pageInserts = Array.from({ length: totalPages }, (_, i) => ({
      document_id: documentData.id,
      user_id: userId,
      page_number: i + 1,
      time_spent_seconds: 0,
      is_mastered: false
    }));

    const { error: pagesError } = await supabase
      .from('document_pages')
      .insert(pageInserts);

    if (pagesError) {
      console.error('Pages insert error:', pagesError);
    }

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: documentData
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
        *,
        document_pages (
          page_number,
          time_spent_seconds,
          is_mastered,
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
      const masteredPages = doc.document_pages.filter(page => page.is_mastered).length;
      const totalTimeSpent = doc.document_pages.reduce((sum, page) => sum + page.time_spent_seconds, 0);
      
      return {
        ...doc,
        progress: {
          total_pages: totalPages,
          mastered_pages: masteredPages,
          completion_percentage: totalPages > 0 ? (masteredPages / totalPages) * 100 : 0,
          total_time_spent_seconds: totalTimeSpent
        }
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
          is_mastered,
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
      .from('pdfs')
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

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;