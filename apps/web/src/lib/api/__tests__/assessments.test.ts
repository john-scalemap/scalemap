import { ApiResponse } from '@scalemap/shared/types/api';
import { Assessment } from '@scalemap/shared/types/assessment';

import { assessmentService } from '../assessments';

// Mock the API client
jest.mock('../client', () => ({
  post: jest.fn(),
  get: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

// Mock retry function
jest.mock('../retry', () => ({
  withRetry: jest.fn((fn) => fn()),
}));

import apiClient from '../client';

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('AssessmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAssessment', () => {
    it('should create assessment successfully', async () => {
      const mockAssessment: Assessment = {
        id: 'test-assessment-id',
        title: 'Test Assessment',
        description: 'Test Description',
        status: 'draft' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        userId: 'test-user-id',
        companyId: 'test-company-id',
        domainResponses: {},
        progress: {
          overall: 0,
          completeness: 0,
          estimatedTimeRemaining: '45-60 minutes',
          domainsCompleted: 0,
          totalDomains: 12
        }
      };

      const mockResponse: ApiResponse<Assessment> = {
        success: true,
        data: mockAssessment,
        meta: {
          timestamp: '2024-01-01T00:00:00Z',
          requestId: 'test-request-id'
        }
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await assessmentService.createAssessment({
        title: 'Test Assessment',
        description: 'Test Description',
        companyId: 'test-company-id'
      });

      expect(result).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith('/assessments', {
        title: 'Test Assessment',
        description: 'Test Description',
        companyId: 'test-company-id'
      });
    });

    it('should handle creation errors', async () => {
      const mockErrorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title is required'
        }
      };

      mockApiClient.post.mockResolvedValue(mockErrorResponse);

      const result = await assessmentService.createAssessment({
        title: '',
        companyId: 'test-company-id'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('getAssessment', () => {
    it('should fetch assessment by ID', async () => {
      const mockAssessment: Assessment = {
        id: 'test-assessment-id',
        title: 'Test Assessment',
        status: 'analyzing' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        userId: 'test-user-id',
        companyId: 'test-company-id',
        domainResponses: {},
        progress: {
          overall: 35,
          completeness: 35,
          estimatedTimeRemaining: '25-30 minutes',
          domainsCompleted: 4,
          totalDomains: 12
        }
      };

      const mockResponse: ApiResponse<Assessment> = {
        success: true,
        data: mockAssessment
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await assessmentService.getAssessment('test-assessment-id');

      expect(result).toEqual(mockResponse);
      expect(mockApiClient.get).toHaveBeenCalledWith('/assessments/test-assessment-id');
    });
  });

  describe('updateAssessment', () => {
    it('should update assessment data', async () => {
      const updateData = {
        title: 'Updated Assessment Title',
        description: 'Updated description'
      };

      const mockResponse: ApiResponse<Assessment> = {
        success: true,
        data: {
          id: 'test-assessment-id',
          title: 'Updated Assessment Title',
          description: 'Updated description',
          status: 'draft' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T01:00:00Z',
          userId: 'test-user-id',
          companyId: 'test-company-id',
          domainResponses: {},
          progress: {
            overall: 0,
            completeness: 0,
            estimatedTimeRemaining: '45-60 minutes',
            domainsCompleted: 0,
            totalDomains: 12
          }
        }
      };

      mockApiClient.patch.mockResolvedValue(mockResponse);

      const result = await assessmentService.updateAssessment('test-assessment-id', updateData);

      expect(result).toEqual(mockResponse);
      expect(mockApiClient.patch).toHaveBeenCalledWith('/assessments/test-assessment-id', updateData);
    });
  });

  describe('startAssessment', () => {
    it('should start assessment processing', async () => {
      const mockResponse: ApiResponse<Assessment> = {
        success: true,
        data: {
          id: 'test-assessment-id',
          title: 'Test Assessment',
          status: 'analyzing' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T01:00:00Z',
          userId: 'test-user-id',
          companyId: 'test-company-id',
          domainResponses: {},
          progress: {
            overall: 0,
            completeness: 100,
            estimatedTimeRemaining: 'Processing...',
            domainsCompleted: 0,
            totalDomains: 12
          }
        }
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await assessmentService.startAssessment('test-assessment-id');

      expect(result).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith('/assessments/test-assessment-id/start');
    });
  });
});