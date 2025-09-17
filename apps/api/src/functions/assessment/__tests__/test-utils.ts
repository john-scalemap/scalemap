import { DomainName, DomainCompletenessAnalysis, AssessmentGap, ConflictingResponse } from '@scalemap/shared';

import { TimelinePauseEvent, TimelineExtension } from '../../../services/timeline-manager';

/**
 * Create a complete DomainCompletenessAnalysis for testing
 */
export function createMockDomainCompleteness(overrides?: Partial<DomainCompletenessAnalysis>): DomainCompletenessAnalysis {
  return {
    score: 85,
    identifiedGaps: [],
    dataQualityScore: 90,
    responseDepthScore: 80,
    consistencyScore: 85,
    missingCriticalQuestions: [],
    conflictingResponses: [],
    ...overrides,
  };
}

/**
 * Create a complete Record<DomainName, DomainCompletenessAnalysis> for testing
 */
export function createMockDomainCompletenessRecord(
  overrides?: Partial<Record<DomainName, DomainCompletenessAnalysis>>
): Record<DomainName, DomainCompletenessAnalysis> {
  const domains: DomainName[] = [
    'strategic-alignment',
    'financial-management',
    'revenue-engine',
    'operational-excellence',
    'people-organization',
    'technology-data',
    'customer-experience',
    'supply-chain',
    'risk-compliance',
    'partnerships',
    'customer-success',
    'change-management',
  ];

  const result = {} as Record<DomainName, DomainCompletenessAnalysis>;

  domains.forEach(domain => {
    result[domain] = createMockDomainCompleteness();
  });

  return {
    ...result,
    ...overrides,
  };
}

/**
 * Create a mock assessment gap for testing
 */
export function createMockAssessmentGap(overrides?: Partial<AssessmentGap>): AssessmentGap {
  return {
    gapId: 'gap-123',
    assessmentId: 'assessment-123',
    domain: 'strategic-alignment',
    category: 'critical',
    description: 'Test gap description',
    detectedAt: new Date().toISOString(),
    suggestedQuestions: ['Test question 1', 'Test question 2'],
    followUpPrompts: ['Test prompt 1', 'Test prompt 2'],
    resolved: false,
    impactOnTimeline: true,
    priority: 1,
    estimatedResolutionTime: 24,
    ...overrides,
  };
}

/**
 * Create a mock conflicting response for testing
 */
export function createMockConflictingResponse(overrides?: Partial<ConflictingResponse>): ConflictingResponse {
  return {
    questionIds: ['q1', 'q2'],
    conflictDescription: 'Test conflict description',
    severity: 'moderate',
    suggestedResolution: 'Test resolution',
    ...overrides,
  };
}

/**
 * Create a mock timeline status response for testing
 */
export function createMockTimelineStatus(overrides?: {
  status?: 'on-track' | 'paused' | 'extended' | 'at-risk' | 'overdue';
  pauseEvent?: TimelinePauseEvent;
  extensions?: TimelineExtension[];
  remainingTime?: {
    executive24h: number;
    detailed48h: number;
    implementation72h: number;
  };
  riskFactors?: string[];
}) {
  return {
    status: 'on-track' as const,
    pauseEvent: undefined,
    extensions: [] as TimelineExtension[],
    remainingTime: {
      executive24h: 12 * 60 * 60 * 1000, // 12 hours in ms
      detailed48h: 36 * 60 * 60 * 1000, // 36 hours in ms
      implementation72h: 60 * 60 * 60 * 1000, // 60 hours in ms
    },
    riskFactors: [] as string[],
    ...overrides,
  };
}

/**
 * Create a mock timeline pause event for testing
 */
export function createMockTimelinePauseEvent(overrides?: Partial<TimelinePauseEvent>): TimelinePauseEvent {
  return {
    assessmentId: 'assessment-123',
    pauseReason: 'critical-gaps',
    pausedAt: new Date().toISOString(),
    pausedBy: 'system',
    affectedGaps: ['gap-1', 'gap-2'],
    estimatedResolutionTime: 120, // 2 hours in minutes
    nextStepsDescription: 'Please provide additional information for the identified gaps',
    ...overrides,
  };
}

/**
 * Create a mock timeline extension for testing
 */
export function createMockTimelineExtension(overrides?: Partial<TimelineExtension>): TimelineExtension {
  const now = new Date().toISOString();
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    extensionId: 'ext-123',
    assessmentId: 'assessment-123',
    extensionType: 'gap-resolution',
    originalDeadlines: {
      executive24h: now,
      detailed48h: now,
      implementation72h: now,
    },
    newDeadlines: {
      executive24h: futureDate,
      detailed48h: futureDate,
      implementation72h: futureDate,
    },
    extensionDuration: 24 * 60 * 60 * 1000, // 24 hours in ms
    requestedBy: 'system',
    requestedAt: now,
    justification: 'Additional time needed for gap resolution',
    affectedStakeholders: ['founder@company.com'],
    ...overrides,
  };
}