'use client';

import { Company } from '@scalemap/shared/types/company';
import { User } from '@scalemap/shared/types/user';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

import { companyService } from '../api/company';

import { JwtUtils } from './jwt-utils';
import { TokenManager } from './token-manager';

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
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserAndCompanyData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const accessToken = TokenManager.getAccessToken();
      if (!accessToken) {
        setUser(null);
        setCompany(null);
        return;
      }

      // Extract user data from JWT
      const userEmail = JwtUtils.getUserEmail(accessToken);
      const companyId = JwtUtils.getCompanyId(accessToken);
      const userId = JwtUtils.getUserId(accessToken);

      if (!userEmail || !companyId || !userId) {
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

      // Fetch company data from API
      try {
        const companyResponse = await companyService.getCompany(companyId);
        if (companyResponse.success && companyResponse.data) {
          setCompany(companyResponse.data);
        } else {
          console.error('Company API call failed:', companyResponse.error);
          // Fallback: Create minimal company data from JWT
          const fallbackCompany: Company = {
            id: companyId,
            name: 'Company', // Basic fallback name
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
          console.warn('Using fallback company data due to API failure');
        }
      } catch (companyError) {
        console.error('Company API request failed:', companyError);
        // Create fallback company data to allow assessment creation
        const fallbackCompany: Company = {
          id: companyId,
          name: 'Company',
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
        console.warn('Using fallback company data due to API network error');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load authentication data';
      setError(errorMessage);
      console.error('Auth context error:', err);
      setUser(null);
      setCompany(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    await loadUserAndCompanyData();
  };

  useEffect(() => {
    loadUserAndCompanyData();
  }, []);

  const isAuthenticated = !!user && !!company && !isLoading;

  const value: AuthContextValue = {
    user,
    company,
    isLoading,
    isAuthenticated,
    error,
    refreshData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
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
