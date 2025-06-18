// src/lib/timeTrackingUtils.ts
import { Document, Topic, StudySession } from '../types';

export interface TimeMetrics {
  totalTimeRemaining: number;
  totalTimeSpent: number;
  avgReadingSpeedSeconds: number;
  avgDailyReadingMinutes: number;
  estimatedCompletionDate: Date | null;
  completedDocuments: number;
  totalDocuments: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface DocumentTimeInfo {
  documentId: string;
  totalPages: number;
  completedPages: number;
  remainingPages: number;
  estimatedTimeRemaining: number;
  completionPercentage: number;
  avgTimePerPage: number;
  estimatedCompletionDate: Date | null;
}

export interface TopicTimeInfo {
  topicId: string;
  totalTimeRemaining: number;
  totalDocuments: number;
  completedDocuments: number;
  avgProgress: number;
  estimatedCompletionDate: Date | null;
  priorityLevel: number;
  urgencyScore: number;
}

/**
 * Calculate estimated reading time for a document based on pages and reading speed
 */
export const calculateEstimatedReadingTime = (
  totalPages: number,
  avgTimePerPageSeconds: number = 60
): number => {
  return totalPages * avgTimePerPageSeconds;
};

/**
 * Calculate remaining reading time for a document
 */
export const calculateRemainingReadingTime = (
  totalPages: number,
  completedPages: number,
  avgTimePerPageSeconds: number = 60
): number => {
  const remainingPages = Math.max(0, totalPages - completedPages);
  return remainingPages * avgTimePerPageSeconds;
};

/**
 * Calculate user's average reading speed from study sessions
 */
export const calculateReadingSpeed = (studySessions: StudySession[]): number => {
  if (!studySessions.length) return 60; // Default 1 minute per page

  const totalTime = studySessions.reduce((sum, session) => sum + session.active_reading_seconds, 0);
  const totalPages = studySessions.reduce((sum, session) => sum + session.pages_covered, 0);

  if (totalPages === 0) return 60;

  return Math.round(totalTime / totalPages);
};

/**
 * Calculate daily reading average from recent activity
 */
export const calculateDailyReadingAverage = (
  recentActivity: any[],
  daysToConsider: number = 7
): number => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToConsider);

  const recentSessions = recentActivity.filter(activity => {
    const activityDate = new Date(activity.date);
    return activityDate >= cutoffDate;
  });

  if (recentSessions.length === 0) return 30; // Default 30 minutes

  const totalMinutes = recentSessions.reduce((sum, session) => sum + session.duration_minutes, 0);
  return Math.round(totalMinutes / daysToConsider);
};

/**
 * Calculate required daily reading time to meet a deadline
 */
export const calculateRequiredDailyTime = (
  totalTimeRemainingSeconds: number,
  targetDays: number
): number => {
  if (targetDays <= 0) return Infinity;
  return Math.ceil(totalTimeRemainingSeconds / (targetDays * 60)); // minutes per day
};

/**
 * Determine urgency level based on time remaining and current pace
 */
export const determineUrgencyLevel = (
  timeRemainingSeconds: number,
  avgDailyMinutes: number,
  targetDays?: number
): 'low' | 'medium' | 'high' | 'critical' => {
  if (avgDailyMinutes === 0) return 'critical';

  const daysAtCurrentPace = Math.ceil((timeRemainingSeconds / 60) / avgDailyMinutes);
  
  if (targetDays) {
    const ratio = daysAtCurrentPace / targetDays;
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'high';
    if (ratio > 1.1) return 'medium';
    return 'low';
  }

  // General urgency based on time remaining
  if (daysAtCurrentPace <= 3) return 'critical';
  if (daysAtCurrentPace <= 7) return 'high';
  if (daysAtCurrentPace <= 30) return 'medium';
  return 'low';
};

/**
 * Calculate estimated completion date based on current reading pace
 */
