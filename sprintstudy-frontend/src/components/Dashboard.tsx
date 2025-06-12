import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Upload, BookOpen, Clock, Target, TrendingUp, LogOut, TestTube } from 'lucide-react';
import { SprintTest } from './SprintTest';
import toast from 'react-hot-toast';

interface DashboardData {
  stats: {
    total_documents: number;
    total_pages: number;
    mastered_pages: number;
    completion_percentage: number;
    total_time_spent_seconds: number;
    estimated_time_remaining_seconds: number;
    average_reading_speed_seconds: number;
    study_streak_days: number;
    total_sprints_completed: number;
  };
  today_sprint: any;
  recent_achievements: any[];
}

export const Dashboard: React.FC = () => {
  const { user, setUser } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showSprintTest, setShowSprintTest] = useState(false);

  useEffect(() => {
    loadDashboardData();
    loadDocuments();
  }, []);

  const loadDashboardData = async () => {
    const result = await api.getDashboardData();
    if (result.success) {
      setDashboardData(result.data);
    }
    setLoading(false);
  };

  const loadDocuments = async () => {
    const result = await api.getDocuments();
    if (result.success) {
      setDocuments(result.data.documents || []);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setUploading(true);
    const result = await api.uploadDocument(file);
    
    if (result.success) {
      toast.success('PDF uploaded successfully!');
      loadDocuments();
      loadDashboardData();
    } else {
      toast.error(result.error || 'Upload failed');
    }
    setUploading(false);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    toast.success('Logged out successfully');
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatSpeed = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s/page`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📚 SprintStudy</h1>
            <p className="text-gray-600">Welcome back, {user?.username || user?.email}!</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowSprintTest(!showSprintTest)}
              className="flex items-center space-x-2 text-primary hover:text-blue-700"
            >
              <TestTube size={20} />
              <span>Sprint Test</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center space-x-3">
              <BookOpen className="text-primary" size={24} />
              <div>
                <p className="text-sm text-gray-600">Total PDFs</p>
                <p className="text-2xl font-bold">{dashboardData?.stats.total_documents || 0}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center space-x-3">
              <Clock className="text-success" size={24} />
              <div>
                <p className="text-sm text-gray-600">Est. Time Left</p>
                <p className="text-2xl font-bold">
                  {formatTime(dashboardData?.stats.estimated_time_remaining_seconds || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center space-x-3">
              <TrendingUp className="text-warning" size={24} />
              <div>
                <p className="text-sm text-gray-600">Reading Speed</p>
                <p className="text-2xl font-bold">
                  {formatSpeed(dashboardData?.stats.average_reading_speed_seconds || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center space-x-3">
              <Target className="text-danger" size={24} />
              <div>
                <p className="text-sm text-gray-600">Study Streak</p>
                <p className="text-2xl font-bold">
                  {dashboardData?.stats.study_streak_days || 0} days
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sprint Test Section */}
        {showSprintTest && (
          <div className="mb-8">
            <SprintTest />
          </div>
        )}

        {/* Today's Sprint */}
        {dashboardData?.today_sprint && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold mb-4">🎯 Today's Sprint</h2>
            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-semibold">{dashboardData.today_sprint.documents?.title}</h3>
              <p className="text-gray-600 mb-2">
                Pages {dashboardData.today_sprint.start_page}-{dashboardData.today_sprint.end_page} • 
                Est. {formatTime(dashboardData.today_sprint.estimated_time_seconds)}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(dashboardData.today_sprint.actual_time_seconds / dashboardData.today_sprint.estimated_time_seconds) * 100}%` }}
                />
              </div>
              <button className="btn-primary">
                Continue Sprint
              </button>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">📤 Upload New PDF</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600 mb-4">Drag and drop your PDF file here or click to browse</p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`btn-primary cursor-pointer inline-block ${uploading ? 'opacity-50' : ''}`}
            >
              {uploading ? 'Uploading...' : 'Choose PDF File'}
            </label>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">📚 Your Documents</h2>
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No documents yet. Upload your first PDF to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow">
                  <h3 className="font-semibold mb-2 truncate">{doc.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{doc.total_pages} pages</p>
                  <p className="text-xs text-gray-500 mb-2">ID: {doc.id}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${doc.progress?.completion_percentage || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {doc.progress?.mastered_pages || 0}/{doc.total_pages} pages mastered
                  </p>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(doc.id);
                        toast.success('Document ID copied to clipboard!');
                      }}
                      className="btn-primary text-sm py-2 px-4 flex-1"
                    >
                      Copy ID
                    </button>
                    <button 
                      onClick={async () => {
                        const result = await api.deleteDocument(doc.id);
                        if (result.success) {
                          toast.success('Document deleted');
                          loadDocuments();
                          loadDashboardData();
                        }
                      }}
                      className="btn-secondary text-sm py-2 px-4"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
