// frontend-api-client.js - Complete API client for frontend integration
class StudyPlannerAPI {
  constructor(config = {}) {
    this.baseURL = config.baseURL || process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
    this.version = config.version || 'v1';
    this.timeout = config.timeout || 30000;
    this.authToken = null;
    this.refreshToken = null;
    
    // Initialize with stored tokens
    this.loadTokensFromStorage();
    
    // Setup axios-like interceptors
    this.interceptors = {
      request: [],
      response: []
    };
  }

  // Authentication methods
  async login(email, password) {
    try {
      const response = await this.request('POST', '/auth/login', {
        email,
        password
      });
      
      if (response.access_token) {
        this.setAuthToken(response.access_token, response.refresh_token);
      }
      
      return response;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async signup(userData) {
    try {
      const response = await this.request('POST', '/auth/signup', userData);
      
      if (response.access_token) {
        this.setAuthToken(response.access_token, response.refresh_token);
      }
      
      return response;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async logout() {
    try {
      await this.request('POST', '/auth/logout');
    } catch (error) {
      console.warn('Logout request failed:', error.message);
    } finally {
      this.clearTokens();
    }
  }

  async refreshAuthToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.request('POST', '/auth/refresh', {
        refresh_token: this.refreshToken
      });
      
      this.setAuthToken(response.access_token, response.refresh_token);
      return response;
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }

  // Document methods
  async uploadDocument(file, metadata = {}) {
    const formData = new FormData();
    formData.append('pdf', file);
    
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    return this.request('POST', '/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: metadata.onProgress
    });
  }

  async getDocuments(filters = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    const url = queryParams.toString() ? `/documents?${queryParams}` : '/documents';
    return this.request('GET', url);
  }

  async getDocument(id) {
    return this.request('GET', `/documents/${id}`);
  }

  async deleteDocument(id) {
    return this.request('DELETE', `/documents/${id}`);
  }

  // Topics methods
  async getTopics(includeArchived = false) {
    const url = includeArchived ? '/topics?include_archived=true' : '/topics';
    return this.request('GET', url);
  }

  async createTopic(topicData) {
    return this.request('POST', '/topics', topicData);
  }

  async updateTopic(id, updates) {
    return this.request('PATCH', `/topics/${id}`, updates);
  }

  async deleteTopic(id) {
    return this.request('DELETE', `/topics/${id}`);
  }

  async reorderTopics(topicOrders) {
    return this.request('PATCH', '/topics/reorder', { topic_orders: topicOrders });
  }

  // Analytics methods
  async getDashboard() {
    return this.request('GET', '/analytics/dashboard');
  }

  async submitFeedback(feedbackData) {
    return this.request('POST', '/analytics/feedback', feedbackData);
  }

  async getPerformanceTrends(period = '30d', metric = 'speed') {
    return this.request('GET', `/analytics/trends?period=${period}&metric=${metric}`);
  }

  // Study Sessions methods
  async startSession(sessionData) {
    return this.request('POST', '/sessions/start', sessionData);
  }

  async updateSession(sessionId, activityData) {
    return this.request('PATCH', `/sessions/${sessionId}/activity`, activityData);
  }

  async endSession(sessionId, completionData) {
    return this.request('PATCH', `/sessions/${sessionId}/end`, completionData);
  }

  async getSessions(filters = {}) {
    const queryParams = new URLSearchParams(filters);
    const url = queryParams.toString() ? `/sessions?${queryParams}` : '/sessions';
    return this.request('GET', url);
  }

  // Sprints methods
  async generateSprint(sprintConfig) {
    return this.request('POST', '/sprints/generate', sprintConfig);
  }

  async createSprint(sprintData) {
    return this.request('POST', '/sprints', sprintData);
  }

  async startSprint(sprintId, startData = {}) {
    return this.request('PATCH', `/sprints/${sprintId}/start`, startData);
  }

  async completeSprint(sprintId, completionData) {
    return this.request('PATCH', `/sprints/${sprintId}/complete`, completionData);
  }

  async getSprintAnalytics(timeframe = '30d') {
    return this.request('GET', `/sprints/analytics?timeframe=${timeframe}`);
  }

  // Progress tracking methods
  async completePage(pageData) {
    return this.request('POST', '/progress/page/complete', pageData);
  }

  async getDocumentProgress(documentId) {
    return this.request('GET', `/progress/document/${documentId}/comprehensive`);
  }

  async startPageSession(documentId, pageNumber, sessionData = {}) {
    return this.request('POST', `/page-tracking/start-page/${documentId}/${pageNumber}`, sessionData);
  }

  async completePageSession(documentId, pageNumber, completionData) {
    return this.request('POST', `/page-tracking/complete-page/${documentId}/${pageNumber}`, completionData);
  }

  // Achievements methods
  async getAchievements(category = null) {
    const url = category ? `/achievements?category=${category}` : '/achievements';
    return this.request('GET', url);
  }

  async checkAchievements() {
    return this.request('POST', '/achievements/check');
  }

  // Core request method
  async request(method, endpoint, data = null, options = {}) {
    const url = `${this.baseURL}/${this.version}${endpoint}`;
    
    const config = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include',
      ...options
    };

    // Add auth token if available
    if (this.authToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${this.authToken}`;
    }

    // Handle different content types
    if (data) {
      if (data instanceof FormData) {
        delete config.headers['Content-Type']; // Let browser set it
        config.body = data;
      } else if (typeof data === 'object') {
        config.body = JSON.stringify(data);
      } else {
        config.body = data;
      }
    }

    // Apply request interceptors
    for (const interceptor of this.interceptors.request) {
      config = await interceptor(config);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      config.signal = controller.signal;
      
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      
      // Apply response interceptors
      let processedResponse = response;
      for (const interceptor of this.interceptors.response) {
        processedResponse = await interceptor(processedResponse);
      }
      
      return this.handleResponse(processedResponse);
    } catch (error) {
      throw this.handleError(error, { method, endpoint, data });
    }
  }

  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const error = new Error(data.message || data.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      error.response = response;
      throw error;
    }

    return data;
  }

  handleError(error, context) {
    console.error('API Request Error:', {
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    });

    // Handle specific error types
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'TIMEOUT';
      return timeoutError;
    }

    if (error.status === 401) {
      // Try to refresh token
      this.refreshAuthToken().catch(() => {
        this.clearTokens();
        window.dispatchEvent(new CustomEvent('auth:logout'));
      });
    }

    if (error.status === 403) {
      window.dispatchEvent(new CustomEvent('auth:forbidden', { detail: error }));
    }

    if (error.status === 429) {
      window.dispatchEvent(new CustomEvent('api:rateLimit', { detail: error }));
    }

    return error;
  }

  handleAuthError(error) {
    if (error.status === 401) {
      return new Error('Invalid credentials');
    }
    if (error.status === 429) {
      return new Error('Too many login attempts. Please try again later.');
    }
    return error;
  }

  // Token management
  setAuthToken(accessToken, refreshToken = null) {
    this.authToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
    this.saveTokensToStorage();
  }

  clearTokens() {
    this.authToken = null;
    this.refreshToken = null;
    this.removeTokensFromStorage();
  }

  saveTokensToStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('study_planner_token', this.authToken || '');
        localStorage.setItem('study_planner_refresh_token', this.refreshToken || '');
      } catch (error) {
        console.warn('Could not save tokens to localStorage:', error);
      }
    }
  }

  loadTokensFromStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        this.authToken = localStorage.getItem('study_planner_token') || null;
        this.refreshToken = localStorage.getItem('study_planner_refresh_token') || null;
      } catch (error) {
        console.warn('Could not load tokens from localStorage:', error);
      }
    }
  }

  removeTokensFromStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem('study_planner_token');
        localStorage.removeItem('study_planner_refresh_token');
      } catch (error) {
        console.warn('Could not remove tokens from localStorage:', error);
      }
    }
  }

  // Utility methods
  isAuthenticated() {
    return !!this.authToken;
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`);
      return response.json();
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  // Add request interceptor
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  }

  // Add response interceptor
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  }
}

