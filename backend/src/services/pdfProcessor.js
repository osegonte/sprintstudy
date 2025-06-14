// src/services/pdfProcessor.js
const pdf = require('pdf-parse');
const { supabase } = require('../config/supabase');

class PDFProcessorService {
  constructor() {
    // Reading difficulty assessment parameters
    this.difficultyFactors = {
      avgWordsPerSentence: { weight: 0.3, ranges: { easy: [1, 15], medium: [16, 25], hard: [26, 100] } },
      avgSyllablesPerWord: { weight: 0.25, ranges: { easy: [1, 1.5], medium: [1.5, 2.2], hard: [2.2, 5] } },
      complexWords: { weight: 0.2, ranges: { easy: [0, 10], medium: [10, 20], hard: [20, 100] } },
      technicalTerms: { weight: 0.15, ranges: { easy: [0, 5], medium: [5, 15], hard: [15, 100] } },
      sentenceVariety: { weight: 0.1, ranges: { easy: [0.8, 1], medium: [0.6, 0.8], hard: [0, 0.6] } }
    };

    // Base reading speeds (words per minute) by difficulty
    this.readingSpeedsWPM = {
      1: 300, // Very easy
      2: 250, // Easy
      3: 200, // Medium
      4: 150, // Hard
      5: 100  // Very hard
    };
  }

