// Updated API Configuration for Lovable Frontend
// Save this as: src/lib/api.js

import axios from 'axios';

// Configure API base URL - CORRECTED to use port 3000
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-url.railway.app/api'  // Replace with your actual Railway URL
  : 'http://localhost:3000/api';  // FIXED: Using port 3000 as shown in your logs

console.log('🔧 API Base URL:', API_BASE_URL);

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let authToken = null;

// Set auth token
export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // Don't use localStorage in Lovable - it's not supported
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('study_planner_token', token);
    }
  } else {
    delete api.defaults.headers.common['Authorization'];
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('study_planner_token');
    }
  }
};

// Initialize token from localStorage if available
if (typeof window !== 'undefined' && window.localStorage) {
  const savedToken = localStorage.getItem('study_planner_token');
  if (savedToken) {
    setAuthToken(savedToken);
  }
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    console.log(`🌐 From Origin: ${window.location.origin}`);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error.response?.data || error.message);
    
    // Handle CORS errors specifically
    if (error.message.includes('CORS') || error.message.includes('Access-Control-Allow-Origin')) {
      console.error('🚨 CORS Error - Backend needs to allow your Lovable URL');
      console.error('Your URL:', window.location.origin);
    }
    
    // Handle 401 - unauthorized
    if (error.response?.status === 401) {
      setAuthToken(null);
      // You might want to redirect to login page here
      console.log('🔒 Authentication expired, please login again');
    }
    
    return Promise.reject(error);
  }
);

// Connection test function
export const testConnection = async () => {
  try {
    console.log('🧪 Testing connection to backend...');
    const response = await axios.get(`${API_BASE_URL.replace('/api', '')}/api/cors-test`, {
      withCredentials: true
    });
    console.log('✅ Connection test successful:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
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

// ====== Authentication ======
export const authAPI = {
  async login(email, password) {
    console.log('🔐 Attempting login for:', email);
    const response = await api.post('/auth/login', { email, password });
    const { access_token, user, session } = response.data;
    
    if (access_token) {
      setAuthToken(access_token);
      console.log('✅ Login successful, token set');
    }
    
    return response.data;
  },

  async signup(email, password, username, full_name) {
    console.log('📝 Attempting signup for:', email);
    const response = await api.post('/auth/signup', { 
      email, 
      password, 
      username, 
      full_name 
    });
    const { access_token } = response.data;
    
    if (access_token) {
      setAuthToken(access_token);
      console.log('✅ Signup successful, token set');
    }
    
    return response.data;
  },

  async logout() {
    await api.post('/auth/logout');
    setAuthToken(null);
    console.log('🚪 Logged out');
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async testLogin() {
    console.log('🧪 Testing login with default credentials...');
    try {
      const response = await axios.post(`${API_BASE_URL}/test-login`, {
        email: 'test@example.com',
        password: 'password123'
      }, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Test login successful:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Test login failed:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  }
};

// ====== Topics ======
export const topicsAPI = {
  async getAll() {
    const response = await api.get('/topics');
    return response.data;
  },

  async create(topic) {
    const response = await api.post('/topics', topic);
    return response.data;
  },

  async getById(id) {
    const response = await api.get(`/topics/${id}`);
    return response.data;
  },

  async update(id, updates) {
    const response = await api.patch(`/topics/${id}`, updates);
    return response.data;
  },

  async delete(id) {
    const response = await api.delete(`/topics/${id}`);
    return response.data;
  }
};

// ====== Documents ======
export const documentsAPI = {
  async getAll(filters = {}) {
    const response = await api.get('/documents', { params: filters });
    return response.data;
  },

  async upload(file, metadata = {}) {
    const formData = new FormData();
    formData.append('pdf', file);
    
    // Add metadata
    Object.keys(metadata).forEach(key => {
      if (metadata[key] !== undefined) {
        formData.append(key, metadata[key]);
      }
    });

    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`📤 Upload Progress: ${percentCompleted}%`);
      },
    });
    
    return response.data;
  },

  async getById(id) {
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },

  async delete(id) {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  }
};

// ====== Analytics ======
export const analyticsAPI = {
  async getDashboard() {
    const response = await api.get('/analytics/dashboard');
    return response.data;
  },

  async submitFeedback(feedbackData) {
    const response = await api.post('/analytics/feedback', feedbackData);
    return response.data;
  }
};

// ====== Quick Test Component for Lovable ======
// Use this component to test the connection
export const ConnectionTestComponent = () => {
  const [status, setStatus] = useState('🔄 Testing...');
  const [details, setDetails] = useState('');

  useEffect(() => {
    runConnectionTest();
  }, []);

  const runConnectionTest = async () => {
    try {
      // Test 1: Basic connection
      console.log('🧪 Step 1: Testing basic connection...');
      setStatus('🧪 Testing basic connection...');
      
      const connectionTest = await testConnection();
      if (!connectionTest.success) {
        setStatus('❌ Connection failed');
        setDetails(`Error: ${connectionTest.error}`);
        return;
      }

      // Test 2: Test login
      console.log('🧪 Step 2: Testing login...');
      setStatus('🧪 Testing login...');
      
      const loginTest = await authAPI.testLogin();
      if (!loginTest.success) {
        setStatus('❌ Login test failed');
        setDetails(`Error: ${loginTest.error}`);
        return;
      }

      // Test 3: Actual login
      console.log('🧪 Step 3: Performing actual login...');
      setStatus('🧪 Performing actual login...');
      
      const actualLogin = await authAPI.login('test@example.com', 'password123');
      if (actualLogin.user) {
        setStatus('✅ All tests passed! Backend connected successfully');
        setDetails(`Logged in as: ${actualLogin.user.email}`);
      } else {
        setStatus('⚠️ Login response missing user data');
        setDetails(JSON.stringify(actualLogin, null, 2));
      }

    } catch (error) {
      console.error('🚨 Connection test failed:', error);
      setStatus('❌ Connection test failed');
      setDetails(`Error: ${error.message}`);
    }
  };

  return (
    <div className="p-6 bg-white border rounded-lg shadow-lg max-w-md mx-auto">
      <h3 className="text-lg font-bold mb-4">🔗 Backend Connection Test</h3>
      <div className="mb-4">
        <p className="text-sm text-gray-600">Backend URL:</p>
        <p className="text-xs font-mono bg-gray-100 p-2 rounded">{API_BASE_URL}</p>
      </div>
      <div className="mb-4">
        <p className="text-sm text-gray-600">Your Lovable URL:</p>
        <p className="text-xs font-mono bg-gray-100 p-2 rounded">{window.location.origin}</p>
      </div>
      <div className="space-y-2">
        <p className="font-medium">{status}</p>
        {details && (
          <div className="text-xs bg-gray-50 p-3 rounded">
            <pre className="whitespace-pre-wrap">{details}</pre>
          </div>
        )}
      </div>
      <button 
        onClick={runConnectionTest}
        className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        🔄 Test Again
      </button>
    </div>
  );
};

// Export the configured API instance
export default api;