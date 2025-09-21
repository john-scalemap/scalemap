export interface Assessment {
  id: string;
  companyId: string;
  companyName: string;
  contactEmail: string;
  title?: string;
  description?: string;
  status: AssessmentStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  assessmentContext?: AssessmentContext;
  domainResponses: Record<string, DomainResponse>;
  progress?: AssessmentProgress;
  results?: AssessmentResults;
  industryClassification?: IndustryClassification;
  companyStage?: 'startup' | 'growth' | 'mature';
  deliverySchedule: {
    executive24h: string;
    detailed48h: string;
    implementation72h: string;
  };
  clarificationPolicy: {
    allowClarificationUntil: string;
    maxClarificationRequests: number;
    maxTimelineExtension: number;
  };
  // Live service integration fields
  triageResult?: TriageResult;
  triageCompletedAt?: string;
  agentAnalysisResults?: AgentAnalysisResult[];
  analysisCompletedAt?: string;
  prioritizationResult?: PrioritizationResult;
  synthesisCompletedAt?: string;
}

export type AssessmentStatus =
  | 'payment-pending'
  | 'document-processing'
  | 'triaging'
  | 'analyzing'
  | 'synthesizing'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'paused-for-gaps'
  | 'paused-for-clarification';

export interface AssessmentContext {
  primaryBusinessChallenges: string[];
  strategicObjectives: string[];
  resourceConstraints: {
    budget: 'limited' | 'moderate' | 'substantial';
    team: 'stretched' | 'adequate' | 'well-staffed';
    timeAvailability: 'minimal' | 'moderate' | 'flexible';
  };
}

export interface DomainResponse {
  domain: DomainName;
  questions: Record<string, QuestionResponse>;
  completeness: number;
  lastUpdated: string;
  notes?: string;
}

export interface QuestionResponse {
  questionId: string;
  value: string | number | string[] | boolean;
  followUpAnswers?: Record<string, string>;
  timestamp: string;
}

export interface AssessmentProgress {
  overall: number;
  domains: Record<DomainName, DomainProgress>;
  completeness: number;
  estimatedTimeRemaining: string;
  currentDomain?: DomainName;
  currentQuestion?: string;
}

export interface DomainProgress {
  completed: number;
  total: number;
  score?: number;
  status: 'not-started' | 'in-progress' | 'completed';
  requiredQuestions: number;
  optionalQuestions: number;
}

export type DomainName =
  | 'strategic-alignment'
  | 'financial-management'
  | 'revenue-engine'
  | 'operational-excellence'
  | 'people-organization'
  | 'technology-data'
  | 'customer-experience'
  | 'supply-chain'
  | 'risk-compliance'
  | 'partnerships'
  | 'customer-success'
  | 'change-management';

export interface IndustryClassification {
  sector: 'technology' | 'financial-services' | 'healthcare' | 'manufacturing' | 'retail' | 'other';
  subSector: string;
  regulatoryClassification: 'heavily-regulated' | 'lightly-regulated' | 'non-regulated';
  businessModel: 'b2b-saas' | 'b2c-marketplace' | 'manufacturing' | 'services' | 'hybrid';
  companyStage: 'startup' | 'growth' | 'mature';
  employeeCount: number;
  revenue?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  scale?: {
    min: number;
    max: number;
    labels: string[];
  };
  required: boolean;
  conditional?: {
    dependsOn: string;
    showIf: string[];
  };
  followUpQuestions?: Question[];
  industrySpecific?: {
    regulated?: boolean;
    businessModels?: string[];
    companyStages?: string[];
    minRevenue?: string;
    minEmployees?: number;
    hasInternationalOperations?: boolean;
    hasPhysicalProducts?: boolean;
    hasChannelSales?: boolean;
    rapidGrowth?: boolean;
  };
}

export type QuestionType =
  | 'multiple-choice'
  | 'scale'
  | 'text'
  | 'number'
  | 'boolean'
  | 'multiple-select';

export interface DomainTemplate {
  domain: DomainName;
  title: string;
  description: string;
  questions: Question[];
  industrySpecific: {
    regulated: {
      additionalQuestions: Question[];
      requiredFields: string[];
    };
    nonRegulated: {
      skipQuestions: string[];
    };
  };
  companyStageVariations: {
    startup: {
      focusAreas: string[];
      questions?: Question[];
    };
    growth: {
      focusAreas: string[];
      questions?: Question[];
    };
    mature: {
      focusAreas: string[];
      questions?: Question[];
    };
  };
  scoringRules: {
    triggerThreshold: number;
    criticalThreshold: number;
    weightingFactors: Record<string, number>;
  };
}

export interface AssessmentResults {
  overallScore: number;
  domains: Record<DomainName, DomainResult>;
  triggeredAgents: DomainName[];
  priorityOrder: DomainName[];
  recommendations: string[];
  insights: string[];
  completenessScore: number;
  qualityMetrics: {
    responseConsistency: number;
    dataQuality: number;
    crossDomainValidation: number;
  };
}

export interface DomainResult {
  name: DomainName;
  score: number;
  status: 'strength' | 'neutral' | 'concern' | 'critical';
  triggered: boolean;
  questions: Record<string, QuestionResult>;
  insights: string[];
  recommendations: string[];
}

export interface QuestionResult {
  questionId: string;
  response: QuestionResponse;
  score: number;
  weight: number;
  impact: 'low' | 'medium' | 'high';
}

export interface AssessmentValidation {
  isValid: boolean;
  errors: AssessmentValidationError[];
  warnings: ValidationWarning[];
  completeness: number;
  requiredFieldsMissing: string[];
  crossDomainInconsistencies: string[];
}

export interface AssessmentValidationError {
  field: string;
  message: string;
  type: 'required' | 'format' | 'range' | 'consistency';
}

export interface ValidationWarning {
  field: string;
  message: string;
  type: 'quality' | 'completeness' | 'consistency';
}

// Live Service Integration Types

export interface TriageResult {
  assessmentId: string;
  criticalDomains: string[];
  priorityScore: Record<string, number>;
  reasoning: string;
  confidence: number;
  processingTime: number;
  modelUsed: string;
}

export interface AgentAnalysisResult {
  domain: DomainName;
  findings: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  supportingEvidence: string[];
  processingTime: number;
  modelUsed: string;
  agentName: string;
}

export interface PrioritizationResult {
  priorityRecommendations: PriorityRecommendation[];
  impactAnalysis: Record<string, string>;
  implementationRoadmap: string[];
  confidence: number;
  reasoning: string;
  processingTime: number;
  modelUsed: string;
}

export interface PriorityRecommendation {
  title: string;
  description: string;
  impactScore: number;
  implementationEffort: 'low' | 'medium' | 'high';
  timeframe: '30' | '60' | '90';
  dependencies: string[];
}

export interface CreateAssessmentRequest {
  companyName: string;
  contactEmail: string;
  title: string;
  description: string;
  assessmentContext?: AssessmentContext;
}

export interface CreateAssessmentResponse {
  success: boolean;
  data?: {
    assessment: Assessment;
    questionnaireUrl: string;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

export interface UpdateAssessmentRequest {
  assessmentId: string;
  domainResponses?: Record<string, DomainResponse>;
  assessmentContext?: Partial<AssessmentContext>;
  status?: AssessmentStatus;
}