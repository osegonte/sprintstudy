// frontend/src/services/api.ts
import axios, { AxiosResponse, AxiosError } from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let authToken: string | null = localStorage.getItem('cinestudy_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('cinestudy_token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('cinestudy_token');
  }
};

// Initialize token
if (authToken) {
  setAuthToken(authToken);
}

// Response interceptor with fallback
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    console.error('API Error:', error);
    
    // If backend unavailable, provide mock data
    if (error.code === 'ERR_NETWORK' || error.message.includes('ECONNREFUSED')) {
      console.log('🔄 Backend unavailable, using mock data');
      return handleMockResponse(error.config);
    }
    
    if (error.response?.status === 401) {
      setAuthToken(null);
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// Mock data handler
const handleMockResponse = (config: any) => {
  const method = config.method?.toUpperCase();
  const url = config.url;
  
  // Mock responses based on endpoint
  if (url.includes('/auth/login')) {
    return Promise.resolve({
      data: {
        user: { id: '1', email: 'demo@example.com', username: 'demo' },
        access_token: 'demo_token_' + Date.now()
      }
    });
  }
  
  if (url.includes('/documents')) {
    return Promise.resolve({
      data: {
        documents: [
          {
            id: '1',
            title: 'React Fundamentals',
            total_pages: 45,
            completion_percentage: 65,
            topic: { id: '1', name: 'Programming', color: '#3B82F6' }
          }
        ]
      }
    });
  }
  
  if (url.includes('/topics')) {
    return Promise.resolve({
      data: {
        topics: [
          {
            id: '1',
            name: 'Programming',
            color: '#3B82F6',
            completion_percentage: 45,
            total_documents: 3
          }
        ]
      }
    });
  }
  
  if (url.includes('/analytics/dashboard')) {
    return Promise.resolve({
      data: {
        overview: {
          total_documents: 5,
          completed_pages: 156,
          total_time_spent_seconds: 14400,
          current_level: 3
        },
        recent_activity: []
      }
    });
  }
  
  return Promise.resolve({ data: {} });
};

// API methods
export const authAPI = {
  async login(credentials: any) {
    try {
      const response = await api.post('/auth/login', credentials);
      const data = response.data;
      if (data.access_token) {
        setAuthToken(data.access_token);
      }
      return data;
    } catch (error) {
      throw error;
    }
  },
  
  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setAuthToken(null);
    }
  },
  
  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

export const documentsAPI = {
  async getAll(filters = {}) {
    const response = await api.get('/documents', { params: filters });
    return response.data;
  },
  
  async upload(file: File, metadata = {}) {
    const formData = new FormData();
    formData.append('pdf', file);
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, value as string);
    });
    
    const response = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  
  async delete(id: string) {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  }
};

export const topicsAPI = {
  async getAll() {
    const response = await api.get('/topics');
    return response.data;
  },
  
  async create(topic: any) {
    const response = await api.post('/topics', topic);
    return response.data;
  },
  
  async update(id: string, updates: any) {
    const response = await api.patch(`/topics/${id}`, updates);
    return response.data;
  },
  
  async delete(id: string) {
    const response = await api.delete(`/topics/${id}`);
    return response.data;
  }
};

export const analyticsAPI = {
  async getDashboard() {
    const response = await api.get('/analytics/dashboard');
    return response.data;
  }
};

export default api;