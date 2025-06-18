// src/pages/analytics/AnalyticsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { analyticsAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Award,
  Calendar,
  BookOpen,
  FileText,
  Zap,
  Eye,
  Brain,
  Activity,
  Download,
  RefreshCw,
  Filter,
  ChevronDown,
  Star,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardData } from '../../types';
import { formatDuration, formatRelativeTime, cn } from '../../lib/utils';

// Mock chart component since we don't have recharts data
const SimpleBarChart: React.FC<{ data: any[]; color: string; height?: number }> = ({ 
  data, 
  color, 
  height = 200 
}) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="flex items-end justify-between space-x-1" style={{ height }}>
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center space-y-1 flex-1">
          <div 
            className="w-full rounded-t transition-all duration-300 hover:opacity-80"
            style={{
              height: `${(item.value / maxValue) * (height - 40)}px`,
              backgroundColor: color,
              minHeight: '4px'
            }}
          />
          <span className="text-xs text-gray-600 truncate">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const ProgressRing: React.FC<{ progress: number; size?: number; strokeWidth?: number; color?: string }> = ({
  progress,
  size = 120,
  strokeWidth = 8,
  color = '#3B82F6'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const { state } = useApp();
  
  // State management
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('reading_time');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load analytics data
  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod, selectedMetric]);

  const loadAnalyticsData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      const data = await analyticsAPI.getDashboard();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadAnalyticsData(true);
  };

  // Mock data for charts
  const weeklyReadingData = [
    { label: 'Mon', value: 120 },
    { label: 'Tue', value: 90 },
    { label: 'Wed', value: 150 },
    { label: 'Thu', value: 80 },
    { label: 'Fri', value: 200 },
    { label: 'Sat', value: 110 },
    { label: 'Sun', value: 75 }
  ];

  const monthlyProgressData = [
    { label: 'Jan', value: 65 },
    { label: 'Feb', value: 78 },
    { label: 'Mar', value: 85 },
    { label: 'Apr', value: 92 },
    { label: 'May', value: 88 },
    { label: 'Jun', value: 95 }
  ];

  const topicPerformanceData = state.topics.slice(0, 5).map(topic => ({
    label: topic.name.substring(0, 8),
    value: topic.completion_percentage || 0
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading analytics..." />
      </div>
    );
  }

  const stats = dashboardData?.overview || {
    total_documents: 0,
    completed_pages: 0,
    total_time_spent_seconds: 0,
    current_level: 1,
    total_xp_points: 0,
    completion_percentage: 0
  };

  const performance = dashboardData?.performance || {
    average_reading_speed_seconds: 60,
    focus_score_average: 75,
    productivity_score: 80,
    reading_consistency: 65,
    improvement_trend: 'stable' as const
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-6 h-6 text-purple-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
                  <p className="text-xs text-gray-500">Track your study progress and insights</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Period Selector */}
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 3 months</option>
                <option value="1y">Last year</option>
              </select>

              <Button
                variant="outline"
                onClick={handleRefresh}
                isLoading={isRefreshing}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Study Time */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Study Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDuration(stats.total_time_spent_seconds)}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+12% this month</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reading Speed */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Reading Speed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(60 / performance.average_reading_speed_seconds)} <span className="text-lg text-gray-600">ppm</span>
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+5% improvement</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Zap className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Focus Score */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Focus Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {performance.focus_score_average}%
                  </p>
                  <div className="flex items-center mt-2">
                    <Minus className="w-4 h-4 text-gray-500 mr-1" />
                    <span className="text-sm text-gray-600">Stable</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Brain className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Productivity Score */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Productivity</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {performance.productivity_score}%
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+8% this week</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Reading Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <span>Weekly Reading Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart 
                data={weeklyReadingData} 
                color="#3B82F6" 
                height={200}
              />
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  Average: {Math.round(weeklyReadingData.reduce((sum, d) => sum + d.value, 0) / weeklyReadingData.length)} minutes/day
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Progress Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span>Progress Trend</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart 
                data={monthlyProgressData} 
                color="#10B981" 
                height={200}
              />
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  Monthly completion rate improving by 15%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Overview & Topic Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Overall Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-purple-600" />
                <span>Overall Progress</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <ProgressRing 
                progress={stats.completion_percentage} 
                color="#8B5CF6"
              />
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 mb-2">
                  {stats.completed_pages} of {stats.total_documents * 100} pages completed
                </p>
                <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
                  <span>{stats.total_documents} documents</span>
                  <span>•</span>
                  <span>Level {stats.current_level}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Topic Performance */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>Topic Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topicPerformanceData.length > 0 ? (
                <div className="space-y-4">
                  {state.topics.slice(0, 5).map((topic, index) => (
                    <div key={topic.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: topic.color }}
                        />
                        <span className="font-medium text-gray-900">{topic.name}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${topic.completion_percentage || 0}%`,
                              backgroundColor: topic.color
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600 w-12 text-right">
                          {topic.completion_percentage || 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No topics created yet</p>
                  <p className="text-sm text-gray-500">Create topics to see performance analytics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Insights & Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Study Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-indigo-600" />
                <span>Study Insights</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Peak Performance Time</h4>
                    <p className="text-sm text-blue-700">
                      You're most productive between 9-11 AM with 85% focus score
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                  <Target className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900">Reading Consistency</h4>
                    <p className="text-sm text-green-700">
                      You've maintained a {performance.reading_consistency}% consistency rate this month
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-orange-900">Study Session Length</h4>
                    <p className="text-sm text-orange-700">
                      Optimal session length for you is 45-60 minutes
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-yellow-600" />
                <span>Recommendations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-medium text-gray-900">Schedule Study Blocks</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Based on your productivity patterns, schedule intensive reading during your peak hours (9-11 AM).
                  </p>
                </div>
                
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium text-gray-900">Focus on Weak Topics</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Consider spending more time on topics with lower completion rates to balance your progress.
                  </p>
                </div>
                
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-medium text-gray-900">Take Regular Breaks</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Your focus score drops after 50 minutes. Try the Pomodoro technique for better retention.
                  </p>
                </div>
                
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-medium text-gray-900">Set Reading Goals</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    You're reading 20% faster than average. Set higher page targets to maximize your potential.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <span>Recent Activity Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData?.recent_activity && dashboardData.recent_activity.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-4 font-medium text-gray-600 text-sm">Document</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600 text-sm">Topic</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600 text-sm">Duration</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600 text-sm">Pages</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600 text-sm">Focus</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600 text-sm">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.recent_activity.slice(0, 8).map((activity, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4 font-medium text-gray-900">
                          {activity.document_title}
                        </td>
                        <td className="py-2 px-4">
                          {activity.topic_name && (
                            <span
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: activity.topic_color || '#6B7280' }}
                            >
                              {activity.topic_name}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-gray-600">
                          {activity.duration_minutes}m
                        </td>
                        <td className="py-2 px-4 text-gray-600">
                          {activity.pages_covered}
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-12 bg-gray-200 rounded-full h-1.5">
                              <div
                                className={cn(
                                  "h-1.5 rounded-full",
                                  (activity.focus_score || 0) >= 80 ? "bg-green-500" :
                                  (activity.focus_score || 0) >= 60 ? "bg-yellow-500" : "bg-red-500"
                                )}
                                style={{ width: `${activity.focus_score || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {activity.focus_score || 0}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-gray-500 text-sm">
                          {formatRelativeTime(activity.date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No recent activity</p>
                <p className="text-sm text-gray-500">Start studying to see your activity here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;