import { GapResolutionResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the gap analysis service before importing the handler
jest.mock('../../../services/gap-analysis-service');

import { GapAnalysisService } from '../../../services/gap-analysis-service';
import { handler, __resetService } from '../resolve-gap';
import { createMockAssessmentGap } from '../test-utils';

const MockedGapAnalysisService = GapAnalysisService as jest.MockedClass<typeof GapAnalysisService>;

describe('resolve-gap Lambda function', () => {
  let mockGapAnalysisService: jest.Mocked<GapAnalysisService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGapAnalysisService = {
      resolveGap: jest.fn()
    } as any;
    MockedGapAnalysisService.mockImplementation(() => mockGapAnalysisService);

    // Reset the service instance for each test
    __resetService();
  });

  it('should resolve gap successfully with client response', async () => {
    const mockResponse: GapResolutionResponse = {
      gapId: 'gap-123',
      resolved: true,
      impactOnCompleteness: 5,
      newGaps: [],
      message: 'Gap resolved successfully'
    };

    mockGapAnalysisService.resolveGap.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        gapId: 'gap-123'
      },
      body: JSON.stringify({
        gapId: 'gap-123',
        clientResponse: 'We have implemented proper security protocols including regular security audits.',
        additionalContext: 'Our team completed security training last month.'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/gap-123/resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockGapAnalysisService.resolveGap).toHaveBeenCalledWith({
      gapId: 'gap-123',
      clientResponse: 'We have implemented proper security protocols including regular security audits.',
      additionalContext: 'Our team completed security training last month.'
    });

    const responseBody = JSON.parse(result.body);
    expect(responseBody.gapId).toBe('gap-123');
    expect(responseBody.resolved).toBe(true);
    expect(responseBody.impactOnCompleteness).toBe(5);
  });

  it('should resolve gap by skipping', async () => {
    const mockResponse: GapResolutionResponse = {
      gapId: 'gap-456',
      resolved: true,
      impactOnCompleteness: 0,
      newGaps: [],
      message: 'Gap skipped successfully'
    };

    mockGapAnalysisService.resolveGap.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        gapId: 'gap-456'
      },
      body: JSON.stringify({
        gapId: 'gap-456',
        skipGap: true,
        skipReason: 'Not applicable to our business model'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/gap-456/resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockGapAnalysisService.resolveGap).toHaveBeenCalledWith({
      gapId: 'gap-456',
      skipGap: true,
      skipReason: 'Not applicable to our business model'
    });
  });

  it('should handle missing gap ID in path', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: null,
      body: JSON.stringify({
        gapId: 'gap-123',
        clientResponse: 'Some response'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps//resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Gap ID is required');
  });

  it('should handle missing request body', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        gapId: 'gap-123'
      },
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/gap-123/resolve',
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
        gapId: 'gap-123'
      },
      body: '{ invalid json }',
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/gap-123/resolve',
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

  it('should handle missing gap ID in request body', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        gapId: 'gap-123'
      },
      body: JSON.stringify({
        clientResponse: 'Some response'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/gap-123/resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Gap ID is required in request body');
  });

  it('should handle mismatched gap IDs', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        gapId: 'gap-123'
      },
      body: JSON.stringify({
        gapId: 'gap-456',
        clientResponse: 'Some response'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/gap-123/resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Gap ID in path must match gap ID in request body');
  });

  it('should handle missing client response when not skipping', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        gapId: 'gap-123'
      },
      body: JSON.stringify({
        gapId: 'gap-123'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/gap-123/resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Either clientResponse or skipGap must be provided');
  });

  it('should handle service errors gracefully', async () => {
    mockGapAnalysisService.resolveGap.mockRejectedValue(new Error('Gap not found'));

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        gapId: 'non-existent-gap'
      },
      body: JSON.stringify({
        gapId: 'non-existent-gap',
        clientResponse: 'Some response'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/non-existent-gap/resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Gap not found');
    expect(responseBody.gapId).toBe('non-existent-gap');
  });

  it('should include CORS headers in response', async () => {
    const mockResponse: GapResolutionResponse = {
      gapId: 'gap-123',
      resolved: true,
      impactOnCompleteness: 5,
      newGaps: [],
      message: 'Gap resolved successfully'
    };

    mockGapAnalysisService.resolveGap.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        gapId: 'gap-123'
      },
      body: JSON.stringify({
        gapId: 'gap-123',
        clientResponse: 'Test response'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/gap-123/resolve',
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

  it('should handle empty client response', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: {
        gapId: 'gap-123'
      },
      body: JSON.stringify({
        gapId: 'gap-123',
        clientResponse: '   ' // Only whitespace
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/gap-123/resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Either clientResponse or skipGap must be provided');
  });

  it('should handle resolution that generates new gaps', async () => {
    const mockResponse: GapResolutionResponse = {
      gapId: 'gap-123',
      resolved: true,
      impactOnCompleteness: 3,
      newGaps: [
        createMockAssessmentGap({
          gapId: 'gap-new-1',
          description: 'Follow-up question about implementation timeline',
          category: 'important',
          domain: 'strategic-alignment'
        }),
        createMockAssessmentGap({
          gapId: 'gap-new-2',
          description: 'Additional context needed for security measures',
          category: 'critical',
          domain: 'risk-compliance'
        })
      ],
      message: 'Gap resolved with new follow-up gaps identified'
    };

    mockGapAnalysisService.resolveGap.mockResolvedValue(mockResponse);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        gapId: 'gap-123'
      },
      body: JSON.stringify({
        gapId: 'gap-123',
        clientResponse: 'We plan to implement this over the next quarter with budget approval pending.'
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/gaps/gap-123/resolve',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: ''
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.newGaps).toHaveLength(2);
    expect(responseBody.newGaps[0].category).toBe('important');
    expect(responseBody.newGaps[1].category).toBe('critical');
  });
});