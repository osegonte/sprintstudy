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
      // First, get the raw response text
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);
      
      // Try to parse as JSON
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        return { 
          success: false, 
          error: `Invalid JSON response: ${responseText}` 
        };
      }
      
      if (!response.ok) {
        console.error('Request failed with status:', response.status, data);
        
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // Don't redirect immediately, let the auth context handle it
        }
        
        return { 
          success: false, 
          error: data.error || data.message || `Request failed with status ${response.status}` 
        };
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Network or parsing error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Authentication with enhanced debugging
  async login(email: string, password: string) {
    console.log('🔐 Attempting login for:', email);
    console.log('🔗 API URL:', `${API_BASE_URL}/api/auth/login`);
    
    const requestBody = { email, password };
    console.log('📤 Request body:', requestBody);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 Response received:', response);
      
      const result = await this.handleResponse(response);
      
      if (result.success && result.data) {
        console.log('✅ Login successful, storing token');
        localStorage.setItem('token', result.data.session.access_token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
      } else {
        console.error('❌ Login failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('🚨 Login request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network request failed'
      };
    }
  }

  async signup(email: string, password: string, username: string) {
    console.log('📝 Attempting signup for:', email);
    
    const requestBody = { email, password, username };
    console.log('📤 Signup request body:', requestBody);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });
      
      const result = await this.handleResponse(response);
      
      if (result.success && result.data) {
        console.log('✅ Signup successful, storing token');
        localStorage.setItem('token', result.data.session.access_token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
      } else {
        console.error('❌ Signup failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('🚨 Signup request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network request failed'
      };
    }
  }

  async logout() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      
      const result = await this.handleResponse(response);
      
      // Always clear local storage, even if the request fails
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      return result;
    } catch (error) {
      // Clear local storage even on network error
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout request failed'
      };
    }
  }

  // Documents
  async uploadDocument(file: File, title?: string) {
    const formData = new FormData();
    formData.append('pdf', file);
    if (title) formData.append('title', title);

    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
        body: formData
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async getDocuments() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`, {
        headers: this.getAuthHeaders()
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch documents'
      };
    }
  }

  async deleteDocument(id: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document'
      };
    }
  }

  // Analytics
  async getDashboardData() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/dashboard`, {
        headers: this.getAuthHeaders()
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard data'
      };
    }
  }

  // Sprints
  async generateSprint(documentId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sprints/generate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ document_id: documentId })
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate sprint'
      };
    }
  }

  async getTodaySprint() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sprints/today`, {
        headers: this.getAuthHeaders()
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch sprint'
      };
    }
  }

  async createSprint(data: any) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sprints`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sprint'
      };
    }
  }

  // Progress
  async recordPageProgress(documentId: string, pageNumber: number, timeSpent: number) {
    try {
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record progress'
      };
    }
  }

  async getSpeedFeedback(currentPageTime: number, documentId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/progress/feedback`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          current_page_time: currentPageTime,
          document_id: documentId
        })
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get feedback'
      };
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }
}

export const api = new ApiService();