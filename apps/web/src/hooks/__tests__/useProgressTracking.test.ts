import { renderHook, act } from '@testing-library/react';

import { progressService } from '@/lib/api';
import { useAssessmentStore } from '@/stores/assessment-store';

import { useProgressTracking } from '../useProgressTracking';

// Mock the progress service
jest.mock('@/lib/api', () => ({
  progressService: {
    trackSessionStart: jest.fn(),
    trackSessionEnd: jest.fn(),
    trackQuestionResponse: jest.fn(),
    trackDomainCompletion: jest.fn(),
    getAssessmentProgress: jest.fn(),
    getProgressStats: jest.fn(),
    updateProgress: jest.fn(),
  },
}));

// Mock the assessment store
jest.mock('@/stores/assessment-store', () => ({
  useAssessmentStore: jest.fn(),
}));

const mockProgressService = progressService as jest.Mocked<typeof progressService>;
const mockUseAssessmentStore = useAssessmentStore as jest.MockedFunction<typeof useAssessmentStore>;

describe('useProgressTracking', () => {
  const mockStoreState = {
    currentAssessment: {
      id: 'test-assessment-id',
      title: 'Test Assessment',
    },
    workflowState: {
      currentDomain: 'strategic-alignment',
      currentQuestion: 'q1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseAssessmentStore.mockReturnValue(mockStoreState as any);

    // Mock successful API responses
    mockProgressService.trackSessionStart.mockResolvedValue({ success: true });
    mockProgressService.trackSessionEnd.mockResolvedValue({ success: true });
    mockProgressService.trackQuestionResponse.mockResolvedValue({ success: true });
    mockProgressService.trackDomainCompletion.mockResolvedValue({ success: true });
    mockProgressService.getAssessmentProgress.mockResolvedValue({
      success: true,
      data: {
        assessmentId: 'test-assessment-id',
        overallProgress: 25,
        domains: [],
        stats: {
          totalTimeSpent: 300,
          averageCompletionTime: 180,
          questionsCompleted: 5,
          totalQuestions: 20,
          domainsCompleted: 1,
          totalDomains: 4,
          lastActivity: '2024-01-01T12:00:00Z',
          estimatedTimeRemaining: '15-20 minutes',
        },
        currentState: {
          sessionStartTime: '2024-01-01T12:00:00Z',
          sessionTimeSpent: 300,
        },
        milestones: {
          started: '2024-01-01T12:00:00Z',
        },
      },
    });
    mockProgressService.getProgressStats.mockResolvedValue({
      success: true,
      data: {
        totalTimeSpent: 300,
        averageCompletionTime: 180,
        questionsCompleted: 5,
        totalQuestions: 20,
        domainsCompleted: 1,
        totalDomains: 4,
        lastActivity: '2024-01-01T12:00:00Z',
        estimatedTimeRemaining: '15-20 minutes',
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useProgressTracking());

    expect(result.current.progress).toBeNull();
    expect(result.current.stats).toBeNull();
    expect(result.current.isTracking).toBe(false);
    expect(result.current.sessionStartTime).toBeNull();
    expect(result.current.sessionDuration).toBe(0);
  });

  it('should start session automatically when assessment is available', async () => {
    const { result } = renderHook(() => useProgressTracking());

    await act(async () => {
      // Trigger useEffect by advancing timers
      jest.advanceTimersByTime(100);
    });

    expect(mockProgressService.trackSessionStart).toHaveBeenCalledWith('test-assessment-id');
    expect(result.current.isTracking).toBe(true);
    expect(result.current.sessionStartTime).not.toBeNull();
  });

  it('should track question responses', async () => {
    const { result } = renderHook(() => useProgressTracking());

    // Start session first
    await act(async () => {
      await result.current.startSession();
    });

    // Track question response
    await act(async () => {
      await result.current.trackQuestionResponse('strategic-alignment', 'q1');
    });

    expect(mockProgressService.trackQuestionResponse).toHaveBeenCalledWith(
      'test-assessment-id',
      'strategic-alignment',
      'q1',
      expect.any(Number)
    );
  });

  it('should track domain completion', async () => {
    const { result } = renderHook(() => useProgressTracking());

    await act(async () => {
      await result.current.startSession();
    });

    await act(async () => {
      await result.current.trackDomainCompletion('strategic-alignment', 100);
    });

    expect(mockProgressService.trackDomainCompletion).toHaveBeenCalledWith(
      'test-assessment-id',
      'strategic-alignment',
      100
    );
  });

  it('should update session duration over time', async () => {
    const { result } = renderHook(() => useProgressTracking());

    await act(async () => {
      await result.current.startSession();
    });

    // Advance time by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.sessionDuration).toBe(5);

    // Advance time by another 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(result.current.sessionDuration).toBe(15);
  });

  it('should send heartbeat periodically', async () => {
    const { result } = renderHook(() => useProgressTracking());

    await act(async () => {
      await result.current.startSession();
    });

    // Advance time by 30 seconds to trigger heartbeat
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockProgressService.updateProgress).toHaveBeenCalledWith({
      assessmentId: 'test-assessment-id',
      completionPercentage: 0,
      timeSpent: 30,
      metadata: {
        action: 'heartbeat',
        timestamp: expect.any(String),
        currentDomain: 'strategic-alignment',
      },
    });
  });

  it('should end session and clean up', async () => {
    const { result } = renderHook(() => useProgressTracking());

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.isTracking).toBe(true);

    await act(async () => {
      await result.current.endSession();
    });

    expect(mockProgressService.trackSessionEnd).toHaveBeenCalledWith(
      'test-assessment-id',
      expect.any(Number)
    );
    expect(result.current.isTracking).toBe(false);
    expect(result.current.sessionStartTime).toBeNull();
    expect(result.current.sessionDuration).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    mockProgressService.trackSessionStart.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useProgressTracking());

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.isTracking).toBe(false);
  });

  it('should refresh progress data', async () => {
    const { result } = renderHook(() => useProgressTracking());

    await act(async () => {
      await result.current.refreshProgress();
    });

    expect(mockProgressService.getAssessmentProgress).toHaveBeenCalledWith('test-assessment-id');
    expect(mockProgressService.getProgressStats).toHaveBeenCalledWith('test-assessment-id');
    expect(result.current.progress).not.toBeNull();
    expect(result.current.stats).not.toBeNull();
  });
});