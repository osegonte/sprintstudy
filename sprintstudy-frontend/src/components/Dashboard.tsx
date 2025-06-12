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
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    loadDashboardData();
    loadDocuments();
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    console.log('🔐 Auth Status Check:');
    console.log('Token exists:', !!token);
    console.log('Token preview:', token ? token.substring(0, 20) + '...' : 'None');
    console.log('User data:', user ? JSON.parse(user) : 'None');
    setDebugInfo(`Token: ${!!token}, User: ${!!user}`);
  };

  const loadDashboardData = async () => {
    console.log('📊 Loading dashboard data...');
    const result = await api.getDashboardData();
    console.log('Dashboard result:', result);
    if (result.success) {
      setDashboardData(result.data);
    } else {
      console.error('Dashboard error:', result.error);
    }
    setLoading(false);
  };

  const loadDocuments = async () => {
    console.log('📚 Loading documents...');
    const result = await api.getDocuments();
    console.log('Documents result:', result);
    if (result.success) {
      setDocuments(result.data.documents || []);
    } else {
      console.error('Documents error:', result.error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('📁 File Upload Debug:');
    console.log('File:', file);
    console.log('File name:', file.name);
    console.log('File type:', file.type);
    console.log('File size:', file.size, 'bytes (', (file.size / 1024 / 1024).toFixed(2), 'MB)');

    // Check file type
    if (file.type !== 'application/pdf') {
      const error = `Invalid file type: ${file.type}. Expected: application/pdf`;
      console.error('❌', error);
      toast.error('Please upload a PDF file');
      return;
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      const error = `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 50MB`;
      console.error('❌', error);
      toast.error(`File too large. Maximum size is 50MB.`);
      return;
    }

    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ No authentication token found');
      toast.error('Please log in again');
      return;
    }

    console.log('✅ Pre-upload checks passed');
    console.log('🚀 Starting upload...');

    setUploading(true);
    
    try {
      // Enhanced upload with detailed logging
      const result = await uploadWithDebug(file);
      
      if (result.success) {
        console.log('✅ Upload successful:', result.data);
        toast.success('PDF uploaded successfully!');
        loadDocuments();
        loadDashboardData();
      } else {
        console.error('❌ Upload failed:', result.error);
        toast.error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ Upload exception:', error);
      toast.error('Upload failed - check console for details');
    } finally {
      setUploading(false);
    }
  };

  // Enhanced upload function with detailed debugging
  const uploadWithDebug = async (file: File) => {
    const API_BASE_URL = 'https://sprintstudy-production.up.railway.app';
    const token = localStorage.getItem('token');
    
    console.log('🔗 Upload URL:', `${API_BASE_URL}/api/documents/upload`);
    
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('title', file.name);
    
    console.log('📤 FormData contents:');
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value);
    }
    
    const headers = {
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type for FormData - let browser set it with boundary
    };
    
    console.log('📋 Request headers:', headers);
    
    try {
      console.log('⏳ Making fetch request...');
      const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: 'POST',
        headers,
        body: formData
      });
      
      console.log('📥 Response received:');
      console.log('  Status:', response.status);
      console.log('  StatusText:', response.statusText);
      console.log('  Headers:', [...response.headers.entries()]);
      
      // Get response text first
      const responseText = await response.text();
      console.log('📄 Raw response:', responseText);
      
      // Try to parse as JSON
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
        console.log('📊 Parsed data:', data);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        return {
          success: false,
          error: `Invalid JSON response: ${responseText}`
        };
      }
      
      if (!response.ok) {
        console.error('❌ HTTP error:', response.status, data);
        return {
          success: false,
          error: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      return { success: true, data };
      
    } catch (networkError) {
      console.error('❌ Network error:', networkError);
      return {
        success: false,
        error: `Network error: ${networkError.message}`
      };
    }
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
            <p className="text-xs text-gray-400">Debug: {debugInfo}</p>
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
        {/* Debug Info Panel */}
        <div className="card mb-6 bg-blue-50 border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">🔍 Upload Debug Info</h3>
          <p className="text-sm text-blue-700">
            If upload fails, check your browser's DevTools Console (F12) for detailed error logs.
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Expected: PDF files up to 50MB • Backend: https://sprintstudy-production.up.railway.app
          </p>
        </div>

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

        {/* Upload Section with Enhanced Debugging */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">📤 Upload New PDF</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600 mb-4">Drag and drop your PDF file here or click to browse</p>
            <p className="text-sm text-gray-500 mb-4">
              Maximum file size: 50MB • Supported format: PDF only
            </p>
            
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`btn-primary cursor-pointer inline-block ${uploading ? 'opacity-50' : ''}`}
            >
              {uploading ? (
                <span>
                  Uploading... 
                  <div className="inline-block ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                </span>
              ) : (
                'Choose PDF File'
              )}
            </label>
            
            {uploading && (
              <p className="text-sm text-gray-500 mt-2">
                Check console (F12) for upload progress...
              </p>
            )}
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
                        if (confirm('Are you sure you want to delete this document?')) {
                          const result = await api.deleteDocument(doc.id);
                          if (result.success) {
                            toast.success('Document deleted');
                            loadDocuments();
                            loadDashboardData();
                          } else {
                            toast.error('Failed to delete document');
                          }
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