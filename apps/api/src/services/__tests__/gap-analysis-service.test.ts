import {
  Assessment,
  DomainName,
  DomainResponse,
  QuestionResponse,
  GapAnalysisRequest,
  AssessmentGap,
  GapCategory,
  IndustryClassification,
  ConflictingResponse
} from '@scalemap/shared';

import { GapAnalysisService } from '../gap-analysis-service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  GetItemCommand: jest.fn(),
  PutItemCommand: jest.fn(),
  QueryCommand: jest.fn(),
  UpdateItemCommand: jest.fn()
}));

jest.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: jest.fn((obj) => obj),
  unmarshall: jest.fn((obj) => obj)
}));

// Mock OpenAI service
jest.mock('../openai-service', () => ({
  OpenAIService: jest.fn().mockImplementation(() => ({
    generateCompletion: jest.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            {
              "question": "Can you provide more details about your current process?",
              "priority": "high",
              "category": "process_clarity"
            }
          ])
        }
      }]
    })
  }))
}));

describe('GapAnalysisService', () => {
  let gapAnalysisService: GapAnalysisService;
  let mockAssessment: Assessment;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Set up environment variables
    process.env.AWS_REGION = 'eu-west-1';
    process.env.DYNAMODB_TABLE_NAME = 'test-table';

    gapAnalysisService = new GapAnalysisService();

    // Create mock assessment data
    mockAssessment = createMockAssessment();
  });

  describe('analyzeGaps', () => {
    it('should analyze gaps successfully for a complete assessment', async () => {
      // Mock the private getAssessment method
      const getAssessmentSpy = jest.spyOn(gapAnalysisService as any, 'getAssessment')
        .mockResolvedValue(mockAssessment);

      const updateAssessmentSpy = jest.spyOn(gapAnalysisService as any, 'updateAssessmentWithGapAnalysis')
        .mockResolvedValue(undefined);

      const storeGapsSpy = jest.spyOn(gapAnalysisService as any, 'storeGapTrackingEntities')
        .mockResolvedValue(undefined);

      const request: GapAnalysisRequest = {
        assessmentId: 'test-assessment-123',
        analysisDepth: 'standard',
        forceReanalysis: true
      };

      const result = await gapAnalysisService.analyzeGaps(request);

      expect(getAssessmentSpy).toHaveBeenCalledWith('test-assessment-123');
      expect(result.assessmentId).toBe('test-assessment-123');
      expect(result.gapAnalysis).toBeDefined();
      expect(result.gapAnalysis.overallCompletenessScore).toBeGreaterThanOrEqual(0);
      expect(result.gapAnalysis.overallCompletenessScore).toBeLessThanOrEqual(100);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.modelUsed).toBe('gpt-4o-mini');
      expect(updateAssessmentSpy).toHaveBeenCalled();
      expect(storeGapsSpy).toHaveBeenCalled();
    });

    it('should return cached results when not forcing reanalysis', async () => {
      // Create assessment with existing gap analysis
      const assessmentWithGaps = {
        ...mockAssessment,
        gapAnalysis: {
          overallCompletenessScore: 85,
          domainCompleteness: {},
          industrySpecificGaps: [],
          lastAnalyzedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
          analysisVersion: 'v123',
          detectedGaps: [],
          criticalGapsCount: 0,
          totalGapsCount: 0
        }
      };

      const getAssessmentSpy = jest.spyOn(gapAnalysisService as any, 'getAssessment')
        .mockResolvedValue(assessmentWithGaps);

      const generateRecommendationsSpy = jest.spyOn(gapAnalysisService as any, 'generateRecommendations')
        .mockResolvedValue([]);

      const request: GapAnalysisRequest = {
        assessmentId: 'test-assessment-123',
        analysisDepth: 'standard',
        forceReanalysis: false
      };

      const result = await gapAnalysisService.analyzeGaps(request);

      expect(result.modelUsed).toBe('cached');
      expect(result.costEstimate).toBe(0);
      expect(generateRecommendationsSpy).toHaveBeenCalled();
    });

    it('should detect missing critical questions', async () => {
      // Create assessment with missing critical questions
      const incompleteAssessment = {
        ...mockAssessment,
        domainResponses: {
          'strategic-alignment': {
            domain: 'strategic-alignment' as DomainName,
            questions: {
              // Missing critical questions 1.1, 1.2, 1.3
            },
            completeness: 20,
            lastUpdated: new Date().toISOString()
          }
        }
      };

      const getAssessmentSpy = jest.spyOn(gapAnalysisService as any, 'getAssessment')
        .mockResolvedValue(incompleteAssessment);

      jest.spyOn(gapAnalysisService as any, 'updateAssessmentWithGapAnalysis')
        .mockResolvedValue(undefined);

      jest.spyOn(gapAnalysisService as any, 'storeGapTrackingEntities')
        .mockResolvedValue(undefined);

      const request: GapAnalysisRequest = {
        assessmentId: 'test-assessment-123',
        analysisDepth: 'standard',
        forceReanalysis: true
      };

      const result = await gapAnalysisService.analyzeGaps(request);

      expect(result.gapAnalysis.criticalGapsCount).toBeGreaterThan(0);
      expect(result.gapAnalysis.detectedGaps.some(gap => gap.category === 'critical')).toBe(true);
    });

    it('should analyze industry-specific gaps for financial services', async () => {
      // Create assessment for financial services company
      const financialAssessment = {
        ...mockAssessment,
        industryClassification: {
          sector: 'financial-services',
          subSector: 'investment-management',
          regulatoryClassification: 'heavily-regulated',
          businessModel: 'b2b-saas',
          companyStage: 'growth',
          employeeCount: 150
        } as IndustryClassification
      };

      const getAssessmentSpy = jest.spyOn(gapAnalysisService as any, 'getAssessment')
        .mockResolvedValue(financialAssessment);

      jest.spyOn(gapAnalysisService as any, 'updateAssessmentWithGapAnalysis')
        .mockResolvedValue(undefined);

      jest.spyOn(gapAnalysisService as any, 'storeGapTrackingEntities')
        .mockResolvedValue(undefined);

      const request: GapAnalysisRequest = {
        assessmentId: 'test-assessment-123',
        analysisDepth: 'comprehensive',
        forceReanalysis: true
      };

      const result = await gapAnalysisService.analyzeGaps(request);

      expect(result.gapAnalysis.industrySpecificGaps.length).toBeGreaterThan(0);
      expect(result.gapAnalysis.industrySpecificGaps.some(gap =>
        gap.regulation.includes('FCA')
      )).toBe(true);
    });

    it('should handle assessment not found', async () => {
      const getAssessmentSpy = jest.spyOn(gapAnalysisService as any, 'getAssessment')
        .mockResolvedValue(null);

      const request: GapAnalysisRequest = {
        assessmentId: 'non-existent-assessment',
        analysisDepth: 'standard'
      };

      await expect(gapAnalysisService.analyzeGaps(request)).rejects.toThrow('Assessment not found');
    });
  });

  describe('resolveGap', () => {
    it('should resolve gap with client response', async () => {
      const mockGap: AssessmentGap = {
        gapId: 'gap-123',
        assessmentId: 'assessment-123',
        domain: 'strategic-alignment',
        category: 'critical',
        description: 'Missing strategic vision',
        detectedAt: new Date().toISOString(),
        suggestedQuestions: ['What is your company vision?'],
        followUpPrompts: ['Please provide more details'],
        resolved: false,
        impactOnTimeline: true,
        priority: 9,
        estimatedResolutionTime: 15
      };

      const getGapSpy = jest.spyOn(gapAnalysisService as any, 'getGap')
        .mockResolvedValue(mockGap);

      const updateGapSpy = jest.spyOn(gapAnalysisService as any, 'updateGap')
        .mockResolvedValue(undefined);

      const analyzeResponseSpy = jest.spyOn(gapAnalysisService as any, 'analyzeResponseForNewGaps')
        .mockResolvedValue([]);

      const result = await gapAnalysisService.resolveGap({
        gapId: 'gap-123',
        clientResponse: 'Our vision is to become the leading provider in our industry.'
      });

      expect(result.resolved).toBe(true);
      expect(result.gapId).toBe('gap-123');
      expect(updateGapSpy).toHaveBeenCalledWith('gap-123', expect.objectContaining({
        clientResponse: 'Our vision is to become the leading provider in our industry.',
        resolved: true,
        resolutionMethod: 'client-input'
      }));
    });

    it('should skip gap when requested', async () => {
      const mockGap: AssessmentGap = {
        gapId: 'gap-123',
        assessmentId: 'assessment-123',
        domain: 'strategic-alignment',
        category: 'nice-to-have',
        description: 'Optional additional context',
        detectedAt: new Date().toISOString(),
        suggestedQuestions: ['Any additional thoughts?'],
        followUpPrompts: ['This is optional'],
        resolved: false,
        impactOnTimeline: false,
        priority: 3,
        estimatedResolutionTime: 5
      };

      const getGapSpy = jest.spyOn(gapAnalysisService as any, 'getGap')
        .mockResolvedValue(mockGap);

      const markResolvedSpy = jest.spyOn(gapAnalysisService as any, 'markGapResolved')
        .mockResolvedValue(undefined);

      const result = await gapAnalysisService.resolveGap({
        gapId: 'gap-123',
        clientResponse: '',
        skipGap: true
      });

      expect(result.resolved).toBe(true);
      expect(result.message).toBe('Gap marked as resolved by user');
      expect(markResolvedSpy).toHaveBeenCalledWith('gap-123', 'founder-override');
    });

    it('should handle gap not found', async () => {
      const getGapSpy = jest.spyOn(gapAnalysisService as any, 'getGap')
        .mockResolvedValue(null);

      await expect(gapAnalysisService.resolveGap({
        gapId: 'non-existent-gap',
        clientResponse: 'Some response'
      })).rejects.toThrow('Gap not found');
    });
  });

  describe('resolveBulkGaps', () => {
    it('should resolve multiple gaps successfully', async () => {
      const resolveGapSpy = jest.spyOn(gapAnalysisService, 'resolveGap')
        .mockResolvedValueOnce({
          gapId: 'gap-1',
          resolved: true,
          impactOnCompleteness: 5,
          message: 'Resolved successfully'
        })
        .mockResolvedValueOnce({
          gapId: 'gap-2',
          resolved: true,
          impactOnCompleteness: 3,
          message: 'Resolved successfully'
        });

      const getAssessmentSpy = jest.spyOn(gapAnalysisService as any, 'getAssessment')
        .mockResolvedValue({
          ...mockAssessment,
          gapAnalysis: {
            overallCompletenessScore: 85
          }
        });

      const result = await gapAnalysisService.resolveBulkGaps({
        assessmentId: 'assessment-123',
        resolutions: [
          {
            gapId: 'gap-1',
            clientResponse: 'Response 1'
          },
          {
            gapId: 'gap-2',
            clientResponse: 'Response 2'
          }
        ]
      });

      expect(result.processedCount).toBe(2);
      expect(result.resolvedCount).toBe(2);
      expect(result.failedResolutions).toHaveLength(0);
      expect(result.overallCompletenessScore).toBe(85);
    });

    it('should handle partial failures in bulk resolution', async () => {
      const resolveGapSpy = jest.spyOn(gapAnalysisService, 'resolveGap')
        .mockResolvedValueOnce({
          gapId: 'gap-1',
          resolved: true,
          impactOnCompleteness: 5,
          message: 'Resolved successfully'
        })
        .mockRejectedValueOnce(new Error('Resolution failed'));

      const getAssessmentSpy = jest.spyOn(gapAnalysisService as any, 'getAssessment')
        .mockResolvedValue({
          ...mockAssessment,
          gapAnalysis: {
            overallCompletenessScore: 75
          }
        });

      const result = await gapAnalysisService.resolveBulkGaps({
        assessmentId: 'assessment-123',
        resolutions: [
          {
            gapId: 'gap-1',
            clientResponse: 'Response 1'
          },
          {
            gapId: 'gap-2',
            clientResponse: 'Response 2'
          }
        ]
      });

      expect(result.processedCount).toBe(2);
      expect(result.resolvedCount).toBe(1);
      expect(result.failedResolutions).toHaveLength(1);
      expect(result.failedResolutions[0]?.gapId).toBe('gap-2');
      expect(result.failedResolutions[0]?.error).toBe('Resolution failed');
    });
  });

  describe('intelligent question generation', () => {
    it('should generate intelligent follow-up questions for brief responses', async () => {
      const service = gapAnalysisService as any;

      // Mock the OpenAI service response
      const mockOpenAIResponse = JSON.stringify({
        questions: [
          'What specific strategic initiatives are currently underway?',
          'How do you measure alignment between different departments?',
          'What challenges have you faced in maintaining strategic focus?'
        ],
        prompts: [
          'Please provide specific examples of how this works in practice',
          'Additional details would help us understand your strategic approach better'
        ]
      });

      const generateCompletionSpy = jest.spyOn(service.openAIService, 'generateCompletion')
        .mockResolvedValue(mockOpenAIResponse);

      const result = await service.generateIntelligentFollowUpQuestions(
        'strategic-alignment',
        '1.1',
        'Yes',
        'brief_response'
      );

      expect(generateCompletionSpy).toHaveBeenCalledWith(
        expect.stringContaining('DOMAIN: strategic alignment'),
        {
          model: 'gpt-4o-mini',
          maxTokens: 300,
          temperature: 0.8
        }
      );

      expect(result.questions).toHaveLength(3);
      expect(result.questions[0]).toContain('strategic initiatives');
      expect(result.prompts).toHaveLength(2);
    });

    it('should use fallback questions when OpenAI fails', async () => {
      const service = gapAnalysisService as any;

      // Mock OpenAI service to throw an error
      const generateCompletionSpy = jest.spyOn(service.openAIService, 'generateCompletion')
        .mockRejectedValue(new Error('OpenAI API error'));

      const result = await service.generateIntelligentFollowUpQuestions(
        'financial-management',
        '2.1',
        'Good',
        'lacks_depth'
      );

      expect(generateCompletionSpy).toHaveBeenCalled();
      expect(result.questions).toHaveLength(3);
      expect(result.questions[0]).toContain('specific processes');
      expect(result.prompts).toHaveLength(2);
    });

    it('should generate conflict resolution questions', async () => {
      const service = gapAnalysisService as any;

      const mockConflict: ConflictingResponse = {
        questionIds: ['financial-management.2.1', 'revenue-engine.3.1'],
        conflictDescription: 'Budget constraints conflict with aggressive growth plans',
        severity: 'major',
        suggestedResolution: 'Clarify funding strategy for growth plans'
      };

      const mockOpenAIResponse = JSON.stringify({
        questions: [
          'How do you plan to fund aggressive growth with current budget constraints?',
          'Are there external funding sources being considered for growth initiatives?',
          'What is the priority order for growth investments given budget limitations?'
        ],
        prompts: [
          'Understanding your funding strategy will help us provide better recommendations',
          'Please help us understand how these aspects work together in your organization'
        ]
      });

      const generateCompletionSpy = jest.spyOn(service.openAIService, 'generateCompletion')
        .mockResolvedValue(mockOpenAIResponse);

      const result = await service.generateConflictResolutionQuestions(
        'financial-management',
        mockConflict
      );

      expect(generateCompletionSpy).toHaveBeenCalledWith(
        expect.stringContaining('CONFLICT DESCRIPTION: Budget constraints conflict'),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0.7
        })
      );

      expect(result.questions).toHaveLength(3);
      expect(result.questions[0]).toContain('fund aggressive growth');
      expect(result.prompts).toHaveLength(2);
    });

    it('should perform AI gap analysis in comprehensive mode', async () => {
      const service = gapAnalysisService as any;

      const mockAIAnalysisResponse = JSON.stringify({
        hasGaps: true,
        identifiedGaps: [
          {
            description: 'Missing specific revenue metrics and growth targets',
            severity: 'important',
            suggestedQuestions: [
              'What are your specific revenue targets for the next 12 months?',
              'How do you track progress against revenue goals?'
            ],
            followUpPrompts: [
              'Specific metrics would help us understand your growth trajectory',
              'Please share any relevant KPIs or targets'
            ],
            estimatedTime: 15
          }
        ]
      });

      const generateCompletionSpy = jest.spyOn(service.openAIService, 'generateCompletion')
        .mockResolvedValue(mockAIAnalysisResponse);

      const result = await service.performAIGapAnalysis(
        'test-assessment-123',
        'revenue-engine',
        '3.1',
        'We are growing well and expect continued success'
      );

      expect(generateCompletionSpy).toHaveBeenCalledWith(
        expect.stringContaining('DOMAIN: revenue engine'),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          maxTokens: 500,
          temperature: 0.7
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('important');
      expect(result[0].description).toContain('Missing specific revenue metrics');
      expect(result[0].suggestedQuestions).toHaveLength(2);
    });

    it('should handle malformed AI responses gracefully', async () => {
      const service = gapAnalysisService as any;

      // Mock malformed JSON response
      const generateCompletionSpy = jest.spyOn(service.openAIService, 'generateCompletion')
        .mockResolvedValue('{ invalid json response }');

      const result = await service.generateIntelligentFollowUpQuestions(
        'operational-excellence',
        '4.1',
        'We do things well',
        'brief_response'
      );

      expect(generateCompletionSpy).toHaveBeenCalled();
      expect(result.questions).toHaveLength(3); // Should use fallback questions
      expect(result.questions[0]).toContain('specific details');
    });
  });

  describe('completeness scoring', () => {
    it('should calculate correct completeness scores', async () => {
      // Test the private methods through public interface
      const service = gapAnalysisService as any;

      // Test domain completeness scoring
      const domainResponse: DomainResponse = {
        domain: 'strategic-alignment',
        questions: {
          '1.1': createMockQuestionResponse('Strong strategic vision with clear objectives and measurable outcomes'),
          '1.2': createMockQuestionResponse('Clear market positioning strategy that differentiates us from competitors'),
          '1.3': createMockQuestionResponse('Well-defined objectives with specific targets and detailed implementation plans')
        },
        completeness: 90,
        lastUpdated: new Date().toISOString()
      };

      const score = service.calculateDomainCompletenessScore('strategic-alignment', domainResponse, 0);
      expect(score).toBeGreaterThan(70); // Should be high for complete responses

      // Test data quality scoring
      const qualityScore = service.calculateDataQualityScore(domainResponse);
      expect(qualityScore).toBeGreaterThan(50); // Should be reasonable for good responses

      // Test response depth scoring
      const depthScore = service.calculateResponseDepthScore(domainResponse);
      expect(depthScore).toBeGreaterThan(0);
    });

    it('should penalize empty or shallow responses', async () => {
      const service = gapAnalysisService as any;

      const poorDomainResponse: DomainResponse = {
        domain: 'strategic-alignment',
        questions: {
          '1.1': createMockQuestionResponse('No'),
          '1.2': createMockQuestionResponse('Yes'),
          '1.3': createMockQuestionResponse('')
        },
        completeness: 30,
        lastUpdated: new Date().toISOString()
      };

      const score = service.calculateDomainCompletenessScore('strategic-alignment', poorDomainResponse, 3);
      expect(score).toBeLessThan(50); // Should be low for poor responses

      const qualityScore = service.calculateDataQualityScore(poorDomainResponse);
      expect(qualityScore).toBeLessThan(70); // Should be low for shallow responses
    });
  });
});

