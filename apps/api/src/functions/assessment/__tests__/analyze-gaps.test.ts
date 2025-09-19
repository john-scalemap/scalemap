import { GapAnalysisResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the gap analysis service before importing the handler
jest.mock('../../../services/gap-analysis-service');

import { GapAnalysisService } from '../../../services/gap-analysis-service';
import { handler, __resetService } from '../analyze-gaps';
import { createMockDomainCompletenessRecord } from '../test-utils';

const MockedGapAnalysisService = GapAnalysisService as jest.MockedClass<typeof GapAnalysisService>;

describe('analyze-gaps Lambda function', () => {
  let mockGapAnalysisService: jest.Mocked<GapAnalysisService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGapAnalysisService = {
      analyzeGaps: jest.fn()
    } as any;
    MockedGapAnalysisService.mockImplementation(() => mockGapAnalysisService);

    // Reset the service instance for each test
    __resetService();
  });

  it('should analyze gaps successfully', async () => {
    const mockResponse: GapAnalysisResponse = {
      assessmentId: 'test-assessment-123',
      gapAnalysis: {
        overallCompletenessScore: 85,
        domainCompleteness: createMockDomainCompletenessRecord(),
        industrySpecificGaps: [],
        lastAnalyzedAt: new Date().toISOString(),
        analysisVersion: 'v123',
        detectedGaps: [],
        criticalGapsCount: 0,
        totalGapsCount: 0
      },
      processingTime: 1500,
      modelUsed: 'gpt-4o-mini',
      costEstimate: 0.025,
      recommendations: []
    };

    mockGapAnalysisService.analyzeGaps.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      body: JSON.stringify({
        analysisDepth: 'standard',
        forceReanalysis: false
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/gaps/analyze',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockGapAnalysisService.analyzeGaps).toHaveBeenCalledWith({
      assessmentId: 'test-assessment-123',
      analysisDepth: 'standard',
      forceReanalysis: false
    });

    const responseBody = JSON.parse(result.body);
    expect(responseBody.assessmentId).toBe('test-assessment-123');
    expect(responseBody.gapAnalysis.overallCompletenessScore).toBe(85);
  });

  it('should handle missing assessment ID', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: null,
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/assessments//gaps/analyze',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Assessment ID is required');
  });

  it('should handle invalid analysis depth', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      body: JSON.stringify({
        analysisDepth: 'invalid-depth'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/gaps/analyze',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toContain('Invalid analysis depth');
  });

  it('should handle service errors gracefully', async () => {
    mockGapAnalysisService.analyzeGaps.mockRejectedValue(new Error('Assessment not found'));

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'non-existent-assessment'
      },
      body: JSON.stringify({
        analysisDepth: 'standard'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/assessments/non-existent-assessment/gaps/analyze',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Assessment not found');
    expect(responseBody.assessmentId).toBe('non-existent-assessment');
  });

  it('should use default values for missing request body', async () => {
    const mockResponse: GapAnalysisResponse = {
      assessmentId: 'test-assessment-123',
      gapAnalysis: {
        overallCompletenessScore: 90,
        domainCompleteness: createMockDomainCompletenessRecord(),
        industrySpecificGaps: [],
        lastAnalyzedAt: new Date().toISOString(),
        analysisVersion: 'v124',
        detectedGaps: [],
        criticalGapsCount: 0,
        totalGapsCount: 0
      },
      processingTime: 1200,
      modelUsed: 'gpt-4o-mini',
      costEstimate: 0.020,
      recommendations: []
    };

    mockGapAnalysisService.analyzeGaps.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      body: null, // No body provided
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/gaps/analyze',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockGapAnalysisService.analyzeGaps).toHaveBeenCalledWith({
      assessmentId: 'test-assessment-123',
      analysisDepth: 'standard', // Default value
      forceReanalysis: false // Default value
    });
  });

  it('should handle malformed JSON in request body', async () => {
    const mockResponse: GapAnalysisResponse = {
      assessmentId: 'test-assessment-123',
      gapAnalysis: {
        overallCompletenessScore: 90,
        domainCompleteness: createMockDomainCompletenessRecord(),
        industrySpecificGaps: [],
        lastAnalyzedAt: new Date().toISOString(),
        analysisVersion: 'v124',
        detectedGaps: [],
        criticalGapsCount: 0,
        totalGapsCount: 0
      },
      processingTime: 1200,
      modelUsed: 'gpt-4o-mini',
      costEstimate: 0.020,
      recommendations: []
    };

    mockGapAnalysisService.analyzeGaps.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      body: '{ invalid json }', // Malformed JSON
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/gaps/analyze',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    // Should still work with default values
    expect(result.statusCode).toBe(200);
    expect(mockGapAnalysisService.analyzeGaps).toHaveBeenCalledWith({
      assessmentId: 'test-assessment-123',
      analysisDepth: 'standard',
      forceReanalysis: false
    });
  });

  it('should include CORS headers in response', async () => {
    const mockResponse: GapAnalysisResponse = {
      assessmentId: 'test-assessment-123',
      gapAnalysis: {
        overallCompletenessScore: 85,
        domainCompleteness: createMockDomainCompletenessRecord(),
        industrySpecificGaps: [],
        lastAnalyzedAt: new Date().toISOString(),
        analysisVersion: 'v123',
        detectedGaps: [],
        criticalGapsCount: 0,
        totalGapsCount: 0
      },
      processingTime: 1500,
      modelUsed: 'gpt-4o-mini',
      costEstimate: 0.025,
      recommendations: []
    };

    mockGapAnalysisService.analyzeGaps.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      body: '{}',
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/gaps/analyze',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.headers).toEqual({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    });
  });

  it('should handle comprehensive analysis depth', async () => {
    const mockResponse: GapAnalysisResponse = {
      assessmentId: 'test-assessment-123',
      gapAnalysis: {
        overallCompletenessScore: 92,
        domainCompleteness: createMockDomainCompletenessRecord(),
        industrySpecificGaps: [],
        lastAnalyzedAt: new Date().toISOString(),
        analysisVersion: 'v125',
        detectedGaps: [],
        criticalGapsCount: 0,
        totalGapsCount: 0
      },
      processingTime: 3500, // Longer processing time for comprehensive
      modelUsed: 'gpt-4o-mini',
      costEstimate: 0.055,
      recommendations: []
    };

    mockGapAnalysisService.analyzeGaps.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      body: JSON.stringify({
        analysisDepth: 'comprehensive',
        forceReanalysis: true,
        focusDomains: ['strategic-alignment', 'financial-management']
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/gaps/analyze',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockGapAnalysisService.analyzeGaps).toHaveBeenCalledWith({
      assessmentId: 'test-assessment-123',
      analysisDepth: 'comprehensive',
      forceReanalysis: true,
      focusDomains: ['strategic-alignment', 'financial-management']
    });

    const responseBody = JSON.parse(result.body);
    expect(responseBody.processingTime).toBe(3500);
    expect(responseBody.costEstimate).toBe(0.055);
  });
});