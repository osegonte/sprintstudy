// src/pages/dashboard/DashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { analyticsAPI, topicsAPI, documentsAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { 
  BookOpen, 
  FileText, 
  Clock, 
  Award, 
  Plus,
  Target,
  BarChart3,
  TrendingUp,
  ArrowRight,
  Timer,
  CalendarDays,
  Zap,
  AlertCircle,
  CheckCircle2,
  Hourglass
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardData } from '../../types';
import { formatDuration, formatRelativeTime, cn } from '../../lib/utils';

// Time calculation utilities
const calculateReadingTimeFromStats = (
  pages: number, 
  avgReadingSpeedSeconds: number = 60
): number => {
  return pages * avgReadingSpeedSeconds;
};

const calculateEstimatedTimeRemaining = (
  totalPages: number,
  completedPages: number,
  avgTimePerPageSeconds: number = 60
): number => {
  const remainingPages = Math.max(0, totalPages - completedPages);
  return remainingPages * avgTimePerPageSeconds;
};

const calculateDailyReadingGoal = (
  totalTimeSeconds: number,
  daysToComplete: number = 30
): number => {
  return Math.ceil(totalTimeSeconds / (daysToComplete * 60)); // minutes per day
};

// Time Summary Component
interface TimeSummaryProps {
  totalTimeRemaining: number;
  totalDocuments: number;
  completedDocuments: number;
  avgDailyReadingMinutes: number;
  estimatedCompletionDate: Date | null;
}

