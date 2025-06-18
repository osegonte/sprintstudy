// src/types/index.ts
// CineStudy Type Definitions

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  preferences?: UserPreferences;
  created_at: string;
  email_confirmed?: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    study_reminders: boolean;
    achievement_alerts: boolean;
  };
  study: {
    default_session_duration: number;
    preferred_difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
    break_reminders: boolean;
    focus_mode: boolean;
  };
  privacy: {
    profile_public: boolean;
    show_progress: boolean;
    show_achievements: boolean;
  };
}

export interface UserStats {
  user_id?: string;
  total_pages_read: number;
  total_time_spent_seconds: number;
  average_reading_speed_seconds: number;
  total_documents: number;
  total_study_sessions?: number;
  current_streak_days: number;
  longest_streak_days: number;
  total_xp_points: number;
  current_level: number;
  focus_score_average: number;
  productivity_score?: number;
  last_activity_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Topic {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  target_completion_date?: string;
  priority: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  total_documents?: number;
  total_pages?: number;
  completed_pages?: number;
  completion_percentage?: number;
  total_time_spent_seconds?: number;
}

export interface Document {
  id: string;
  title: string;
  file_name: string;
  file_path?: string;
  file_size?: number;
  total_pages: number;
  difficulty_level: number;
  estimated_reading_time_minutes: number;
  content_type: string;
  priority: number;
  created_at: string;
  updated_at: string;
  topic_id?: string;
  topic?: Topic;
  topic_name?: string;
  completed_pages?: number;
  completion_percentage?: number;
  total_time_spent_seconds?: number;
  current_page?: number;
  processing_metadata?: any;
  is_processing?: boolean;
  processing_error?: string;
  reading_metrics?: {
    reading_velocity_pages_per_hour: number;
    average_time_per_page_seconds: number;
    last_read_page?: number;
    last_read_at?: string;
    estimated_time_remaining_minutes: number;
  };
}

export interface StudySession {
  id: string;
  user_id: string;
  document_id: string;
  topic_id?: string;
  sprint_id?: string;
  started_at: string;
  ended_at?: string;
  total_duration_seconds: number;
  active_reading_seconds: number;
  break_time_seconds: number;
  pages_covered: number;
  starting_page?: number;
  ending_page?: number;
  tab_switches?: number;
  app_minimized_count?: number;
  inactivity_periods?: number;
  longest_focus_streak_seconds?: number;
  focus_score?: number;
  comprehension_rating?: number;
  difficulty_rating?: number;
  energy_level?: number;
  session_type: 'reading' | 'review' | 'practice' | 'exam_prep';
  completion_status: 'completed' | 'interrupted' | 'abandoned';
  notes?: string;
  pause_data?: any;
  created_at?: string;
  updated_at?: string;
}

export interface Sprint {
  id: string;
  user_id: string;
  title: string;
  document_id: string;
  topic_id?: string;
  exam_goal_id?: string;
  start_page: number;
  end_page: number;
  estimated_time_seconds: number;
  actual_time_seconds?: number;
  target_date: string;
  target_start_time?: string;
  target_end_time?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  difficulty_level: number;
  sprint_type: 'reading' | 'review' | 'practice';
  auto_generated: boolean;
  generation_strategy?: string;
  completion_quality?: number;
  pages_actually_completed?: number;
  breaks_taken?: number;
  focus_score?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at?: string;
  document?: Document;
  topic?: Topic;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: 'progress' | 'speed' | 'consistency' | 'milestone' | 'performance';
  requirement_type: string;
  requirement_value: number;
  points: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  is_active?: boolean;
  is_earned?: boolean;
  earned_at?: string;
  current_progress?: number;
  progress_percentage?: number;
  is_close?: boolean;
  is_new?: boolean;
  created_at?: string;
}

export interface ExamGoal {
  id: string;
  user_id: string;
  topic_id?: string;
  title: string;
  description?: string;
  exam_date: string;
  target_score?: string;
  study_hours_per_day: number;
  difficulty_level: number;
  is_completed: boolean;
  actual_score?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  topic?: Topic;
  time_metrics?: {
    days_until_exam: number;
    required_pages_per_day: number;
    required_study_time_seconds_per_day: number;
    urgency_level: 'low' | 'medium' | 'high' | 'critical' | 'overdue';
    on_track: boolean;
    target_completion_rate: number;
    current_completion_rate: number;
  };
}

export interface RecentActivity {
  id: string;
  document_title: string;
  topic_name?: string;
  topic_color?: string;
  duration_minutes: number;
  pages_covered: number;
  focus_score?: number;
  date: string;
  description?: string;
  created_at: string;
}

export interface Insight {
  type: 'performance' | 'consistency' | 'urgency' | 'speed' | 'trend';
  icon: string;
  title: string;
  message: string;
  action?: string;
  recommendation?: string;
}

export interface Recommendation {
  type: 'timing' | 'exam_prep' | 'consistency' | 'speed';
  icon: string;
  title: string;
  description: string;
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface DashboardData {
  overview: {
    total_documents: number;
    total_topics: number;
    total_pages: number;
    completed_pages: number;
    completion_percentage: number;
    total_time_spent_seconds: number;
    current_streak_days: number;
    current_level: number;
    total_xp_points: number;
  };
  performance: {
    average_reading_speed_seconds: number;
    focus_score_average: number;
    productivity_score: number;
    reading_consistency: number;
    improvement_trend: 'improving' | 'declining' | 'stable';
  };
  today: {
    sprint?: Sprint;
    recommended_study_time: number;
    priority_documents: Document[];
    urgent_goals: ExamGoal[];
  };
  topics: Topic[];
  recent_activity: RecentActivity[];
  achievements: Achievement[];
  trends?: {
    reading_velocity: any[];
    weekly_summary: any;
    monthly_goals: any;
  };
  insights: Insight[];
  recommendations: Recommendation[];
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
  success: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  username: string;
  full_name?: string;
}

export interface AuthResponse {
  user: User;
  session?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  message?: string;
  stats?: UserStats;
  lovable_ready?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  details?: any;
}

// Utility types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface FormState<T> {
  data: T;
  errors: Partial<Record<keyof T, string>>;
  isSubmitting: boolean;
  isValid: boolean;
}

export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
  page: number;
  limit: number;
  sort_by?: string;
  sort_order?: SortOrder;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}