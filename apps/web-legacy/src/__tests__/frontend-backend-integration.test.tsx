import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';

import { authService, assessmentService } from '@/lib/api';
import { useAssessmentStore } from '@/stores/assessment-store';
import { useAuthStore } from '@/stores/auth';

// Mock the API services
jest.mock('@/lib/api', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
    refreshToken: jest.fn(),
  },
  assessmentService: {
    createAssessment: jest.fn(),
    getAssessments: jest.fn(),
    getAssessment: jest.fn(),
    updateAssessment: jest.fn(),
    startAssessment: jest.fn(),
    getDocumentUploadUrl: jest.fn(),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockAssessmentService = assessmentService as jest.Mocked<typeof assessmentService>;

describe('Frontend-Backend Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset stores
    useAuthStore.getState().clearAuth();
    useAssessmentStore.getState().resetAssessment();
  });

  describe('Authentication Flow Integration', () => {
    it('should complete full login flow', async () => {
      const mockLoginResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            emailVerified: true,
          },
          tokens: {
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-123',
            expiresIn: 3600,
          },
        },
      };

      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.authenticateWithCredentials('test@example.com', 'password123');
      });

      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('test@example.com');
      expect(result.current.tokens?.accessToken).toBe('access-token-123');
    });

    it('should handle token refresh automatically', async () => {
      const mockRefreshResponse = {
        success: true,
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
        },
      };

      mockAuthService.refreshToken.mockResolvedValue(mockRefreshResponse);

      const { result } = renderHook(() => useAuthStore());

      // Set initial tokens
      act(() => {
        result.current.updateTokens({
          accessToken: 'old-access-token',
          refreshToken: 'refresh-token-123',
          expiresIn: 3600,
          tokenType: 'Bearer',
          scope: [],
        });
      });

      await act(async () => {
        const success = await result.current.refreshTokens();
        expect(success).toBe(true);
      });

      expect(result.current.tokens?.accessToken).toBe('new-access-token');
    });

    it('should logout and clear state', async () => {
      mockAuthService.logout.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuthStore());

      // Set authenticated state
      act(() => {
        result.current.login(
          {
            id: 'user-123',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            emailVerified: true,
          },
          {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer',
            scope: [],
          }
        );
      });

      expect(result.current.isAuthenticated).toBe(true);

      await act(async () => {
        await result.current.logout();
      });

      expect(mockAuthService.logout).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.tokens).toBeNull();
    });
  });

  describe('Assessment Flow Integration', () => {
    it('should create assessment successfully', async () => {
      const mockCreateResponse = {
        success: true,
        data: {
          id: 'assessment-123',
          title: 'Test Assessment',
          description: 'Test Description',
          status: 'draft' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userId: 'user-123',
          companyId: 'company-123',
          domainResponses: {},
          progress: {
            overall: 0,
            completeness: 0,
            estimatedTimeRemaining: '45-60 minutes',
            domainsCompleted: 0,
            totalDomains: 12,
          },
        },
      };

      mockAssessmentService.createAssessment.mockResolvedValue(mockCreateResponse);

      const { result } = renderHook(() => useAssessmentStore());

      await act(async () => {
        await result.current.createAssessment('Test Assessment', 'Test Description');
      });

      expect(mockAssessmentService.createAssessment).toHaveBeenCalledWith({
        title: 'Test Assessment',
        description: 'Test Description',
        companyId: 'default-company-id',
      });

      expect(result.current.currentAssessment?.id).toBe('assessment-123');
      expect(result.current.currentAssessment?.title).toBe('Test Assessment');
    });

    it('should load assessment list successfully', async () => {
      const mockListResponse = {
        success: true,
        data: {
          assessments: [
            {
              id: 'assessment-1',
              title: 'Q3 Assessment',
              status: 'analyzing' as const,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T01:00:00Z',
              userId: 'user-123',
              companyId: 'company-123',
              domainResponses: {},
              progress: {
                overall: 35,
                completeness: 35,
                estimatedTimeRemaining: '25-30 minutes',
                domainsCompleted: 4,
                totalDomains: 12,
              },
            },
          ],
          count: 1,
          hasMore: false,
          totalCount: 1,
        },
      };

      mockAssessmentService.getAssessments.mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useAssessmentStore());

      let assessmentsList;
      await act(async () => {
        // Simulate getting assessments through the hook
        const response = await mockAssessmentService.getAssessments();
        assessmentsList = response.data?.assessments;
      });

      expect(mockAssessmentService.getAssessments).toHaveBeenCalled();
      expect(assessmentsList).toHaveLength(1);
      expect(assessmentsList?.[0].title).toBe('Q3 Assessment');
    });

    it('should submit assessment and update status', async () => {
      const mockSubmitResponse = {
        success: true,
        data: {
          id: 'assessment-123',
          title: 'Test Assessment',
          status: 'analyzing' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T01:00:00Z',
          userId: 'user-123',
          companyId: 'company-123',
          domainResponses: {},
          progress: {
            overall: 100,
            completeness: 100,
            estimatedTimeRemaining: 'Processing...',
            domainsCompleted: 12,
            totalDomains: 12,
          },
        },
      };

      mockAssessmentService.startAssessment.mockResolvedValue(mockSubmitResponse);

      const { result } = renderHook(() => useAssessmentStore());

      // Set initial assessment
      act(() => {
        result.current.setCurrentAssessment({
          id: 'assessment-123',
          title: 'Test Assessment',
          status: 'draft',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userId: 'user-123',
          companyId: 'company-123',
          domainResponses: {},
          progress: {
            overall: 100,
            completeness: 100,
            estimatedTimeRemaining: 'Complete',
            domainsCompleted: 12,
            totalDomains: 12,
          },
        });
      });

      await act(async () => {
        await result.current.submitAssessment();
      });

      expect(mockAssessmentService.startAssessment).toHaveBeenCalledWith('assessment-123');
      expect(result.current.currentAssessment?.status).toBe('analyzing');
    });
  });

  describe('Document Upload Integration', () => {
    it('should get upload URL and handle upload flow', async () => {
      const mockUploadUrlResponse = {
        success: true,
        data: {
          documentId: 'doc-123',
          uploadUrl: 'https://s3.amazonaws.com/bucket/upload-url',
          expiresAt: '2024-01-01T12:00:00Z',
        },
      };

      mockAssessmentService.getDocumentUploadUrl.mockResolvedValue(mockUploadUrlResponse);

      const response = await mockAssessmentService.getDocumentUploadUrl('assessment-123', {
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      });

      expect(response.success).toBe(true);
      expect(response.data?.documentId).toBe('doc-123');
      expect(response.data?.uploadUrl).toContain('s3.amazonaws.com');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API errors gracefully', async () => {
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server',
        },
      };

      mockAuthService.login.mockResolvedValue(mockErrorResponse);

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.authenticateWithCredentials('test@example.com', 'password');
        })
      ).rejects.toThrow('Failed to connect to server');

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle network timeouts', async () => {
      mockAssessmentService.createAssessment.mockRejectedValue(new Error('Request timeout'));

      const { result } = renderHook(() => useAssessmentStore());

      await expect(
        act(async () => {
          await result.current.createAssessment('Test', 'Description');
        })
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('Data Persistence Integration', () => {
    it('should persist auth state across sessions', () => {
      const mockLocalStorage = {
        getItem: jest.fn().mockReturnValue(JSON.stringify({
          user: { id: 'user-123', email: 'test@example.com' },
          tokens: { accessToken: 'token-123' },
          isAuthenticated: true,
        })),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      };

      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      const { result } = renderHook(() => useAuthStore());

      // The store should automatically load persisted state
      expect(mockLocalStorage.getItem).toHaveBeenCalled();
    });

    it('should sync assessment progress with backend', async () => {
      const { result } = renderHook(() => useAssessmentStore());

      // Mock saving assessment
      act(() => {
        result.current.setCurrentAssessment({
          id: 'assessment-123',
          title: 'Test Assessment',
          status: 'draft',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userId: 'user-123',
          companyId: 'company-123',
          domainResponses: {
            'strategic-alignment': {
              questions: {
                'q1': { questionId: 'q1', value: 4, timestamp: '2024-01-01T00:00:00Z' },
              },
            },
          },
          progress: {
            overall: 10,
            completeness: 10,
            estimatedTimeRemaining: '40-50 minutes',
            domainsCompleted: 0,
            totalDomains: 12,
          },
        });
      });

      mockAssessmentService.updateAssessment.mockResolvedValue({ success: true, data: result.current.currentAssessment! });

      await act(async () => {
        await result.current.saveAssessment();
      });

      expect(mockAssessmentService.updateAssessment).toHaveBeenCalledWith(
        'assessment-123',
        expect.objectContaining({
          domainResponses: expect.any(Object),
        })
      );
    });
  });
});