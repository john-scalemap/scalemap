import { ApiResponse } from '@scalemap/shared/types/api';
import { Assessment, AssessmentStatus } from '@scalemap/shared/types/assessment';

import apiClient from './client';
import { withRetry } from './retry';

export interface CreateAssessmentRequest {
  title: string;
  description: string;
  companyName: string;
  contactEmail: string;
  companyId: string;
}

export interface AssessmentListResponse {
  assessments: Assessment[];
  count: number;
  hasMore: boolean;
  totalCount: number;
}

export interface AssessmentAnalysisResponse {
  analysisId: string;
  assessmentId: string;
  progress: {
    overall: number;
    completeness: number;
    estimatedTimeRemaining: string;
    domainsCompleted: number;
    totalDomains: number;
  };
  domains: Record<string, {
    completed: boolean;
    score: number | null;
    analysis?: string;
  }>;
  updatedAt: string;
}

export interface DocumentUploadUrlRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface DocumentUploadUrlResponse {
  uploadUrl: string;
  documentId: string;
  expiresAt: string;
}

export interface ValidationFeedbackRequest {
  domainId: string;
  feedback: {
    accuracy: number; // 1-5 scale
    relevance: number; // 1-5 scale
    completeness: number; // 1-5 scale
    comments?: string;
  };
}

export class AssessmentService {
  async createAssessment(data: CreateAssessmentRequest): Promise<ApiResponse<Assessment>> {
    return withRetry(() => apiClient.post<Assessment>('/assessments', data), {
      maxRetries: 2, // Assessment creation is important but should fail fast
    });
  }

  async getAssessments(params?: {
    status?: AssessmentStatus[];
    companyId?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<AssessmentListResponse>> {
    const searchParams = new URLSearchParams();

    if (params?.status) {
      searchParams.append('status', params.status.join(','));
    }
    if (params?.companyId) {
      searchParams.append('companyId', params.companyId);
    }
    if (params?.page) {
      searchParams.append('page', params.page.toString());
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }

    const query = searchParams.toString();
    const endpoint = query ? `/assessments?${query}` : '/assessments';

    return apiClient.get<AssessmentListResponse>(endpoint);
  }

  async getAssessment(assessmentId: string): Promise<ApiResponse<Assessment>> {
    return apiClient.get<Assessment>(`/assessments/${assessmentId}`);
  }

  async updateAssessment(
    assessmentId: string,
    data: Partial<Assessment>
  ): Promise<ApiResponse<Assessment>> {
    return withRetry(() => apiClient.patch<Assessment>(`/assessments/${assessmentId}`, data), {
      maxRetries: 3, // Updates should be retried to handle DynamoDB eventual consistency
    });
  }

  async deleteAssessment(assessmentId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/assessments/${assessmentId}`);
  }

  async getAssessmentAnalysis(assessmentId: string): Promise<ApiResponse<AssessmentAnalysisResponse>> {
    return apiClient.get<AssessmentAnalysisResponse>(`/assessments/${assessmentId}/analysis`);
  }

  async getDocumentUploadUrl(
    assessmentId: string,
    request: DocumentUploadUrlRequest
  ): Promise<ApiResponse<DocumentUploadUrlResponse>> {
    return apiClient.post<DocumentUploadUrlResponse>(
      `/assessments/${assessmentId}/documents/upload-url`,
      request
    );
  }

  async submitValidationFeedback(
    assessmentId: string,
    feedback: ValidationFeedbackRequest
  ): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/assessments/${assessmentId}/validation`, feedback);
  }

  async startAssessment(assessmentId: string): Promise<ApiResponse<Assessment>> {
    return apiClient.post<Assessment>(`/assessments/${assessmentId}/start`);
  }

  async pauseAssessment(assessmentId: string): Promise<ApiResponse<Assessment>> {
    return apiClient.post<Assessment>(`/assessments/${assessmentId}/pause`);
  }

  async resumeAssessment(assessmentId: string): Promise<ApiResponse<Assessment>> {
    return apiClient.post<Assessment>(`/assessments/${assessmentId}/resume`);
  }
}

export const assessmentService = new AssessmentService();