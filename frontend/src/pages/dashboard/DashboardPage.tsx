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
  Users, 
  TrendingUp, 
  Award, 
  Settings, 
  LogOut,
  Plus,
  Clock,
  Target,
  FileText,
  BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardData } from '../../types';

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { state, dispatch } = useApp();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load dashboard data
      const data = await analyticsAPI.getDashboard();
      setDashboardData(data);
      dispatch({ type: 'SET_DASHBOARD_DATA', payload: data });

      // Load topics
      const topicsResponse = await topicsAPI.getAll();
      dispatch({ type: 'SET_TOPICS', payload: topicsResponse.topics });

      // Load documents
      const documentsResponse = await documentsAPI.getAll();
      dispatch({ type: 'SET_DOCUMENTS', payload: documentsResponse.documents });

    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-8 h-8 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">CineStudy</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome back, {user?.full_name || user?.username}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                leftIcon={<LogOut className="w-4 h-4" />}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Dashboard
          </h2>
          <p className="text-gray-600">
            Track your study progress and manage your learning journey
          </p>
        </div>

        {/* Stats Overview */}
        {dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Documents</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData.overview.total_documents}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BookOpen className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Pages Read</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData.overview.completed_pages}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Clock className="w-8 h-8 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Study Time</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Math.round(dashboardData.overview.total_time_spent_seconds / 3600)}h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Award className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Level</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData.overview.current_level}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Topics Overview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Topics</CardTitle>
                <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                  Add Topic
                </Button>
              </CardHeader>
              <CardContent>
                {state.topics.length > 0 ? (
                  <div className="space-y-4">
                    {state.topics.slice(0, 5).map((topic) => (
                      <div
                        key={topic.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: topic.color }}
                          />
                          <div>
                            <h4 className="font-medium text-gray-900">{topic.name}</h4>
                            <p className="text-sm text-gray-600">
                              {topic.completion_percentage || 0}% complete
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {topic.total_documents || 0} docs
                          </p>
                          <p className="text-xs text-gray-600">
                            {topic.total_pages || 0} pages
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No topics yet
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Get started by creating your first topic
                    </p>
                    <Button leftIcon={<Plus className="w-4 h-4" />}>
                      Create Topic
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Upload Document
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  leftIcon={<Target className="w-4 h-4" />}
                >
                  Start Sprint
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  leftIcon={<BarChart3 className="w-4 h-4" />}
                >
                  View Analytics
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData?.recent_activity && dashboardData.recent_activity.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.recent_activity.slice(0, 5).map((activity, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">
                            {activity.description}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Progress */}
            {dashboardData && (
              <Card>
                <CardHeader>
                  <CardTitle>Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Current Level</span>
                        <span>{dashboardData.overview.current_level}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min(
                              (dashboardData.overview.total_time_spent_seconds / 36000) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <p className="text-sm text-gray-600 mb-2">This Week</p>
                      <div className="flex justify-between text-sm">
                        <span>Study Time</span>
                        <span className="font-medium">
                          {Math.round(dashboardData.overview.total_time_spent_seconds / 3600)}h
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Pages Read</span>
                        <span className="font-medium">
                          {dashboardData.overview.completed_pages}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Recent Documents */}
        <div className="mt-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Documents</CardTitle>
              <Button size="sm" variant="outline">
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {state.documents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Topic</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Progress</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Last Read</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.documents.slice(0, 5).map((doc) => (
                        <tr key={doc.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{doc.title}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600">{doc.topic_name || 'Uncategorized'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      ((doc.current_page || 0) / (doc.total_pages || 1)) * 100,
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">
                                {Math.round(((doc.current_page || 0) / (doc.total_pages || 1)) * 100)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600">
                              {doc.updated_at
                                ? new Date(doc.updated_at).toLocaleDateString()
                                : 'Never'
                              }
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No documents yet
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Upload your first document to get started
                  </p>
                  <Button leftIcon={<Plus className="w-4 h-4" />}>
                    Upload Document
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;