// 🎬 CineStudy Dashboard - Main dashboard page

import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ProgressRing from '../../components/ui/ProgressRing';
import MotivationalQuote from '../../components/ui/MotivationalQuote';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { 
  BookOpen, 
  Target, 
  TrendingUp, 
  Clock, 
  Award,
  Plus,
  PlayCircle
} from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { user, stats } = useAuth();
  const { dashboardData, loading, loadDashboard } = useApp();

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading.dashboard === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading your dashboard..." />
      </div>
    );
  }

  const overview = dashboardData?.overview || {
    total_documents: 0,
    total_pages: 0,
    completed_pages: 0,
    completion_percentage: 0,
    current_streak_days: 0,
    current_level: 1,
    total_xp_points: 0,
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.username || 'Student'}! 🎬
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Ready to beat procrastination with focused study sprints?
        </p>
      </div>

      {/* Motivational Quote */}
      <MotivationalQuote autoRotate showIcon />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="text-center">
          <div className="flex justify-center mb-4">
            <ProgressRing 
              percentage={overview.completion_percentage} 
              size="lg" 
              color="primary"
            />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Overall Progress
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {overview.completed_pages} of {overview.total_pages} pages
          </p>
        </Card>

        <Card className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-success-100 dark:bg-success-900 rounded-full">
              <Target className="w-8 h-8 text-success-600 dark:text-success-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            {overview.current_streak_days}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Day streak 🔥
          </p>
        </Card>

        <Card className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-full">
              <Award className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Level {overview.current_level}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {overview.total_xp_points} XP
          </p>
        </Card>

        <Card className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-warning-100 dark:bg-warning-900 rounded-full">
              <BookOpen className="w-8 h-8 text-warning-600 dark:text-warning-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            {overview.total_documents}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Documents
          </p>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="primary"
            size="lg"
            leftIcon={<PlayCircle className="w-5 h-5" />}
            fullWidth
          >
            🔥 Start Sprint
          </Button>
          
          <Button
            variant="secondary"
            size="lg"
            leftIcon={<Plus className="w-5 h-5" />}
            fullWidth
          >
            📄 Upload PDF
          </Button>
          
          <Button
            variant="secondary"
            size="lg"
            leftIcon={<TrendingUp className="w-5 h-5" />}
            fullWidth
          >
            📊 View Analytics
          </Button>
        </div>
      </Card>

      {/* Recent Activity */}
      {dashboardData?.recent_activity && dashboardData.recent_activity.length > 0 && (
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {dashboardData.recent_activity.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {activity.document_title}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {activity.pages_covered} pages • {activity.duration_minutes} minutes
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(activity.date).toLocaleDateString()}
                  </p>
                  {activity.focus_score && (
                    <p className="text-xs text-success-600 dark:text-success-400">
                      {Math.round(activity.focus_score * 100)}% focus
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {overview.total_documents === 0 && (
        <Card className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Ready to start your study journey?
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Upload your first PDF and begin crushing your study goals with focused sprints!
          </p>
          <Button
            variant="primary"
            size="lg"
            leftIcon={<Plus className="w-5 h-5" />}
          >
            Upload Your First PDF
          </Button>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
