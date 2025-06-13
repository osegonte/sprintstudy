-- Enhanced Study Planner Database Schema
-- This migration adds all the advanced features for the complete study app

-- 1. TOPICS & CATEGORIES SYSTEM
CREATE TABLE topics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#667eea', -- Hex color for UI
    icon VARCHAR(50) DEFAULT '📚', -- Emoji or icon identifier
    target_completion_date DATE,
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5), -- 1=highest, 5=lowest
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. EXAM GOALS & DEADLINE MANAGEMENT
CREATE TABLE exam_goals (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENHANCED DOCUMENT CATEGORIES
ALTER TABLE documents ADD COLUMN topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN difficulty_level INTEGER DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5);
ALTER TABLE documents ADD COLUMN estimated_reading_time_minutes INTEGER;
ALTER TABLE documents ADD COLUMN content_type VARCHAR(100) DEFAULT 'academic'; -- academic, reference, practice, etc.
ALTER TABLE documents ADD COLUMN priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5);

-- 4. ENHANCED SPRINT SYSTEM
DROP TABLE IF EXISTS sprints;
CREATE TABLE sprints (
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
    
    -- Status and completion
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')),
    completion_quality INTEGER CHECK (completion_quality BETWEEN 1 AND 5), -- User rates their focus/comprehension
    
    -- Performance tracking
    pages_actually_completed INTEGER DEFAULT 0,
    breaks_taken INTEGER DEFAULT 0,
    focus_score DECIMAL(3,2), -- 0.0 to 1.0 based on activity detection
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. ACHIEVEMENTS & GAMIFICATION SYSTEM
CREATE TABLE achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'first_pdf', 'speed_reader', 'streak_7'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50) NOT NULL, -- Emoji or icon
    category VARCHAR(50) NOT NULL, -- progress, speed, consistency, milestone
    requirement_type VARCHAR(50) NOT NULL, -- pages_read, streak_days, reading_speed, etc.
    requirement_value INTEGER NOT NULL,
    points INTEGER DEFAULT 0,
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements junction table
CREATE TABLE user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress_value INTEGER, -- For tracking partial progress
    UNIQUE(user_id, achievement_id)
);

-- 6. ENHANCED USER STATS
ALTER TABLE user_stats ADD COLUMN current_streak_days INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN longest_streak_days INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN last_activity_date DATE;
ALTER TABLE user_stats ADD COLUMN total_study_sessions INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN average_session_duration_seconds INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN total_xp_points INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN current_level INTEGER DEFAULT 1;
ALTER TABLE user_stats ADD COLUMN focus_score_average DECIMAL(3,2) DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN preferred_session_duration_minutes INTEGER DEFAULT 30;
ALTER TABLE user_stats ADD COLUMN peak_performance_hour INTEGER; -- 0-23, hour of day when most productive

-- 7. STUDY SESSIONS (Enhanced activity tracking)
CREATE TABLE study_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    
    -- Session timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    total_duration_seconds INTEGER DEFAULT 0,
    active_reading_seconds INTEGER DEFAULT 0, -- Actual focused time
    break_time_seconds INTEGER DEFAULT 0,
    
    -- Session details
    pages_covered INTEGER DEFAULT 0,
    starting_page INTEGER,
    ending_page INTEGER,
    
    -- Activity detection
    tab_switches INTEGER DEFAULT 0,
    app_minimized_count INTEGER DEFAULT 0,
    inactivity_periods INTEGER DEFAULT 0,
    longest_focus_streak_seconds INTEGER DEFAULT 0,
    
    -- Session quality
    focus_score DECIMAL(3,2), -- 0.0 to 1.0
    comprehension_rating INTEGER CHECK (comprehension_rating BETWEEN 1 AND 5),
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
    
    -- Session outcome
    session_type VARCHAR(50) DEFAULT 'reading', -- reading, review, practice, exam_prep
    completion_status VARCHAR(20) DEFAULT 'completed' CHECK (completion_status IN ('completed', 'interrupted', 'abandoned')),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. PERFORMANCE ANALYTICS
