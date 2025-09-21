import Cookies from 'js-cookie';
import type { AuthTokens, User, TokenManager, StoredSession } from '@/types/auth';

class TokenManagerImpl implements TokenManager {
  private static instance: TokenManagerImpl;
  private accessToken: string | null = null;
  private tokenExpiration: number | null = null;

  // Storage keys
  private readonly ACCESS_TOKEN_KEY = 'scalemap_access_token';
  private readonly REFRESH_TOKEN_KEY = 'scalemap_refresh_token';
  private readonly SESSION_KEY = 'scalemap_session';
  private readonly DEVICE_ID_KEY = 'scalemap_device_id';

  // Token refresh settings
  private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry

  private constructor() {
    // Only initialize from storage on the client side
    if (typeof window !== 'undefined') {
      this.initializeFromStorage();
    }
  }

  static getInstance(): TokenManagerImpl {
    if (!TokenManagerImpl.instance) {
      TokenManagerImpl.instance = new TokenManagerImpl();
    }
    return TokenManagerImpl.instance;
  }

  private initializeFromStorage(): void {
    // Only run on client side
    if (typeof window === 'undefined') return;

    try {
      // Get access token from memory first, fallback to sessionStorage
      this.accessToken = sessionStorage.getItem(this.ACCESS_TOKEN_KEY);

      if (this.accessToken) {
        const expiration = this.getTokenExpiration(this.accessToken);
        this.tokenExpiration = expiration;
      }
    } catch (error) {
      console.warn('Failed to initialize tokens from storage:', error);
      this.clearTokens();
    }
  }

  getAccessToken(): string | null {
    // Always check if token is expired before returning
    if (this.isTokenExpired()) {
      return null;
    }
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    // Only access localStorage on client side
    if (typeof window === 'undefined') return null;

    try {
      // Refresh token stored in secure httpOnly cookie (handled by backend)
      // For client-side, we can also store in localStorage as backup
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to get refresh token:', error);
      return null;
    }
  }

  setTokens(tokens: AuthTokens, sessionId: string, user: User): void {
    // Only set tokens on client side
    if (typeof window === 'undefined') return;

    try {
      // Store access token in memory and sessionStorage (shorter-lived)
      this.accessToken = tokens.accessToken;
      this.tokenExpiration = Date.now() + (tokens.expiresIn * 1000);

      sessionStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken);

      // Store refresh token in localStorage (longer-lived)
      localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken);

      // Store session data
      const sessionData: StoredSession = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: this.tokenExpiration,
        sessionId,
        deviceId: this.getOrCreateDeviceId(),
        user,
      };

      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));

      // Set secure cookie for refresh token (if possible)
      this.setRefreshTokenCookie(tokens.refreshToken);

    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  clearTokens(): void {
    try {
      // Clear memory
      this.accessToken = null;
      this.tokenExpiration = null;

      // Only clear storage on client side
      if (typeof window !== 'undefined') {
        // Clear storage
        sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
        localStorage.removeItem(this.SESSION_KEY);

        // Clear refresh token cookie
        Cookies.remove(this.REFRESH_TOKEN_KEY);
      }

    } catch (error) {
      console.warn('Failed to clear tokens:', error);
    }
  }

  isTokenExpired(token?: string): boolean {
    const tokenToCheck = token || this.accessToken;
    if (!tokenToCheck) return true;

    try {
      const expiration = this.getTokenExpiration(tokenToCheck);
      if (!expiration) return true;

      // Add a small buffer (30 seconds) to account for network delays
      return Date.now() >= (expiration - 30000);
    } catch (error) {
      console.warn('Failed to check token expiration:', error);
      return true;
    }
  }

  getTokenExpiration(token?: string): number | null {
    const tokenToCheck = token || this.accessToken;
    if (!tokenToCheck) return null;

    try {
      // JWT tokens have 3 parts separated by dots
      const parts = tokenToCheck.split('.');
      if (parts.length !== 3) return null;

      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1]));

      // Return expiration time in milliseconds
      return payload.exp ? payload.exp * 1000 : null;
    } catch (error) {
      console.warn('Failed to decode token:', error);
      return null;
    }
  }

  shouldRefreshToken(): boolean {
    if (!this.accessToken || !this.tokenExpiration) return false;

    // Refresh if token expires within the threshold
    return Date.now() >= (this.tokenExpiration - this.REFRESH_THRESHOLD_MS);
  }

  getStoredSession(): StoredSession | null {
    // Only access localStorage on client side
    if (typeof window === 'undefined') return null;

    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return null;

      return JSON.parse(sessionData);
    } catch (error) {
      console.warn('Failed to get stored session:', error);
      return null;
    }
  }

  getDeviceId(): string {
    return this.getOrCreateDeviceId();
  }

  private getOrCreateDeviceId(): string {
    // Only access localStorage on client side
    if (typeof window === 'undefined') return this.generateDeviceId();

    try {
      let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);

      if (!deviceId) {
        // Generate a unique device ID
        deviceId = this.generateDeviceId();
        localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
      }

      return deviceId;
    } catch (error) {
      console.warn('Failed to get/create device ID:', error);
      return this.generateDeviceId();
    }
  }

  private generateDeviceId(): string {
    // Generate a unique device ID based on browser characteristics
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);

    // Only use navigator if available (client-side)
    if (typeof window !== 'undefined' && navigator) {
      const navigator_info = `${navigator.userAgent}_${navigator.language}`;
      const hash = btoa(navigator_info).substring(0, 8);
      return `${timestamp}-${random}-${hash}`;
    }

    return `${timestamp}-${random}-server`;
  }

  private setRefreshTokenCookie(refreshToken: string): void {
    try {
      // Set secure cookie for refresh token (7 days)
      Cookies.set(this.REFRESH_TOKEN_KEY, refreshToken, {
        expires: 7, // 7 days
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict',
        httpOnly: false, // Note: client-side cookies can't be httpOnly
      });
    } catch (error) {
      console.warn('Failed to set refresh token cookie:', error);
    }
  }

  // Utility method to get user info from stored session
  getStoredUser(): User | null {
    const session = this.getStoredSession();
    return session?.user || null;
  }

  // Utility method to get session ID
  getSessionId(): string | null {
    const session = this.getStoredSession();
    return session?.sessionId || null;
  }

  // Method to validate token format
  isValidTokenFormat(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      // Try to decode the header and payload
      JSON.parse(atob(parts[0]));
      JSON.parse(atob(parts[1]));

      return true;
    } catch (error) {
      return false;
    }
  }

  // Get device information for session tracking
  getDeviceInfo() {
    // Only access browser APIs on client side
    if (typeof window === 'undefined') {
      return {
        userAgent: 'server',
        deviceId: this.getDeviceId(),
        platform: 'server',
        browser: 'server',
        language: 'en-US',
        screenResolution: '0x0',
        timezone: 'UTC',
      };
    }

    return {
      userAgent: navigator.userAgent,
      deviceId: this.getDeviceId(),
      platform: navigator.platform,
      browser: this.getBrowserName(),
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  private getBrowserName(): string {
    // Only access navigator on client side
    if (typeof window === 'undefined' || !navigator) return 'server';

    const agent = navigator.userAgent;
    if (agent.includes('Chrome')) return 'Chrome';
    if (agent.includes('Firefox')) return 'Firefox';
    if (agent.includes('Safari')) return 'Safari';
    if (agent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }
}

// Export singleton instance
export const tokenManager = TokenManagerImpl.getInstance();
export type { TokenManager };