// React hooks for using the API
export const useStudyPlannerAPI = () => {
  const [api] = useState(() => new StudyPlannerAPI());
  return api;
};

// Error boundary component for API errors
export class APIErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('API Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong with the API connection.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Connection test component
export const ConnectionTest = ({ apiInstance }) => {
  const [status, setStatus] = useState('testing');
  const [details, setDetails] = useState('');

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      setStatus('testing');
      setDetails('Testing connection...');

      // Test 1: Health check
      const health = await apiInstance.healthCheck();
      setDetails(prev => prev + '\n✅ Health check passed');

      // Test 2: Test anonymous endpoint
      try {
        await fetch(`${apiInstance.baseURL}/docs`);
        setDetails(prev => prev + '\n✅ API documentation accessible');
      } catch (error) {
        setDetails(prev => prev + '\n⚠️ API docs not accessible');
      }

      // Test 3: CORS test
      try {
        await apiInstance.request('GET', '/docs');
        setDetails(prev => prev + '\n✅ CORS configured correctly');
      } catch (error) {
        if (error.message.includes('CORS')) {
          setDetails(prev => prev + '\n❌ CORS configuration issue');
          setStatus('cors_error');
          return;
        }
      }

      setStatus('success');
      setDetails(prev => prev + '\n🎉 All tests passed!');
    } catch (error) {
      setStatus('error');
      setDetails(prev => prev + `\n❌ Error: ${error.message}`);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'testing': return '#fbbf24';
      case 'success': return '#10b981';
      case 'error': 
      case 'cors_error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: `2px solid ${getStatusColor()}`, 
      borderRadius: '8px',
      backgroundColor: '#f9fafb',
      fontFamily: 'monospace'
    }}>
      <h3>🔌 Backend Connection Test</h3>
      <div style={{ marginBottom: '10px' }}>
        <strong>Status:</strong> <span style={{ color: getStatusColor() }}>{status}</span>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>API URL:</strong> {apiInstance.baseURL}
      </div>
      <pre style={{ 
        backgroundColor: '#1f2937', 
        color: '#f9fafb', 
        padding: '10px', 
        borderRadius: '4px',
        fontSize: '12px',
        overflowX: 'auto'
      }}>
        {details}
      </pre>
      <button 
        onClick={testConnection}
        style={{
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        🔄 Test Again
      </button>
    </div>
  );
};

// Export singleton instance
export const studyPlannerAPI = new StudyPlannerAPI();

export default StudyPlannerAPI;