const TimeSummaryCard: React.FC<TimeSummaryProps> = ({
  totalTimeRemaining,
  totalDocuments,
  completedDocuments,
  avgDailyReadingMinutes,
  estimatedCompletionDate
}) => {
  const daysToComplete = avgDailyReadingMinutes > 0 
    ? Math.ceil((totalTimeRemaining / 60) / avgDailyReadingMinutes)
    : null;

  const urgencyLevel = daysToComplete && daysToComplete <= 7 ? 'high' : 
                      daysToComplete && daysToComplete <= 30 ? 'medium' : 'low';

  return (
    <Card className="relative overflow-hidden">
      {/* Urgency indicator */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        urgencyLevel === 'high' ? "bg-red-500" :
        urgencyLevel === 'medium' ? "bg-yellow-500" : "bg-green-500"
      )} />
      
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <Hourglass className="w-5 h-5 text-blue-600" />
          <span>Time Left Summary</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Total time remaining */}
        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <div className="text-3xl font-bold text-blue-700 mb-1">
            {formatDuration(totalTimeRemaining)}
          </div>
          <div className="text-sm text-blue-600">
            Total reading time remaining
          </div>
        </div>

        {/* Progress overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {completedDocuments}
            </div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {totalDocuments - completedDocuments}
            </div>
            <div className="text-xs text-gray-500">Remaining</div>
          </div>
        </div>

        {/* Time breakdown */}
        <div className="space-y-3 pt-3 border-t border-gray-200">
          {avgDailyReadingMinutes > 0 && daysToComplete && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">At current pace:</span>
              <span className="font-medium text-gray-900">
                {daysToComplete} days
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Daily goal needed:</span>
            <span className="font-medium text-gray-900">
              {calculateDailyReadingGoal(totalTimeRemaining)} min/day
            </span>
          </div>

          {estimatedCompletionDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Est. completion:</span>
              <span className={cn(
                "font-medium",
                urgencyLevel === 'high' ? "text-red-600" :
                urgencyLevel === 'medium' ? "text-yellow-600" : "text-green-600"
              )}>
                {estimatedCompletionDate.toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Urgency indicator */}
        {urgencyLevel === 'high' && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">
              High urgency - consider increasing daily reading time
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Topic time tracking component
interface TopicTimeDisplayProps {
  topic: any;
  avgReadingSpeed: number;
}

const TopicTimeDisplay: React.FC<TopicTimeDisplayProps> = ({ topic, avgReadingSpeed }) => {
  const totalPages = topic.total_pages || 0;
  const completedPages = Math.round((totalPages * (topic.completion_percentage || 0)) / 100);
  const remainingPages = totalPages - completedPages;
  const estimatedTimeRemaining = calculateEstimatedTimeRemaining(totalPages, completedPages, avgReadingSpeed);

  return (
    <div className="flex items-center space-x-3 text-xs text-gray-500">
      <div className="flex items-center space-x-1">
        <Clock className="w-3 h-3" />
        <span>{formatDuration(estimatedTimeRemaining)} left</span>
      </div>
      <div className="flex items-center space-x-1">
        <FileText className="w-3 h-3" />
        <span>{remainingPages} pages</span>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { state, dispatch } = useApp();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Time tracking state
  const [timeMetrics, setTimeMetrics] = useState({
    totalTimeRemaining: 0,
    avgReadingSpeedSeconds: 60, // Default 1 minute per page
    avgDailyReadingMinutes: 30, // Default 30 minutes per day
    estimatedCompletionDate: null as Date | null,
    completedDocuments: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Calculate time metrics when data changes
  useEffect(() => {
    if (dashboardData && state.documents.length > 0) {
      calculateTimeMetrics();
    }
  }, [dashboardData, state.documents]);

  const calculateTimeMetrics = () => {
    const documents = state.documents;
    const stats = dashboardData?.overview;
    const performance = dashboardData?.performance;

    if (!documents.length || !stats) return;

    // Use user's actual reading speed if available, otherwise default
    const avgReadingSpeed = performance?.average_reading_speed_seconds || 60;
    
    // Calculate total remaining reading time
    let totalTimeRemaining = 0;
    let completedDocuments = 0;

    documents.forEach(doc => {
      const totalPages = doc.total_pages || 0;
      const completionPercentage = doc.completion_percentage || 0;
      const completedPages = Math.round((totalPages * completionPercentage) / 100);
      const remainingPages = totalPages - completedPages;
      
      if (completionPercentage >= 100) {
        completedDocuments++;
      }
      
      totalTimeRemaining += calculateEstimatedTimeRemaining(
        totalPages, 
        completedPages, 
        avgReadingSpeed
      );
    });

    // Calculate daily reading average from recent activity
    const recentActivity = dashboardData?.recent_activity || [];
    const last7Days = recentActivity.filter(activity => {
      const activityDate = new Date(activity.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return activityDate >= weekAgo;
    });

    const avgDailyReadingMinutes = last7Days.length > 0
      ? Math.round(last7Days.reduce((sum, activity) => sum + activity.duration_minutes, 0) / 7)
      : 30; // Default to 30 minutes if no recent activity

    // Calculate estimated completion date
    let estimatedCompletionDate = null;
    if (avgDailyReadingMinutes > 0 && totalTimeRemaining > 0) {
      const daysToComplete = Math.ceil((totalTimeRemaining / 60) / avgDailyReadingMinutes);
      estimatedCompletionDate = new Date();
      estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + daysToComplete);
    }

    setTimeMetrics({
      totalTimeRemaining,
      avgReadingSpeedSeconds: avgReadingSpeed,
      avgDailyReadingMinutes,
      estimatedCompletionDate,
      completedDocuments
    });
  };

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      // Load dashboard data in parallel
      const [dashboardResponse, topicsResponse, documentsResponse] = await Promise.all([
        analyticsAPI.getDashboard(),
        topicsAPI.getAll(),
        documentsAPI.getAll()
      ]);

      setDashboardData(dashboardResponse);
      dispatch({ type: 'SET_DASHBOARD_DATA', payload: dashboardResponse });
      dispatch({ type: 'SET_TOPICS', payload: topicsResponse.topics });
      dispatch({ type: 'SET_DOCUMENTS', payload: documentsResponse.documents });

    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  const stats = dashboardData?.overview || {
    total_documents: 0,
    completed_pages: 0,
    total_time_spent_seconds: 0,
    current_level: 1
  };

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.username}! 👋
          </h1>
          <p className="text-gray-600">
            Here's your study progress overview and time remaining summary
          </p>
        </div>
        
        <Button
          variant="outline"
          onClick={handleRefresh}
          isLoading={isRefreshing}
          className="hidden sm:flex"
        >
          Refresh
        </Button>
      </div>

      {/* Enhanced Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Documents Card */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Documents</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.total_documents}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {timeMetrics.completedDocuments} completed
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pages Read Card */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Pages Read</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.completed_pages}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.total_pages ? `of ${stats.total_pages} total` : 'pages completed'}
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Study Time Card - Enhanced with remaining time */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Study Time</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(stats.total_time_spent_seconds)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDuration(timeMetrics.totalTimeRemaining)} remaining
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Level Card */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Level</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.current_level}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.total_xp_points} XP earned
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Recent Topics with Time Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Time Left Summary Card */}
          <TimeSummaryCard
            totalTimeRemaining={timeMetrics.totalTimeRemaining}
            totalDocuments={stats.total_documents}
            completedDocuments={timeMetrics.completedDocuments}
            avgDailyReadingMinutes={timeMetrics.avgDailyReadingMinutes}
            estimatedCompletionDate={timeMetrics.estimatedCompletionDate}
          />

          {/* Recent Topics Card - Enhanced with time tracking */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-semibold">Recent Topics</CardTitle>
              <Button 
                size="sm" 
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => toast.info('Navigate to Topics page to create!')}
              >
                Add Topic
              </Button>
            </CardHeader>
            <CardContent>
              {state.topics.length > 0 ? (
                <div className="space-y-3">
                  {state.topics.slice(0, 5).map((topic) => (
                    <div
                      key={topic.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: topic.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-gray-900 truncate">
                            {topic.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {topic.completion_percentage || 0}% complete • {topic.total_documents || 0} documents
                          </p>
                          {/* Enhanced time display */}
                          <TopicTimeDisplay 
                            topic={topic} 
                            avgReadingSpeed={timeMetrics.avgReadingSpeedSeconds}
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {topic.total_pages || 0}
                          </p>
                          <p className="text-xs text-gray-500">pages</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No topics yet
                  </h3>
                  <p className="text-gray-600 mb-4 max-w-sm mx-auto">
                    Get organized by creating your first topic to group related study materials
                  </p>
                  <Button 
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => toast.info('Navigate to Topics page to create!')}
                  >
                    Create Your First Topic
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Documents Table - Enhanced with time estimates */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-semibold">Recent Documents</CardTitle>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => toast.info('Navigate to Documents page to see all!')}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {state.documents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm">Name</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm">Topic</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm">Progress</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm">Time Left</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm">Last Read</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.documents.slice(0, 5).map((doc) => {
                        const progress = doc.completion_percentage || 0;
                        const totalPages = doc.total_pages || 0;
                        const completedPages = Math.round((totalPages * progress) / 100);
                        const estimatedTimeRemaining = calculateEstimatedTimeRemaining(
                          totalPages, 
                          completedPages, 
                          timeMetrics.avgReadingSpeedSeconds
                        );
                        
                        return (
                          <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-2">
                              <div className="flex items-center space-x-2">
                                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="font-medium text-gray-900 truncate max-w-xs">
                                  {doc.title}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <span className="text-sm text-gray-600 truncate">
                                {doc.topic?.name || 'Uncategorized'}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center space-x-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-green-500 h-2 rounded-full transition-all"
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600 min-w-0">
                                  {progress}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center space-x-1">
                                {progress >= 100 ? (
                                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Timer className="w-3 h-3 text-blue-500" />
                                )}
                                <span className="text-sm text-gray-600">
                                  {progress >= 100 ? 'Complete' : formatDuration(estimatedTimeRemaining)}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <span className="text-sm text-gray-600">
                                {doc.updated_at
                                  ? formatRelativeTime(doc.updated_at)
                                  : 'Never'
                                }
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No documents yet
                  </h3>
                  <p className="text-gray-600 mb-4 max-w-sm mx-auto">
                    Upload your first PDF document to start tracking your reading progress
                  </p>
                  <Button 
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => toast.info('Navigate to Documents page to upload!')}
                  >
                    Upload Document
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar with enhanced time info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-12"
                leftIcon={<Plus className="w-5 h-5" />}
                onClick={() => toast.info('Navigate to Documents page to upload!')}
              >
                <span className="ml-2">Upload Document</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-12"
                leftIcon={<Target className="w-5 h-5" />}
                onClick={() => toast.info('Sprint creation coming soon!')}
              >
                <span className="ml-2">Start Sprint</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-12"
                leftIcon={<BarChart3 className="w-5 h-5" />}
                onClick={() => toast.info('Navigate to Analytics page!')}
              >
                <span className="ml-2">View Analytics</span>
              </Button>
            </CardContent>
          </Card>

          {/* Reading Goals & Time Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                <span>Reading Goals</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Daily Goal</h4>
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700">
                      {calculateDailyReadingGoal(timeMetrics.totalTimeRemaining)} minutes
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    To complete all documents in 30 days
                  </p>
                </div>

                <div className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Current Pace</h4>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700">
                      {timeMetrics.avgDailyReadingMinutes} min/day
                    </span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Based on last 7 days
                  </p>
                </div>

                {timeMetrics.estimatedCompletionDate && (
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-900 mb-2">Estimated Completion</h4>
                    <div className="flex items-center space-x-2">
                      <CalendarDays className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-purple-700">
                        {timeMetrics.estimatedCompletionDate.toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-purple-600 mt-1">
                      At current reading pace
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.recent_activity && dashboardData.recent_activity.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.recent_activity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 mb-1">
                          {activity.document_title}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>{activity.pages_covered} pages</span>
                          <span>•</span>
                          <span>{activity.duration_minutes}m</span>
                          <span>•</span>
                          <span>{Math.round(activity.pages_covered / (activity.duration_minutes / 60))} pages/hr</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {formatRelativeTime(activity.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">No recent activity</p>
                  <p className="text-xs text-gray-500">
                    Start studying to see your activity here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress Card - Enhanced with time tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Progress Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Level Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Level {stats.current_level}</span>
                    <span className="text-gray-900 font-medium">{stats.total_xp_points} XP</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((stats.total_xp_points % 100), 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {100 - (stats.total_xp_points % 100)} XP to next level
                  </p>
                </div>
                
                {/* Weekly Stats */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-900 mb-3">This Week</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Study Time</span>
                      <span className="font-medium text-gray-900">
                        {formatDuration(stats.total_time_spent_seconds)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Pages Read</span>
                      <span className="font-medium text-gray-900">
                        {stats.completed_pages}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current Streak</span>
                      <span className="font-medium text-gray-900">
                        {stats.current_streak_days} days
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Reading Speed</span>
                      <span className="font-medium text-gray-900">
                        {Math.round(60 / timeMetrics.avgReadingSpeedSeconds)} pages/hr
                      </span>
                    </div>
                  </div>
                </div>

                {/* Time Efficiency Insights */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-900 mb-3">Time Insights</p>
                  <div className="space-y-3">
                    {timeMetrics.avgDailyReadingMinutes > calculateDailyReadingGoal(timeMetrics.totalTimeRemaining) ? (
                      <div className="flex items-center space-x-2 p-2 bg-green-50 rounded">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-700">
                          You're ahead of schedule!
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 p-2 bg-yellow-50 rounded">
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <span className="text-xs text-yellow-700">
                          Consider increasing daily reading time
                        </span>
                      </div>
                    )}
                    
                    {timeMetrics.estimatedCompletionDate && (
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <span className="text-xs text-blue-700">
                          📅 Finish by {timeMetrics.estimatedCompletionDate.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;