// Helper functions
function createMockAssessment(): Assessment {
  return {
    id: 'test-assessment-123',
    companyId: 'test-company-456',
    companyName: 'Test Company Ltd',
    contactEmail: 'test@testcompany.com',
    status: 'triaging',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    domainResponses: {
      'strategic-alignment': createMockDomainResponse('strategic-alignment'),
      'financial-management': createMockDomainResponse('financial-management'),
      'revenue-engine': createMockDomainResponse('revenue-engine')
    },
    deliverySchedule: {
      executive24h: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      detailed48h: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      implementation72h: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    },
    clarificationPolicy: {
      allowClarificationUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxClarificationRequests: 3,
      maxTimelineExtension: 24
    }
  };
}

function createMockDomainResponse(domain: DomainName): DomainResponse {
  return {
    domain,
    questions: {
      '1.1': createMockQuestionResponse('Well-defined strategic objectives'),
      '1.2': createMockQuestionResponse('Clear market positioning strategy'),
      '1.3': createMockQuestionResponse('Strong competitive advantage')
    },
    completeness: 85,
    lastUpdated: new Date().toISOString()
  };
}

function createMockQuestionResponse(value: string): QuestionResponse {
  return {
    questionId: '1.1',
    value,
    timestamp: new Date().toISOString()
  };
}