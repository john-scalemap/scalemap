import { apiClient } from '@/lib/api/client';
import { tokenManager } from '@/lib/auth/token-manager';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenResponse,
  User,
  AuthTokens,
  AuthError
} from '@/types/auth';

class AuthService {
  private static instance: AuthService;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Authenticate user with email and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      // Debug: Log the API URL being used
      console.log('Login API URL:', process.env.NEXT_PUBLIC_API_URL);
      console.log('Attempting login for:', credentials.email);

      const response = await apiClient.post<LoginResponse>('/auth/login', credentials, {
        skipAuth: true, // No auth needed for login
      });

      if (!response.success || !response.data) {
        throw new Error('Invalid login response');
      }

      const loginData = response.data;

      // Store tokens and session data
      tokenManager.setTokens(
        loginData.tokens,
        loginData.sessionId,
        loginData.user
      );

      return loginData;
    } catch (error) {
      console.error('Login failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Register new user and company
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response = await apiClient.post<RegisterResponse>('/auth/register', data, {
        skipAuth: true, // No auth needed for registration
      });

      if (!response.success || !response.data) {
        throw new Error('Invalid registration response');
      }

      return response.data;
    } catch (error) {
      console.error('Registration failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<AuthTokens | null> {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh', {
        refreshToken,
      }, {
        skipAuth: true, // Skip auth for refresh
        skipRetry: true, // Don't retry refresh requests
      });

      if (!response.success || !response.data) {
        throw new Error('Invalid refresh response');
      }

      const tokens = response.data;
      const user = tokenManager.getStoredUser();
      const sessionId = tokenManager.getSessionId();

      if (user && sessionId) {
        const authTokens: AuthTokens = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
        };

        tokenManager.setTokens(authTokens, sessionId, user);
        return authTokens;
      }

      return null;
    } catch (error) {
      console.warn('Token refresh failed:', error);
      // Clear tokens if refresh fails
      tokenManager.clearTokens();
      return null;
    }
  }

  /**
   * Logout user and clear session
   */
  async logout(): Promise<void> {
    try {
      // Attempt to notify backend of logout
      const sessionId = tokenManager.getSessionId();
      if (sessionId) {
        await apiClient.post('/auth/logout', { sessionId }).catch(() => {
          // Ignore logout API errors - clear local state anyway
        });
      }
    } finally {
      // Always clear local tokens and session data
      tokenManager.clearTokens();
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<boolean> {
    try {
      const response = await apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
        skipAuth: true,
      });

      return response.success;
    } catch (error) {
      console.error('Email verification failed:', error);
      return false;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      const response = await apiClient.post('/auth/forgot-password', { email }, {
        skipAuth: true,
      });

      return response.success;
    } catch (error) {
      console.error('Password reset request failed:', error);
      return false;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const response = await apiClient.post('/auth/reset-password', {
        token,
        password: newPassword,
      }, {
        skipAuth: true,
      });

      return response.success;
    } catch (error) {
      console.error('Password reset failed:', error);
      return false;
    }
  }

  /**
   * Get current user from stored session
   */
  getCurrentUser(): User | null {
    return tokenManager.getStoredUser();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const accessToken = tokenManager.getAccessToken();
    const user = tokenManager.getStoredUser();
    return !!(accessToken && user);
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    return user.permissions.includes(permission);
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    return user.role === role;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return tokenManager.getSessionId();
  }

  /**
   * Initialize authentication state from storage
   */
  async initializeAuth(): Promise<User | null> {
    try {
      const storedUser = tokenManager.getStoredUser();
      const accessToken = tokenManager.getAccessToken();

      if (!storedUser || !accessToken) {
        return null;
      }

      // Check if token needs refresh
      if (tokenManager.shouldRefreshToken()) {
        const refreshedTokens = await this.refreshToken();
        if (!refreshedTokens) {
          return null;
        }
      }

      return storedUser;
    } catch (error) {
      console.warn('Failed to initialize auth:', error);
      tokenManager.clearTokens();
      return null;
    }
  }

  /**
   * Check authentication status periodically
   */
  startAuthenticationMonitor(): void {
    // Check every 60 seconds for token refresh needs
    setInterval(() => {
      if (this.isAuthenticated() && tokenManager.shouldRefreshToken()) {
        this.refreshToken().catch(() => {
          // Refresh failed - user will need to login again
          console.warn('Background token refresh failed');
        });
      }
    }, 60000); // 60 seconds

    // Check for token expiration every 30 seconds
    setInterval(() => {
      const accessToken = tokenManager.getAccessToken();
      if (!accessToken && tokenManager.getStoredUser()) {
        // Token expired but user session still exists - clear everything
        tokenManager.clearTokens();
        // Could dispatch logout event here
      }
    }, 30000); // 30 seconds
  }

  /**
   * Get device information for session tracking
   */
  getDeviceInfo() {
    return tokenManager.getDeviceInfo();
  }

  /**
   * Handle rate limiting awareness
   */
  private async handleRateLimit(error: AuthError): Promise<void> {
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      // Extract retry-after from error details if available
      const retryAfter = error.details?.retryAfter as number;
      const waitTime = retryAfter ? retryAfter * 1000 : 15 * 60 * 1000; // Default 15 minutes

      console.warn(`Rate limited. Waiting ${waitTime / 1000} seconds before next attempt.`);

      // Could implement exponential backoff here
      // or show user-friendly rate limit message
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: unknown): AuthError {
    if (error && typeof error === 'object' && 'code' in error) {
      const authError = error as AuthError;

      // Handle rate limiting
      if (authError.code === 'RATE_LIMIT_EXCEEDED') {
        this.handleRateLimit(authError);
      }

      return authError;
    }

    // Default error handling
    if (error instanceof Error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  /**
   * Validate session integrity
   */
  validateSession(): boolean {
    const session = tokenManager.getStoredSession();
    if (!session) return false;

    // Check if session data is consistent
    const hasValidTokens = session.accessToken && session.refreshToken;
    const hasValidUser = session.user && session.user.id;
    const hasValidExpiration = session.expiresAt > Date.now();

    return !!(hasValidTokens && hasValidUser && hasValidExpiration);
  }

  /**
   * Clear authentication state (for testing or manual cleanup)
   */
  clearAuthState(): void {
    tokenManager.clearTokens();
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
export type { AuthService };