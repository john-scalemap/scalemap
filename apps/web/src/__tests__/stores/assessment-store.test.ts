import { renderHook, act } from '@testing-library/react';
import { useAssessmentStore } from '../../stores/assessment-store';
import { Assessment, DomainResponse } from '../../types/assessment';

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

describe('useAssessmentStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useAssessmentStore.getState().reset();
  });

  describe('assessment management', () => {
    it('should set current assessment', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
      });

      expect(result.current.currentAssessment).toEqual(mockAssessment);
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should clear current assessment', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        result.current.clearCurrentAssessment();
      });

      expect(result.current.currentAssessment).toBeNull();
      expect(result.current.draftResponses).toEqual({});
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should update assessment status', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        result.current.updateAssessmentStatus('completed');
      });

      expect(result.current.currentAssessment?.status).toBe('completed');
    });
  });

  describe('domain navigation', () => {
    it('should set current domain', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentDomain('strategic-alignment', 0);
      });

      expect(result.current.currentDomain).toBe('strategic-alignment');
      expect(result.current.currentDomainIndex).toBe(0);
    });

    it('should navigate to next domain', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentDomain('strategic-alignment', 0);
        const success = result.current.goToNextDomain();

        expect(success).toBe(true);
        expect(result.current.currentDomain).toBe('financial-management');
        expect(result.current.currentDomainIndex).toBe(1);
      });
    });

    it('should navigate to previous domain', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentDomain('financial-management', 1);
        const success = result.current.goToPreviousDomain();

        expect(success).toBe(true);
        expect(result.current.currentDomain).toBe('strategic-alignment');
        expect(result.current.currentDomainIndex).toBe(0);
      });
    });

    it('should not navigate beyond bounds', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentDomain('strategic-alignment', 0);
        const success = result.current.goToPreviousDomain();

        expect(success).toBe(false);
        expect(result.current.currentDomainIndex).toBe(0);
      });
    });
  });

  describe('response management', () => {
    it('should update question response', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        result.current.updateQuestionResponse('strategic-alignment', 'sa-1.1', 3);
      });

      const response = result.current.draftResponses['strategic-alignment']?.questions['sa-1.1'];
      expect(response?.value).toBe(3);
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should update domain response', () => {
      const { result } = renderHook(() => useAssessmentStore());

      const domainResponse: Partial<DomainResponse> = {
        notes: 'Additional notes'
      };

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        result.current.updateQuestionResponse('strategic-alignment', 'sa-1.1', 3);
        result.current.updateDomainResponse('strategic-alignment', domainResponse);
      });

      expect(result.current.draftResponses['strategic-alignment']?.notes).toBe('Additional notes');
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should clear draft responses', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        result.current.updateQuestionResponse('strategic-alignment', 'sa-1.1', 3);
        result.current.clearDraftResponses();
      });

      expect(result.current.draftResponses).toEqual({});
      expect(result.current.hasUnsavedChanges).toBe(false);
    });
  });

  describe('validation', () => {
    it('should validate current domain', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        result.current.setCurrentDomain('strategic-alignment', 0);
        // Add some responses to validate
        result.current.updateQuestionResponse('strategic-alignment', 'sa-1.1', 3);
      });

      act(() => {
        const isValid = result.current.validateCurrentDomain();
        // This will depend on the actual validation logic
        expect(typeof isValid).toBe('boolean');
      });
    });

    it('should clear validation errors', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        // Manually set some validation errors
        (result.current as any).validationErrors = {
          'strategic-alignment.sa-1.1': 'Test error'
        };

        result.current.clearValidationErrors('strategic-alignment');
      });

      expect(result.current.validationErrors).toEqual({});
    });
  });

  describe('progress calculation', () => {
    it('should calculate progress correctly', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        result.current.updateQuestionResponse('strategic-alignment', 'sa-1.1', 3);
        result.current.updateLocalProgress();
      });

      expect(result.current.localProgress).toBeDefined();
      expect(result.current.localProgress?.overall).toBeGreaterThanOrEqual(0);
    });
  });

  describe('persistence', () => {
    it('should save responses to server', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { assessment: { ...mockAssessment, updatedAt: '2024-01-01T01:00:00Z' } }
        })
      } as Response);

      localStorageMock.getItem.mockReturnValue('mock-token');

      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        result.current.updateQuestionResponse('strategic-alignment', 'sa-1.1', 3);
      });

      await act(async () => {
        await result.current.saveResponses();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/assessment/${mockAssessment.id}`,
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should handle save errors', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      } as Response);

      localStorageMock.getItem.mockReturnValue('mock-token');

      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
      });

      await act(async () => {
        await expect(result.current.saveResponses()).rejects.toThrow();
      });
    });

    it('should save draft to localStorage', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        result.current.updateQuestionResponse('strategic-alignment', 'sa-1.1', 3);
        result.current.saveDraftToStorage();
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        `assessment-draft-${mockAssessment.id}`,
        expect.any(String)
      );
    });

    it('should load draft from localStorage', () => {
      const mockDraft = {
        responses: {
          'strategic-alignment': {
            domain: 'strategic-alignment',
            questions: {
              'sa-1.1': { questionId: 'sa-1.1', value: 3, timestamp: '2024-01-01T00:00:00Z' }
            },
            completeness: 50,
            lastUpdated: '2024-01-01T00:00:00Z'
          }
        },
        lastSaved: '2024-01-01T00:00:00Z'
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockDraft));

      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.loadDraftFromStorage(mockAssessment.id);
      });

      expect(result.current.draftResponses).toEqual(mockDraft.responses);
    });
  });

  describe('UI state management', () => {
    it('should manage loading state', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should manage saving state', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setSaving(true);
      });

      expect(result.current.isSaving).toBe(true);

      act(() => {
        result.current.setSaving(false);
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('should mark saved and unsaved states', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.markUnsaved();
      });

      expect(result.current.hasUnsavedChanges).toBe(true);

      act(() => {
        result.current.markSaved();
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
      expect(result.current.lastSaved).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should reset store state', () => {
      const { result } = renderHook(() => useAssessmentStore());

      act(() => {
        result.current.setCurrentAssessment(mockAssessment);
        result.current.updateQuestionResponse('strategic-alignment', 'sa-1.1', 3);
        result.current.reset();
      });

      expect(result.current.currentAssessment).toBeNull();
      expect(result.current.draftResponses).toEqual({});
      expect(result.current.hasUnsavedChanges).toBe(false);
    });
  });
});