export const calculateEstimatedCompletionDate = (
  timeRemainingSeconds: number,
  avgDailyMinutes: number
): Date | null => {
  if (avgDailyMinutes === 0 || timeRemainingSeconds === 0) return null;

  const daysToComplete = Math.ceil((timeRemainingSeconds / 60) / avgDailyMinutes);
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + daysToComplete);
  
  return completionDate;
};

/**
 * Calculate comprehensive time metrics for all documents
 */
export const calculateOverallTimeMetrics = (
  documents: Document[],
  recentActivity: any[] = [],
  studySessions: StudySession[] = []
): TimeMetrics => {
  const avgReadingSpeed = calculateReadingSpeed(studySessions);
  const avgDailyReadingMinutes = calculateDailyReadingAverage(recentActivity);

  let totalTimeRemaining = 0;
  let totalTimeSpent = 0;
  let completedDocuments = 0;

  documents.forEach(doc => {
    const totalPages = doc.total_pages || 0;
    const completionPercentage = doc.completion_percentage || 0;
    const completedPages = Math.round((totalPages * completionPercentage) / 100);
    
    if (completionPercentage >= 100) {
      completedDocuments++;
    }
    
    totalTimeRemaining += calculateRemainingReadingTime(totalPages, completedPages, avgReadingSpeed);
    totalTimeSpent += doc.total_time_spent_seconds || 0;
  });

  const estimatedCompletionDate = calculateEstimatedCompletionDate(
    totalTimeRemaining,
    avgDailyReadingMinutes
  );

  const urgencyLevel = determineUrgencyLevel(
    totalTimeRemaining,
    avgDailyReadingMinutes
  );

  return {
    totalTimeRemaining,
    totalTimeSpent,
    avgReadingSpeedSeconds: avgReadingSpeed,
    avgDailyReadingMinutes,
    estimatedCompletionDate,
    completedDocuments,
    totalDocuments: documents.length,
    urgencyLevel
  };
};

/**
 * Calculate time information for a specific document
 */
export const calculateDocumentTimeInfo = (
  document: Document,
  avgReadingSpeedSeconds: number = 60,
  avgDailyMinutes: number = 30
): DocumentTimeInfo => {
  const totalPages = document.total_pages || 0;
  const completionPercentage = document.completion_percentage || 0;
  const completedPages = Math.round((totalPages * completionPercentage) / 100);
  const remainingPages = totalPages - completedPages;
  const estimatedTimeRemaining = calculateRemainingReadingTime(totalPages, completedPages, avgReadingSpeedSeconds);
  
  const avgTimePerPage = document.total_time_spent_seconds && completedPages > 0
    ? Math.round(document.total_time_spent_seconds / completedPages)
    : avgReadingSpeedSeconds;

  const estimatedCompletionDate = avgDailyMinutes > 0
    ? calculateEstimatedCompletionDate(estimatedTimeRemaining, avgDailyMinutes)
    : null;

  return {
    documentId: document.id,
    totalPages,
    completedPages,
    remainingPages,
    estimatedTimeRemaining,
    completionPercentage,
    avgTimePerPage,
    estimatedCompletionDate
  };
};

/**
 * Calculate time information for a topic (aggregated from its documents)
 */
