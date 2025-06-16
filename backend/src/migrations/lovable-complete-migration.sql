-- ==============================================
-- COMPLETE SUPABASE MIGRATION FOR LOVABLE FRONTEND
-- Version: 2.1.0-lovable
-- ==============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================
-- 1. USER PROFILES & AUTHENTICATION
-- ==============================================

-- Enhanced user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    bio TEXT,
    avatar_url TEXT,
    email VARCHAR(255),
    preferences JSONB DEFAULT '{
        "theme": "light",
        "notifications": {
            "email": true,
            "push": false,
            "study_reminders": true,
            "achievement_alerts": true
        },
        "study": {
            "default_session_duration": 30,
            "preferred_difficulty": "adaptive",
            "break_reminders": true,
            "focus_mode": false
        },
        "privacy": {
            "profile_public": false,
            "show_progress": true,
            "show_achievements": true
        }
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 2. STUDY ORGANIZATION SYSTEM
-- ==============================================

-- Topics for organizing study materials
CREATE TABLE IF NOT EXISTS topics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#667eea', -- Hex color for UI
    icon VARCHAR(50) DEFAULT '📚', -- Emoji or icon identifier
    target_completion_date DATE,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5), -- 1=highest, 5=lowest
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Exam goals and deadline management
CREATE TABLE IF NOT EXISTS exam_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    exam_date DATE NOT NULL,
    target_score VARCHAR(50), -- e.g., "85%", "A grade", "Pass"
    study_hours_per_day DECIMAL(4,2) DEFAULT 1.0,
    difficulty_level INTEGER DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
    is_completed BOOLEAN DEFAULT FALSE,
    actual_score VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 3. DOCUMENT MANAGEMENT SYSTEM
-- ==============================================

-- Enhanced documents table with AI analysis support
CREATE TABLE IF NOT EXISTS documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- Supabase storage path
    file_size BIGINT, -- Size in bytes
    total_pages INTEGER DEFAULT 0,
    difficulty_level INTEGER DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
    estimated_reading_time_minutes INTEGER,
    content_type VARCHAR(100) DEFAULT 'academic', -- academic, reference, practice, etc.
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    notes TEXT,
    processing_metadata JSONB DEFAULT '{}'::jsonb,
    is_processing BOOLEAN DEFAULT FALSE,
    processing_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page-level tracking for detailed analytics
CREATE TABLE IF NOT EXISTS document_pages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    page_number INTEGER NOT NULL,
    time_spent_seconds INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    last_read_at TIMESTAMPTZ,
    estimated_time_seconds INTEGER DEFAULT 120, -- AI-generated estimate
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
    comprehension_rating INTEGER CHECK (comprehension_rating BETWEEN 1 AND 5),
    focus_events INTEGER DEFAULT 0,
    scroll_events INTEGER DEFAULT 0,
    pause_count INTEGER DEFAULT 0,
    actual_reading_seconds INTEGER DEFAULT 0,
    notes TEXT,
    session_id UUID, -- References study_sessions(id)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, page_number)
);

-- PDF content analysis for AI-powered insights
CREATE TABLE IF NOT EXISTS pdf_content_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    page_number INTEGER NOT NULL,
    text_content TEXT,
    word_count INTEGER DEFAULT 0,
    sentence_count INTEGER DEFAULT 0,
    paragraph_count INTEGER DEFAULT 0,
    difficulty_score DECIMAL(3,2) DEFAULT 3.0,
    difficulty_level INTEGER DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
    estimated_reading_seconds INTEGER DEFAULT 120,
    has_images BOOLEAN DEFAULT FALSE,
    has_equations BOOLEAN DEFAULT FALSE,
    has_code BOOLEAN DEFAULT FALSE,
    chapter_title VARCHAR(255),
    section_title VARCHAR(255),
    content_type VARCHAR(50) DEFAULT 'standard_text',
    avg_words_per_sentence DECIMAL(5,2),
    complex_word_count INTEGER DEFAULT 0,
    technical_term_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, page_number)
);

-- ==============================================
-- 4. STUDY SESSION SYSTEM
-- ==============================================