  /**
   * Main PDF processing function - analyzes uploaded PDF comprehensively
   */
  async processUploadedPDF(buffer, filename, userId, title) {
    try {
      console.log(`📄 Starting enhanced PDF processing for user ${userId}: ${filename}`);
      
      // Step 1: Extract basic PDF data and text content
      const pdfData = await pdf(buffer, {
        pagerender: this.renderPage.bind(this),
        max: 0, // Process all pages
        version: 'v1.10.100'
      });

      const totalPages = pdfData.numpages;
      console.log(`📊 PDF contains ${totalPages} pages`);

      // Step 2: Analyze content structure and extract text per page
      const pageAnalysis = await this.analyzePageContent(buffer, totalPages);
      
      // Step 3: Detect document structure (chapters, sections)
      const documentStructure = this.detectDocumentStructure(pageAnalysis);
      
      // Step 4: Calculate overall document metrics
      const documentMetrics = this.calculateDocumentMetrics(pageAnalysis, documentStructure);
      
      // Step 5: Generate reading time estimates
      const timeEstimates = this.generateTimeEstimates(pageAnalysis, userId);

      return {
        totalPages,
        documentMetrics,
        documentStructure,
        pageAnalysis,
        timeEstimates,
        processingMetadata: {
          filename,
          processedAt: new Date().toISOString(),
          processingVersion: '2.0.0',
          totalWords: pageAnalysis.reduce((sum, page) => sum + page.wordCount, 0),
          avgDifficulty: documentMetrics.averageDifficulty,
          estimatedTotalReadingTime: timeEstimates.totalSeconds
        }
      };
    } catch (error) {
      console.error('PDF processing error:', error);
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  /**
   * Analyzes content of each page individually
   */
  async analyzePageContent(buffer, totalPages) {
    const pageAnalysis = [];
    
    try {
      // Process pages in batches to avoid memory issues
      const batchSize = 10;
      for (let i = 0; i < totalPages; i += batchSize) {
        const batch = [];
        const endPage = Math.min(i + batchSize, totalPages);
        
        for (let pageNum = i + 1; pageNum <= endPage; pageNum++) {
          try {
            // Extract text for specific page
            const pageText = await this.extractPageText(buffer, pageNum);
            const analysis = this.analyzeTextContent(pageText, pageNum);
            batch.push(analysis);
          } catch (pageError) {
            console.warn(`Failed to process page ${pageNum}:`, pageError.message);
            // Create fallback analysis for failed pages
            batch.push(this.createFallbackPageAnalysis(pageNum));
          }
        }
        
        pageAnalysis.push(...batch);
        
        // Add small delay between batches to prevent memory pressure
        if (endPage < totalPages) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Page content analysis error:', error);
      throw error;
    }

    return pageAnalysis;
  }

  /**
   * Extracts text content from a specific page
   */
  async extractPageText(buffer, pageNumber) {
    try {
      const options = {
        first: pageNumber,
        last: pageNumber
      };
      
      const pageData = await pdf(buffer, options);
      return pageData.text || '';
    } catch (error) {
      console.warn(`Text extraction failed for page ${pageNumber}:`, error.message);
      return '';
    }
  }

  /**
   * Analyzes text content for difficulty, structure, and reading metrics
   */
  analyzeTextContent(text, pageNumber) {
    if (!text || text.trim().length === 0) {
      return this.createFallbackPageAnalysis(pageNumber);
    }

    // Basic text metrics
    const words = this.extractWords(text);
    const sentences = this.extractSentences(text);
    const paragraphs = this.extractParagraphs(text);

    // Content analysis
    const wordCount = words.length;
    const sentenceCount = sentences.length;
    const paragraphCount = paragraphs.length;
    
    // Readability metrics
    const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    const avgSyllablesPerWord = this.calculateAverageSyllables(words);
    const complexWordCount = this.countComplexWords(words);
    const technicalTermCount = this.countTechnicalTerms(words);
    
    // Difficulty assessment
    const difficultyScore = this.calculateDifficultyScore({
      avgWordsPerSentence,
      avgSyllablesPerWord,
      complexWordPercentage: (complexWordCount / wordCount) * 100,
      technicalTermPercentage: (technicalTermCount / wordCount) * 100,
      sentenceVariety: this.calculateSentenceVariety(sentences)
    });

    // Content structure detection
    const hasHeadings = this.detectHeadings(text);
    const hasBulletPoints = this.detectBulletPoints(text);
    const hasImages = this.detectImageReferences(text);
    const hasEquations = this.detectMathContent(text);
    const hasCode = this.detectCodeBlocks(text);

    // Chapter/section detection
    const chapterTitle = this.extractChapterTitle(text);
    const sectionTitle = this.extractSectionTitle(text);

    return {
      pageNumber,
      textContent: text.substring(0, 5000), // Store first 5000 chars to avoid DB limits
      wordCount,
      sentenceCount,
      paragraphCount,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
      complexWordCount,
      technicalTermCount,
      difficultyScore: Math.round(difficultyScore * 100) / 100,
      difficultyLevel: this.scoreToDifficultyLevel(difficultyScore),
      hasHeadings,
      hasBulletPoints,
      hasImages,
      hasEquations,
      hasCode,
      chapterTitle,
      sectionTitle,
      contentType: this.determineContentType({
        hasHeadings, hasBulletPoints, hasImages, hasEquations, hasCode,
        wordCount, paragraphCount
      })
    };
  }

  /**
   * Creates fallback analysis for pages that couldn't be processed
   */
  createFallbackPageAnalysis(pageNumber) {
    return {
      pageNumber,
      textContent: '',
      wordCount: 0,
      sentenceCount: 0,
      paragraphCount: 0,
      avgWordsPerSentence: 0,
      avgSyllablesPerWord: 0,
      complexWordCount: 0,
      technicalTermCount: 0,
      difficultyScore: 3.0, // Default medium difficulty
      difficultyLevel: 3,
      hasHeadings: false,
      hasBulletPoints: false,
      hasImages: false,
      hasEquations: false,
      hasCode: false,
      chapterTitle: null,
      sectionTitle: null,
      contentType: 'unknown'
    };
  }

  /**
   * Detects document structure (chapters, sections, etc.)
   */
  detectDocumentStructure(pageAnalysis) {
    const structure = {
      chapters: [],
      sections: [],
      tableOfContents: [],
      appendices: [],
      bibliography: []
    };

    let currentChapter = null;
    let currentSection = null;

    pageAnalysis.forEach((page, index) => {
      // Chapter detection
      if (page.chapterTitle) {
        currentChapter = {
          title: page.chapterTitle,
          startPage: page.pageNumber,
          endPage: null,
          sections: []
        };
        structure.chapters.push(currentChapter);
      }

      // Section detection
      if (page.sectionTitle) {
        currentSection = {
          title: page.sectionTitle,
          startPage: page.pageNumber,
          endPage: null,
          chapter: currentChapter?.title || null
        };
        structure.sections.push(currentSection);
        
        if (currentChapter) {
          currentChapter.sections.push(currentSection);
        }
      }

      // Update end pages
      if (index < pageAnalysis.length - 1) {
        const nextPage = pageAnalysis[index + 1];
        
        if (nextPage.chapterTitle && currentChapter) {
          currentChapter.endPage = page.pageNumber;
        }
        
        if (nextPage.sectionTitle && currentSection) {
          currentSection.endPage = page.pageNumber;
        }
      } else {
        // Last page
        if (currentChapter) currentChapter.endPage = page.pageNumber;
        if (currentSection) currentSection.endPage = page.pageNumber;
      }

      // Special content detection
      if (this.isTableOfContentsPage(page.textContent)) {
        structure.tableOfContents.push(page.pageNumber);
      }
      
      if (this.isAppendixPage(page.textContent)) {
        structure.appendices.push(page.pageNumber);
      }
      
      if (this.isBibliographyPage(page.textContent)) {
        structure.bibliography.push(page.pageNumber);
      }
    });

    return structure;
  }

  /**
   * Calculates overall document metrics
   */
  calculateDocumentMetrics(pageAnalysis, documentStructure) {
    const validPages = pageAnalysis.filter(page => page.wordCount > 0);
    
    if (validPages.length === 0) {
      return {
        totalWords: 0,
        averageDifficulty: 3.0,
        averageWordsPerPage: 0,
        difficultyDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        contentTypeDistribution: {},
        structuralComplexity: 'simple'
      };
    }

    const totalWords = validPages.reduce((sum, page) => sum + page.wordCount, 0);
    const averageDifficulty = validPages.reduce((sum, page) => sum + page.difficultyScore, 0) / validPages.length;
    const averageWordsPerPage = totalWords / validPages.length;

    // Difficulty distribution
    const difficultyDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    validPages.forEach(page => {
      difficultyDistribution[page.difficultyLevel]++;
    });

    // Content type distribution
    const contentTypeDistribution = {};
    validPages.forEach(page => {
      contentTypeDistribution[page.contentType] = (contentTypeDistribution[page.contentType] || 0) + 1;
    });

    // Structural complexity assessment
    const structuralComplexity = this.assessStructuralComplexity(documentStructure, validPages.length);

    return {
      totalWords: Math.round(totalWords),
      averageDifficulty: Math.round(averageDifficulty * 100) / 100,
      averageWordsPerPage: Math.round(averageWordsPerPage),
      difficultyDistribution,
      contentTypeDistribution,
      structuralComplexity
    };
  }

  /**
   * Generates personalized reading time estimates
   */
  generateTimeEstimates(pageAnalysis, userId) {
    // Get user's historical reading speed or use defaults
    const estimates = {
      totalSeconds: 0,
      pageEstimates: [],
      difficultyBasedTotals: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      averageSecondsPerPage: 0
    };

    pageAnalysis.forEach(page => {
      let estimatedSeconds;
      
      if (page.wordCount === 0) {
        estimatedSeconds = 30; // Minimum time for image/diagram pages
      } else {
        // Base time on difficulty and word count
        const baseWPM = this.readingSpeedsWPM[page.difficultyLevel] || 200;
        const estimatedMinutes = page.wordCount / baseWPM;
        estimatedSeconds = Math.round(estimatedMinutes * 60);
        
        // Add complexity adjustments
        if (page.hasEquations) estimatedSeconds *= 1.5;
        if (page.hasCode) estimatedSeconds *= 1.3;
        if (page.hasBulletPoints) estimatedSeconds *= 0.9;
        
        // Minimum and maximum bounds
        estimatedSeconds = Math.max(30, Math.min(estimatedSeconds, 1800)); // 30s to 30min
      }

      estimates.pageEstimates.push({
        pageNumber: page.pageNumber,
        estimatedSeconds: Math.round(estimatedSeconds),
        difficultyLevel: page.difficultyLevel,
        wordCount: page.wordCount
      });

      estimates.totalSeconds += estimatedSeconds;
      estimates.difficultyBasedTotals[page.difficultyLevel] += estimatedSeconds;
    });

    estimates.averageSecondsPerPage = pageAnalysis.length > 0 
      ? Math.round(estimates.totalSeconds / pageAnalysis.length) 
      : 0;

    return estimates;
  }

  /**
   * Text processing helper methods
   */
  extractWords(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  extractSentences(text) {
    return text.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  extractParagraphs(text) {
    return text.split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  calculateAverageSyllables(words) {
    if (words.length === 0) return 0;
    
    const totalSyllables = words.reduce((sum, word) => {
      return sum + this.countSyllables(word);
    }, 0);
    
    return totalSyllables / words.length;
  }

  countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    // Remove silent e
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    
    // Count vowel groups
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  countComplexWords(words) {
    return words.filter(word => 
      word.length > 6 || this.countSyllables(word) > 2
    ).length;
  }

  countTechnicalTerms(words) {
    const technicalPatterns = [
      /^[A-Z]{2,}$/, // Acronyms
      /\d+\.\d+/, // Version numbers
      /[a-z]+_[a-z]+/, // Snake_case
      /[a-z]+[A-Z][a-z]+/, // CamelCase
      /-[a-z]+/, // Hyphenated technical terms
    ];
    
    return words.filter(word => 
      technicalPatterns.some(pattern => pattern.test(word))
    ).length;
  }

  calculateSentenceVariety(sentences) {
    if (sentences.length === 0) return 0;
    
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    
    return Math.min(1, Math.sqrt(variance) / avgLength);
  }

  /**
   * Difficulty scoring algorithm
   */
  calculateDifficultyScore(metrics) {
    let score = 0;
    
    Object.entries(this.difficultyFactors).forEach(([key, factor]) => {
      let metricValue;
      switch (key) {
        case 'avgWordsPerSentence':
          metricValue = metrics.avgWordsPerSentence;
          break;
        case 'avgSyllablesPerWord':
          metricValue = metrics.avgSyllablesPerWord;
          break;
        case 'complexWords':
          metricValue = metrics.complexWordPercentage;
          break;
        case 'technicalTerms':
          metricValue = metrics.technicalTermPercentage;
          break;
        case 'sentenceVariety':
          metricValue = metrics.sentenceVariety;
          break;
        default:
          metricValue = 0;
      }
      
      const difficultyContribution = this.mapValueToDifficulty(metricValue, factor.ranges);
      score += difficultyContribution * factor.weight;
    });
    
    return Math.max(1, Math.min(5, score));
  }

  mapValueToDifficulty(value, ranges) {
    if (value >= ranges.easy[0] && value <= ranges.easy[1]) return 2;
    if (value >= ranges.medium[0] && value <= ranges.medium[1]) return 3;
    if (value >= ranges.hard[0] && value <= ranges.hard[1]) return 4;
    return value < ranges.easy[0] ? 1 : 5;
  }

  scoreToDifficultyLevel(score) {
    if (score <= 1.5) return 1;
    if (score <= 2.5) return 2;
    if (score <= 3.5) return 3;
    if (score <= 4.5) return 4;
    return 5;
  }

  /**
   * Content detection methods
   */
  detectHeadings(text) {
    const headingPatterns = [
      /^[A-Z][A-Z\s]{5,}$/m, // ALL CAPS headings
      /^\d+\.\s+[A-Z][a-zA-Z\s]+$/m, // Numbered headings
      /^Chapter\s+\d+/im, // Chapter headings
      /^Section\s+\d+/im, // Section headings
    ];
    
    return headingPatterns.some(pattern => pattern.test(text));
  }

  detectBulletPoints(text) {
    const bulletPatterns = [
      /^\s*[•·▪▫‣⁃]\s+/m,
      /^\s*[-*+]\s+/m,
      /^\s*\d+\.\s+/m,
      /^\s*[a-z]\)\s+/m,
    ];
    
    return bulletPatterns.some(pattern => pattern.test(text));
  }

  detectImageReferences(text) {
    const imagePatterns = [
      /Figure\s+\d+/i,
      /Fig\.\s*\d+/i,
      /Image\s+\d+/i,
      /Diagram\s+\d+/i,
      /Chart\s+\d+/i,
      /Table\s+\d+/i,
    ];
    
    return imagePatterns.some(pattern => pattern.test(text));
  }

  detectMathContent(text) {
    const mathPatterns = [
      /\$[^$]+\$/, // LaTeX math
      /\\\([^)]+\\\)/, // LaTeX inline math
      /\\\[[^\]]+\\\]/, // LaTeX display math
      /\b\d+\s*[+\-*/=]\s*\d+\b/, // Simple equations
      /[∑∏∫∆∇αβγδεζηθικλμνξοπρστυφχψω]/i, // Greek letters and symbols
    ];
    
    return mathPatterns.some(pattern => pattern.test(text));
  }

  detectCodeBlocks(text) {
    const codePatterns = [
      /```[^`]*```/s, // Code blocks
      /`[^`]+`/, // Inline code
      /function\s+\w+\s*\(/i,
      /class\s+\w+\s*[:{]/i,
      /import\s+\w+/i,
      /def\s+\w+\s*\(/i,
    ];
    
    return codePatterns.some(pattern => pattern.test(text));
  }

  extractChapterTitle(text) {
    const chapterPatterns = [
      /^Chapter\s+(\d+):?\s*(.+)$/im,
      /^(\d+)\.\s+([A-Z][a-zA-Z\s]+)$/m,
      /^([A-Z][A-Z\s]{10,})$/m, // Long uppercase titles
    ];
    
    for (const pattern of chapterPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[2] || match[1] || match[0].trim();
      }
    }
    
    return null;
  }

  extractSectionTitle(text) {
    const sectionPatterns = [
      /^Section\s+(\d+):?\s*(.+)$/im,
      /^(\d+\.\d+)\s+([A-Z][a-zA-Z\s]+)$/m,
      /^\d+\.\d+\.\s+([A-Z][a-zA-Z\s]+)$/m,
    ];
    
    for (const pattern of sectionPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[2] || match[1] || match[0].trim();
      }
    }
    
    return null;
  }

  determineContentType(features) {
    const { hasHeadings, hasBulletPoints, hasImages, hasEquations, hasCode, wordCount, paragraphCount } = features;
    
    if (hasCode) return 'code_documentation';
    if (hasEquations && wordCount > 100) return 'mathematical';
    if (hasImages && hasBulletPoints) return 'technical_reference';
    if (hasHeadings && paragraphCount > 3) return 'academic_text';
    if (hasBulletPoints && wordCount < 500) return 'summary_notes';
    if (wordCount < 100) return 'minimal_content';
    if (paragraphCount > 5) return 'dense_text';
    
    return 'standard_text';
  }

  /**
   * Document structure helper methods
   */
  isTableOfContentsPage(text) {
    const tocPatterns = [
      /table\s+of\s+contents/i,
      /contents/i,
      /^Chapter\s+\d+\s+\.\.\.\s+\d+$/m,
      /\.\.\.\s*\d+$/m, // Page numbers with dots
    ];
    
    return tocPatterns.some(pattern => pattern.test(text));
  }

  isAppendixPage(text) {
    return /^Appendix\s+[A-Z]/im.test(text);
  }

  isBibliographyPage(text) {
    const bibPatterns = [
      /^Bibliography$/im,
      /^References$/im,
      /^Works\s+Cited$/im,
      /\[\d+\]\s+[A-Z]/m, // Citation format [1] Author
    ];
    
    return bibPatterns.some(pattern => pattern.test(text));
  }

  assessStructuralComplexity(structure, totalPages) {
    const chapterCount = structure.chapters.length;
    const sectionCount = structure.sections.length;
    const hasTableOfContents = structure.tableOfContents.length > 0;
    const hasAppendices = structure.appendices.length > 0;
    const hasBibliography = structure.bibliography.length > 0;
    
    let complexityScore = 0;
    
    // Chapter-based complexity
    if (chapterCount > 10) complexityScore += 3;
    else if (chapterCount > 5) complexityScore += 2;
    else if (chapterCount > 0) complexityScore += 1;
    
    // Section density
    const sectionDensity = totalPages > 0 ? sectionCount / totalPages : 0;
    if (sectionDensity > 0.5) complexityScore += 3;
    else if (sectionDensity > 0.2) complexityScore += 2;
    else if (sectionDensity > 0) complexityScore += 1;
    
    // Structural features
    if (hasTableOfContents) complexityScore += 1;
    if (hasAppendices) complexityScore += 1;
    if (hasBibliography) complexityScore += 1;
    
    // Determine complexity level
    if (complexityScore >= 8) return 'very_complex';
    if (complexityScore >= 6) return 'complex';
    if (complexityScore >= 4) return 'moderate';
    if (complexityScore >= 2) return 'simple';
    return 'minimal';
  }

  /**
   * Custom page rendering for enhanced text extraction
   */
  async renderPage(pageData) {
    // Custom rendering logic for better text extraction
    // This can be enhanced with additional PDF.js features
    let render_options = {
      normalizeWhitespace: false,
      disableCombineTextItems: false
    };

    try {
      return pageData.getTextContent(render_options)
        .then(textContent => {
          let lastY, text = '';
          for (let item of textContent.items) {
            if (lastY == item.transform[5] || !lastY) {
              text += item.str;
            } else {
              text += '\n' + item.str;
            }
            lastY = item.transform[5];
          }
          return text;
        });
    } catch (error) {
      console.warn('Custom page rendering failed:', error.message);
      return '';
    }
  }

  /**
   * Save processed PDF data to database
   */
  async savePDFAnalysisToDatabase(documentId, userId, analysisData) {
    try {
      console.log(`💾 Saving PDF analysis to database for document ${documentId}`);
      
      // Save page-by-page analysis
      const pageInserts = analysisData.pageAnalysis.map(page => ({
        document_id: documentId,
        user_id: userId,
        page_number: page.pageNumber,
        text_content: page.textContent,
        word_count: page.wordCount,
        difficulty_score: page.difficultyScore,
        difficulty_level: page.difficultyLevel,
        estimated_reading_seconds: analysisData.timeEstimates.pageEstimates
          .find(e => e.pageNumber === page.pageNumber)?.estimatedSeconds || 120,
        has_images: page.hasImages,
        has_equations: page.hasEquations,
        has_code: page.hasCode,
        chapter_title: page.chapterTitle,
        section_title: page.sectionTitle,
        content_type: page.contentType,
        sentence_count: page.sentenceCount,
        paragraph_count: page.paragraphCount,
        avg_words_per_sentence: page.avgWordsPerSentence,
        complex_word_count: page.complexWordCount,
        technical_term_count: page.technicalTermCount
      }));

      // Insert page analysis data
      const { error: pageError } = await supabase
        .from('pdf_content_analysis')
        .insert(pageInserts);

      if (pageError) {
        console.error('Error saving page analysis:', pageError);
        throw pageError;
      }

      // Update document with overall metrics
      const { error: docError } = await supabase
        .from('documents')
        .update({
          difficulty_level: Math.round(analysisData.documentMetrics.averageDifficulty),
          estimated_reading_time_minutes: Math.round(analysisData.timeEstimates.totalSeconds / 60),
          content_type: this.getDominantContentType(analysisData.documentMetrics.contentTypeDistribution),
          processing_metadata: analysisData.processingMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .eq('user_id', userId);

      if (docError) {
        console.error('Error updating document metadata:', docError);
        throw docError;
      }

      console.log(`✅ Successfully saved PDF analysis for ${pageInserts.length} pages`);
      return true;
    } catch (error) {
      console.error('Failed to save PDF analysis to database:', error);
      throw error;
    }
  }

  /**
   * Get dominant content type from distribution
   */
  getDominantContentType(distribution) {
    if (!distribution || Object.keys(distribution).length === 0) {
      return 'standard_text';
    }
    
    return Object.entries(distribution)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  /**
   * Get user's historical reading speed for personalized estimates
   */
  async getUserReadingSpeed(userId) {
    try {
      const { data: userStats } = await supabase
        .from('user_stats')
        .select('average_reading_speed_seconds, total_pages_read')
        .eq('user_id', userId)
        .single();

      if (userStats && userStats.total_pages_read > 10) {
        // User has enough history, use their speed
        return {
          hasPersonalizedSpeed: true,
          avgSecondsPerPage: userStats.average_reading_speed_seconds,
          confidence: Math.min(userStats.total_pages_read / 100, 1.0)
        };
      }

      return {
        hasPersonalizedSpeed: false,
        avgSecondsPerPage: 120, // Default 2 minutes per page
        confidence: 0
      };
    } catch (error) {
      console.warn('Could not fetch user reading speed:', error.message);
      return {
        hasPersonalizedSpeed: false,
        avgSecondsPerPage: 120,
        confidence: 0
      };
    }
  }

  /**
   * Generate intelligent reading recommendations
   */
  generateReadingRecommendations(analysisData, userReadingSpeed) {
    const recommendations = [];
    const { documentMetrics, documentStructure, timeEstimates } = analysisData;
    
    // Difficulty-based recommendations
    if (documentMetrics.averageDifficulty > 4) {
      recommendations.push({
        type: 'difficulty',
        priority: 'high',
        title: 'Challenging Content Detected',
        message: 'This document contains advanced material. Consider shorter study sessions (20-30 minutes) with breaks.',
        actionable: true,
        suggestedSessionLength: 25 * 60 // 25 minutes
      });
    }

    // Content type recommendations
    const dominantType = this.getDominantContentType(documentMetrics.contentTypeDistribution);
    if (dominantType === 'mathematical') {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        title: 'Mathematical Content',
        message: 'Take extra time with equations and formulas. Have paper ready for working through problems.',
        actionable: true
      });
    }

    if (dominantType === 'code_documentation') {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        title: 'Code Documentation',
        message: 'Consider having a code editor open to test examples as you read.',
        actionable: true
      });
    }

    // Structure-based recommendations
    if (documentStructure.chapters.length > 10) {
      recommendations.push({
        type: 'structure',
        priority: 'low',
        title: 'Complex Document Structure',
        message: 'Focus on one chapter at a time. Use the table of contents to plan your reading schedule.',
        actionable: true
      });
    }

    // Time-based recommendations
    const totalHours = timeEstimates.totalSeconds / 3600;
    if (totalHours > 10) {
      recommendations.push({
        type: 'time',
        priority: 'high',
        title: 'Long Document',
        message: `This document will take approximately ${Math.round(totalHours)} hours to read. Plan multiple study sessions.`,
        actionable: true,
        suggestedSessions: Math.ceil(totalHours / 2) // 2-hour sessions
      });
    }

    // Personalization based on user speed
    if (userReadingSpeed.hasPersonalizedSpeed) {
      const speedDifference = userReadingSpeed.avgSecondsPerPage - 120; // Compare to average
      
      if (speedDifference > 60) {
        recommendations.push({
          type: 'personalization',
          priority: 'medium',
          title: 'Adjusted for Your Reading Pace',
          message: 'Based on your reading history, you might need extra time with this material. The estimates have been adjusted.',
          actionable: false
        });
      } else if (speedDifference < -30) {
        recommendations.push({
          type: 'personalization',
          priority: 'low',
          title: 'Fast Reader Detected',
          message: 'You read faster than average! Consider tackling larger sections or more challenging material.',
          actionable: true
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

module.exports = PDFProcessorService;