export const calculateTopicTimeInfo = (
  topic: Topic,
  topicDocuments: Document[],
  avgReadingSpeedSeconds: number = 60,
  avgDailyMinutes: number = 30
): TopicTimeInfo => {
  if (topicDocuments.length === 0) {
    return {
      topicId: topic.id,
      totalTimeRemaining: 0,
      totalDocuments: 0,
      completedDocuments: 0,
      avgProgress: 0,
      estimatedCompletionDate: null,
      priorityLevel: topic.priority || 3,
      urgencyScore: 0
    };
  }

  let totalTimeRemaining = 0;
  let completedDocuments = 0;
  let totalProgress = 0;

  topicDocuments.forEach(doc => {
    const docTimeInfo = calculateDocumentTimeInfo(doc, avgReadingSpeedSeconds, avgDailyMinutes);
    totalTimeRemaining += docTimeInfo.estimatedTimeRemaining;
    
    if (docTimeInfo.completionPercentage >= 100) {
      completedDocuments++;
    }
    
    totalProgress += docTimeInfo.completionPercentage;
  });

  const avgProgress = totalProgress / topicDocuments.length;
  const estimatedCompletionDate = calculateEstimatedCompletionDate(totalTimeRemaining, avgDailyMinutes);
  
  // Calculate urgency score based on priority, time remaining, and target date
  let urgencyScore = topic.priority || 3;
  
  if (topic.target_completion_date) {
    const targetDate = new Date(topic.target_completion_date);
    const today = new Date();
    const daysUntilTarget = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const daysNeeded = avgDailyMinutes > 0 ? Math.ceil((totalTimeRemaining / 60) / avgDailyMinutes) : Infinity;
    
    if (daysNeeded > daysUntilTarget) {
      urgencyScore += 2; // Increase urgency if behind schedule
    }
  }

  return {
    topicId: topic.id,
    totalTimeRemaining,
    totalDocuments: topicDocuments.length,
    completedDocuments,
    avgProgress,
    estimatedCompletionDate,
    priorityLevel: topic.priority || 3,
    urgencyScore: Math.min(urgencyScore, 5) // Cap at 5
  };
};

/**
 * Get reading recommendations based on time metrics
 */
export const getReadingRecommendations = (timeMetrics: TimeMetrics): string[] => {
  const recommendations: string[] = [];

  if (timeMetrics.urgencyLevel === 'critical') {
    recommendations.push("🚨 Critical: Consider significantly increasing daily reading time");
    recommendations.push("📅 Set specific daily reading blocks in your calendar");
  } else if (timeMetrics.urgencyLevel === 'high') {
    recommendations.push("⚠️ High priority: Increase reading time to stay on track");
    recommendations.push("🎯 Focus on highest priority documents first");
  }

  if (timeMetrics.avgDailyReadingMinutes < 30) {
    recommendations.push("📈 Try to read for at least 30 minutes daily for better progress");
  }

  if (timeMetrics.avgReadingSpeedSeconds > 90) {
    recommendations.push("🐌 Consider techniques to improve reading speed and comprehension");
  } else if (timeMetrics.avgReadingSpeedSeconds < 30) {
    recommendations.push("🏃‍♂️ Great reading speed! Consider increasing daily reading time");
  }

  const completionRate = timeMetrics.completedDocuments / timeMetrics.totalDocuments;
  if (completionRate < 0.2) {
    recommendations.push("🎯 Focus on completing documents rather than starting new ones");
  }

  return recommendations;
};

/**
 * Format time duration in a human-readable way
 */
export const formatTimeRemaining = (seconds: number): string => {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    const days = Math.floor(seconds / 86400);
    const hours = Math.round((seconds % 86400) / 3600);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
};

/**
 * Get urgency color class for UI components
 */
export const getUrgencyColorClass = (urgencyLevel: 'low' | 'medium' | 'high' | 'critical'): string => {
  switch (urgencyLevel) {
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'high':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low':
    default:
      return 'text-green-600 bg-green-50 border-green-200';
  }
};

/**
 * Calculate reading pace compared to goals
 */
export const calculatePaceAnalysis = (
  currentDailyMinutes: number,
  requiredDailyMinutes: number
): {
  status: 'ahead' | 'on_track' | 'behind' | 'critical';
  percentage: number;
  message: string;
} => {
  if (requiredDailyMinutes === 0) {
    return {
      status: 'ahead',
      percentage: 100,
      message: 'All documents completed!'
    };
  }

  const percentage = Math.round((currentDailyMinutes / requiredDailyMinutes) * 100);

  if (percentage >= 120) {
    return {
      status: 'ahead',
      percentage,
      message: 'You\'re ahead of schedule!'
    };
  } else if (percentage >= 90) {
    return {
      status: 'on_track',
      percentage,
      message: 'You\'re on track to meet your goals'
    };
  } else if (percentage >= 50) {
    return {
      status: 'behind',
      percentage,
      message: 'Consider increasing your daily reading time'
    };
  } else {
    return {
      status: 'critical',
      percentage,
      message: 'Significantly behind schedule'
    };
  }
};