-- Study sessions with comprehensive tracking
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    sprint_id UUID, -- References sprints(id)
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    
    -- Session timing
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    total_duration_seconds INTEGER DEFAULT 0,
    active_reading_seconds INTEGER DEFAULT 0,
    break_time_seconds INTEGER DEFAULT 0,
    
    -- Session details
    pages_covered INTEGER DEFAULT 0,
    starting_page INTEGER,
    ending_page INTEGER,
    
    -- Activity detection and focus metrics
    tab_switches INTEGER DEFAULT 0,
    app_minimized_count INTEGER DEFAULT 0,
    inactivity_periods INTEGER DEFAULT 0,
    longest_focus_streak_seconds INTEGER DEFAULT 0,
    
    -- Session quality ratings
    focus_score DECIMAL(3,2), -- 0.0 to 1.0
    comprehension_rating INTEGER CHECK (comprehension_rating BETWEEN 1 AND 5),
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
    
    -- Session metadata
    session_type VARCHAR(50) DEFAULT 'reading', -- reading, review, practice, exam_prep
    completion_status VARCHAR(20) DEFAULT 'completed' CHECK (completion_status IN ('completed', 'interrupted', 'abandoned')),
    environment_notes TEXT,
    notes TEXT,
    pause_data JSONB DEFAULT '{"pauses": []}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 5. INTELLIGENT SPRINT SYSTEM
-- ==============================================

