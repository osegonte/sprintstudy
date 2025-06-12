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
