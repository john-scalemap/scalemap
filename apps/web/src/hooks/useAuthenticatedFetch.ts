import { useState, useCallback } from 'react';

import { TokenManager } from '@/lib/auth/token-manager';

interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

interface UseAuthenticatedFetchResult {
  loading: boolean;
  error: string | null;
  fetchWithAuth: <T = any>(url: string, options?: FetchOptions) => Promise<T>;
}

/**
 * Hook for making authenticated API calls
 * Automatically includes the Authorization header from TokenManager
 */
export function useAuthenticatedFetch(): UseAuthenticatedFetchResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWithAuth = useCallback(
    async <T = any>(url: string, options: FetchOptions = {}): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        const token = TokenManager.getAccessToken();

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...options.headers,
        };

        // Add authentication header if token exists
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          console.log('useAuthenticatedFetch: Including auth token in request');
        } else {
          console.warn('useAuthenticatedFetch: No auth token found');
        }

        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Request failed: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        const data = await response.json();
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Request failed';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { loading, error, fetchWithAuth };
}

/**
 * Hook specifically for assessment operations
 */
export function useAssessmentApi() {
  const { loading, error, fetchWithAuth } = useAuthenticatedFetch();

  const createAssessment = useCallback(
    async (data: {
      companyName: string;
      contactEmail: string;
      title: string;
      description: string;
      assessmentContext?: any;
    }) => {
      console.log('CreateAssessment auth check:', {
        authLoading: false,
        isAuthenticated: TokenManager.isAuthenticated(),
        hasUser: !!TokenManager.getAccessToken(),
        hasCompany: !!TokenManager.getAccessToken(),
        userEmail: undefined, // Will be resolved by backend
      });

      return fetchWithAuth('/api/assessments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    [fetchWithAuth]
  );

  const listAssessments = useCallback(async () => {
    return fetchWithAuth('/api/assessments');
  }, [fetchWithAuth]);

  const getAssessment = useCallback(
    async (id: string) => {
      return fetchWithAuth(`/api/assessments/${id}`);
    },
    [fetchWithAuth]
  );

  return {
    loading,
    error,
    createAssessment,
    listAssessments,
    getAssessment,
  };
}