CREATE TABLE reading_analytics (
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
    productivity_score DECIMAL(3,2), -- Composite score
    
    -- Time distribution
    morning_minutes INTEGER DEFAULT 0, -- 6-12
    afternoon_minutes INTEGER DEFAULT 0, -- 12-18
    evening_minutes INTEGER DEFAULT 0, -- 18-22
    night_minutes INTEGER DEFAULT 0, -- 22-6
    
    -- Goals and targets
    daily_goal_minutes INTEGER,
    goal_achievement_percentage DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 9. REAL-TIME FEEDBACK SYSTEM
CREATE TABLE reading_feedback (
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
    energy_context VARCHAR(50), -- morning_fresh, afternoon_tired, etc.
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. ENHANCED PAGE TRACKING
ALTER TABLE document_pages ADD COLUMN session_id UUID REFERENCES study_sessions(id) ON DELETE SET NULL;
ALTER TABLE document_pages ADD COLUMN focus_events INTEGER DEFAULT 0; -- Number of focus/blur events
ALTER TABLE document_pages ADD COLUMN scroll_events INTEGER DEFAULT 0; -- Page interaction tracking
ALTER TABLE document_pages ADD COLUMN pause_count INTEGER DEFAULT 0;
ALTER TABLE document_pages ADD COLUMN actual_reading_seconds INTEGER DEFAULT 0; -- Excluding pauses
ALTER TABLE document_pages ADD COLUMN difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5);
ALTER TABLE document_pages ADD COLUMN comprehension_rating INTEGER CHECK (comprehension_rating BETWEEN 1 AND 5);
ALTER TABLE document_pages ADD COLUMN notes TEXT;

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Topics
CREATE INDEX idx_topics_user_id ON topics(user_id);
CREATE INDEX idx_topics_priority ON topics(user_id, priority);

-- Exam Goals
CREATE INDEX idx_exam_goals_user_id ON exam_goals(user_id);
CREATE INDEX idx_exam_goals_exam_date ON exam_goals(exam_date);
CREATE INDEX idx_exam_goals_topic ON exam_goals(topic_id);

-- Documents
CREATE INDEX idx_documents_topic ON documents(topic_id);
CREATE INDEX idx_documents_difficulty ON documents(difficulty_level);

-- Sprints
CREATE INDEX idx_sprints_user_date ON sprints(user_id, target_date);
CREATE INDEX idx_sprints_status ON sprints(user_id, status);
CREATE INDEX idx_sprints_topic ON sprints(topic_id);

-- Achievements
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_achievements_category ON achievements(category);

-- Study Sessions
CREATE INDEX idx_study_sessions_user_date ON study_sessions(user_id, started_at);
CREATE INDEX idx_study_sessions_document ON study_sessions(document_id);
CREATE INDEX idx_study_sessions_topic ON study_sessions(topic_id);

-- Analytics
CREATE INDEX idx_reading_analytics_user_date ON reading_analytics(user_id, date);

-- Feedback
CREATE INDEX idx_reading_feedback_user_session ON reading_feedback(user_id, session_id);

-- =====================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================

-- Enable RLS
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_feedback ENABLE ROW LEVEL SECURITY;

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

-- Achievements policies
CREATE POLICY "Everyone can view achievements" ON achievements FOR SELECT TO public USING (true);
CREATE POLICY "Users can view their own earned achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Study sessions policies
CREATE POLICY "Users can view their own study sessions" ON study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own study sessions" ON study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own study sessions" ON study_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Analytics policies
CREATE POLICY "Users can view their own analytics" ON reading_analytics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own analytics" ON reading_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own analytics" ON reading_analytics FOR UPDATE USING (auth.uid() = user_id);

-- Feedback policies
CREATE POLICY "Users can view their own feedback" ON reading_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own feedback" ON reading_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================
-- INITIAL ACHIEVEMENT DATA
-- =====================================

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
('zen_master', 'Zen Master', 'Maintain 95%+ focus score for 10 sessions', '🧘‍♂️', 'performance', 'ultra_focus_sessions', 10, 750, 'epic');

-- =====================================
-- UTILITY FUNCTIONS
-- =====================================

-- Function to calculate user level from XP
CREATE OR REPLACE FUNCTION calculate_user_level(xp_points INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Level 1: 0-99 XP, Level 2: 100-299 XP, Level 3: 300-599 XP, etc.
    -- Formula: Level = floor(sqrt(XP/100)) + 1
    RETURN GREATEST(1, FLOOR(SQRT(xp_points::FLOAT / 100)) + 1);
END;
$$ LANGUAGE plpgsql;

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $$
DECLARE
    analytics_date DATE := CURRENT_DATE;
    existing_analytics reading_analytics%ROWTYPE;
BEGIN
    -- Get existing analytics for today
    SELECT * INTO existing_analytics 
    FROM reading_analytics 
    WHERE user_id = NEW.user_id AND date = analytics_date;
    
    -- Calculate daily totals
    IF existing_analytics.id IS NULL THEN
        -- Create new analytics record
        INSERT INTO reading_analytics (
            user_id, 
            date, 
            total_pages_read, 
            total_time_seconds,
            study_sessions_count
        ) VALUES (
            NEW.user_id,
            analytics_date,
            1,
            COALESCE(NEW.total_duration_seconds, 0),
            1
        );
    ELSE
        -- Update existing analytics
        UPDATE reading_analytics SET
            total_pages_read = total_pages_read + COALESCE(NEW.pages_covered, 0),
            total_time_seconds = total_time_seconds + COALESCE(NEW.total_duration_seconds, 0),
            study_sessions_count = study_sessions_count + 1,
            updated_at = NOW()
        WHERE user_id = NEW.user_id AND date = analytics_date;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic analytics updates
CREATE TRIGGER trigger_update_daily_analytics
    AFTER INSERT ON study_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_analytics();

-- =====================================
-- VIEWS FOR COMPLEX QUERIES
-- =====================================

-- View for topic progress
CREATE VIEW topic_progress AS
SELECT 
    t.id,
    t.user_id,
    t.name,
    t.description,
    t.color,
    t.icon,
    t.target_completion_date,
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT CASE WHEN dp.is_completed THEN dp.id END) as completed_pages,
    COUNT(DISTINCT dp.id) as total_pages,
    CASE 
        WHEN COUNT(DISTINCT dp.id) > 0 
        THEN ROUND((COUNT(DISTINCT CASE WHEN dp.is_completed THEN dp.id END)::FLOAT / COUNT(DISTINCT dp.id)) * 100, 2)
        ELSE 0 
    END as completion_percentage,
    COALESCE(SUM(dp.time_spent_seconds), 0) as total_time_spent_seconds
FROM topics t
LEFT JOIN documents d ON t.id = d.topic_id
LEFT JOIN document_pages dp ON d.id = dp.document_id
GROUP BY t.id, t.user_id, t.name, t.description, t.color, t.icon, t.target_completion_date;

-- View for user dashboard summary
CREATE VIEW user_dashboard_summary AS
SELECT 
    us.user_id,
    us.total_pages_read,
    us.total_time_spent_seconds,
    us.average_reading_speed_seconds,
    us.current_streak_days,
    us.longest_streak_days,
    us.total_xp_points,
    us.current_level,
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT t.id) as total_topics,
    COUNT(DISTINCT eg.id) as total_exam_goals,
    COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_sprints,
    COUNT(DISTINCT ua.id) as total_achievements
FROM user_stats us
LEFT JOIN documents d ON us.user_id = d.user_id
LEFT JOIN topics t ON us.user_id = t.user_id AND t.is_archived = false
LEFT JOIN exam_goals eg ON us.user_id = eg.user_id AND eg.is_completed = false
LEFT JOIN sprints s ON us.user_id = s.user_id
LEFT JOIN user_achievements ua ON us.user_id = ua.user_id
GROUP BY us.user_id, us.total_pages_read, us.total_time_spent_seconds, 
         us.average_reading_speed_seconds, us.current_streak_days, 
         us.longest_streak_days, us.total_xp_points, us.current_level;

-- =====================================
-- COMMIT CHANGES
-- =====================================

COMMIT;