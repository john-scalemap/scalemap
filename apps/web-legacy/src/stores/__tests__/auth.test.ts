import { authService } from '@/lib/api';

import { useAuthStore } from '../auth';

// Mock the auth service
jest.mock('@/lib/api', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    refreshToken: jest.fn(),
    getCurrentUser: jest.fn(),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

// Mock localStorage
const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockStorage });
Object.defineProperty(window, 'sessionStorage', { value: mockStorage });

describe('Auth Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  describe('authenticateWithCredentials', () => {
    it('should authenticate user successfully', async () => {
      const mockLoginResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            emailVerified: true,
          },
          tokens: {
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-123',
            expiresIn: 3600,
          },
        },
      };

      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      const store = useAuthStore.getState();
      await store.authenticateWithCredentials('test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('test@example.com');
      expect(state.tokens?.accessToken).toBe('access-token-123');
      expect(state.loading).toBe(false);
    });

    it('should handle authentication errors', async () => {
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      };

      mockAuthService.login.mockResolvedValue(mockErrorResponse);

      const store = useAuthStore.getState();

      await expect(
        store.authenticateWithCredentials('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid email or password');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
    });
  });

  describe('registerUser', () => {
    it('should register user successfully', async () => {
      const mockRegisterResponse = {
        success: true,
        data: {
          user: {
            id: 'user-456',
            email: 'newuser@example.com',
            firstName: 'New',
            lastName: 'User',
            emailVerified: false,
          },
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
          },
        },
      };

      mockAuthService.register.mockResolvedValue(mockRegisterResponse);

      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        companyName: 'Test Company',
        gdprConsent: true,
      };

      const store = useAuthStore.getState();
      await store.registerUser(userData);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('newuser@example.com');
      expect(state.tokens?.accessToken).toBe('new-access-token');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      // Set up initial state with tokens
      const initialTokens = {
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
        tokenType: 'Bearer' as const,
        scope: [],
      };

      useAuthStore.getState().updateTokens(initialTokens);

      const mockRefreshResponse = {
        success: true,
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
        },
      };

      mockAuthService.refreshToken.mockResolvedValue(mockRefreshResponse);

      const store = useAuthStore.getState();
      const result = await store.refreshTokens();

      expect(result).toBe(true);
      const state = useAuthStore.getState();
      expect(state.tokens?.accessToken).toBe('new-access-token');
      expect(state.tokens?.refreshToken).toBe('new-refresh-token');
    });

    it('should handle refresh token failure', async () => {
      const initialTokens = {
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
        tokenType: 'Bearer' as const,
        scope: [],
      };

      useAuthStore.getState().updateTokens(initialTokens);

      const mockRefreshResponse = {
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token expired',
        },
      };

      mockAuthService.refreshToken.mockResolvedValue(mockRefreshResponse);

      const store = useAuthStore.getState();
      const result = await store.refreshTokens();

      expect(result).toBe(false);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.tokens).toBeNull();
    });
  });

  describe('logout', () => {
    it('should logout user and clear state', async () => {
      // Set up authenticated state
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
      };

      const tokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
        tokenType: 'Bearer' as const,
        scope: [],
      };

      useAuthStore.getState().login(user, tokens);

      mockAuthService.logout.mockResolvedValue({ success: true });

      const store = useAuthStore.getState();
      await store.logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(mockStorage.removeItem).toHaveBeenCalledWith('accessToken');
      expect(mockStorage.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(mockStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });
});