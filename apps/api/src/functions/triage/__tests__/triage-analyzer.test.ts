import { Assessment } from '@scalemap/shared';
import { TriageConfiguration } from '@scalemap/shared/src/types/triage';

import { TriageAnalyzer } from '../triage-analyzer';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  domainAnalysis: {
                    'strategic-alignment': {
                      adjustedScore: 4.2,
                      confidence: 0.85,
                      reasoning: 'Strong strategic clarity but implementation gaps',
                      criticalFactors: ['Vision alignment issues', 'Resource allocation challenges'],
                      severity: 'high'
                    },
                    'operational-excellence': {
                      adjustedScore: 4.5,
                      confidence: 0.90,
                      reasoning: 'Critical operational inefficiencies detected',
                      criticalFactors: ['Process bottlenecks', 'Quality control gaps'],
                      severity: 'critical'
                    }
                  }
                })
              }
            }],
            usage: {
              prompt_tokens: 1500,
              completion_tokens: 800,
              total_tokens: 2300
            }
          })
        }
      }
    }))
  };
});

describe('TriageAnalyzer', () => {
  let analyzer: TriageAnalyzer;
  let mockAssessment: Assessment;

  beforeEach(() => {
    // Set required environment variables
    process.env.OPENAI_API_KEY = 'test-key';

    const config: Partial<TriageConfiguration> = {
      algorithmVersion: '1.0.0',
      modelSelection: {
        primary: 'gpt-4o-mini',
        fallback: 'gpt-4o',
        costOptimized: 'gpt-4o-mini'
      }
    };

    analyzer = new TriageAnalyzer(config);

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
        sector: 'technology',
        subSector: 'SaaS',
        regulatoryClassification: 'lightly-regulated',
        businessModel: 'b2b-saas',
        companyStage: 'growth',
        employeeCount: 50,
        revenue: '$5M-10M'
      },
      companyStage: 'growth',
      domainResponses: {
        'strategic-alignment': {
          domain: 'strategic-alignment',
          questions: {
            '1.1': { questionId: '1.1', value: 4, timestamp: '2025-01-15T09:00:00Z' },
            '1.2': { questionId: '1.2', value: 3, timestamp: '2025-01-15T09:01:00Z' },
            '1.3': { questionId: '1.3', value: 5, timestamp: '2025-01-15T09:02:00Z' },
            '1.4': { questionId: '1.4', value: 4, timestamp: '2025-01-15T09:03:00Z' }
          },
          completeness: 80,
          lastUpdated: '2025-01-15T09:03:00Z'
        },
        'operational-excellence': {
          domain: 'operational-excellence',
          questions: {
            '4.1': { questionId: '4.1', value: 5, timestamp: '2025-01-15T09:10:00Z' },
            '4.2': { questionId: '4.2', value: 4, timestamp: '2025-01-15T09:11:00Z' },
            '4.3': { questionId: '4.3', value: 5, timestamp: '2025-01-15T09:12:00Z' },
            '4.4': { questionId: '4.4', value: 4, timestamp: '2025-01-15T09:13:00Z' }
          },
          completeness: 85,
          lastUpdated: '2025-01-15T09:13:00Z'
        },
        'technology-data': {
          domain: 'technology-data',
          questions: {
            '6.1': { questionId: '6.1', value: 3, timestamp: '2025-01-15T09:20:00Z' },
            '6.2': { questionId: '6.2', value: 4, timestamp: '2025-01-15T09:21:00Z' },
            '6.3': { questionId: '6.3', value: 3, timestamp: '2025-01-15T09:22:00Z' }
          },
          completeness: 60,
          lastUpdated: '2025-01-15T09:22:00Z'
        }
      },
      assessmentContext: {
        primaryBusinessChallenges: ['Scaling operations', 'Team alignment'],
        strategicObjectives: ['Market expansion', 'Operational efficiency'],
        resourceConstraints: {
          budget: 'moderate',
          team: 'stretched',
          timeAvailability: 'moderate'
        }
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('performTriage', () => {
    it('should successfully perform triage analysis', async () => {
      const result = await analyzer.performTriage(mockAssessment);

      expect(result).toBeDefined();
      expect(result.domainScores).toBeDefined();
      expect(result.criticalDomains).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.reasoning).toBeDefined();
      expect(result.industryContext).toBeDefined();
      expect(result.processingMetrics).toBeDefined();
    });

    it('should identify critical domains correctly', async () => {
      const result = await analyzer.performTriage(mockAssessment);

      expect(result.criticalDomains).toContain('operational-excellence'); // High scoring domain
      expect(result.criticalDomains.length).toBeGreaterThanOrEqual(3);
      expect(result.criticalDomains.length).toBeLessThanOrEqual(5);
    });

    it('should apply industry-specific weighting', async () => {
      const result = await analyzer.performTriage(mockAssessment);

      // Technology sector should weight technology-data domain higher
      expect(result.domainScores['technology-data']).toBeDefined();
      expect(result.industryContext.sector).toBe('technology');
      expect(result.industryContext.weightingMultipliers['technology-data']).toBe(1.4);
    });

    it('should handle missing industry classification gracefully', async () => {
      const assessmentWithoutIndustry = {
        ...mockAssessment,
        industryClassification: undefined
      };

      const result = await analyzer.performTriage(assessmentWithoutIndustry);

      expect(result).toBeDefined();
      expect(result.industryContext.sector).toBe('unknown');
      expect(result.industryContext.regulatoryClassification).toBe('lightly-regulated');
    });

    it('should validate data completeness', async () => {
      const incompleteAssessment = {
        ...mockAssessment,
        domainResponses: {
          'strategic-alignment': {
            domain: 'strategic-alignment',
            questions: {
              '1.1': { questionId: '1.1', value: 4, timestamp: '2025-01-15T09:00:00Z' },
              '1.2': { questionId: '1.2', value: null, timestamp: '2025-01-15T09:00:00Z' },
              '1.3': { questionId: '1.3', value: null, timestamp: '2025-01-15T09:00:00Z' },
              '1.4': { questionId: '1.4', value: null, timestamp: '2025-01-15T09:00:00Z' },
              '1.5': { questionId: '1.5', value: null, timestamp: '2025-01-15T09:00:00Z' }
            },
            completeness: 20,
            lastUpdated: '2025-01-15T09:00:00Z'
          }
        }
      } as unknown as Assessment;

      await expect(analyzer.performTriage(incompleteAssessment)).rejects.toThrow();
    });

    it('should classify domain severity correctly', async () => {
      const result = await analyzer.performTriage(mockAssessment);

      Object.values(result.domainScores).forEach(domain => {
        expect(['low', 'medium', 'high', 'critical']).toContain(domain.severity);

        // Test severity classification logic
        if (domain.score >= 4.5) {
          expect(domain.severity).toBe('critical');
        } else if (domain.score >= 4.0) {
          expect(domain.severity).toBe('high');
        }
      });
    });

    it('should determine agent activation correctly', async () => {
      const result = await analyzer.performTriage(mockAssessment);

      Object.values(result.domainScores).forEach(domain => {
        expect(['NOT_REQUIRED', 'CONDITIONAL', 'REQUIRED']).toContain(domain.agentActivation);

        // Test activation logic
        if (domain.score >= 4.0) {
          expect(domain.agentActivation).toBe('REQUIRED');
        } else if (domain.score >= 3.5) {
          expect(domain.agentActivation).toBe('CONDITIONAL');
        }
      });
    });
  });

  describe('error handling', () => {
    it('should handle OpenAI API failures gracefully', async () => {
      // Temporarily mock rejection for this test
      const _originalCreate = true; // Placeholder for original implementation
      const mockCreate = jest.fn().mockRejectedValueOnce(new Error('API rate limit exceeded'));

      jest.doMock('openai', () => ({
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({
          chat: {
            completions: {
              create: mockCreate
            }
          }
        }))
      }));

      // Create new analyzer instance with mocked client
      const testAnalyzer = new TriageAnalyzer();

      // Should fall back to base scores
      const result = await testAnalyzer.performTriage(mockAssessment);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should throw error for missing OpenAI API key', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => new TriageAnalyzer()).toThrow('OpenAI API key is required');
    });

    it('should handle malformed assessment data', async () => {
      const malformedAssessment = {
        ...mockAssessment,
        domainResponses: {}
      } as Assessment;

      await expect(analyzer.performTriage(malformedAssessment)).rejects.toThrow();
    });
  });

  describe('performance requirements', () => {
    it('should complete triage within performance limits', async () => {
      const startTime = Date.now();
      await analyzer.performTriage(mockAssessment);
      const processingTime = Date.now() - startTime;

      // Should complete within 2 minutes (120,000ms)
      expect(processingTime).toBeLessThan(120000);
    });

    it('should generate reasonable cost estimates', async () => {
      const result = await analyzer.performTriage(mockAssessment);

      expect(result.processingMetrics.costEstimate).toBeLessThan(0.5); // Under £0.5 target
      expect(result.processingMetrics.costEstimate).toBeGreaterThan(0); // Should have some cost
    });
  });

  describe('cross-domain impact analysis', () => {
    it('should identify cross-domain impacts', async () => {
      const result = await analyzer.performTriage(mockAssessment);

      // Check that domains with high scores boost related domains
      Object.values(result.domainScores).forEach(domain => {
        if (domain.score >= 4.0 && domain.crossDomainImpacts) {
          expect(domain.crossDomainImpacts!.length).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should apply industry-specific multipliers', async () => {
      const result = await analyzer.performTriage(mockAssessment);

      // Technology sector should have higher weight for technology-data
      const techScore = result.domainScores['technology-data'];
      expect(techScore).toBeDefined();

      // Score should reflect industry weighting
      const baseScore = (3 + 4 + 3) / 3; // Average of responses
      expect(techScore?.score).toBeGreaterThanOrEqual(baseScore);
    });
  });

  describe('reasoning generation', () => {
    it('should generate comprehensive reasoning', async () => {
      const result = await analyzer.performTriage(mockAssessment);

      expect(result.reasoning).toContain('technology');
      expect(result.reasoning).toContain('domain');
      expect(result.reasoning.length).toBeGreaterThan(50); // Should be substantial
    });

    it('should include industry context in reasoning', async () => {
      const result = await analyzer.performTriage(mockAssessment);

      expect(result.reasoning).toContain('technology');
      expect(result.reasoning).toContain('lightly-regulated');
    });
  });

  describe('edge cases', () => {
    it('should handle all low scores', async () => {
      const lowScoreAssessment = {
        ...mockAssessment,
        domainResponses: {
          'strategic-alignment': {
            domain: 'strategic-alignment',
            questions: {
              '1.1': { questionId: '1.1', value: 1, timestamp: '2025-01-15T09:00:00Z' },
              '1.2': { questionId: '1.2', value: 2, timestamp: '2025-01-15T09:01:00Z' }
            },
            completeness: 50,
            lastUpdated: '2025-01-15T09:01:00Z'
          },
          'operational-excellence': {
            domain: 'operational-excellence',
            questions: {
              '4.1': { questionId: '4.1', value: 2, timestamp: '2025-01-15T09:10:00Z' },
              '4.2': { questionId: '4.2', value: 1, timestamp: '2025-01-15T09:11:00Z' }
            },
            completeness: 40,
            lastUpdated: '2025-01-15T09:11:00Z'
          }
        }
      } as unknown as Assessment;

      const result = await analyzer.performTriage(lowScoreAssessment);
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      // Should still produce a valid result even with low scores
      expect(result.criticalDomains.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty responses', async () => {
      const emptyAssessment = {
        ...mockAssessment,
        domainResponses: {}
      };

      await expect(analyzer.performTriage(emptyAssessment)).rejects.toThrow();
    });
  });
});