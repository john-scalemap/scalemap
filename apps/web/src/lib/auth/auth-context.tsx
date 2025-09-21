'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useIsomorphicLayoutEffect } from '@/lib/hooks/useIsomorphicLayoutEffect';
import { authService } from '@/lib/auth/auth-service';
import type {
  AuthContextType,
  AuthState,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
  AuthTokens,
  AuthError
} from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    sessionId: null,
  });

  // Initialize authentication state on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;

    const initializeAuth = async () => {
      try {
        setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

        const user = await authService.initializeAuth();

        if (mounted) {
          if (user) {
            setAuthState({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              sessionId: authService.getSessionId(),
            });
          } else {
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
              sessionId: null,
            });
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        if (mounted) {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Failed to initialize authentication',
            sessionId: null,
          });
        }
      }
    };

    initializeAuth();

    // Start authentication monitor
    authService.startAuthenticationMonitor();

    return () => {
      mounted = false;
    };
  }, []);

  // Login function
  const login = useCallback(async (credentials: LoginRequest): Promise<LoginResponse> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const loginResponse = await authService.login(credentials);

      setAuthState({
        user: loginResponse.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        sessionId: loginResponse.sessionId,
      });

      return loginResponse;
    } catch (error) {
      const authError = error as AuthError;
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: authError.message,
      }));
      throw error;
    }
  }, []);

  // Register function
  const register = useCallback(async (data: RegisterRequest): Promise<RegisterResponse> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const registerResponse = await authService.register(data);

      // Registration successful but user needs to verify email
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
      }));

      return registerResponse;
    } catch (error) {
      const authError = error as AuthError;
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: authError.message,
      }));
      throw error;
    }
  }, []);

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      await authService.logout();

      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        sessionId: null,
      });
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear state anyway
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        sessionId: null,
      });
    }
  }, []);

  // Refresh token function
  const refreshToken = useCallback(async (): Promise<AuthTokens | null> => {
    try {
      const tokens = await authService.refreshToken();

      if (tokens) {
        // Update session ID if it exists
        const sessionId = authService.getSessionId();
        const user = authService.getCurrentUser();

        if (user) {
          setAuthState(prev => ({
            ...prev,
            user,
            isAuthenticated: true,
            sessionId,
            error: null,
          }));
        }
      } else {
        // Refresh failed - logout user
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Session expired',
          sessionId: null,
        });
      }

      return tokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired',
        sessionId: null,
      });
      return null;
    }
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // Permission check function
  const hasPermission = useCallback((permission: string): boolean => {
    return authService.hasPermission(permission);
  }, []);

  // Role check function
  const hasRole = useCallback((role: string): boolean => {
    return authService.hasRole(role);
  }, []);

  // Listen for storage changes (e.g., logout in another tab)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'scalemap_session' && !event.newValue) {
        // Session was cleared in another tab
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          sessionId: null,
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Periodic authentication check
  useEffect(() => {
    const checkAuthStatus = () => {
      const isValid = authService.validateSession();
      if (!isValid && authState.isAuthenticated) {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Session expired',
          sessionId: null,
        });
      }
    };

    // Check every 60 seconds
    const interval = setInterval(checkAuthStatus, 60000);
    return () => clearInterval(interval);
  }, [authState.isAuthenticated]);

  const contextValue: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    refreshToken,
    clearError,
    hasPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protecting routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    requiredPermissions?: string[];
    requiredRole?: string;
    redirectTo?: string;
  }
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, hasPermission, hasRole } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      // Redirect to login page
      if (typeof window !== 'undefined') {
        const redirectUrl = options?.redirectTo || '/login';
        window.location.href = redirectUrl;
      }
      return null;
    }

    // Check permissions if required
    if (options?.requiredPermissions) {
      const hasAllPermissions = options.requiredPermissions.every(permission =>
        hasPermission(permission)
      );
      if (!hasAllPermissions) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
              <p>You don't have permission to access this page.</p>
            </div>
          </div>
        );
      }
    }

    // Check role if required
    if (options?.requiredRole && !hasRole(options.requiredRole)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p>You don't have the required role to access this page.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

// Hook to get authenticated user
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

// Hook to check if user is authenticated
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

// Hook to get auth loading state
export function useAuthLoading(): boolean {
  const { isLoading } = useAuth();
  return isLoading;
}