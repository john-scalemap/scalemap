import { ApiResponse } from '@scalemap/shared/types/api';

import apiClient from './client';

export interface ProgressUpdate {
  assessmentId: string;
  domainId?: string;
  questionId?: string;
  completionPercentage: number;
  timeSpent?: number; // in seconds
  metadata?: Record<string, any>;
}

export interface ProgressStats {
  totalTimeSpent: number;
  averageCompletionTime: number;
  questionsCompleted: number;
  totalQuestions: number;
  domainsCompleted: number;
  totalDomains: number;
  lastActivity: string;
  estimatedTimeRemaining: string;
}

export interface DomainProgress {
  domainId: string;
  completionPercentage: number;
  questionsAnswered: number;
  totalQuestions: number;
  timeSpent: number;
  lastUpdated: string;
  score?: number;
}

export interface AssessmentProgress {
  assessmentId: string;
  overallProgress: number;
  domains: DomainProgress[];
  stats: ProgressStats;
  currentState: {
    currentDomain?: string;
    currentQuestion?: string;
    sessionStartTime: string;
    sessionTimeSpent: number;
  };
  milestones: {
    started: string;
    firstQuestionAnswered?: string;
    halfwayComplete?: string;
    allDomainsCompleted?: string;
    submitted?: string;
  };
}

export class ProgressService {
  async updateProgress(update: ProgressUpdate): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/progress/update', update);
  }

  async getAssessmentProgress(assessmentId: string): Promise<ApiResponse<AssessmentProgress>> {
    return apiClient.get<AssessmentProgress>(`/progress/assessment/${assessmentId}`);
  }

  async getDomainProgress(
    assessmentId: string,
    domainId: string
  ): Promise<ApiResponse<DomainProgress>> {
    return apiClient.get<DomainProgress>(`/progress/assessment/${assessmentId}/domain/${domainId}`);
  }

  async trackQuestionResponse(
    assessmentId: string,
    domainId: string,
    questionId: string,
    timeSpent: number
  ): Promise<ApiResponse<void>> {
    return this.updateProgress({
      assessmentId,
      domainId,
      questionId,
      completionPercentage: 0, // Will be calculated by backend
      timeSpent,
      metadata: {
        action: 'question_answered',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async trackDomainCompletion(
    assessmentId: string,
    domainId: string,
    completionPercentage: number
  ): Promise<ApiResponse<void>> {
    return this.updateProgress({
      assessmentId,
      domainId,
      completionPercentage,
      metadata: {
        action: 'domain_completed',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async trackSessionStart(assessmentId: string): Promise<ApiResponse<void>> {
    return this.updateProgress({
      assessmentId,
      completionPercentage: 0,
      metadata: {
        action: 'session_start',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async trackSessionEnd(
    assessmentId: string,
    sessionTimeSpent: number
  ): Promise<ApiResponse<void>> {
    return this.updateProgress({
      assessmentId,
      completionPercentage: 0,
      timeSpent: sessionTimeSpent,
      metadata: {
        action: 'session_end',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async getProgressStats(assessmentId: string): Promise<ApiResponse<ProgressStats>> {
    return apiClient.get<ProgressStats>(`/progress/assessment/${assessmentId}/stats`);
  }

  async getUserProgressHistory(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<ApiResponse<AssessmentProgress[]>> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.dateFrom) params.append('dateFrom', options.dateFrom);
    if (options?.dateTo) params.append('dateTo', options.dateTo);

    const query = params.toString();
    const endpoint = query ? `/progress/user/${userId}?${query}` : `/progress/user/${userId}`;

    return apiClient.get<AssessmentProgress[]>(endpoint);
  }
}

export const progressService = new ProgressService();