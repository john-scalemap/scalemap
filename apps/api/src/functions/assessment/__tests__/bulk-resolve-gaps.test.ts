import { BulkGapResolutionResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the gap analysis service before importing the handler
jest.mock('../../../services/gap-analysis-service');

import { GapAnalysisService } from '../../../services/gap-analysis-service';
import { handler, __resetService } from '../bulk-resolve-gaps';

const MockedGapAnalysisService = GapAnalysisService as jest.MockedClass<typeof GapAnalysisService>;

describe('bulk-resolve-gaps Lambda function', () => {
  let mockGapAnalysisService: jest.Mocked<GapAnalysisService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGapAnalysisService = {
      resolveBulkGaps: jest.fn()
    } as any;
    MockedGapAnalysisService.mockImplementation(() => mockGapAnalysisService);

    // Reset the service instance for each test
    __resetService();
  });

  it('should resolve bulk gaps successfully', async () => {
    const mockResponse: BulkGapResolutionResponse = {
      assessmentId: 'assessment-123',
      processedCount: 3,
      resolvedCount: 3,
      newGapsCount: 1,
      overallCompletenessScore: 92,
      failedResolutions: []
    };

    mockGapAnalysisService.resolveBulkGaps.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        assessmentId: 'assessment-123',
        resolutions: [
          {
            gapId: 'gap-1',
            clientResponse: 'We have implemented proper documentation processes.',
            additionalContext: 'Training completed last quarter.'
          },
          {
            gapId: 'gap-2',
            clientResponse: 'Security measures are in place and regularly audited.'
          },
          {
            gapId: 'gap-3',
            skipGap: true,
            skipReason: 'Not applicable to our current operations'
          }
        ]
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockGapAnalysisService.resolveBulkGaps).toHaveBeenCalledWith({
      assessmentId: 'assessment-123',
      resolutions: [
        {
          gapId: 'gap-1',
          clientResponse: 'We have implemented proper documentation processes.',
          additionalContext: 'Training completed last quarter.'
        },
        {
          gapId: 'gap-2',
          clientResponse: 'Security measures are in place and regularly audited.'
        },
        {
          gapId: 'gap-3',
          skipGap: true,
          skipReason: 'Not applicable to our current operations'
        }
      ]
    });

    const responseBody = JSON.parse(result.body);
    expect(responseBody.assessmentId).toBe('assessment-123');
    expect(responseBody.processedCount).toBe(3);
    expect(responseBody.resolvedCount).toBe(3);
    expect(responseBody.newGapsCount).toBe(1);
    expect(responseBody.overallCompletenessScore).toBe(92);
  });

  it('should handle partial failures in bulk resolution', async () => {
    const mockResponse: BulkGapResolutionResponse = {
      assessmentId: 'assessment-123',
      processedCount: 3,
      resolvedCount: 2,
      newGapsCount: 0,
      overallCompletenessScore: 87,
      failedResolutions: [
        {
          gapId: 'gap-3',
          error: 'Gap not found in database'
        }
      ]
    };

    mockGapAnalysisService.resolveBulkGaps.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        assessmentId: 'assessment-123',
        resolutions: [
          {
            gapId: 'gap-1',
            clientResponse: 'Valid response 1'
          },
          {
            gapId: 'gap-2',
            clientResponse: 'Valid response 2'
          },
          {
            gapId: 'gap-3',
            clientResponse: 'Response for non-existent gap'
          }
        ]
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.resolvedCount).toBe(2);
    expect(responseBody.failedResolutions).toHaveLength(1);
    expect(responseBody.failedResolutions[0].gapId).toBe('gap-3');
  });

  it('should handle missing assessment ID in path', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: null,
      body: JSON.stringify({
        assessmentId: 'assessment-123',
        resolutions: [{ gapId: 'gap-1', clientResponse: 'response' }]
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments//gaps/bulk-resolve',
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

  it('should handle missing request body', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Request body is required');
  });

  it('should handle malformed JSON in request body', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: '{ invalid json }',
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Invalid JSON in request body');
  });

  it('should handle missing assessment ID in request body', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        resolutions: [{ gapId: 'gap-1', clientResponse: 'response' }]
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Assessment ID is required in request body');
  });

  it('should handle mismatched assessment IDs', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        assessmentId: 'assessment-456',
        resolutions: [{ gapId: 'gap-1', clientResponse: 'response' }]
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Assessment ID in path must match assessment ID in request body');
  });

  it('should handle missing resolutions array', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        assessmentId: 'assessment-123'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Resolutions array is required');
  });

  it('should handle empty resolutions array', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        assessmentId: 'assessment-123',
        resolutions: []
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('At least one resolution is required');
  });

  it('should handle invalid resolution format', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        assessmentId: 'assessment-123',
        resolutions: [
          { gapId: 'gap-1', clientResponse: 'Valid response' },
          { clientResponse: 'Missing gap ID' } // Missing gapId
        ]
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Resolution 2: Gap ID is required');
  });

  it('should handle resolution with missing response', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        assessmentId: 'assessment-123',
        resolutions: [
          { gapId: 'gap-1', clientResponse: 'Valid response' },
          { gapId: 'gap-2' } // Missing both clientResponse and skipGap
        ]
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Resolution 2: Either clientResponse or skipGap must be provided');
  });

  it('should handle too many resolutions', async () => {
    const resolutions = Array.from({ length: 51 }, (_, i) => ({
      gapId: `gap-${i + 1}`,
      clientResponse: `Response ${i + 1}`
    }));

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        assessmentId: 'assessment-123',
        resolutions
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Maximum 50 resolutions allowed per bulk request');
  });

  it('should handle service errors gracefully', async () => {
    mockGapAnalysisService.resolveBulkGaps.mockRejectedValue(new Error('Assessment not found'));

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'non-existent-assessment'
      },
      body: JSON.stringify({
        assessmentId: 'non-existent-assessment',
        resolutions: [
          { gapId: 'gap-1', clientResponse: 'Some response' }
        ]
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/non-existent-assessment/gaps/bulk-resolve',
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

  it('should include CORS headers in response', async () => {
    const mockResponse: BulkGapResolutionResponse = {
      assessmentId: 'assessment-123',
      processedCount: 1,
      resolvedCount: 1,
      newGapsCount: 0,
      overallCompletenessScore: 90,
      failedResolutions: []
    };

    mockGapAnalysisService.resolveBulkGaps.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        assessmentId: 'assessment-123',
        resolutions: [
          { gapId: 'gap-1', clientResponse: 'Test response' }
        ]
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
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

  it('should handle mixed resolution types', async () => {
    const mockResponse: BulkGapResolutionResponse = {
      assessmentId: 'assessment-123',
      processedCount: 4,
      resolvedCount: 4,
      newGapsCount: 2,
      overallCompletenessScore: 94,
      failedResolutions: []
    };

    mockGapAnalysisService.resolveBulkGaps.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'assessment-123'
      },
      body: JSON.stringify({
        assessmentId: 'assessment-123',
        resolutions: [
          {
            gapId: 'gap-1',
            clientResponse: 'Detailed response with implementation plan',
            additionalContext: 'This includes timeline and budget considerations'
          },
          {
            gapId: 'gap-2',
            skipGap: true,
            skipReason: 'Not applicable to our business model'
          },
          {
            gapId: 'gap-3',
            clientResponse: 'We have partially implemented this and will complete it next quarter'
          },
          {
            gapId: 'gap-4',
            skipGap: true,
            skipReason: 'Regulatory exemption applies'
          }
        ]
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: '/assessments/assessment-123/gaps/bulk-resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.processedCount).toBe(4);
    expect(responseBody.resolvedCount).toBe(4);
    expect(responseBody.newGapsCount).toBe(2);
  });
});