'use client';

import { Company } from '@scalemap/shared/types/company';
import { User } from '@scalemap/shared/types/user';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';

// Company service - simplified for this fix

// Simple JWT decode utilities
const decodeJwtPayload = (token: string) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

const JwtUtils = {
  getUserEmail: (token: string) => decodeJwtPayload(token)?.email,
  getUserId: (token: string) => decodeJwtPayload(token)?.sub,
  getCompanyId: (token: string) => decodeJwtPayload(token)?.companyId,
  safeDecode: (token: string) => decodeJwtPayload(token),
};
import { TokenManager } from './token-manager';

// Helper function to read user from both storage types (only in browser)
function getStoredUser(): string | null {
  if (typeof window === 'undefined') return null; // SSR protection
  try {
    const fromSession = sessionStorage.getItem('user');
    if (fromSession) return fromSession;
    // Fallback to localStorage when Remember Me was used
    return localStorage.getItem('user');
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: User | null;
  company: Company | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  console.log('🚀 AuthProvider: Component initializing');

  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log('🚀 AuthProvider: State initialized', {
    isLoading,
    hasUser: !!user,
    hasCompany: !!company,
  });

  const loadUserAndCompanyData = useCallback(async () => {
    console.log('AuthContext: loadUserAndCompanyData called');
    try {
      setIsLoading(true);
      setError(null);

      const accessToken = TokenManager.getAccessToken();
      console.log('AuthContext: Loading user data, token present:', !!accessToken);

      // Only log storage keys in browser environment
      if (typeof window !== 'undefined') {
        console.log('AuthContext: sessionStorage keys:', Object.keys(sessionStorage || {}));
        console.log('AuthContext: localStorage keys:', Object.keys(localStorage || {}));
      }

      if (!accessToken) {
        console.log('AuthContext: No access token found');
        setUser(null);
        setCompany(null);
        return;
      }

      // Try to get user data from both sessionStorage and localStorage
      const storedUserData = getStoredUser();
      console.log(
        'AuthContext: Stored user data from storage:',
        !!storedUserData,
        storedUserData?.substring(0, 50) + '...'
      );

      // If we have stored user data, parse and use it immediately
      if (storedUserData) {
        try {
          const userData = JSON.parse(storedUserData);
          console.log('✅ AuthContext: Setting user from storage:', userData.email);
          setUser(userData);

          // Also set a basic company object if user has companyId
          if (userData.companyId) {
            setCompany({
              id: userData.companyId,
              name: 'Your Company', // Placeholder until we load real data
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('❌ AuthContext: Failed to parse stored user data:', error);
        }
      }

      let user: User | null = null;

      if (storedUserData) {
        try {
          const parsedUser = JSON.parse(storedUserData);

          // Create user object from stored data
          user = {
            id: parsedUser.id || parsedUser.sub || JwtUtils.getUserId(accessToken),
            cognitoUserId: parsedUser.cognitoUserId || parsedUser.id || parsedUser.sub,
            email: parsedUser.email || JwtUtils.getUserEmail(accessToken),
            emailVerified: parsedUser.emailVerified ?? true,
            firstName: parsedUser.firstName || '',
            lastName: parsedUser.lastName || '',
            companyId: parsedUser.companyId || JwtUtils.getCompanyId(accessToken),
            role: parsedUser.role || ('user' as const),
            status: parsedUser.status || ('active' as const),
            lastLoginAt: parsedUser.lastLoginAt || new Date().toISOString(),
            gdprConsent: parsedUser.gdprConsent || {
              consentGiven: true,
              consentDate: new Date().toISOString(),
              consentVersion: '1.0',
              ipAddress: '',
              userAgent: '',
              dataProcessingPurposes: ['authentication', 'service_provision'],
            },
            createdAt: parsedUser.createdAt || new Date().toISOString(),
            updatedAt: parsedUser.updatedAt || new Date().toISOString(),
          };

          console.log('AuthContext: Created user from storage:', user);
        } catch (parseError) {
          console.warn('Failed to parse stored user data, will try JWT fallback');
          user = null;
        }
      }

      // If user is still null or missing key fields, try JWT-derived fallback
      if (!user || !user.companyId) {
        const payload = JwtUtils.safeDecode(accessToken);
        if (payload?.email) {
          user = {
            id: payload.sub || JwtUtils.getUserId(accessToken),
            cognitoUserId: payload.sub || JwtUtils.getUserId(accessToken),
            email: payload.email,
            emailVerified: true,
            firstName: '',
            lastName: '',
            companyId: payload.companyId || JwtUtils.getCompanyId(accessToken),
            role: 'user' as const,
            status: 'active' as const,
            lastLoginAt: new Date().toISOString(),
            gdprConsent: {
              consentGiven: true,
              consentDate: new Date().toISOString(),
              consentVersion: '1.0',
              ipAddress: '',
              userAgent: '',
              dataProcessingPurposes: ['authentication', 'service_provision'],
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          console.log('AuthContext: Created user from JWT fallback:', user);
        }
      }

      if (user) {
        setUser(user);

        // Create company from user data or fallback
        const fallbackCompany: Company = {
          id: user.companyId || 'unknown',
          name: 'Your Company',
          industry: '',
          businessModel: 'other',
          size: '1-10',
          description: '',
          website: '',
          headquarters: '',
          subscription: {
            plan: 'basic',
            status: 'active',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            features: ['basic_assessment'],
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        console.log('AuthContext: Created company from user data:', fallbackCompany);
        setCompany(fallbackCompany);
        return;
      }

      // Fallback: Extract user data from JWT
      const userEmail = JwtUtils.getUserEmail(accessToken);
      const companyId = JwtUtils.getCompanyId(accessToken);
      const userId = JwtUtils.getUserId(accessToken);

      console.log('AuthContext: Extracted from JWT:', { userEmail, companyId, userId });

      if (!userEmail || !companyId || !userId) {
        console.error('AuthContext: Invalid JWT data:', { userEmail, companyId, userId });
        throw new Error('Invalid authentication token');
      }

      // Create user object from JWT data
      // Note: This is minimal user data from JWT. In a full implementation,
      // you might want to fetch full user details from a user API
      const userData: User = {
        id: userId,
        cognitoUserId: userId, // Assuming JWT sub is the Cognito user ID
        email: userEmail,
        emailVerified: true, // TODO: Extract from JWT if available
        firstName: '', // TODO: Extract from JWT if available or fetch from user API
        lastName: '', // TODO: Extract from JWT if available or fetch from user API
        companyId,
        role: 'user' as const, // TODO: Extract from JWT if available
        status: 'active' as const,
        lastLoginAt: new Date().toISOString(),
        gdprConsent: {
          consentGiven: true, // Assume true for existing users
          consentDate: new Date().toISOString(),
          consentVersion: '1.0',
          ipAddress: '',
          userAgent: '',
          dataProcessingPurposes: ['authentication', 'service_provision'],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setUser(userData);

      // Create fallback company data for now
      const fallbackCompany: Company = {
        id: companyId,
        name: 'Test Company',
        industry: '',
        businessModel: 'other',
        size: '1-10',
        description: '',
        website: '',
        headquarters: '',
        subscription: {
          plan: 'basic',
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          features: ['basic_assessment'],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCompany(fallbackCompany);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load authentication data';
      setError(errorMessage);
      console.error('AuthContext: Error loading user data:', err);
      setUser(null);
      setCompany(null);
    } finally {
      console.log('AuthContext: loadUserAndCompanyData finished, setting isLoading to false');
      setIsLoading(false);
    }
  }, []); // Empty dependency array since this function should be stable

  const refreshData = async () => {
    await loadUserAndCompanyData();
  };

  // CRITICAL FIX: Only run authentication loading on client side (not during SSR)
  useEffect(() => {
    console.log('🚀 AuthProvider: Client-side auth loading');
    loadUserAndCompanyData().catch((error) => {
      console.error('🚨 AuthProvider: Client auth load failed:', error);
      setIsLoading(false);
    });
  }, []);

  // CRITICAL FIX: Listen for storage changes (from login/logout) and reload auth data
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      // Reload auth data when access token changes (login/logout)
      if (e.key === 'accessToken' || e.key === 'user') {
        console.log('🔄 AuthProvider: Storage changed, reloading auth data');
        loadUserAndCompanyData().catch((error) => {
          console.error('🚨 AuthProvider: Storage change reload failed:', error);
        });
      }
    };

    // Listen for storage events from other tabs/windows
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadUserAndCompanyData]);

  // CRITICAL FIX: Also check for auth data periodically in case storage events are missed
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkAuthPeriodically = () => {
      const hasToken = TokenManager.getAccessToken();

      // If we have a token but no user data, try to reload
      if (hasToken && !user && !isLoading) {
        console.log('🔄 AuthProvider: Found token but missing user data, reloading...');
        loadUserAndCompanyData().catch((error) => {
          console.error('🚨 AuthProvider: Periodic reload failed:', error);
        });
      }
    };

    // Check every 2 seconds for the first 10 seconds after mount
    // This handles the case where login redirect happens faster than auth context reload
    const intervals = [];
    for (let i = 1; i <= 5; i++) {
      intervals.push(setTimeout(checkAuthPeriodically, i * 2000));
    }

    return () => {
      intervals.forEach(clearTimeout);
    };
  }, [user, isLoading, loadUserAndCompanyData]);

  // Use user data to determine authentication (with token validation)
  const [hasValidToken, setHasValidToken] = useState(false);

  // Check token validity on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = TokenManager.getAccessToken();
      setHasValidToken(!!token);
    }
  }, [user]); // Re-check when user data changes

  const isAuthenticated = !!user && hasValidToken && !isLoading;

  // Debug authentication state
  React.useEffect(() => {
    console.log('🔄 AuthContext state update:', {
      hasValidToken,
      hasUser: !!user,
      hasCompany: !!company,
      isLoading,
      isAuthenticated,
      userEmail: user?.email,
      companyName: company?.name,
    });
  }, [user, company, isLoading, isAuthenticated]);

  const value: AuthContextValue = {
    user,
    company,
    isLoading,
    isAuthenticated,
    error,
    refreshData,
  };

  console.log('🚀 AuthProvider: Rendering with value:', {
    hasUser: !!user,
    hasCompany: !!company,
    isLoading,
    isAuthenticated,
    error,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.error(
      '🚨 useAuth called outside AuthProvider! This will cause authentication to fail.'
    );

    // Return a safe fallback instead of throwing
    return {
      user: null,
      company: null,
      isLoading: false,
      isAuthenticated: false,
      error: 'AuthProvider not found - please ensure this component is wrapped in AuthProvider',
      refreshData: async () => {
        console.warn('refreshData called but AuthProvider not available');
      },
    };
  }
  return context;
}

// Convenience hooks for specific data
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

export function useCompany(): Company | null {
  const { company } = useAuth();
  return company;
}

// Helper functions for backward compatibility with existing code
export const getUserFromAuth = (): { email: string; id: string } => {
  const accessToken = TokenManager.getAccessToken();
  if (!accessToken) throw new Error('No authentication token');

  const userEmail = JwtUtils.getUserEmail(accessToken);
  const userId = JwtUtils.getUserId(accessToken);

  if (!userEmail || !userId) {
    throw new Error('Invalid authentication token');
  }

  return {
    email: userEmail,
    id: userId,
  };
};

export const getCompanyFromAuth = (): { id: string; name?: string } => {
  const accessToken = TokenManager.getAccessToken();
  if (!accessToken) throw new Error('No authentication token');

  const companyId = JwtUtils.getCompanyId(accessToken);

  if (!companyId) {
    throw new Error('Invalid authentication token');
  }

  return {
    id: companyId,
    // Note: Company name is not in JWT, so we return undefined
    // The calling code should use the useCompany hook for full company data
    name: undefined,
  };
};
