import { tokenManager } from '@/lib/auth/token-manager';
import type { AuthError, AuthErrorCode } from '@/types/auth';

// API Response interface matching backend contract
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

// API Client configuration
interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// Request options
interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipRetry?: boolean;
  timeout?: number;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000; // 30 seconds
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000; // 1 second
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      skipAuth = false,
      skipRetry = false,
      timeout = this.timeout,
      ...fetchOptions
    } = options;

    const url = this.buildURL(endpoint);
    const headers = await this.buildHeaders(fetchOptions.headers, skipAuth);

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };

    try {
      const response = await this.executeRequest<T>(url, requestOptions, timeout);

      // Handle 401 Unauthorized - attempt token refresh
      if (response.status === 401 && !skipAuth && !skipRetry) {
        const refreshed = await this.handleTokenRefresh();
        if (refreshed) {
          // Retry the request with new token
          const newHeaders = await this.buildHeaders(fetchOptions.headers, false);
          return await this.request<T>(endpoint, {
            ...options,
            skipRetry: true,
            headers: newHeaders
          });
        }
      }

      return await this.parseResponse<T>(response);
    } catch (error) {
      if (!skipRetry && this.shouldRetry(error)) {
        return await this.retryRequest<T>(endpoint, options);
      }
      throw this.createAuthError('NETWORK_ERROR', 'Network request failed', error);
    }
  }

  // Convenience methods for common HTTP verbs
  async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  private buildURL(endpoint: string): string {
    // Remove leading slash from endpoint if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    // Remove trailing slash from baseURL if present
    const cleanBaseURL = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    return `${cleanBaseURL}/${cleanEndpoint}`;
  }

  private async buildHeaders(
    customHeaders?: HeadersInit,
    skipAuth = false
  ): Promise<Headers> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'User-Agent': this.getUserAgent(),
      ...Object.fromEntries(new Headers(customHeaders)),
    });

    // Add authentication header if not skipped and token is available
    if (!skipAuth) {
      const accessToken = tokenManager.getAccessToken();
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
    }

    // Add device information headers for session tracking
    const deviceInfo = tokenManager.getDeviceInfo();
    headers.set('X-Device-ID', deviceInfo.deviceId);
    headers.set('X-Client-Version', process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0');

    return headers;
  }

  private async executeRequest<T>(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    try {
      if (isJson) {
        const data = await response.json();

        // Handle successful responses
        if (response.ok) {
          return data;
        }

        // Handle error responses with API error format
        if (data.error) {
          throw this.createAuthErrorFromApi(data.error);
        }

        // Fallback error handling
        throw this.createAuthError(
          this.mapHttpStatusToErrorCode(response.status),
          `Request failed: ${response.statusText}`,
          { status: response.status, statusText: response.statusText }
        );
      } else {
        // Non-JSON response
        const text = await response.text();
        throw this.createAuthError(
          this.mapHttpStatusToErrorCode(response.status),
          text || `Request failed: ${response.statusText}`,
          { status: response.status, statusText: response.statusText }
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'SyntaxError') {
        throw this.createAuthError(
          'UNKNOWN_ERROR',
          'Invalid response format',
          error
        );
      }
      throw error;
    }
  }

  private async handleTokenRefresh(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      const result = await this.refreshPromise;
      return result !== null;
    }

    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    this.refreshPromise = this.performTokenRefresh(refreshToken);
    try {
      const newAccessToken = await this.refreshPromise;
      return newAccessToken !== null;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(refreshToken: string): Promise<string | null> {
    try {
      const response = await this.request<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        tokenType: 'Bearer';
        scope: string[];
      }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        skipAuth: true,
        skipRetry: true,
      });

      if (response.success && response.data) {
        const tokens = response.data;
        const user = tokenManager.getStoredUser();
        const sessionId = tokenManager.getSessionId();

        if (user && sessionId) {
          tokenManager.setTokens(
            {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresIn: tokens.expiresIn,
              tokenType: tokens.tokenType,
              scope: tokens.scope,
            },
            sessionId,
            user
          );
          return tokens.accessToken;
        }
      }

      return null;
    } catch (error) {
      console.warn('Token refresh failed:', error);
      // Clear tokens if refresh fails
      tokenManager.clearTokens();
      return null;
    }
  }

  private shouldRetry(error: unknown): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return true;
    }
    return false;
  }

  private async retryRequest<T>(
    endpoint: string,
    options: RequestOptions,
    attempt = 1
  ): Promise<ApiResponse<T>> {
    if (attempt >= this.retryAttempts) {
      throw this.createAuthError(
        'NETWORK_ERROR',
        'Request failed after maximum retry attempts'
      );
    }

    // Exponential backoff with jitter
    const delay = this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    return this.request<T>(endpoint, { ...options, skipRetry: true });
  }

  private createAuthError(
    code: AuthErrorCode,
    message: string,
    details?: unknown
  ): AuthError {
    return {
      code,
      message,
      details: details as Record<string, unknown>,
    };
  }

  private createAuthErrorFromApi(apiError: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }): AuthError {
    return {
      code: this.mapApiErrorCode(apiError.code),
      message: apiError.message,
      details: apiError.details,
    };
  }

  private mapHttpStatusToErrorCode(status: number): AuthErrorCode {
    switch (status) {
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'ACCOUNT_SUSPENDED';
      case 429:
        return 'RATE_LIMIT_EXCEEDED';
      case 422:
        return 'VALIDATION_ERROR';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  private mapApiErrorCode(apiCode: string): AuthErrorCode {
    // Map backend error codes to frontend error codes
    const codeMap: Record<string, AuthErrorCode> = {
      'INVALID_CREDENTIALS': 'INVALID_CREDENTIALS',
      'EMAIL_NOT_VERIFIED': 'EMAIL_NOT_VERIFIED',
      'ACCOUNT_SUSPENDED': 'ACCOUNT_SUSPENDED',
      'TOKEN_EXPIRED': 'TOKEN_EXPIRED',
      'REFRESH_TOKEN_INVALID': 'REFRESH_TOKEN_INVALID',
      'SESSION_EXPIRED': 'SESSION_EXPIRED',
      'RATE_LIMIT_EXCEEDED': 'RATE_LIMIT_EXCEEDED',
      'EMAIL_ALREADY_EXISTS': 'EMAIL_ALREADY_EXISTS',
      'VALIDATION_ERROR': 'VALIDATION_ERROR',
      'PASSWORD_TOO_WEAK': 'PASSWORD_TOO_WEAK',
      'UNAUTHORIZED': 'UNAUTHORIZED',
    };

    return codeMap[apiCode] || 'UNKNOWN_ERROR';
  }

  private getUserAgent(): string {
    const appName = process.env.NEXT_PUBLIC_APP_NAME || 'ScaleMap';
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
    return `${appName}/${appVersion} (Web)`;
  }
}

// Create and export default API client instance
const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
});

export { apiClient, ApiClient };
export type { RequestOptions };