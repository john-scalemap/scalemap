import { useCallback, useEffect, useRef, useState } from 'react';

import { progressService, type AssessmentProgress, type ProgressStats } from '@/lib/api';
import { useAssessmentStore } from '@/stores/assessment-store';
import { DomainName } from '@/types';

interface UseProgressTrackingReturn {
  progress: AssessmentProgress | null;
  stats: ProgressStats | null;
  isTracking: boolean;
  error: string | null;

  // Progress tracking actions
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  trackQuestionResponse: (domainId: string, questionId: string) => Promise<void>;
  trackDomainCompletion: (domainId: string, completionPercentage: number) => Promise<void>;
  refreshProgress: () => Promise<void>;

  // Session state
  sessionStartTime: Date | null;
  sessionDuration: number; // in seconds
  currentQuestionStartTime: Date | null;
}

export const useProgressTracking = (assessmentId?: string): UseProgressTrackingReturn => {
  const [progress, setProgress] = useState<AssessmentProgress | null>(null);
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState<Date | null>(null);

  const sessionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<Date | null>(null);

  const { currentAssessment, workflowState } = useAssessmentStore();
  const activeAssessmentId = assessmentId || currentAssessment?.id;

  // Update session duration every second
  useEffect(() => {
    if (sessionStartTime && isTracking) {
      sessionIntervalRef.current = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
        setSessionDuration(duration);

        // Send heartbeat every 30 seconds
        if (!lastHeartbeatRef.current ||
            (now.getTime() - lastHeartbeatRef.current.getTime()) > 30000) {
          sendHeartbeat();
        }
      }, 1000);

      return () => {
        if (sessionIntervalRef.current) {
          clearInterval(sessionIntervalRef.current);
        }
      };
    }
  }, [sessionStartTime, isTracking]);

  // Clean up session tracking on unmount
  useEffect(() => {
    return () => {
      if (isTracking && sessionStartTime) {
        endSession();
      }
    };
  }, []);

  // Auto-start session when assessment loads
  useEffect(() => {
    if (activeAssessmentId && !isTracking) {
      startSession();
    }
  }, [activeAssessmentId]);

  const sendHeartbeat = useCallback(async () => {
    if (!activeAssessmentId || !sessionStartTime) return;

    try {
      await progressService.updateProgress({
        assessmentId: activeAssessmentId,
        completionPercentage: 0,
        timeSpent: Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000),
        metadata: {
          action: 'heartbeat',
          timestamp: new Date().toISOString(),
          currentDomain: workflowState.currentDomain,
        },
      });
      lastHeartbeatRef.current = new Date();
    } catch (err) {
      console.warn('Failed to send progress heartbeat:', err);
    }
  }, [activeAssessmentId, sessionStartTime, workflowState.currentDomain]);

  const startSession = useCallback(async () => {
    if (!activeAssessmentId || isTracking) return;

    try {
      setError(null);
      const now = new Date();

      await progressService.trackSessionStart(activeAssessmentId);

      setSessionStartTime(now);
      setSessionDuration(0);
      setIsTracking(true);
      lastHeartbeatRef.current = now;

      // Load initial progress data
      await refreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session tracking');
      console.error('Failed to start session tracking:', err);
    }
  }, [activeAssessmentId, isTracking]);

  const endSession = useCallback(async () => {
    if (!activeAssessmentId || !isTracking || !sessionStartTime) return;

    try {
      const totalSessionTime = Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000);

      await progressService.trackSessionEnd(activeAssessmentId, totalSessionTime);

      setIsTracking(false);
      setSessionStartTime(null);
      setSessionDuration(0);
      setCurrentQuestionStartTime(null);

      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
        sessionIntervalRef.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session tracking');
      console.error('Failed to end session tracking:', err);
    }
  }, [activeAssessmentId, isTracking, sessionStartTime]);

  const trackQuestionResponse = useCallback(async (domainId: string, questionId: string) => {
    if (!activeAssessmentId || !isTracking) return;

    try {
      setError(null);
      const now = new Date();
      const timeSpent = currentQuestionStartTime
        ? Math.floor((now.getTime() - currentQuestionStartTime.getTime()) / 1000)
        : 0;

      await progressService.trackQuestionResponse(
        activeAssessmentId,
        domainId,
        questionId,
        timeSpent
      );

      // Reset question timer for next question
      setCurrentQuestionStartTime(now);

      // Refresh progress data
      await refreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to track question response');
      console.error('Failed to track question response:', err);
    }
  }, [activeAssessmentId, isTracking, currentQuestionStartTime]);

  const trackDomainCompletion = useCallback(async (
    domainId: string,
    completionPercentage: number
  ) => {
    if (!activeAssessmentId || !isTracking) return;

    try {
      setError(null);

      await progressService.trackDomainCompletion(
        activeAssessmentId,
        domainId,
        completionPercentage
      );

      // Refresh progress data
      await refreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to track domain completion');
      console.error('Failed to track domain completion:', err);
    }
  }, [activeAssessmentId, isTracking]);

  const refreshProgress = useCallback(async () => {
    if (!activeAssessmentId) return;

    try {
      setError(null);

      const [progressResponse, statsResponse] = await Promise.all([
        progressService.getAssessmentProgress(activeAssessmentId),
        progressService.getProgressStats(activeAssessmentId),
      ]);

      if (progressResponse.success) {
        setProgress(progressResponse.data!);
      }

      if (statsResponse.success) {
        setStats(statsResponse.data!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh progress data');
      console.error('Failed to refresh progress data:', err);
    }
  }, [activeAssessmentId]);

  // Track when user starts answering a new question
  useEffect(() => {
    if (isTracking && workflowState.currentQuestion !== currentQuestionStartTime) {
      setCurrentQuestionStartTime(new Date());
    }
  }, [workflowState.currentQuestion, isTracking]);

  return {
    progress,
    stats,
    isTracking,
    error,
    startSession,
    endSession,
    trackQuestionResponse,
    trackDomainCompletion,
    refreshProgress,
    sessionStartTime,
    sessionDuration,
    currentQuestionStartTime,
  };
};