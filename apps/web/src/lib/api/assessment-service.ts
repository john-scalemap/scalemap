import { apiClient } from './client';

import type { Assessment } from '@/types/assessment';

export interface ListAssessmentsParams {
  status?: string;
  limit?: number;
}

export interface ListAssessmentsResponse {
  assessments: Assessment[];
  count: number;
  hasMore: boolean;
}

export interface CreateAssessmentRequest {
  title: string;
  description?: string;
  companyName?: string;
}

export interface CreateAssessmentResponse {
  assessment: Assessment;
}

class AssessmentService {
  /**
   * List assessments for the authenticated user's company
   */
  async listAssessments(
    params?: ListAssessmentsParams
  ): Promise<ListAssessmentsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.status) {
      searchParams.append('status', params.status);
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }

    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/assessments?${queryString}`
      : '/assessments';

    const response = await apiClient.get<ListAssessmentsResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch assessments');
    }

    return response.data;
  }

  /**
   * Get a specific assessment by ID
   */
  async getAssessment(id: string): Promise<Assessment> {
    const response = await apiClient.get<Assessment>(`/assessments/${id}`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch assessment');
    }

    return response.data;
  }

  /**
   * Create a new assessment
   */
  async createAssessment(data: CreateAssessmentRequest): Promise<Assessment> {
    const response = await apiClient.post<CreateAssessmentResponse>(
      '/assessments',
      data
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to create assessment');
    }

    return response.data.assessment;
  }

  /**
   * Start an assessment (move from payment-pending to active)
   */
  async startAssessment(id: string): Promise<Assessment> {
    const response = await apiClient.post<Assessment>(
      `/assessments/${id}/start`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to start assessment');
    }

    return response.data;
  }

  /**
   * Update assessment responses
   */
  async updateAssessmentResponses(
    id: string,
    domainResponses: Record<string, unknown>
  ): Promise<Assessment> {
    const response = await apiClient.put<Assessment>(
      `/assessments/${id}/responses`,
      {
        domainResponses,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(
        response.error?.message || 'Failed to update assessment responses'
      );
    }

    return response.data;
  }
}

// Create and export singleton instance
export const assessmentService = new AssessmentService();
export default assessmentService;
