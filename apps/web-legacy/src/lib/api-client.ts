import { TokenManager } from './auth/token-manager';

/**
 * API client with automatic authentication header injection
 */
export class ApiClient {
  private static baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

  /**
   * Make an authenticated API request
   */
  static async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = TokenManager.getAccessToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authentication header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    console.log('ApiClient: Making request to', url, 'with auth:', !!token);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Make a POST request with authentication
   */
  static async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Make a GET request with authentication
   */
  static async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Make a PUT request with authentication
   */
  static async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Make a DELETE request with authentication
   */
  static async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

/**
 * Assessment API methods
 */
export const assessmentApi = {
  /**
   * Create a new assessment with automatic authentication
   */
  async create(data: {
    companyName: string;
    contactEmail: string;
    title: string;
    description: string;
    assessmentContext?: any;
  }) {
    console.log('CreateAssessment auth check:', {
      authLoading: false,
      isAuthenticated: TokenManager.isAuthenticated(),
      hasUser: !!TokenManager.getAccessToken(),
      hasCompany: !!TokenManager.getAccessToken(),
      userEmail: undefined, // Will be resolved by backend
    });

    return ApiClient.post('/assessments', data);
  },

  /**
   * Get assessments list
   */
  async list() {
    return ApiClient.get('/assessments');
  },

  /**
   * Get specific assessment
   */
  async get(id: string) {
    return ApiClient.get(`/assessments/${id}`);
  },
};