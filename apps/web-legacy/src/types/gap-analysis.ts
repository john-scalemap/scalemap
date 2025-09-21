import { DomainName } from './assessment';

export interface GapAnalysis {
  overallCompletenessScore: number; // 0-100%
  domainCompleteness: Record<DomainName, DomainCompletenessAnalysis>;
  industrySpecificGaps: IndustrySpecificGap[];
  lastAnalyzedAt: string;
  analysisVersion: string;
  detectedGaps: AssessmentGap[];
  criticalGapsCount: number;
  totalGapsCount: number;
}

export interface DomainCompletenessAnalysis {
  score: number; // 0-100%
  identifiedGaps: AssessmentGap[];
  dataQualityScore: number;
  responseDepthScore: number;
  consistencyScore: number;
  missingCriticalQuestions: string[];
  conflictingResponses: ConflictingResponse[];
}

export interface AssessmentGap {
  gapId: string;
  assessmentId: string;
  domain: DomainName;
  category: GapCategory;
  description: string;
  detectedAt: string;
  suggestedQuestions: string[];
  followUpPrompts: string[];
  clientResponse?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolutionMethod?: 'client-input' | 'auto-resolved' | 'founder-override';
  impactOnTimeline: boolean;
  priority: number; // 1-10, with 10 being highest priority
  estimatedResolutionTime: number; // minutes
}

export type GapCategory = 'critical' | 'important' | 'nice-to-have';

export interface IndustrySpecificGap {
  regulation: string;
  requirements: string[];
  complianceLevel: 'full' | 'partial' | 'missing';
  mandatoryFields: string[];
  recommendedFields: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ConflictingResponse {
  questionIds: string[];
  conflictDescription: string;
  severity: 'minor' | 'moderate' | 'major';
  suggestedResolution: string;
}

export interface GapAnalysisRequest {
  assessmentId: string;
  forceReanalysis?: boolean;
  focusDomains?: DomainName[];
  analysisDepth: 'quick' | 'standard' | 'comprehensive';
}

export interface GapAnalysisResponse {
  assessmentId: string;
  gapAnalysis: GapAnalysis;
  processingTime: number;
  modelUsed: string;
  costEstimate: number;
  recommendations: GapRecommendation[];
}

export interface GapRecommendation {
  title: string;
  description: string;
  suggestedActions: string[];
  estimatedImpact: 'low' | 'medium' | 'high';
  priority: number;
  category: GapCategory;
}

export interface GapResolutionRequest {
  gapId: string;
  clientResponse: string;
  additionalContext?: string;
  skipGap?: boolean;
}

export interface GapResolutionResponse {
  gapId: string;
  resolved: boolean;
  newGaps?: AssessmentGap[];
  impactOnCompleteness: number;
  message: string;
}

export interface BulkGapResolutionRequest {
  assessmentId: string;
  resolutions: GapResolutionRequest[];
}

export interface BulkGapResolutionResponse {
  assessmentId: string;
  processedCount: number;
  resolvedCount: number;
  newGapsCount: number;
  overallCompletenessScore: number;
  failedResolutions: Array<{
    gapId: string;
    error: string;
  }>;
}

export interface GapNotificationSettings {
  emailEnabled: boolean;
  timelineThreshold: number; // minutes
  criticalGapThreshold: number; // count
  recipientEmail?: string;
  notificationTemplate: 'standard' | 'detailed' | 'minimal';
}

export interface GapAnalysisSettings {
  autoTriggerThreshold: number; // completeness percentage below which to auto-trigger
  realTimeEnabled: boolean;
  postSubmissionEnabled: boolean;
  industryRulesEnabled: boolean;
  timelinePauseEnabled: boolean;
  maxGapsPerDomain: number;
  gapExpirationHours: number;
}

// Scoring algorithms configuration
export interface GapScoringConfig {
  domainWeights: Record<DomainName, number>;
  questionTypeWeights: Record<string, number>;
  responseQualityFactors: {
    lengthMinimum: number;
    depthIndicators: string[];
    qualityKeywords: string[];
  };
  conflictDetectionRules: {
    crossDomainValidation: boolean;
    temporalConsistency: boolean;
    logicalConsistency: boolean;
  };
}

// Database entities for DynamoDB
export interface GapTrackingEntity {
  PK: string; // ASSESSMENT#{assessmentId}
  SK: string; // GAP#{gapId}
  GSI1PK: string; // GAP#{category}
  GSI1SK: string; // PRIORITY#{priority}#{createdAt}
  GSI2PK: string; // GAP#{status}
  GSI2SK: string; // CREATED#{createdAt}
  Data: AssessmentGap;
  TTL: number;
}

export interface GapAnalysisEntity {
  PK: string; // ASSESSMENT#{assessmentId}
  SK: string; // GAP_ANALYSIS#{version}
  GSI1PK: string; // ANALYSIS#{status}
  GSI1SK: string; // CREATED#{createdAt}
  Data: GapAnalysis;
  TTL: number;
}