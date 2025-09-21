export { default as apiClient } from './client';
export { authService, type LoginRequest, type LoginResponse, type RegisterRequest } from './auth';
export { companyService, type CompanyService } from './company';
export {
  assessmentService,
  type CreateAssessmentRequest,
  type AssessmentListResponse,
  type AssessmentAnalysisResponse,
  type DocumentUploadUrlRequest,
  type DocumentUploadUrlResponse,
  type ValidationFeedbackRequest,
} from './assessments';
export {
  progressService,
  type ProgressUpdate,
  type ProgressStats,
  type DomainProgress,
  type AssessmentProgress,
} from './progress';