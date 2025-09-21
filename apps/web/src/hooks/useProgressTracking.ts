'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Assessment, AssessmentStatus } from '../types/assessment';

interface ProgressTrackingState {
  assessment: Assessment | null;
  isPolling: boolean;
  isConnected: boolean;
  lastUpdated: Date | null;
  error: string | null;
  retryCount: number;
}

interface ProgressTrackingOptions {
  assessmentId: string;
  pollingInterval?: number; // milliseconds, default 30000 (30 seconds)
  maxRetries?: number; // default 3
  enabled?: boolean; // default true
  onStatusChange?: (status: AssessmentStatus) => void;
  onError?: (error: string) => void;
  onComplete?: (assessment: Assessment) => void;
}

export const useProgressTracking = ({
  assessmentId,
  pollingInterval = 30000,
  maxRetries = 3,
  enabled = true,
  onStatusChange,
  onError,
  onComplete
}: ProgressTrackingOptions) => {
  const [state, setState] = useState<ProgressTrackingState>({
    assessment: null,
    isPolling: false,
    isConnected: false,
    lastUpdated: null,
    error: null,
    retryCount: 0
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAssessmentStatus = useCallback(async (): Promise<Assessment | null> => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/assessment/${assessmentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired');
        }
        if (response.status === 404) {
          throw new Error('Assessment not found');
        }
        throw new Error(`Failed to fetch assessment: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.assessment;

    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
  }, [assessmentId]);

  const pollAssessment = useCallback(async () => {
    if (!enabled || state.retryCount >= maxRetries) {
      return;
    }

    setState(prev => ({ ...prev, isPolling: true, error: null }));

    try {
      const assessment = await fetchAssessmentStatus();

      if (assessment) {
        const previousStatus = state.assessment?.status;
        const newStatus = assessment.status;

        setState(prev => ({
          ...prev,
          assessment,
          isConnected: true,
          lastUpdated: new Date(),
          error: null,
          retryCount: 0,
          isPolling: false
        }));

        // Trigger status change callback
        if (previousStatus !== newStatus && onStatusChange) {
          onStatusChange(newStatus);
        }

        // Check if assessment is completed
        if (newStatus === 'completed' && onComplete) {
          onComplete(assessment);
        }

        // Stop polling if assessment is in a final state
        if (['completed', 'failed'].includes(newStatus)) {
          stopPolling();
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch progress';

      setState(prev => ({
        ...prev,
        error: errorMessage,
        isConnected: false,
        retryCount: prev.retryCount + 1,
        isPolling: false
      }));

      if (onError) {
        onError(errorMessage);
      }

      // Retry with exponential backoff if under retry limit
      if (state.retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, state.retryCount), 30000); // Max 30 seconds
        retryTimeoutRef.current = setTimeout(() => {
          pollAssessment();
        }, retryDelay);
      }
    }
  }, [enabled, maxRetries, state.retryCount, state.assessment?.status, fetchAssessmentStatus, onStatusChange, onComplete, onError]);

  const startPolling = useCallback(() => {
    if (!enabled || intervalRef.current) {
      return;
    }

    // Initial fetch
    pollAssessment();

    // Set up polling interval
    intervalRef.current = setInterval(pollAssessment, pollingInterval);

    setState(prev => ({ ...prev, isPolling: true }));
  }, [enabled, pollingInterval, pollAssessment]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setState(prev => ({ ...prev, isPolling: false }));
  }, []);

  const retry = useCallback(() => {
    setState(prev => ({ ...prev, retryCount: 0, error: null }));
    pollAssessment();
  }, [pollAssessment]);

  const forceRefresh = useCallback(async () => {
    setState(prev => ({ ...prev, error: null }));
    await pollAssessment();
  }, [pollAssessment]);

  // Auto-start polling when enabled
  useEffect(() => {
    if (enabled && assessmentId) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, assessmentId, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Page visibility handling - pause/resume polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else if (enabled && assessmentId) {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, assessmentId, startPolling, stopPolling]);

  return {
    assessment: state.assessment,
    isPolling: state.isPolling,
    isConnected: state.isConnected,
    lastUpdated: state.lastUpdated,
    error: state.error,
    retryCount: state.retryCount,
    canRetry: state.retryCount < maxRetries,
    startPolling,
    stopPolling,
    retry,
    forceRefresh
  };
};