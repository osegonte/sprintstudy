import axios, { AxiosResponse, AxiosError } from 'axios';
import toast from 'react-hot-toast';
import type {
  User,
  AuthResponse,
  LoginRequest,
  SignupRequest,
  Topic,
  Document,
  DashboardData,
  Achievement,
  StudySession,
  Sprint,
  ConnectionTestResult,
  ApiResponse,
} from '../types';

// Configure API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
const ENABLE_DEBUG = import.meta.env.VITE_ENABLE_DEBUG === 'true';

console.log('🔧 API Base URL:', API_BASE_URL);

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
let authToken: string | null = null;

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

// Initialize token from localStorage
const savedToken = localStorage.getItem('cinestudy_token');
if (savedToken) {
  setAuthToken(savedToken);
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    if (ENABLE_DEBUG) {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (ENABLE_DEBUG) {
      console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error: AxiosError) => {
    console.error('❌ API Error:', error.response?.data || error.message);
    
    // Handle CORS errors
    if (error.message.includes('CORS') || error.message.includes('Access-Control-Allow-Origin')) {
      console.error('🚨 CORS Error - Backend needs to allow your frontend URL');
      toast.error('Connection error: Please check if the backend is running');
    }
    
    // Handle 401 - unauthorized
    if (error.response?.status === 401) {
      setAuthToken(null);
      toast.error('Session expired. Please login again.');
      window.location.href = '/login';
    }
    
    // Handle 500 - server errors
    if (error.response?.status === 500) {
      toast.error('Server error. Please try again later.');
    }
    
    return Promise.reject(error);
  }
);

// Helper function to handle API responses
const handleApiResponse = <T>(response: AxiosResponse<T>): T => {
  return response.data;
};

const handleApiError = (error: AxiosError): never => {
  const message = (error.response?.data as any)?.error || error.message;
  throw new Error(message);
};

// Connection test
export const testConnection = async (): Promise<ConnectionTestResult> => {
  try {
    console.log('🧪 Testing connection to backend...');
    const response = await axios.get(`${API_BASE_URL.replace('/api', '')}/api/cors-test`, {
      withCredentials: true,
      timeout: 10000,
    });
    console.log('✅ Connection test successful:', response.data);
    return { success: true, message: 'Connected successfully', data: response.data };
  } catch (error: any) {
    console.error('❌ Connection test failed:', error);
    if (error.code === 'ERR_NETWORK') {
      return { 
        success: false, 
        error: 'Network error - is your backend running on http://localhost:3000?',
        details: error.message 
      };
    }
    return { success: false, error: error.message, details: error };
  }
};

// ====== Authentication API ======
export const authAPI = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      console.log('🔐 Attempting login for:', credentials.email);
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      const data = handleApiResponse(response);
      
      if (data.access_token) {
        setAuthToken(data.access_token);
        console.log('✅ Login successful, token set');
        toast.success('Login successful!');
      }
      
      return data;
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async signup(userData: SignupRequest): Promise<AuthResponse> {
    try {
      console.log('📝 Attempting signup for:', userData.email);
      const response = await api.post<AuthResponse>('/auth/signup', userData);
      const data = handleApiResponse(response);
      
      if (data.access_token) {
        setAuthToken(data.access_token);
        console.log('✅ Signup successful, token set');
        toast.success('Account created successfully!');
      }
      
      return data;
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
      setAuthToken(null);
      console.log('🚪 Logged out');
      toast.success('Logged out successfully');
    } catch (error) {
      // Even if logout fails on backend, clear local token
      setAuthToken(null);
      console.log('🚪 Logged out (local only)');
    }
  },

  async getCurrentUser(): Promise<{ user: User; stats: any }> {
    try {
      const response = await api.get<{ user: User; stats: any }>('/auth/me');
      return handleApiResponse(response);
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken });
      const data = handleApiResponse(response);
      
      if (data.access_token) {
        setAuthToken(data.access_token);
      }
      
      return data;
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },
};

// ====== Topics API ======
export const topicsAPI = {
  async getAll(): Promise<{ topics: Topic[] }> {
    try {
      const response = await api.get<{ topics: Topic[] }>('/topics');
      return handleApiResponse(response);
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async create(topic: Partial<Topic>): Promise<{ topic: Topic; message: string }> {
    try {
      const response = await api.post<{ topic: Topic; message: string }>('/topics', topic);
      const data = handleApiResponse(response);
      toast.success('Topic created successfully!');
      return data;
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async getById(id: string): Promise<{ topic: Topic }> {
    try {
      const response = await api.get<{ topic: Topic }>(`/topics/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async update(id: string, updates: Partial<Topic>): Promise<{ topic: Topic; message: string }> {
    try {
      const response = await api.patch<{ topic: Topic; message: string }>(`/topics/${id}`, updates);
      const data = handleApiResponse(response);
      toast.success('Topic updated successfully!');
      return data;
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async delete(id: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/topics/${id}`);
      const data = handleApiResponse(response);
      toast.success('Topic deleted successfully!');
      return data;
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },
};

// ====== Documents API ======
export const documentsAPI = {
  async getAll(filters: any = {}): Promise<{ documents: Document[] }> {
    try {
      const response = await api.get<{ documents: Document[] }>('/documents', { params: filters });
      return handleApiResponse(response);
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async upload(file: File, metadata: any = {}): Promise<{ document: Document; message: string }> {
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      
      Object.keys(metadata).forEach(key => {
        if (metadata[key] !== undefined) {
          formData.append(key, metadata[key]);
        }
      });

      const response = await api.post<{ document: Document; message: string }>('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`📤 Upload Progress: ${percentCompleted}%`);
          }
        },
      });
      
      const data = handleApiResponse(response);
      toast.success('Document uploaded successfully!');
      return data;
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async getById(id: string): Promise<{ document: Document }> {
    try {
      const response = await api.get<{ document: Document }>(`/documents/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async delete(id: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/documents/${id}`);
      const data = handleApiResponse(response);
      toast.success('Document deleted successfully!');
      return data;
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },
};

// ====== Analytics API ======
export const analyticsAPI = {
  async getDashboard(): Promise<DashboardData> {
    try {
      const response = await api.get<DashboardData>('/analytics/dashboard');
      return handleApiResponse(response);
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async getTrends(period: string = '30d', metric: string = 'speed'): Promise<any> {
    try {
      const response = await api.get('/analytics/trends', { params: { period, metric } });
      return handleApiResponse(response);
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async getPatterns(): Promise<any> {
    try {
      const response = await api.get('/analytics/patterns');
      return handleApiResponse(response);
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },

  async submitFeedback(feedbackData: any): Promise<any> {
    try {
      const response = await api.post('/analytics/feedback', feedbackData);
      return handleApiResponse(response);
    } catch (error) {
      handleApiError(error as AxiosError);
    }
  },
};

// Export the configured API instance (removed duplicate setAuthToken export)
export { api };
export default api;