-- AI-powered study sprints
CREATE TABLE IF NOT EXISTS sprints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    exam_goal_id UUID REFERENCES exam_goals(id) ON DELETE SET NULL,
    
    -- Sprint details
    title VARCHAR(255) NOT NULL,
    start_page INTEGER NOT NULL,
    end_page INTEGER NOT NULL,
    estimated_time_seconds INTEGER NOT NULL,
    actual_time_seconds INTEGER,
    
    -- Scheduling
    target_date DATE NOT NULL,
    target_start_time TIME,
    target_end_time TIME,
    
    -- Sprint metadata
    difficulty_level INTEGER DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
    sprint_type VARCHAR(50) DEFAULT 'reading', -- reading, review, practice
    auto_generated BOOLEAN DEFAULT TRUE,
    generation_strategy VARCHAR(50), -- sequential, difficulty_focused, review, etc.
    
    -- Status and completion
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')),
    completion_quality INTEGER CHECK (completion_quality BETWEEN 1 AND 5),
    
    -- Performance tracking
    pages_actually_completed INTEGER DEFAULT 0,
    breaks_taken INTEGER DEFAULT 0,
    focus_score DECIMAL(3,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- ==============================================
-- 6. ANALYTICS & PERFORMANCE TRACKING
-- ==============================================

-- User statistics for personalization
CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    total_pages_read INTEGER DEFAULT 0,
    total_time_spent_seconds INTEGER DEFAULT 0,
    average_reading_speed_seconds DECIMAL(6,2) DEFAULT 120,
    total_documents INTEGER DEFAULT 0,
    total_study_sessions INTEGER DEFAULT 0,
    average_session_duration_seconds INTEGER DEFAULT 0,
    
    -- Streak tracking
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    last_activity_date DATE,
    
    -- Performance metrics
    focus_score_average DECIMAL(3,2) DEFAULT 0.7,
    productivity_score DECIMAL(3,2) DEFAULT 0.5,
    preferred_session_duration_minutes INTEGER DEFAULT 30,
    peak_performance_hour INTEGER, -- 0-23, hour of day when most productive
    
    -- Gamification
    total_xp_points INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily reading analytics
CREATE TABLE IF NOT EXISTS reading_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    
    -- Daily aggregates
    total_pages_read INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    average_page_time_seconds DECIMAL(6,2),
    study_sessions_count INTEGER DEFAULT 0,
    
    -- Performance metrics
    reading_speed_wpm DECIMAL(6,2), -- Words per minute
    focus_score_average DECIMAL(3,2),
    productivity_score DECIMAL(3,2),
    
    -- Time distribution
    morning_minutes INTEGER DEFAULT 0, -- 6-12
    afternoon_minutes INTEGER DEFAULT 0, -- 12-18
    evening_minutes INTEGER DEFAULT 0, -- 18-22
    night_minutes INTEGER DEFAULT 0, -- 22-6
    
    -- Goals and targets
    daily_goal_minutes INTEGER,
    goal_achievement_percentage DECIMAL(5,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Real-time feedback system
CREATE TABLE IF NOT EXISTS reading_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    page_number INTEGER NOT NULL,
    
    -- Performance comparison
    page_time_seconds INTEGER NOT NULL,
    personal_average_seconds DECIMAL(6,2),
    difference_from_average_seconds DECIMAL(6,2),
    
    -- Feedback data
    feedback_type VARCHAR(50) NOT NULL, -- fast, perfect, slow, improving
    feedback_message TEXT,
    encouragement_level INTEGER CHECK (encouragement_level BETWEEN 1 AND 5),
    
    -- Context
    time_of_day TIME,
    day_of_week INTEGER, -- 0=Sunday, 6=Saturday
    energy_context VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 7. GAMIFICATION SYSTEM
-- ==============================================

-- Achievement definitions
CREATE TABLE IF NOT EXISTS achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL, -- progress, speed, consistency, milestone
    requirement_type VARCHAR(50) NOT NULL, -- pages_read, streak_days, reading_speed, etc.
    requirement_value INTEGER NOT NULL,
    points INTEGER DEFAULT 0,
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User achievements junction table
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    progress_value INTEGER,
    UNIQUE(user_id, achievement_id)
);

-- ==============================================
-- 8. STORAGE BUCKET SETUP
-- ==============================================

-- Create storage bucket for PDF documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'pdf-documents',
    'pdf-documents',
    false,
    52428800, -- 50MB limit
    ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- 9. ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_content_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete their own profile" ON user_profiles FOR DELETE USING (auth.uid() = id);

-- Topics policies
CREATE POLICY "Users can view their own topics" ON topics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own topics" ON topics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own topics" ON topics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own topics" ON topics FOR DELETE USING (auth.uid() = user_id);

-- Exam goals policies
CREATE POLICY "Users can view their own exam goals" ON exam_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own exam goals" ON exam_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own exam goals" ON exam_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own exam goals" ON exam_goals FOR DELETE USING (auth.uid() = user_id);

-- Documents policies
CREATE POLICY "Users can view their own documents" ON documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own documents" ON documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own documents" ON documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON documents FOR DELETE USING (auth.uid() = user_id);

-- Document pages policies
CREATE POLICY "Users can view their own document pages" ON document_pages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own document pages" ON document_pages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own document pages" ON document_pages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own document pages" ON document_pages FOR DELETE USING (auth.uid() = user_id);

-- PDF content analysis policies
CREATE POLICY "Users can view their own content analysis" ON pdf_content_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own content analysis" ON pdf_content_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Study sessions policies
CREATE POLICY "Users can view their own study sessions" ON study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own study sessions" ON study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own study sessions" ON study_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Sprints policies
CREATE POLICY "Users can view their own sprints" ON sprints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sprints" ON sprints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sprints" ON sprints FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sprints" ON sprints FOR DELETE USING (auth.uid() = user_id);

-- User stats policies
CREATE POLICY "Users can view their own stats" ON user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own stats" ON user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stats" ON user_stats FOR UPDATE USING (auth.uid() = user_id);

-- Reading analytics policies
CREATE POLICY "Users can view their own analytics" ON reading_analytics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own analytics" ON reading_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own analytics" ON reading_analytics FOR UPDATE USING (auth.uid() = user_id);

-- Reading feedback policies
CREATE POLICY "Users can view their own feedback" ON reading_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own feedback" ON reading_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Achievements policies (achievements are public, user_achievements are private)
CREATE POLICY "Everyone can view achievements" ON achievements FOR SELECT TO public USING (true);
CREATE POLICY "Users can view their own earned achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage policies
CREATE POLICY "Users can upload documents" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'pdf-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own documents" ON storage.objects
FOR SELECT USING (
    bucket_id = 'pdf-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own documents" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'pdf-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own documents" ON storage.objects
FOR DELETE USING (
    bucket_id = 'pdf-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- ==============================================
-- 10. INDEXES FOR PERFORMANCE
-- ==============================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Topics indexes
CREATE INDEX IF NOT EXISTS idx_topics_user_id ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_priority ON topics(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_topics_archived ON topics(user_id, is_archived);

-- Exam goals indexes
CREATE INDEX IF NOT EXISTS idx_exam_goals_user_id ON exam_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_goals_exam_date ON exam_goals(exam_date);
CREATE INDEX IF NOT EXISTS idx_exam_goals_topic ON exam_goals(topic_id);
CREATE INDEX IF NOT EXISTS idx_exam_goals_completed ON exam_goals(user_id, is_completed);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_topic ON documents(topic_id);
CREATE INDEX IF NOT EXISTS idx_documents_difficulty ON documents(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(user_id, created_at);

-- Document pages indexes
CREATE INDEX IF NOT EXISTS idx_document_pages_doc_page ON document_pages(document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_document_pages_user_completed ON document_pages(user_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_document_pages_last_read ON document_pages(user_id, last_read_at);

-- PDF content analysis indexes
CREATE INDEX IF NOT EXISTS idx_pdf_analysis_doc_page ON pdf_content_analysis(document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_pdf_analysis_difficulty ON pdf_content_analysis(difficulty_level);

-- Study sessions indexes
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_study_sessions_document ON study_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_topic ON study_sessions(topic_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_status ON study_sessions(user_id, completion_status);

-- Sprints indexes
CREATE INDEX IF NOT EXISTS idx_sprints_user_date ON sprints(user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sprints_topic ON sprints(topic_id);
CREATE INDEX IF NOT EXISTS idx_sprints_document ON sprints(document_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_reading_analytics_user_date ON reading_analytics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_reading_feedback_user_session ON reading_feedback(user_id, session_id);

-- Achievements indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_earned ON user_achievements(user_id, earned_at);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_active ON achievements(is_active);

-- ==============================================
-- 11. DATABASE FUNCTIONS
-- ==============================================

-- Function to calculate user level from XP
CREATE OR REPLACE FUNCTION calculate_user_level(xp_points INTEGER)
RETURNS INTEGER AS $
BEGIN
    -- Level 1: 0-99 XP, Level 2: 100-299 XP, Level 3: 300-599 XP, etc.
    -- Formula: Level = floor(sqrt(XP/100)) + 1
    RETURN GREATEST(1, FLOOR(SQRT(xp_points::FLOAT / 100)) + 1);
END;
$ LANGUAGE plpgsql;

-- Function to update user stats when sessions complete
CREATE OR REPLACE FUNCTION update_user_stats_on_session_complete()
RETURNS TRIGGER AS $
DECLARE
    current_stats user_stats%ROWTYPE;
    new_total_pages INTEGER;
    new_total_time INTEGER;
    new_avg_speed DECIMAL(6,2);
    new_session_count INTEGER;
BEGIN
    -- Only process completed sessions
    IF NEW.completion_status != 'completed' OR NEW.ended_at IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get current user stats
    SELECT * INTO current_stats 
    FROM user_stats 
    WHERE user_id = NEW.user_id;

    -- Calculate new values
    new_total_pages := COALESCE(current_stats.total_pages_read, 0) + COALESCE(NEW.pages_covered, 0);
    new_total_time := COALESCE(current_stats.total_time_spent_seconds, 0) + COALESCE(NEW.total_duration_seconds, 0);
    new_session_count := COALESCE(current_stats.total_study_sessions, 0) + 1;
    
    -- Calculate new average speed
    IF new_total_pages > 0 THEN
        new_avg_speed := new_total_time::DECIMAL / new_total_pages;
    ELSE
        new_avg_speed := COALESCE(current_stats.average_reading_speed_seconds, 120);
    END IF;

    -- Update user stats
    INSERT INTO user_stats (
        user_id,
        total_pages_read,
        total_time_spent_seconds,
        average_reading_speed_seconds,
        total_study_sessions,
        average_session_duration_seconds,
        focus_score_average,
        last_activity_date,
        updated_at
    ) VALUES (
        NEW.user_id,
        new_total_pages,
        new_total_time,
        new_avg_speed,
        new_session_count,
        CASE WHEN new_session_count > 0 THEN new_total_time / new_session_count ELSE 0 END,
        COALESCE(
            (COALESCE(current_stats.focus_score_average, 0.7) * COALESCE(current_stats.total_study_sessions, 0) + COALESCE(NEW.focus_score, 0.7)) / new_session_count,
            0.7
        ),
        CURRENT_DATE,
        NOW()
    ) ON CONFLICT (user_id) DO UPDATE SET
        total_pages_read = EXCLUDED.total_pages_read,
        total_time_spent_seconds = EXCLUDED.total_time_spent_seconds,
        average_reading_speed_seconds = EXCLUDED.average_reading_speed_seconds,
        total_study_sessions = EXCLUDED.total_study_sessions,
        average_session_duration_seconds = EXCLUDED.average_session_duration_seconds,
        focus_score_average = EXCLUDED.focus_score_average,
        last_activity_date = EXCLUDED.last_activity_date,
        updated_at = EXCLUDED.updated_at;

    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $
DECLARE
    analytics_date DATE := CURRENT_DATE;
    session_duration INTEGER;
    session_pages INTEGER;
BEGIN
    -- Only process completed sessions
    IF NEW.completion_status != 'completed' OR NEW.ended_at IS NULL THEN
        RETURN NEW;
    END IF;

    session_duration := COALESCE(NEW.total_duration_seconds, 0);
    session_pages := COALESCE(NEW.pages_covered, 0);

    -- Insert or update daily analytics
    INSERT INTO reading_analytics (
        user_id,
        date,
        total_pages_read,
        total_time_seconds,
        study_sessions_count,
        average_page_time_seconds,
        focus_score_average
    ) VALUES (
        NEW.user_id,
        analytics_date,
        session_pages,
        session_duration,
        1,
        CASE WHEN session_pages > 0 THEN session_duration::DECIMAL / session_pages ELSE 0 END,
        COALESCE(NEW.focus_score, 0.7)
    ) ON CONFLICT (user_id, date) DO UPDATE SET
        total_pages_read = reading_analytics.total_pages_read + session_pages,
        total_time_seconds = reading_analytics.total_time_seconds + session_duration,
        study_sessions_count = reading_analytics.study_sessions_count + 1,
        average_page_time_seconds = 
            CASE WHEN (reading_analytics.total_pages_read + session_pages) > 0 
            THEN (reading_analytics.total_time_seconds + session_duration)::DECIMAL / (reading_analytics.total_pages_read + session_pages)
            ELSE reading_analytics.average_page_time_seconds END,
        focus_score_average = 
            (reading_analytics.focus_score_average * reading_analytics.study_sessions_count + COALESCE(NEW.focus_score, 0.7)) / 
            (reading_analytics.study_sessions_count + 1);

    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Function to update document stats when pages are completed
CREATE OR REPLACE FUNCTION update_document_stats_on_page_complete()
RETURNS TRIGGER AS $
BEGIN
    -- Only process when a page is marked as completed
    IF NEW.is_completed = TRUE AND (OLD.is_completed IS NULL OR OLD.is_completed = FALSE) THEN
        -- Update user's total document count if needed
        INSERT INTO user_stats (user_id, total_documents)
        SELECT NEW.user_id, COUNT(DISTINCT d.id)
        FROM documents d
        WHERE d.user_id = NEW.user_id
        ON CONFLICT (user_id) DO UPDATE SET
            total_documents = EXCLUDED.total_documents,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- ==============================================
-- 12. TRIGGERS
-- ==============================================

-- Trigger for updating user stats on session completion
DROP TRIGGER IF EXISTS trigger_update_user_stats_on_session_complete ON study_sessions;
CREATE TRIGGER trigger_update_user_stats_on_session_complete
    AFTER UPDATE ON study_sessions
    FOR EACH ROW
    WHEN (NEW.completion_status = 'completed' AND NEW.ended_at IS NOT NULL)
    EXECUTE FUNCTION update_user_stats_on_session_complete();

-- Trigger for updating daily analytics
DROP TRIGGER IF EXISTS trigger_update_daily_analytics ON study_sessions;
CREATE TRIGGER trigger_update_daily_analytics
    AFTER UPDATE ON study_sessions
    FOR EACH ROW
    WHEN (NEW.completion_status = 'completed' AND NEW.ended_at IS NOT NULL)
    EXECUTE FUNCTION update_daily_analytics();

-- Trigger for updating document stats
DROP TRIGGER IF EXISTS trigger_update_document_stats ON document_pages;
CREATE TRIGGER trigger_update_document_stats
    AFTER UPDATE ON document_pages
    FOR EACH ROW
    EXECUTE FUNCTION update_document_stats_on_page_complete();

-- ==============================================
-- 13. INITIAL ACHIEVEMENT DATA
-- ==============================================

INSERT INTO achievements (code, title, description, icon, category, requirement_type, requirement_value, points, rarity) VALUES
-- Progress achievements
('first_pdf', 'First Steps', 'Upload your first PDF document', '📚', 'progress', 'documents_uploaded', 1, 50, 'common'),
('first_page', 'Page Turner', 'Complete reading your first page', '📄', 'progress', 'pages_read', 1, 25, 'common'),
('pages_10', 'Getting Started', 'Read 10 pages', '📖', 'progress', 'pages_read', 10, 100, 'common'),
('pages_50', 'Bookworm', 'Read 50 pages', '🐛', 'progress', 'pages_read', 50, 250, 'uncommon'),
('pages_100', 'Century Reader', 'Read 100 pages', '💯', 'progress', 'pages_read', 100, 500, 'rare'),
('pages_500', 'Library Master', 'Read 500 pages', '📚', 'progress', 'pages_read', 500, 1000, 'epic'),

-- Speed achievements
('speed_reader', 'Speed Reader', 'Average less than 60 seconds per page', '⚡', 'speed', 'avg_page_time', 60, 200, 'uncommon'),
('lightning_fast', 'Lightning Fast', 'Average less than 30 seconds per page', '⚡', 'speed', 'avg_page_time', 30, 500, 'rare'),

-- Consistency achievements
('streak_3', 'Getting Consistent', 'Study for 3 days in a row', '🔥', 'consistency', 'streak_days', 3, 150, 'common'),
('streak_7', 'Week Warrior', 'Study for 7 days in a row', '🗓️', 'consistency', 'streak_days', 7, 300, 'uncommon'),
('streak_30', 'Month Master', 'Study for 30 days in a row', '📅', 'consistency', 'streak_days', 30, 1000, 'epic'),

-- Time achievements
('hour_1', 'First Hour', 'Study for 1 hour total', '⏰', 'milestone', 'total_time_hours', 1, 75, 'common'),
('hour_10', 'Ten Hours Strong', 'Study for 10 hours total', '⏳', 'milestone', 'total_time_hours', 10, 200, 'uncommon'),
('hour_50', 'Time Master', 'Study for 50 hours total', '⌛', 'milestone', 'total_time_hours', 50, 750, 'rare'),

-- Sprint achievements
('sprint_1', 'Sprint Starter', 'Complete your first sprint', '🎯', 'milestone', 'sprints_completed', 1, 100, 'common'),
('sprint_10', 'Sprint Champion', 'Complete 10 sprints', '🏆', 'milestone', 'sprints_completed', 10, 300, 'uncommon'),
('perfect_sprint', 'Perfect Focus', 'Complete a sprint with 100% focus score', '🎯', 'performance', 'perfect_focus_sprints', 1, 400, 'rare'),

-- Focus achievements
('focused_reader', 'Focused Reader', 'Maintain 90%+ focus score for 5 sessions', '🧘', 'performance', 'high_focus_sessions', 5, 350, 'uncommon'),
('zen_master', 'Zen Master', 'Maintain 95%+ focus score for 10 sessions', '🧘‍♂️', 'performance', 'ultra_focus_sessions', 10, 750, 'epic')

ON CONFLICT (code) DO NOTHING;

-- ==============================================
-- 14. ENABLE REALTIME FOR LOVABLE
-- ==============================================

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE study_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE reading_analytics;
ALTER PUBLICATION supabase_realtime ADD TABLE user_achievements;
ALTER PUBLICATION supabase_realtime ADD TABLE sprints;

-- ==============================================
-- 15. VIEWS FOR COMPLEX QUERIES
-- ==============================================

-- View for topic progress summary
CREATE OR REPLACE VIEW topic_progress_summary AS
SELECT 
    t.id,
    t.user_id,
    t.name,
    t.description,
    t.color,
    t.icon,
    t.target_completion_date,
    t.priority,
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT dp.id) as total_pages,
    COUNT(DISTINCT CASE WHEN dp.is_completed THEN dp.id END) as completed_pages,
    CASE 
        WHEN COUNT(DISTINCT dp.id) > 0 
        THEN ROUND((COUNT(DISTINCT CASE WHEN dp.is_completed THEN dp.id END)::FLOAT / COUNT(DISTINCT dp.id)) * 100, 2)
        ELSE 0 
    END as completion_percentage,
    COALESCE(SUM(dp.time_spent_seconds), 0) as total_time_spent_seconds,
    COUNT(DISTINCT CASE WHEN eg.is_completed = false THEN eg.id END) as active_exam_goals
FROM topics t
LEFT JOIN documents d ON t.id = d.topic_id
LEFT JOIN document_pages dp ON d.id = dp.document_id
LEFT JOIN exam_goals eg ON t.id = eg.topic_id
WHERE t.is_archived = false
GROUP BY t.id, t.user_id, t.name, t.description, t.color, t.icon, t.target_completion_date, t.priority;

-- View for user dashboard summary
CREATE OR REPLACE VIEW user_dashboard_summary AS
SELECT 
    us.user_id,
    us.total_pages_read,
    us.total_time_spent_seconds,
    us.average_reading_speed_seconds,
    us.current_streak_days,
    us.longest_streak_days,
    us.total_xp_points,
    us.current_level,
    us.total_documents,
    COUNT(DISTINCT t.id) as total_active_topics,
    COUNT(DISTINCT eg.id) as total_exam_goals,
    COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_sprints,
    COUNT(DISTINCT ua.id) as total_achievements,
    COALESCE(recent_session.last_session_date, us.last_activity_date) as last_activity
FROM user_stats us
LEFT JOIN topics t ON us.user_id = t.user_id AND t.is_archived = false
LEFT JOIN exam_goals eg ON us.user_id = eg.user_id AND eg.is_completed = false
LEFT JOIN sprints s ON us.user_id = s.user_id
LEFT JOIN user_achievements ua ON us.user_id = ua.user_id
LEFT JOIN (
    SELECT user_id, MAX(started_at::date) as last_session_date
    FROM study_sessions
    GROUP BY user_id
) recent_session ON us.user_id = recent_session.user_id
GROUP BY us.user_id, us.total_pages_read, us.total_time_spent_seconds, 
         us.average_reading_speed_seconds, us.current_streak_days, 
         us.longest_streak_days, us.total_xp_points, us.current_level,
         us.total_documents, recent_session.last_session_date, us.last_activity_date;

-- ==============================================
-- 16. FINAL SETUP COMMANDS
-- ==============================================

-- Create a function to initialize user data on signup
CREATE OR REPLACE FUNCTION initialize_user_data()
RETURNS TRIGGER AS $
BEGIN
    -- Create user profile
    INSERT INTO user_profiles (id, username, email, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
    ) ON CONFLICT (id) DO NOTHING;

    -- Create user stats
    INSERT INTO user_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger to initialize user data on signup
DROP TRIGGER IF EXISTS trigger_initialize_user_data ON auth.users;
CREATE TRIGGER trigger_initialize_user_data
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_data();

-- ==============================================
-- MIGRATION COMPLETE
-- ==============================================

-- Insert a record to track migration completion
CREATE TABLE IF NOT EXISTS migration_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO migration_log (version, description)
VALUES ('2.1.0-lovable', 'Complete Supabase migration for Lovable frontend integration')
ON CONFLICT DO NOTHING;

-- Success message
DO $
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE 'Version: 2.1.0-lovable';
    RAISE NOTICE 'Lovable Frontend Ready: ✅';
    RAISE NOTICE 'Supabase Integration: ✅';
    RAISE NOTICE 'All Features Enabled: ✅';
    RAISE NOTICE '========================================';
END $;