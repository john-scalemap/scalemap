import type { UserProfile } from '@/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { authService } from '@/lib/api';
import { TokenManager } from '@/lib/auth/token-manager';

interface User extends UserProfile {
  company?: {
    id: string;
    name: string;
    industry?: {
      sector?: string;
      subSector?: string;
      regulatoryClassification?: 'highly-regulated' | 'moderately-regulated' | 'lightly-regulated';
      specificRegulations?: string[];
    };
    businessModel?: string;
    size?: string;
    description?: string;
    website?: string;
    headquarters?: {
      country?: string;
      city?: string;
    };
  };
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope: string[];
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  loading: boolean;

  // Actions
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  updateTokens: (tokens: AuthTokens) => void;
  updateUser: (user: Partial<User>) => void;
  updateProfile: (profileData: Partial<UserProfile>) => Promise<void>;
  updateCompanyProfile: (companyData: Partial<User['company']>) => Promise<void>;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;

  // New authentication actions using API services
  authenticateWithCredentials: (email: string, password: string) => Promise<void>;
  registerUser: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
    gdprConsent: boolean;
  }) => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  getCurrentUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      loading: false,

      login: (user: User, tokens: AuthTokens) => {
        // Store tokens using centralized token manager
        TokenManager.setTokens(tokens);

        set({
          user,
          tokens,
          isAuthenticated: true,
          loading: false
        });
      },

      logout: async () => {
        const { tokens } = get();

        // Call logout endpoint using auth service
        if (tokens?.refreshToken) {
          try {
            await authService.logout();
          } catch (error) {
            console.error('Logout API call failed:', error);
            // Continue with local logout even if API call fails
          }
        }

        // Clear tokens using centralized token manager
        TokenManager.clearTokens();

        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          loading: false
        });
      },

      updateTokens: (tokens: AuthTokens) => {
        // Update tokens using centralized token manager
        TokenManager.setTokens(tokens);

        set(state => ({
          ...state,
          tokens
        }));
      },

      updateUser: (userData: Partial<User>) => {
        set(state => ({
          ...state,
          user: state.user ? { ...state.user, ...userData } : null
        }));
      },

      updateProfile: async (profileData: Partial<UserProfile>) => {
        try {
          const { authService } = await import('@/lib/api');
          const response = await authService.updateProfile(profileData);

          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to update profile');
          }

          // Update user data in store
          set(state => ({
            ...state,
            user: state.user ? { ...state.user, ...response.data } : null
          }));
        } catch (error) {
          console.error('Failed to update profile:', error);
          throw error;
        }
      },

      updateCompanyProfile: async (companyData: Partial<User['company']>) => {
        try {
          const { authService } = await import('@/lib/api');
          const response = await authService.updateCompanyProfile(companyData);

          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to update company profile');
          }

          // Update company data in user store
          set(state => ({
            ...state,
            user: state.user ? { ...state.user, company: response.data } : null
          }));
        } catch (error) {
          console.error('Failed to update company profile:', error);
          throw error;
        }
      },

      setLoading: (loading: boolean) => {
        set(state => ({ ...state, loading }));
      },

      clearAuth: () => {
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          loading: false
        });
      },

      // New authentication actions using API services
      authenticateWithCredentials: async (email: string, password: string) => {
        set({ loading: true });

        try {
          const response = await authService.login({ email, password });

          if (!response.success) {
            throw new Error(response.error?.message || 'Login failed');
          }

          const data = response.data;
          if (!data) {
            throw new Error('No data received from login response');
          }

          const { user, tokens } = data;

          // Convert API response to internal format
          const authTokens: AuthTokens = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: 'Bearer',
            scope: []
          };

          get().login(user as User, authTokens);

        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      registerUser: async (userData: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        companyName: string;
        gdprConsent: boolean;
      }) => {
        set({ loading: true });

        try {
          const response = await authService.register(userData);

          if (!response.success) {
            throw new Error(response.error?.message || 'Registration failed');
          }

          const data = response.data;
          if (!data) {
            throw new Error('No data received from registration response');
          }

          const { user, tokens } = data;

          // Convert API response to internal format
          const authTokens: AuthTokens = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: 'Bearer',
            scope: []
          };

          get().login(user as User, authTokens);

        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      refreshTokens: async (): Promise<boolean> => {
        try {
          const refreshed = await TokenManager.refreshAccessToken();

          if (refreshed) {
            // Update store state with new tokens
            const newTokens = TokenManager.getTokens();
            if (newTokens) {
              set(state => ({
                ...state,
                tokens: newTokens
              }));
            }
          } else {
            // Refresh failed, logout user
            get().logout();
          }

          return refreshed;
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
          return false;
        }
      },

      getCurrentUser: async () => {
        try {
          const response = await authService.getCurrentUser();

          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to get current user');
          }

          get().updateUser(response.data as User);

        } catch (error) {
          console.error('Failed to get current user:', error);
          // Don't logout on this error, just log it
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
        // tokens are handled by TokenManager, not persisted here
      })
    }
  )
);

// Hook for easier usage
export const useAuth = () => {
  return useAuthStore();
};

// Initialize auth state from storage
export const initializeAuth = () => {
  if (typeof window === 'undefined') return;

  const tokens = TokenManager.getTokens();
  if (tokens && TokenManager.isAuthenticated()) {
    const { user } = useAuthStore.getState();
    if (user) {
      useAuthStore.getState().login(user, tokens);
    }
  }
};