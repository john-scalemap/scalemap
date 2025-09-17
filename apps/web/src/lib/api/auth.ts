import { ApiResponse } from '@scalemap/shared/types/api';
import { User, UserProfile } from '@scalemap/shared/types/user';

import apiClient from './client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  gdprConsent: boolean;
}

export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return apiClient.post<LoginResponse>('/auth/login', credentials);
  }

  async register(userData: RegisterRequest): Promise<ApiResponse<LoginResponse>> {
    return apiClient.post<LoginResponse>('/auth/register', userData);
  }

  async logout(): Promise<ApiResponse<void>> {
    const result = await apiClient.post<void>('/auth/logout');
    apiClient.clearAuthToken();
    return result;
  }

  async refreshToken(request: TokenRefreshRequest): Promise<ApiResponse<TokenRefreshResponse>> {
    return apiClient.post<TokenRefreshResponse>('/auth/refresh', request);
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/auth/me');
  }

  async verifyEmail(token: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/verify-email', { token });
  }

  async requestPasswordReset(email: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/request-password-reset', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/reset-password', { token, newPassword });
  }

  async updateProfile(profileData: Partial<UserProfile>): Promise<ApiResponse<User>> {
    return apiClient.put<User>('/user/profile', profileData);
  }

  async updateCompanyProfile(companyData: Partial<User['company']>): Promise<ApiResponse<User['company']>> {
    return apiClient.put<User['company']>('/user/company', companyData);
  }
}

export const authService = new AuthService();