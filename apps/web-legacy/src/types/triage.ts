export interface TriageEntity {
  PK: string; // `ASSESSMENT#{assessmentId}`
  SK: string; // `TRIAGE#RESULTS`
  GSI2PK: string; // `STATUS#{triageStatus}`
  GSI2SK: string; // `CREATED#{createdAt}`
  EntityType: 'TriageResult';
  Data: {
    assessmentId: string;
    triageStatus: 'pending' | 'analyzing' | 'completed' | 'failed';
    algorithm: {
      version: string;
      modelUsed: 'gpt-4o-mini' | 'gpt-4o';
      processingTime: number;
      tokenUsage: {
        prompt: number;
        completion: number;
        total: number;
      };
    };
    domainScores: {
      [domain: string]: {
        score: number; // 1-5 scale
        confidence: number; // 0-1 scale
        reasoning: string;
        criticalFactors: string[];
        crossDomainImpacts: string[];
      };
    };
    selectedDomains: string[];
    industryContext: {
      sector: string;
      regulatoryClassification: string;
      specificRules: string[];
    };
    overrideHistory: {
      originalSelection: string[];
      overriddenBy: string;
      overrideReason: string;
      timestamp: string;
    }[];
  };
}

export interface TriageAnalysis {
  domainScores: Record<string, DomainScore>;
  criticalDomains: string[];
  confidence: number;
  reasoning: string;
  industryContext: IndustryContext;
  processingMetrics: ProcessingMetrics;
}

export interface DomainScore {
  score: number; // 1-5 scale
  confidence: number; // 0-1 scale
  reasoning: string;
  criticalFactors: string[];
  crossDomainImpacts: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  priorityLevel: 'HEALTHY' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  agentActivation: 'NOT_REQUIRED' | 'CONDITIONAL' | 'REQUIRED';
}

export interface IndustryContext {
  sector: string;
  regulatoryClassification: 'lightly-regulated' | 'moderately-regulated' | 'heavily-regulated';
  specificRules: string[];
  benchmarks: Record<string, number>;
  weightingMultipliers: Record<string, number>;
}

export interface ProcessingMetrics {
  processingTime: number;
  modelUsed: string;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  costEstimate: number;
}

export interface TriageValidationResult {
  isValid: boolean;
  confidence: number;
  validationErrors: string[];
  fallbackActivated: boolean;
  dataCompleteness: number;
  qualityScore: number;
}

export interface TriageOverride {
  assessmentId: string;
  originalSelection: string[];
  overriddenSelection: string[];
  overriddenBy: string;
  overrideReason: string;
  timestamp: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalTimestamp?: string;
}

export interface TriageMetrics {
  averageProcessingTime: number;
  averageTokenUsage: number;
  averageCost: number;
  accuracyScore: number;
  overrideRate: number;
  confidenceDistribution: Record<string, number>;
  industryPerformance: Record<string, {
    averageTime: number;
    averageAccuracy: number;
    domainDistribution: Record<string, number>;
  }>;
}

export interface TriageAuditLog {
  assessmentId: string;
  timestamp: string;
  event: 'triage_started' | 'triage_completed' | 'triage_failed' | 'triage_override' | 'validation_failed';
  details: {
    modelUsed?: string;
    processingTime?: number;
    confidence?: number;
    errorMessage?: string;
    userId?: string;
    changes?: Record<string, any>;
  };
  metadata: {
    version: string;
    environment: string;
    requestId: string;
  };
}

export interface TriageConfiguration {
  algorithmVersion: string;
  modelSelection: {
    primary: string;
    fallback: string;
    costOptimized: string;
  };
  thresholds: {
    domainSelection: number;
    confidenceMinimum: number;
    dataCompletenessRequired: number;
  };
  industryRules: Record<string, {
    weightingMultipliers: Record<string, number>;
    requiredDomains: string[];
    excludedDomains: string[];
  }>;
  performance: {
    maxProcessingTime: number;
    maxTokensPerRequest: number;
    maxCostPerTriage: number;
  };
}

export type TriageStatus = 'pending' | 'analyzing' | 'completed' | 'failed' | 'overridden';

export interface TriageBatchRequest {
  assessments: string[];
  priority: 'low' | 'normal' | 'high';
  configuration?: Partial<TriageConfiguration>;
}

export interface TriageBatchResult {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  results: Record<string, TriageAnalysis | string>; // assessmentId -> result or error
  metrics: {
    totalProcessingTime: number;
    totalTokenUsage: number;
    totalCost: number;
    averageConfidence: number;
  };
}