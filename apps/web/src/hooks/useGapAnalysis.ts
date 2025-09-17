'use client';

import {
  AssessmentGap,
  GapAnalysisRequest,
  GapAnalysisResponse,
  DomainName,
  GapResolutionRequest,
  GapResolutionResponse
} from '@/types';
import { useState, useEffect, useCallback } from 'react';

interface UseGapAnalysisResult {
  gaps: AssessmentGap[];
  isAnalyzing: boolean;
  isLoading: boolean;
  completenessScore: number;
  criticalGapsCount: number;
  totalGapsCount: number;
  error: string | null;

  // Actions
  triggerRealTimeAnalysis: (domain?: DomainName) => Promise<void>;
  loadGaps: () => Promise<void>;
  resolveGap: (gapId: string, response: string) => Promise<void>;
  skipGap: (gapId: string) => Promise<void>;
  markGapAsReviewed: (gapId: string) => void;
  clearErrors: () => void;
}

interface GapAnalysisCache {
  [assessmentId: string]: {
    gaps: AssessmentGap[];
    completenessScore: number;
    lastUpdated: number;
    reviewedGaps: Set<string>;
  };
}

// Simple in-memory cache for gap analysis results
const gapAnalysisCache: GapAnalysisCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useGapAnalysis = (assessmentId: string): UseGapAnalysisResult => {
  const [gaps, setGaps] = useState<AssessmentGap[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [completenessScore, setCompletenessScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reviewedGaps, setReviewedGaps] = useState<Set<string>>(new Set());

  // API base URL
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod';

  // Load gaps from cache or API
  const loadGaps = useCallback(async () => {
    if (!assessmentId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = gapAnalysisCache[assessmentId];
      const now = Date.now();

      if (cached && (now - cached.lastUpdated) < CACHE_DURATION) {
        setGaps(cached.gaps);
        setCompletenessScore(cached.completenessScore);
        setReviewedGaps(cached.reviewedGaps);
        setIsLoading(false);
        return;
      }

      // Fetch from API
      const response = await fetch(`${apiBaseUrl}/assessments/${assessmentId}/gaps`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load gaps: ${response.statusText}`);
      }

      const data = await response.json();
      const fetchedGaps = data.gaps || [];

      setGaps(fetchedGaps);
      setCompletenessScore(data.summary?.overallCompletenessScore || 0);

      // Update cache
      gapAnalysisCache[assessmentId] = {
        gaps: fetchedGaps,
        completenessScore: data.summary?.overallCompletenessScore || 0,
        lastUpdated: now,
        reviewedGaps
      };

    } catch (err) {
      console.error('Error loading gaps:', err);
      setError(err instanceof Error ? err.message : 'Failed to load gaps');
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId, apiBaseUrl, reviewedGaps]);

  // Trigger real-time gap analysis
  const triggerRealTimeAnalysis = useCallback(async (domain?: DomainName) => {
    if (!assessmentId) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const analysisRequest: GapAnalysisRequest = {
        assessmentId,
        analysisDepth: 'quick', // Fast analysis for real-time
        forceReanalysis: true,
        ...(domain && { focusDomains: [domain] })
      };

      const response = await fetch(`${apiBaseUrl}/assessments/${assessmentId}/gaps/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisRequest),
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze gaps: ${response.statusText}`);
      }

      const analysisResult: GapAnalysisResponse = await response.json();

      // Update state with new analysis
      setGaps(analysisResult.gapAnalysis.detectedGaps);
      setCompletenessScore(analysisResult.gapAnalysis.overallCompletenessScore);

      // Update cache
      const now = Date.now();
      gapAnalysisCache[assessmentId] = {
        gaps: analysisResult.gapAnalysis.detectedGaps,
        completenessScore: analysisResult.gapAnalysis.overallCompletenessScore,
        lastUpdated: now,
        reviewedGaps
      };

      console.log(`Real-time gap analysis completed: ${analysisResult.gapAnalysis.totalGapsCount} gaps detected`);

    } catch (err) {
      console.error('Error during real-time analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze gaps');
    } finally {
      setIsAnalyzing(false);
    }
  }, [assessmentId, apiBaseUrl, reviewedGaps]);

  // Resolve a gap with client response
  const resolveGap = useCallback(async (gapId: string, response: string) => {
    if (!response.trim()) {
      setError('Response cannot be empty');
      return;
    }

    try {
      const resolutionRequest: GapResolutionRequest = {
        gapId,
        clientResponse: response
      };

      const apiResponse = await fetch(`${apiBaseUrl}/gaps/${gapId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resolutionRequest),
      });

      if (!apiResponse.ok) {
        throw new Error(`Failed to resolve gap: ${apiResponse.statusText}`);
      }

      const result: GapResolutionResponse = await apiResponse.json();

      if (result.resolved) {
        // Remove resolved gap from state
        setGaps(prevGaps => prevGaps.filter(gap => gap.gapId !== gapId));

        // Add any new gaps that were created
        if (result.newGaps && result.newGaps.length > 0) {
          setGaps(prevGaps => [...prevGaps, ...result.newGaps!]);
        }

        // Update completeness score
        if (result.impactOnCompleteness > 0) {
          setCompletenessScore(prev => Math.min(100, prev + result.impactOnCompleteness));
        }

        // Clear cache to force refresh
        delete gapAnalysisCache[assessmentId];

        console.log(`Gap ${gapId} resolved successfully`);
      }

    } catch (err) {
      console.error('Error resolving gap:', err);
      setError(err instanceof Error ? err.message : 'Failed to resolve gap');
    }
  }, [assessmentId, apiBaseUrl]);

  // Skip a gap
  const skipGap = useCallback(async (gapId: string) => {
    try {
      const resolutionRequest: GapResolutionRequest = {
        gapId,
        clientResponse: '',
        skipGap: true
      };

      const apiResponse = await fetch(`${apiBaseUrl}/gaps/${gapId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resolutionRequest),
      });

      if (!apiResponse.ok) {
        throw new Error(`Failed to skip gap: ${apiResponse.statusText}`);
      }

      const result: GapResolutionResponse = await apiResponse.json();

      if (result.resolved) {
        // Remove skipped gap from state
        setGaps(prevGaps => prevGaps.filter(gap => gap.gapId !== gapId));

        // Clear cache to force refresh
        delete gapAnalysisCache[assessmentId];

        console.log(`Gap ${gapId} skipped successfully`);
      }

    } catch (err) {
      console.error('Error skipping gap:', err);
      setError(err instanceof Error ? err.message : 'Failed to skip gap');
    }
  }, [assessmentId, apiBaseUrl]);

  // Mark gap as reviewed (local state only)
  const markGapAsReviewed = useCallback((gapId: string) => {
    setReviewedGaps(prev => {
      const newSet = new Set(prev);
      newSet.add(gapId);

      // Update cache
      if (gapAnalysisCache[assessmentId]) {
        gapAnalysisCache[assessmentId].reviewedGaps = newSet;
      }

      return newSet;
    });
  }, [assessmentId]);

  // Clear errors
  const clearErrors = useCallback(() => {
    setError(null);
  }, []);

  // Auto-load gaps on mount
  useEffect(() => {
    if (assessmentId) {
      loadGaps();
    }
  }, [assessmentId, loadGaps]);

  // Filter out reviewed gaps from display
  const visibleGaps = gaps.filter(gap => !reviewedGaps.has(gap.gapId));

  return {
    gaps: visibleGaps,
    isAnalyzing,
    isLoading,
    completenessScore,
    criticalGapsCount: visibleGaps.filter(gap => gap.category === 'critical').length,
    totalGapsCount: visibleGaps.length,
    error,

    // Actions
    triggerRealTimeAnalysis,
    loadGaps,
    resolveGap,
    skipGap,
    markGapAsReviewed,
    clearErrors
  };
};

// Utility hook for triggering analysis on form changes
export const useRealTimeGapDetection = (
  assessmentId: string,
  domain: DomainName,
  debounceMs: number = 2000
) => {
  const { triggerRealTimeAnalysis } = useGapAnalysis(assessmentId);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const triggerAnalysis = useCallback(() => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timeout for debounced analysis
    const newTimeoutId = setTimeout(() => {
      triggerRealTimeAnalysis(domain);
    }, debounceMs);

    setTimeoutId(newTimeoutId);
  }, [triggerRealTimeAnalysis, domain, debounceMs, timeoutId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return { triggerAnalysis };
};