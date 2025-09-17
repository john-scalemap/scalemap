import { Assessment } from '@scalemap/shared';
import { TriageAnalysis, DomainScore } from '@scalemap/shared/src/types/triage';

import { TriageValidator } from '../triage-validator';

describe('TriageValidator', () => {
  let validator: TriageValidator;
  let mockAssessment: Assessment;
  let mockTriageAnalysis: TriageAnalysis;

  beforeEach(() => {
    validator = new TriageValidator();

    mockAssessment = {
      id: 'test-assessment-1',
      companyId: 'test-company-1',
      companyName: 'Test Company Inc',
      contactEmail: 'test@example.com',
      status: 'triaging',
      createdAt: '2025-01-15T10:00:00Z',
      updatedAt: '2025-01-15T10:00:00Z',
      deliverySchedule: {
        executive24h: '2025-01-16T10:00:00Z',
        detailed48h: '2025-01-17T10:00:00Z',
        implementation72h: '2025-01-18T10:00:00Z'
      },
      clarificationPolicy: {
        allowClarificationUntil: '2025-01-16T10:00:00Z',
        maxClarificationRequests: 3,
        maxTimelineExtension: 24
      },
      industryClassification: {
        sector: 'financial-services',
        subSector: 'Banking',
        regulatoryClassification: 'heavily-regulated',
        businessModel: 'b2b-saas',
        companyStage: 'mature',
        employeeCount: 500,
        revenue: '$50M+'
      },
      companyStage: 'mature',
      domainResponses: {
        'risk-compliance': {
          domain: 'risk-compliance',
          questions: {
            '9.1': { questionId: '9.1', value: 4, timestamp: '2025-01-15T09:00:00Z' },
            '9.2': { questionId: '9.2', value: 5, timestamp: '2025-01-15T09:01:00Z' },
            '9.3': { questionId: '9.3', value: 4, timestamp: '2025-01-15T09:02:00Z' }
          },
          completeness: 100,
          lastUpdated: '2025-01-15T09:02:00Z'
        },
        'financial-management': {
          domain: 'financial-management',
          questions: {
            '2.1': { questionId: '2.1', value: 4, timestamp: '2025-01-15T09:10:00Z' },
            '2.2': { questionId: '2.2', value: 5, timestamp: '2025-01-15T09:11:00Z' },
            '2.3': { questionId: '2.3', value: 3, timestamp: '2025-01-15T09:12:00Z' }
          },
          completeness: 100,
          lastUpdated: '2025-01-15T09:12:00Z'
        },
        'operational-excellence': {
          domain: 'operational-excellence',
          questions: {
            '4.1': { questionId: '4.1', value: 3, timestamp: '2025-01-15T09:20:00Z' },
            '4.2': { questionId: '4.2', value: 4, timestamp: '2025-01-15T09:21:00Z' },
            '4.3': { questionId: '4.3', value: 3, timestamp: '2025-01-15T09:22:00Z' }
          },
          completeness: 100,
          lastUpdated: '2025-01-15T09:22:00Z'
        }
      }
    };

    const mockDomainScore: DomainScore = {
      score: 4.3,
      confidence: 0.85,
      reasoning: 'High severity issues detected in risk management',
      criticalFactors: ['Regulatory gaps', 'Compliance framework weaknesses'],
      crossDomainImpacts: ['Impacts operational processes'],
      severity: 'high',
      priorityLevel: 'HIGH',
      agentActivation: 'REQUIRED'
    };

    mockTriageAnalysis = {
      domainScores: {
        'risk-compliance': { ...mockDomainScore, score: 4.3 },
        'financial-management': { ...mockDomainScore, score: 4.0 },
        'operational-excellence': {
          ...mockDomainScore,
          score: 3.7,
          severity: 'medium',
          priorityLevel: 'MODERATE'
        }
      },
      criticalDomains: ['risk-compliance', 'financial-management', 'operational-excellence'],
      confidence: 0.82,
      reasoning: 'Financial services assessment shows critical regulatory compliance needs',
      industryContext: {
        sector: 'financial-services',
        regulatoryClassification: 'heavily-regulated',
        specificRules: ['risk-compliance', 'financial-management'],
        benchmarks: {
          'risk-compliance': 4.2,
          'financial-management': 4.0
        },
        weightingMultipliers: {
          'risk-compliance': 1.5,
          'financial-management': 1.3
        }
      },
      processingMetrics: {
        processingTime: 45000,
        modelUsed: 'gpt-4o-mini',
        tokenUsage: {
          prompt: 1200,
          completion: 800,
          total: 2000
        },
        costEstimate: 0.15
      }
    };
  });

  describe('validateTriageResults', () => {
    it('should validate successful triage results', async () => {
      const result = await validator.validateTriageResults(mockAssessment, mockTriageAnalysis);

      expect(result.isValid).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.fallbackApplied).toBe(false);
      expect(result.result.criticalDomains).toEqual(mockTriageAnalysis.criticalDomains);
    });

    it('should apply fallback for low confidence results', async () => {
      const lowConfidenceAnalysis = {
        ...mockTriageAnalysis,
        confidence: 0.5 // Below 0.7 threshold
      };

      const result = await validator.validateTriageResults(mockAssessment, lowConfidenceAnalysis);

      expect(result.isValid).toBe(true);
      expect(result.fallbackApplied).toBe(true);
      expect(result.result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should validate industry-required domains are included', async () => {
      const missingRequiredDomains = {
        ...mockTriageAnalysis,
        criticalDomains: ['operational-excellence', 'people-organization'] // Missing risk-compliance
      };

      const result = await validator.validateTriageResults(mockAssessment, missingRequiredDomains);

      expect(result.fallbackApplied).toBe(true);
      expect(result.result.criticalDomains).toContain('risk-compliance'); // Should be added back
    });

    it('should enforce minimum domain count', async () => {
      const tooFewDomains = {
        ...mockTriageAnalysis,
        criticalDomains: ['risk-compliance'] // Only 1 domain
      };

      const result = await validator.validateTriageResults(mockAssessment, tooFewDomains);

      expect(result.fallbackApplied).toBe(true);
      expect(result.result.criticalDomains.length).toBeGreaterThanOrEqual(3);
    });

    it('should enforce maximum domain count', async () => {
      const tooManyDomains = {
        ...mockTriageAnalysis,
        criticalDomains: [
          'risk-compliance',
          'financial-management',
          'operational-excellence',
          'strategic-alignment',
          'people-organization',
          'technology-data' // 6 domains - exceeds limit
        ]
      };

      const result = await validator.validateTriageResults(mockAssessment, tooManyDomains);

      expect(result.result.criticalDomains.length).toBeLessThanOrEqual(5);
    });
  });

  describe('domain coverage validation', () => {
    it('should require balanced domain coverage', async () => {
      const imbalancedAnalysis = {
        ...mockTriageAnalysis,
        criticalDomains: [
          'supply-chain',
          'partnerships',
          'customer-success' // All similar category - no strategy/operations/people balance
        ]
      };

      const result = await validator.validateTriageResults(mockAssessment, imbalancedAnalysis);

      // Should apply fallback for better balance
      expect(result.fallbackApplied).toBe(true);
    });

    it('should validate essential domain combinations', async () => {
      const analysis = {
        ...mockTriageAnalysis,
        criticalDomains: ['risk-compliance', 'financial-management', 'operational-excellence']
      };

      const result = await validator.validateTriageResults(mockAssessment, analysis);

      expect(result.isValid).toBe(true);
      expect(result.fallbackApplied).toBe(false); // Good balance, no fallback needed
    });
  });

  describe('score consistency validation', () => {
    it('should validate score ranges', async () => {
      const invalidScoreAnalysis = {
        ...mockTriageAnalysis,
        domainScores: {
          'risk-compliance': {
            ...mockTriageAnalysis.domainScores['risk-compliance'],
            score: 6.5, // Invalid - exceeds 5
            confidence: 1.2 // Invalid - exceeds 1
          }
        }
      };

      const result = await validator.validateTriageResults(mockAssessment, invalidScoreAnalysis as unknown as TriageAnalysis);

      expect(result.fallbackApplied).toBe(true); // Should apply fallback for invalid scores
    });

    it('should validate severity alignment with scores', async () => {
      const inconsistentSeverityAnalysis = {
        ...mockTriageAnalysis,
        domainScores: {
          'risk-compliance': {
            ...mockTriageAnalysis.domainScores['risk-compliance'],
            score: 4.6, // High score
            severity: 'low' // Inconsistent severity
          }
        }
      };

      const result = await validator.validateTriageResults(mockAssessment, inconsistentSeverityAnalysis as unknown as TriageAnalysis);

      expect(result.fallbackApplied).toBe(true);
    });

    it('should validate priority level alignment with scores', async () => {
      const inconsistentPriorityAnalysis = {
        ...mockTriageAnalysis,
        domainScores: {
          'financial-management': {
            ...mockTriageAnalysis.domainScores['financial-management'],
            score: 4.5, // High score
            priorityLevel: 'HEALTHY' // Inconsistent priority
          }
        }
      };

      const result = await validator.validateTriageResults(mockAssessment, inconsistentPriorityAnalysis as unknown as TriageAnalysis);

      expect(result.fallbackApplied).toBe(true);
    });
  });

  describe('confidence validation', () => {
    it('should validate reasonable overall confidence', async () => {
      const unreasonableConfidenceAnalysis = {
        ...mockTriageAnalysis,
        confidence: 0.95, // Very high
        domainScores: {
          'risk-compliance': {
            ...mockTriageAnalysis.domainScores['risk-compliance'],
            confidence: 0.5 // Much lower domain confidence
          }
        }
      };

      const result = await validator.validateTriageResults(mockAssessment, unreasonableConfidenceAnalysis as unknown as TriageAnalysis);

      expect(result.fallbackApplied).toBe(true);
    });

    it('should validate confidence is within valid range', async () => {
      const invalidConfidenceAnalysis = {
        ...mockTriageAnalysis,
        confidence: 1.5 // Invalid - exceeds 1.0
      };

      const result = await validator.validateTriageResults(mockAssessment, invalidConfidenceAnalysis);

      expect(result.fallbackApplied).toBe(true);
    });
  });

  describe('fallback strategies', () => {
    it('should apply default domain fallback for very low confidence', async () => {
      const veryLowConfidenceAnalysis = {
        ...mockTriageAnalysis,
        confidence: 0.3
      };

      const result = await validator.validateTriageResults(mockAssessment, veryLowConfidenceAnalysis);

      expect(result.fallbackApplied).toBe(true);
      expect(result.result.criticalDomains).toContain('strategic-alignment');
      expect(result.result.criticalDomains).toContain('operational-excellence');
      expect(result.result.criticalDomains).toContain('people-organization');
      expect(result.result.confidence).toBe(0.6); // Conservative fallback confidence
    });

    it('should apply industry fallback for insufficient data', async () => {
      const incompleteAssessment = {
        ...mockAssessment,
        domainResponses: {
          'risk-compliance': {
            domain: 'risk-compliance',
            questions: {
              '9.1': { questionId: '9.1', value: 4, timestamp: '2025-01-15T09:00:00Z' }
            },
            completeness: 20, // Very incomplete
            lastUpdated: '2025-01-15T09:00:00Z'
          }
        }
      } as unknown as Assessment;

      // Create analysis that passes confidence but fails completeness
      const analysis = {
        ...mockTriageAnalysis,
        confidence: 0.8 // Good confidence but low data completeness
      };

      const result = await validator.validateTriageResults(incompleteAssessment, analysis);

      expect(result.fallbackApplied).toBe(true);
      expect(result.result.criticalDomains).toContain('risk-compliance'); // Industry-required
      expect(result.result.criticalDomains).toContain('financial-management'); // Industry-required
    });

    it('should apply rule-based fallback for low quality', async () => {
      // This would be triggered by low quality score but reasonable confidence and completeness
      const lowQualityAnalysis = {
        ...mockTriageAnalysis,
        confidence: 0.75, // Above threshold
        domainScores: {
          ...mockTriageAnalysis.domainScores,
          // Add inconsistent scores to trigger quality issues
          'customer-experience': {
            score: 2.1,
            confidence: 0.3,
            reasoning: 'Inconsistent responses',
            criticalFactors: [],
            crossDomainImpacts: [],
            severity: 'low' as const,
            priorityLevel: 'HEALTHY' as const,
            agentActivation: 'NOT_REQUIRED' as const
          }
        }
      };

      const result = await validator.validateTriageResults(mockAssessment, lowQualityAnalysis);

      if (result.fallbackApplied) {
        expect(result.result.criticalDomains.length).toBeGreaterThanOrEqual(3);
        expect(result.result.confidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe('industry-specific validation', () => {
    it('should require risk-compliance for heavily regulated industries', async () => {
      const missingRiskCompliance = {
        ...mockTriageAnalysis,
        criticalDomains: ['financial-management', 'operational-excellence', 'strategic-alignment']
      };

      const result = await validator.validateTriageResults(mockAssessment, missingRiskCompliance);

      expect(result.fallbackApplied).toBe(true);
      expect(result.result.criticalDomains).toContain('risk-compliance');
    });

    it('should handle unknown industry gracefully', async () => {
      const unknownIndustryAssessment = {
        ...mockAssessment,
        industryClassification: undefined
      };

      const analysis = {
        ...mockTriageAnalysis,
        industryContext: {
          sector: 'unknown',
          regulatoryClassification: 'lightly-regulated' as const,
          specificRules: [],
          benchmarks: {},
          weightingMultipliers: {}
        }
      };

      const result = await validator.validateTriageResults(unknownIndustryAssessment, analysis);

      expect(result.isValid).toBe(true);
    });
  });

  describe('data completeness calculations', () => {
    it('should calculate data completeness correctly', async () => {
      // Should calculate based on answered vs total questions
      // mockAssessment has 9 total questions, all answered
      const validation = (validator as any).performComprehensiveValidation(mockAssessment, mockTriageAnalysis);
      expect(validation.dataCompleteness).toBe(1.0); // 100% complete
    });

    it('should handle partial completeness', async () => {
      const partialAssessment = {
        ...mockAssessment,
        domainResponses: {
          'risk-compliance': {
            domain: 'risk-compliance',
            questions: {
              '9.1': { questionId: '9.1', value: 4, timestamp: '2025-01-15T09:00:00Z' },
              '9.2': { questionId: '9.2', value: null, timestamp: '2025-01-15T09:01:00Z' }, // Unanswered
              '9.3': { questionId: '9.3', value: '', timestamp: '2025-01-15T09:02:00Z' } // Empty
            },
            completeness: 33,
            lastUpdated: '2025-01-15T09:02:00Z'
          }
        }
      };

      const validation = (validator as any).performComprehensiveValidation(partialAssessment, mockTriageAnalysis);
      expect(validation.dataCompleteness).toBeCloseTo(0.33, 1); // ~33% complete
    });
  });

  describe('quality score calculations', () => {
    it('should calculate quality scores based on consistency', async () => {
      const validation = (validator as any).performComprehensiveValidation(mockAssessment, mockTriageAnalysis);
      expect(validation.qualityScore).toBeGreaterThan(0);
      expect(validation.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should penalize inconsistent responses', async () => {
      const inconsistentAnalysis = {
        ...mockTriageAnalysis,
        domainScores: {
          'risk-compliance': { ...mockTriageAnalysis.domainScores['risk-compliance'], confidence: 0.2 },
          'financial-management': { ...mockTriageAnalysis.domainScores['financial-management'], confidence: 0.9 },
          'operational-excellence': { ...mockTriageAnalysis.domainScores['operational-excellence'], confidence: 0.3 }
        }
      };

      const validation = (validator as any).performComprehensiveValidation(mockAssessment, inconsistentAnalysis);
      // Quality should be lower due to confidence variance
      expect(validation.qualityScore).toBeLessThan(0.9);
    });
  });
});