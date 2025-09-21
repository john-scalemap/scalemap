import { renderHook, act, waitFor } from '@testing-library/react';
import { useProgressTracking } from '../../hooks/useProgressTracking';
import { Assessment } from '../../types/assessment';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = jest.fn();

// Mock timers
jest.useFakeTimers();

const mockAssessment: Assessment = {
  id: 'test-assessment-1',
  companyId: 'test-company-1',
  companyName: 'Test Company',
  contactEmail: 'test@example.com',
  title: 'Test Assessment',
  description: 'A test assessment',
  status: 'document-processing',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  domainResponses: {},
  deliverySchedule: {
    executive24h: '2024-01-02T00:00:00Z',
    detailed48h: '2024-01-03T00:00:00Z',
    implementation72h: '2024-01-04T00:00:00Z'
  },
  clarificationPolicy: {
    allowClarificationUntil: '2024-01-03T00:00:00Z',
    maxClarificationRequests: 3,
    maxTimelineExtension: 24
  }
};

describe('useProgressTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    localStorageMock.getItem.mockReturnValue('mock-token');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: false // Disable auto-start for this test
      })
    );

    expect(result.current.assessment).toBeNull();
    expect(result.current.isPolling).toBe(false);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.retryCount).toBe(0);
  });

  it('should fetch assessment successfully', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          assessment: mockAssessment
        }
      })
    } as Response);

    const { result } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: false
      })
    );

    await act(async () => {
      await result.current.forceRefresh();
    });

    await waitFor(() => {
      expect(result.current.assessment).toEqual(mockAssessment);
      expect(result.current.isConnected).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle fetch errors', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);

    const { result } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: false
      })
    );

    await act(async () => {
      await result.current.forceRefresh();
    });

    await waitFor(() => {
      expect(result.current.assessment).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toContain('Failed to fetch assessment');
      expect(result.current.retryCount).toBe(1);
    });
  });

  it('should handle authentication errors', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    } as Response);

    const { result } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: false
      })
    );

    await act(async () => {
      await result.current.forceRefresh();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Authentication expired');
    });
  });

  it('should call onStatusChange when status changes', async () => {
    const onStatusChange = jest.fn();
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

    // First call returns processing status
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          assessment: { ...mockAssessment, status: 'document-processing' }
        }
      })
    } as Response);

    const { result, rerender } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: false,
        onStatusChange
      })
    );

    await act(async () => {
      await result.current.forceRefresh();
    });

    // Second call returns completed status
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          assessment: { ...mockAssessment, status: 'completed' }
        }
      })
    } as Response);

    await act(async () => {
      await result.current.forceRefresh();
    });

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('completed');
    });
  });

  it('should call onComplete when assessment is completed', async () => {
    const onComplete = jest.fn();
    const completedAssessment = { ...mockAssessment, status: 'completed' as const };

    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          assessment: completedAssessment
        }
      })
    } as Response);

    const { result } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: false,
        onComplete
      })
    );

    await act(async () => {
      await result.current.forceRefresh();
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(completedAssessment);
    });
  });

  it('should handle retry logic with exponential backoff', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

    // First attempt fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);

    const { result } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: false,
        maxRetries: 2
      })
    );

    await act(async () => {
      await result.current.forceRefresh();
    });

    await waitFor(() => {
      expect(result.current.retryCount).toBe(1);
      expect(result.current.canRetry).toBe(true);
    });

    // Mock successful retry
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          assessment: mockAssessment
        }
      })
    } as Response);

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.retryCount).toBe(0);
      expect(result.current.assessment).toEqual(mockAssessment);
    });
  });

  it('should stop polling when max retries reached', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

    // All attempts fail
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);

    const { result } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: false,
        maxRetries: 2
      })
    );

    // First attempt
    await act(async () => {
      await result.current.forceRefresh();
    });

    // Second attempt (should happen automatically via timeout)
    await act(async () => {
      jest.advanceTimersByTime(1000); // 1 second delay for first retry
    });

    // Third attempt
    await act(async () => {
      jest.advanceTimersByTime(2000); // 2 second delay for second retry
    });

    await waitFor(() => {
      expect(result.current.retryCount).toBe(2);
      expect(result.current.canRetry).toBe(false);
    });
  });

  it('should start and stop polling', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          assessment: mockAssessment
        }
      })
    } as Response);

    const { result } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: false,
        pollingInterval: 1000
      })
    );

    // Start polling
    act(() => {
      result.current.startPolling();
    });

    expect(result.current.isPolling).toBe(true);

    // Advance time to trigger poll
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + one poll

    // Stop polling
    act(() => {
      result.current.stopPolling();
    });

    expect(result.current.isPolling).toBe(false);

    // Advance time - should not trigger more polls
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2); // No additional calls
  });

  it('should stop polling for final states', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

    // Return completed assessment
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          assessment: { ...mockAssessment, status: 'completed' }
        }
      })
    } as Response);

    const { result } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: false
      })
    );

    await act(async () => {
      result.current.startPolling();
    });

    // Should stop polling after receiving completed status
    await waitFor(() => {
      expect(result.current.isPolling).toBe(false);
    });
  });

  it('should handle page visibility changes', () => {
    const { result } = renderHook(() =>
      useProgressTracking({
        assessmentId: 'test-assessment-1',
        enabled: true
      })
    );

    // Mock document.hidden
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: true
    });

    // Trigger visibility change
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isPolling).toBe(false);

    // Show page again
    Object.defineProperty(document, 'hidden', {
      value: false
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isPolling).toBe(true);
  });
});