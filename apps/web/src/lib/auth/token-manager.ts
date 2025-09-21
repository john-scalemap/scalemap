// Simple token expiration check
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope: string[];
}

/**
 * Centralized token management to eliminate circular dependencies
 * and provide single source of truth for token storage
 */
export class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'scalemap_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'scalemap_refresh_token';
  private static readonly EXPIRES_AT_KEY = 'scalemap_token_expires_at';

  private static storage: Storage | null = null;

  /**
   * Initialize storage - checks both sessionStorage and localStorage
   * Priority: sessionStorage (for live site) -> localStorage (for development)
   */
  private static getStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!this.storage) {
      // Check sessionStorage first (live site uses this)
      if (sessionStorage.getItem(this.ACCESS_TOKEN_KEY)) {
        this.storage = sessionStorage;
      } else {
        // Fallback to localStorage (development)
        this.storage = localStorage;
      }
    }

    return this.storage;
  }

  /**
   * Store authentication tokens securely
   */
  static setTokens(tokens: AuthTokens): void {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken);
      storage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken);

      // Calculate absolute expiration time
      const expiresAt = Date.now() + tokens.expiresIn * 1000;
      storage.setItem(this.EXPIRES_AT_KEY, expiresAt.toString());
    } catch (error) {
      console.error('Failed to store tokens:', error);
    }
  }

  /**
   * Get current access token
   */
  static getAccessToken(): string | null {
    if (typeof window === 'undefined') {
      console.log('TokenManager: SSR environment, no window object');
      return null;
    }

    try {
      console.log('🔍 TokenManager: Searching for access token...');

      // Check sessionStorage first (live site format)
      let token = sessionStorage.getItem('accessToken');
      if (token) {
        console.log('✅ TokenManager: Found access token in sessionStorage', {
          length: token.length,
          prefix: token.substring(0, 20) + '...',
        });
        return token;
      }

      // Check localStorage (development format)
      token = localStorage.getItem('accessToken');
      if (token) {
        console.log('✅ TokenManager: Found access token in localStorage', {
          length: token.length,
          prefix: token.substring(0, 20) + '...',
        });
        return token;
      }

      // Fallback: Check with our custom key (backwards compatibility)
      token = localStorage.getItem(this.ACCESS_TOKEN_KEY);
      if (token) {
        console.log('✅ TokenManager: Found access token with custom key', {
          length: token.length,
          prefix: token.substring(0, 20) + '...',
        });
        return token;
      }

      // Debug: Show what's actually in storage
      console.log('❌ TokenManager: No access token found. Storage contents:', {
        sessionStorageKeys: Object.keys(sessionStorage),
        localStorageKeys: Object.keys(localStorage),
      });
      return null;
    } catch (error) {
      console.error('💥 TokenManager: Failed to retrieve access token:', error);
      return null;
    }
  }

  /**
   * Get current refresh token
   */
  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      // Check sessionStorage first (live site format)
      let token = sessionStorage.getItem('refreshToken');
      if (token) {
        console.log('TokenManager: Found refresh token in sessionStorage');
        return token;
      }

      // Check localStorage (development format)
      token = localStorage.getItem('refreshToken');
      if (token) {
        console.log('TokenManager: Found refresh token in localStorage');
        return token;
      }

      // Fallback: Check with our custom key (backwards compatibility)
      token = localStorage.getItem(this.REFRESH_TOKEN_KEY);
      if (token) {
        console.log('TokenManager: Found refresh token with custom key');
        return token;
      }

      console.log('TokenManager: No refresh token found in any storage');
      return null;
    } catch (error) {
      console.error('Failed to retrieve refresh token:', error);
      return null;
    }
  }

  /**
   * Get valid access token with automatic refresh if needed
   */
  static async getValidAccessToken(): Promise<string | null> {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      return null;
    }

    // Check if token is expired
    if (isTokenExpired(accessToken)) {
      const refreshed = await this.refreshAccessToken();
      return refreshed ? this.getAccessToken() : null;
    }

    return accessToken;
  }

  /**
   * Check if tokens are expired
   */
  static isTokenExpired(): boolean {
    const accessToken = this.getAccessToken();
    if (!accessToken) return true;

    return isTokenExpired(accessToken);
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.clearTokens();
      return false;
    }

    try {
      // Import auth service dynamically to avoid circular dependency
      const { authService } = await import('@/lib/api');

      const response = await authService.refreshToken({ refreshToken });

      if (!response.success) {
        this.clearTokens();
        return false;
      }

      const data = response.data;
      if (!data) {
        this.clearTokens();
        return false;
      }

      const newTokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        tokenType: 'Bearer',
        scope: [],
      };

      this.setTokens(newTokens);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      return false;
    }
  }

  /**
   * Clear all stored tokens
   */
  static clearTokens(): void {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.removeItem(this.ACCESS_TOKEN_KEY);
      storage.removeItem(this.REFRESH_TOKEN_KEY);
      storage.removeItem(this.EXPIRES_AT_KEY);
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }

  /**
   * Get tokens in the format expected by auth store
   */
  static getTokens(): AuthTokens | null {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();

    if (!accessToken || !refreshToken) {
      return null;
    }

    const storage = this.getStorage();
    let expiresIn = 900; // Default 15 minutes

    if (storage) {
      const expiresAtStr = storage.getItem(this.EXPIRES_AT_KEY);
      if (expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        const now = Date.now();
        expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000));
      }
    }

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      scope: [],
    };
  }

  /**
   * Check if user is authenticated (has valid tokens)
   */
  static isAuthenticated(): boolean {
    const tokens = this.getTokens();
    return tokens !== null && !this.isTokenExpired();
  }
}
