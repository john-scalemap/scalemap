import { TokenManager } from './auth/token-manager';

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod';

// Generic API response interface
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Helper function to make authenticated API calls
async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const accessToken = TokenManager.getAccessToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: {
          code: errorData.error?.code || 'API_ERROR',
          message: errorData.error?.message || `API call failed with status ${response.status}`,
        },
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
}

// Assessment Service
export const assessmentService = {
  async createAssessment(data: {
    title: string;
    description: string;
    companyName: string;
    contactEmail: string;
    companyId?: string;
  }): Promise<ApiResponse> {
    return apiCall('/assessment/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getAssessments(params?: { status?: string[] }): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();
    if (params?.status) {
      queryParams.append('status', params.status.join(','));
    }

    return apiCall(`/assessment/list${queryParams.toString() ? `?${queryParams}` : ''}`);
  },

  async getAssessment(id: string): Promise<ApiResponse> {
    return apiCall(`/assessment/${id}`);
  },
};

// Auth Service
export const authService = {
  async login(data: { email: string; password: string }): Promise<ApiResponse> {
    return apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
    gdprConsent: boolean;
  }): Promise<ApiResponse> {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        user: {
          email: data.email,
          password: data.password,
          confirmPassword: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          gdprConsent: data.gdprConsent,
        },
        company: {
          name: data.companyName,
          industry: {
            sector: 'technology',
            subSector: 'saas',
            regulatoryClassification: 'lightly-regulated',
          },
          businessModel: 'b2b-saas',
          size: 'small',
        },
      }),
    });
  },

  async logout(): Promise<ApiResponse> {
    return apiCall('/auth/logout', {
      method: 'POST',
    });
  },

  async getCurrentUser(): Promise<ApiResponse> {
    return apiCall('/auth/user');
  },

  async updateProfile(data: any): Promise<ApiResponse> {
    return apiCall('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateCompanyProfile(data: any): Promise<ApiResponse> {
    return apiCall('/auth/company', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async refreshToken(data: { refreshToken: string }): Promise<ApiResponse> {
    return apiCall('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};