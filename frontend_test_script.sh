#!/bin/bash

# SprintStudy Basic Frontend Test App Builder
# Creates a simple React app to test your live backend API

echo "🚀 Creating SprintStudy Basic Frontend Test App..."

# Create React app with Vite
echo "📦 Creating React project with Vite..."
npm create vite@latest sprintstudy-frontend -- --template react-ts
cd sprintstudy-frontend

# Install dependencies
echo "📚 Installing dependencies..."
npm install
npm install axios react-router-dom @types/react-router-dom lucide-react react-hot-toast

# Install Tailwind CSS
echo "🎨 Setting up Tailwind CSS..."
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Configure Tailwind
echo "⚙️ Configuring Tailwind CSS..."
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
      }
    },
  },
  plugins: [],
}
EOF

# Update CSS
echo "🎨 Setting up global styles..."
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-slate-50 text-slate-800 font-sans;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors;
  }
  
  .btn-secondary {
    @apply bg-gray-200 text-gray-800 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors;
  }
  
  .card {
    @apply bg-white rounded-2xl p-6 shadow-lg;
  }
  
  .input {
    @apply w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary;
  }
}
EOF

# Create API service
echo "🔗 Creating API service..."
mkdir -p src/services
cat > src/services/api.ts << 'EOF'
const API_BASE_URL = 'https://sprintstudy-production.up.railway.app';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/';
        }
        return { success: false, error: data.error || 'Request failed' };
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  // Authentication
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ email, password })
    });
    
    const result = await this.handleResponse(response);
    if (result.success && result.data) {
      localStorage.setItem('token', result.data.session.access_token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
    }
    return result;
  }

  async signup(email: string, password: string, username: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ email, password, username })
    });
    
    const result = await this.handleResponse(response);
    if (result.success && result.data) {
      localStorage.setItem('token', result.data.session.access_token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
    }
    return result;
  }

  async logout() {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return this.handleResponse(response);
  }

  // Documents
  async uploadDocument(file: File, title?: string) {
    const formData = new FormData();
    formData.append('pdf', file);
    if (title) formData.append('title', title);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
      body: formData
    });

    return this.handleResponse(response);
  }

  async getDocuments() {
    const response = await fetch(`${API_BASE_URL}/api/documents`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async deleteDocument(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // Analytics
  async getDashboardData() {
    const response = await fetch(`${API_BASE_URL}/api/analytics/dashboard`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  // Sprints
  async generateSprint(documentId: string) {
    const response = await fetch(`${API_BASE_URL}/api/sprints/generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ document_id: documentId })
    });
    return this.handleResponse(response);
  }

  async getTodaySprint() {
    const response = await fetch(`${API_BASE_URL}/api/sprints/today`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async createSprint(data: any) {
    const response = await fetch(`${API_BASE_URL}/api/sprints`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  // Progress
  async recordPageProgress(documentId: string, pageNumber: number, timeSpent: number) {
    const response = await fetch(`${API_BASE_URL}/api/progress/page`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        document_id: documentId,
        page_number: pageNumber,
        time_spent_seconds: timeSpent
      })
    });
    return this.handleResponse(response);
  }

  async getSpeedFeedback(currentPageTime: number, documentId: string) {
    const response = await fetch(`${API_BASE_URL}/api/progress/feedback`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        current_page_time: currentPageTime,
        document_id: documentId
      })
    });
    return this.handleResponse(response);
  }

  // Health check
  async healthCheck() {
    const response = await fetch(`${API_BASE_URL}/health`);
    return this.handleResponse(response);
  }
}

export const api = new ApiService();
EOF

# Create Auth Context
echo "🔐 Creating authentication context..."
mkdir -p src/contexts
cat > src/contexts/AuthContext.tsx << 'EOF'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    
    setIsLoading(false);
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
EOF

# Create components
echo "🧩 Creating components..."
mkdir -p src/components

# Login Component
cat > src/components/Login.tsx << 'EOF'
import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      if (isSignup) {
        result = await api.signup(email, password, username);
      } else {
        result = await api.login(email, password);
      }

      if (result.success) {
        setUser(result.data.user);
        toast.success(isSignup ? 'Account created successfully!' : 'Welcome back!');
      } else {
        toast.error(result.error || 'Authentication failed');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📚 SprintStudy
          </h1>
          <p className="text-gray-600">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              required
            />
          </div>

          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Loading...' : (isSignup ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="text-primary hover:underline"
          >
            {isSignup ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
};
EOF

# Dashboard Component
cat > src/components/Dashboard.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Upload, BookOpen, Clock, Target, TrendingUp, LogOut } from 'lucide-react';
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
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
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
                    <button className="btn-primary text-sm py-2 px-4 flex-1">
                      Continue Reading
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
EOF

# API Test Component
cat > src/components/ApiTest.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
}

export const ApiTest: React.FC = () => {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Health Check', status: 'pending', message: '' },
    { name: 'Authentication (if logged in)', status: 'pending', message: '' },
    { name: 'Dashboard Data', status: 'pending', message: '' },
    { name: 'Documents List', status: 'pending', message: '' },
  ]);

  useEffect(() => {
    runTests();
  }, []);

  const updateTest = (index: number, status: 'success' | 'error', message: string) => {
    setTests(prev => prev.map((test, i) => 
      i === index ? { ...test, status, message } : test
    ));
  };

  const runTests = async () => {
    // Test 1: Health Check
    try {
      const healthResult = await api.healthCheck();
      if (healthResult.success) {
        updateTest(0, 'success', `API v${healthResult.data.version} - Features: ${healthResult.data.features.join(', ')}`);
      } else {
        updateTest(0, 'error', healthResult.error || 'Health check failed');
      }
    } catch (error) {
      updateTest(0, 'error', 'Network error');
    }

    // Test 2: Authentication (if token exists)
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const dashResult = await api.getDashboardData();
        if (dashResult.success) {
          updateTest(1, 'success', 'Authentication working');
        } else {
          updateTest(1, 'error', 'Authentication failed');
        }
      } catch (error) {
        updateTest(1, 'error', 'Auth test failed');
      }
    } else {
      updateTest(1, 'error', 'No token found - please login');
    }

    // Test 3: Dashboard Data (if authenticated)
    if (token) {
      try {
        const dashResult = await api.getDashboardData();
        if (dashResult.success) {
          updateTest(2, 'success', `Found ${dashResult.data.stats.total_documents} documents, ${dashResult.data.stats.study_streak_days} day streak`);
        } else {
          updateTest(2, 'error', dashResult.error || 'Dashboard data failed');
        }
      } catch (error) {
        updateTest(2, 'error', 'Dashboard test failed');
      }
    } else {
      updateTest(2, 'error', 'Authentication required');
    }

    // Test 4: Documents List (if authenticated)
    if (token) {
      try {
        const docsResult = await api.getDocuments();
        if (docsResult.success) {
          updateTest(3, 'success', `Found ${docsResult.data.documents?.length || 0} documents`);
        } else {
          updateTest(3, 'error', docsResult.error || 'Documents list failed');
        }
      } catch (error) {
        updateTest(3, 'error', 'Documents test failed');
      }
    } else {
      updateTest(3, 'error', 'Authentication required');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'error':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <Clock className="text-yellow-500 animate-spin" size={20} />;
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">🧪 API Test Results</h2>
      <div className="space-y-3">
        {tests.map((test, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
            {getStatusIcon(test.status)}
            <div className="flex-1">
              <h3 className="font-semibold">{test.name}</h3>
              <p className={`text-sm ${test.status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                {test.message || 'Testing...'}
              </p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={runTests}
        className="btn-primary mt-4"
      >
        Run Tests Again
      </button>
    </div>
  );
};
EOF

# Main App Component
cat > src/App.tsx << 'EOF'
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ApiTest } from './components/ApiTest';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/test" 
            element={
              <div className="min-h-screen bg-slate-50 p-8">
                <div className="max-w-4xl mx-auto">
                  <h1 className="text-3xl font-bold mb-8">🧪 SprintStudy API Test</h1>
                  <ApiTest />
                </div>
              </div>
            } 
          />
          <Route 
            path="/" 
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} 
          />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
EOF

# Update main.tsx
cat > src/main.tsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

# Create sprint test component
echo "🎯 Creating sprint test component..."
cat > src/components/SprintTest.tsx << 'EOF'
import React, { useState } from 'react';
import { api } from '../services/api';
import { Play, Pause, Target } from 'lucide-react';
import toast from 'react-hot-toast';

export const SprintTest: React.FC = () => {
  const [selectedDocument, setSelectedDocument] = useState('');
  const [sprintSuggestion, setSprintSuggestion] = useState<any>(null);
  const [currentSprint, setCurrentSprint] = useState<any>(null);
  const [pageTime, setPageTime] = useState(120);
  const [speedFeedback, setSpeedFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateSprint = async () => {
    if (!selectedDocument) {
      toast.error('Please select a document first');
      return;
    }

    setLoading(true);
    const result = await api.generateSprint(selectedDocument);
    if (result.success) {
      setSprintSuggestion(result.data.sprint_suggestion);
      toast.success('Sprint suggestion generated!');
    } else {
      toast.error(result.error || 'Failed to generate sprint');
    }
    setLoading(false);
  };

  const getSpeedFeedback = async () => {
    if (!selectedDocument) {
      toast.error('Please select a document first');
      return;
    }

    setLoading(true);
    const result = await api.getSpeedFeedback(pageTime, selectedDocument);
    if (result.success) {
      setSpeedFeedback(result.data.feedback);
      toast.success('Speed feedback received!');
    } else {
      toast.error(result.error || 'Failed to get feedback');
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">🎯 Sprint Testing</h2>
      
      {/* Document Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Document ID (for testing)
        </label>
        <input
          type="text"
          value={selectedDocument}
          onChange={(e) => setSelectedDocument(e.target.value)}
          placeholder="Enter document ID from your documents list"
          className="input"
        />
      </div>

      {/* Sprint Generation */}
      <div className="mb-6">
        <button
          onClick={generateSprint}
          disabled={loading || !selectedDocument}
          className="btn-primary mr-4"
        >
          {loading ? 'Generating...' : 'Generate Sprint'}
        </button>
        
        {sprintSuggestion && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <h3 className="font-semibold mb-2">📚 Sprint Suggestion</h3>
            <p>Pages: {sprintSuggestion.start_page} - {sprintSuggestion.end_page}</p>
            <p>Estimated time: {Math.round(sprintSuggestion.estimated_time_seconds / 60)} minutes</p>
            <p>Total pages: {sprintSuggestion.total_pages}</p>
            <p>Completed: {sprintSuggestion.completed_pages}</p>
            <p>Remaining: {sprintSuggestion.remaining_pages}</p>
          </div>
        )}
      </div>

      {/* Speed Feedback Test */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page Time (seconds)
            </label>
            <input
              type="number"
              value={pageTime}
              onChange={(e) => setPageTime(Number(e.target.value))}
              className="input w-32"
              min="1"
            />
          </div>
          <button
            onClick={getSpeedFeedback}
            disabled={loading || !selectedDocument}
            className="btn-primary mt-6"
          >
            Get Speed Feedback
          </button>
        </div>

        {speedFeedback && (
          <div className="p-4 bg-green-50 rounded-xl">
            <h3 className="font-semibold mb-2">⚡ Speed Feedback</h3>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{speedFeedback.emoji}</span>
              <span className={`font-medium text-${speedFeedback.color}-600`}>
                {speedFeedback.message}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Type: {speedFeedback.type}</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="font-semibold mb-2">📝 Testing Instructions</h3>
        <ol className="text-sm text-gray-700 space-y-1">
          <li>1. First upload a PDF document in the dashboard</li>
          <li>2. Copy the document ID from the documents list</li>
          <li>3. Paste it in the Document ID field above</li>
          <li>4. Test sprint generation and speed feedback</li>
          <li>5. Try different page times to see different feedback messages</li>
        </ol>
      </div>
    </div>
  );
};
EOF

# Update dashboard to include sprint testing
cat > src/components/Dashboard.tsx << 'EOF'
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
EOF

# Create development scripts
echo "⚡ Creating development scripts..."
cat > package.json << 'EOF'
{
  "name": "sprintstudy-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@typescript-eslint/eslint-plugin": "^6.10.0",
    "@typescript-eslint/parser": "^6.10.0",
    "@vitejs/plugin-react": "^4.1.0",
    "eslint": "^8.53.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.4",
    "typescript": "^5.2.2",
    "vite": "^4.5.0"
  }
}
EOF

# Create launch script
echo "🚀 Creating launch script..."
cat > start.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting SprintStudy Frontend Test App..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🌐 Starting development server..."
echo "📍 Your app will be available at: http://localhost:5173"
echo ""
echo "🧪 Test Pages Available:"
echo "  • http://localhost:5173 - Main app (login/dashboard)"
echo "  • http://localhost:5173/test - API test page"
echo ""
echo "🔗 Your Backend API: https://sprintstudy-production.up.railway.app"
echo ""

npm run dev
EOF

chmod +x start.sh

# Create README
echo "📖 Creating README..."
cat > README.md << 'EOF'
# 📚 SprintStudy Frontend Test App

A basic React frontend to test your SprintStudy backend API.

## 🚀 Quick Start

```bash
# Start the app
./start.sh
```

The app will be available at: http://localhost:5173

## 🧪 Testing Your Backend

### 1. API Health Test
Visit: http://localhost:5173/test

This page will test:
- ✅ Backend health check
- ✅ Authentication (if logged in)
- ✅ Dashboard data
- ✅ Documents list

### 2. Main App Testing
Visit: http://localhost:5173

**Test Flow:**
1. **Sign up/Login** with your email
2. **Upload a PDF** to test document management
3. **View Dashboard** to see analytics
4. **Test Sprint Features** (click "Sprint Test" in header)
5. **Copy Document ID** and use in sprint testing

### 3. Sprint Testing
1. Upload a PDF document first
2. Click "Sprint Test" in the dashboard header
3. Copy a document ID from the documents grid
4. Test sprint generation and speed feedback

## 🔗 API Integration

**Backend URL:** `https://sprintstudy-production.up.railway.app`

### Features Tested:
- ✅ User authentication (signup/login)
- ✅ PDF upload and storage
- ✅ Dashboard analytics
- ✅ Document management
- ✅ Sprint generation
- ✅ Real-time speed feedback
- ✅ Progress tracking

## 📱 Pages Available

- `/` - Redirects to login or dashboard
- `/login` - Authentication page
- `/dashboard` - Main dashboard with analytics
- `/test` - API testing page

## 🎯 What to Test

### Authentication
- Sign up with a new account
- Login with existing credentials
- Logout functionality

### Document Management
- Upload PDF files (drag & drop supported)
- View document list with progress
- Delete documents
- Copy document IDs for testing

### Sprint Features
- Generate sprint suggestions
- Test speed feedback with different times
- View real-time motivational messages

### Analytics
- View reading statistics
- Check study streaks
- See estimated completion times

## 🐛 Troubleshooting

### Common Issues:

1. **API Connection Failed**
   - Check if backend is running: https://sprintstudy-production.up.railway.app/health
   - Verify network connection

2. **Authentication Errors**
   - Clear browser localStorage: `localStorage.clear()`
   - Try signing up with a new email

3. **Upload Errors**
   - Ensure file is a PDF
   - Check file size (max 50MB)
   - Verify authentication token

### Debug Steps:
1. Open browser DevTools (F12)
2. Check Console for errors
3. Check Network tab for failed requests
4. Use the API test page for diagnostics

## 🔧 Development

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

## 📊 Backend Features Integrated

- **Authentication System** - JWT-based login/signup
- **Document Management** - PDF upload, storage, metadata
- **Progress Tracking** - Page-by-page reading progress
- **Sprint System** - Smart daily study goals
- **Analytics Dashboard** - Reading speed, streaks, completion
- **Real-time Feedback** - Motivational speed messages
- **Gamification** - Achievements and progress tracking

Ready to test your SprintStudy backend! 🚀
EOF

# Final completion message
echo ""
echo "🎉 SprintStudy Frontend Test App Created Successfully!"
echo ""
echo "📁 Created Files:"
echo "  ✅ Complete React TypeScript app with Vite"
echo "  ✅ Tailwind CSS for styling"
echo "  ✅ Authentication system"
echo "  ✅ Dashboard with analytics"
echo "  ✅ Document upload/management"
echo "  ✅ Sprint testing features"
echo "  ✅ API integration with error handling"
echo "  ✅ Development scripts and documentation"
echo ""
echo "🚀 To Start Testing:"
echo "  1. cd sprintstudy-frontend"
echo "  2. ./start.sh"
echo "  3. Open http://localhost:5173"
echo ""
echo "🧪 Test Pages:"
echo "  • http://localhost:5173 - Main app"
echo "  • http://localhost:5173/test - API diagnostics"
echo ""
echo "🔗 Your Backend: https://sprintstudy-production.up.railway.app"
echo ""
echo "Ready to test your SprintStudy app! 🎯"