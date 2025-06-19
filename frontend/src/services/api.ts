// src/services/api.ts - Fixed version
import axios, { AxiosResponse, AxiosError } from 'axios';

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

// Add the missing testConnection function
export const testConnection = async () => {
  try {
    const response = await fetch(API_BASE_URL.replace('/api', '/health'));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Connection test failed:', error);
    throw error;
  }
};

// Response interceptor with better error handling
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    console.error('API Error:', error);
    
    if (error.response?.status === 401) {
      setAuthToken(null);
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

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
    } catch (error) {
      console.warn('Logout request failed:', error);
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