import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the timeline manager before importing the handler
jest.mock('../../../services/timeline-manager');

import { TimelineManager } from '../../../services/timeline-manager';
import { handler, __resetService } from '../get-timeline-status';
import { createMockTimelineStatus, createMockTimelinePauseEvent, createMockTimelineExtension } from '../test-utils';

const MockedTimelineManager = TimelineManager as jest.MockedClass<typeof TimelineManager>;

describe('get-timeline-status Lambda function', () => {
  let mockTimelineManager: jest.Mocked<TimelineManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimelineManager = {
      getTimelineStatus: jest.fn()
    } as any;
    MockedTimelineManager.mockImplementation(() => mockTimelineManager);

    // Reset the service instance for each test
    __resetService();
  });

  it('should get timeline status successfully', async () => {
    const mockTimelineStatus = createMockTimelineStatus({
      status: 'on-track',
      remainingTime: {
        executive24h: 20 * 60 * 60 * 1000, // 20 hours
        detailed48h: 44 * 60 * 60 * 1000, // 44 hours
        implementation72h: 68 * 60 * 60 * 1000 // 68 hours
      }
    });

    mockTimelineManager.getTimelineStatus.mockResolvedValue(mockTimelineStatus);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/timeline',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockTimelineManager.getTimelineStatus).toHaveBeenCalledWith('test-assessment-123');

    const responseBody = JSON.parse(result.body);
    expect(responseBody.assessmentId).toBe('test-assessment-123');
    expect(responseBody.timeline.status).toBe('on-track');
    expect(responseBody.nextSteps).toBeDefined();
    expect(responseBody.nextSteps.summary).toContain('progressing normally');
    expect(responseBody.lastUpdated).toBeDefined();
  });

  it('should handle paused timeline status', async () => {
    const mockTimelineStatus = createMockTimelineStatus({
      status: 'paused',
      pauseEvent: createMockTimelinePauseEvent({
        assessmentId: 'test-assessment-123',
        pauseReason: 'critical-gaps',
        estimatedResolutionTime: 45,
        nextStepsDescription: 'Please resolve the critical gaps'
      }),
      remainingTime: {
        executive24h: 20 * 60 * 60 * 1000,
        detailed48h: 44 * 60 * 60 * 1000,
        implementation72h: 68 * 60 * 60 * 1000
      }
    });

    mockTimelineManager.getTimelineStatus.mockResolvedValue(mockTimelineStatus);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/timeline',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.timeline.status).toBe('paused');
    expect(responseBody.timeline.pauseEvent).toBeDefined();
    expect(responseBody.timeline.pauseEvent.affectedGaps).toEqual(['gap-1', 'gap-2']);
    expect(responseBody.nextSteps.immediate.some((step: string) => step.includes('Review and resolve critical gaps'))).toBe(true);
    expect(responseBody.nextSteps.immediate.some((step: string) => step.includes('Address 2 critical gap(s)'))).toBe(true);
    expect(responseBody.nextSteps.summary).toContain('currently paused due to critical gaps');
  });

  it('should handle at-risk timeline status', async () => {
    const mockTimelineStatus = createMockTimelineStatus({
      status: 'at-risk',
      remainingTime: {
        executive24h: 2 * 60 * 60 * 1000, // 2 hours remaining
        detailed48h: 26 * 60 * 60 * 1000,
        implementation72h: 50 * 60 * 60 * 1000
      },
      riskFactors: ['Approaching 24h deadline']
    });

    mockTimelineManager.getTimelineStatus.mockResolvedValue(mockTimelineStatus);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/timeline',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.timeline.status).toBe('at-risk');
    expect(responseBody.timeline.riskFactors).toContain('Approaching 24h deadline');
    expect(responseBody.nextSteps.immediate.some((step: string) => step.includes('deadline is approaching'))).toBe(true);
    expect(responseBody.nextSteps.summary).toContain('timeline is at risk');
  });

  it('should handle overdue timeline status', async () => {
    const mockTimelineStatus = createMockTimelineStatus({
      status: 'overdue',
      remainingTime: {
        executive24h: -2 * 60 * 60 * 1000, // 2 hours overdue
        detailed48h: 22 * 60 * 60 * 1000,
        implementation72h: 46 * 60 * 60 * 1000
      },
      riskFactors: ['Timeline deadline exceeded']
    });

    mockTimelineManager.getTimelineStatus.mockResolvedValue(mockTimelineStatus);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/timeline',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.timeline.status).toBe('overdue');
    expect(responseBody.nextSteps.immediate.some((step: string) => step.includes('deadline has passed'))).toBe(true);
    expect(responseBody.nextSteps.immediate.some((step: string) => step.includes('contact support immediately'))).toBe(true);
    expect(responseBody.nextSteps.summary).toContain('deadline has passed');
  });

  it('should handle extended timeline status', async () => {
    const mockTimelineStatus = createMockTimelineStatus({
      status: 'extended',
      extensions: [
        createMockTimelineExtension({
          extensionId: 'ext-1',
          extensionType: 'gap-resolution',
          extensionDuration: 4 * 60 * 60 * 1000,
          justification: 'Critical gaps resolution'
        })
      ],
      remainingTime: {
        executive24h: 24 * 60 * 60 * 1000,
        detailed48h: 48 * 60 * 60 * 1000,
        implementation72h: 72 * 60 * 60 * 1000
      }
    });

    mockTimelineManager.getTimelineStatus.mockResolvedValue(mockTimelineStatus);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/timeline',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.timeline.status).toBe('extended');
    expect(responseBody.timeline.extensions).toHaveLength(1);
    expect(responseBody.nextSteps.immediate.some((step: string) => step.includes('timeline has been extended'))).toBe(true);
    expect(responseBody.nextSteps.immediate.some((step: string) => step.includes('no immediate action required'))).toBe(true);
  });

  it('should handle risk factors in next steps', async () => {
    const mockTimelineStatus = createMockTimelineStatus({
      status: 'on-track',
      extensions: [
        createMockTimelineExtension({ extensionId: 'ext-1' }),
        createMockTimelineExtension({ extensionId: 'ext-2' })
      ],
      remainingTime: {
        executive24h: 20 * 60 * 60 * 1000,
        detailed48h: 44 * 60 * 60 * 1000,
        implementation72h: 68 * 60 * 60 * 1000
      },
      riskFactors: [
        'High number of detected gaps',
        'Approaching maximum extension limit'
      ]
    });

    mockTimelineManager.getTimelineStatus.mockResolvedValue(mockTimelineStatus);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/timeline',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.nextSteps.immediate.some((step: string) => step.includes('Monitor gap resolution progress'))).toBe(true);
    expect(responseBody.nextSteps.immediate.some((step: string) => step.includes('extension options may be limited'))).toBe(true);
  });

  it('should handle missing assessment ID', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/assessments//timeline',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Assessment ID is required');
  });

  it('should handle service errors gracefully', async () => {
    mockTimelineManager.getTimelineStatus.mockRejectedValue(new Error('Assessment not found'));

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'non-existent-assessment'
      },
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/assessments/non-existent-assessment/timeline',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Assessment not found');
    expect(responseBody.assessmentId).toBe('non-existent-assessment');
  });

  it('should include CORS headers in response', async () => {
    const mockTimelineStatus = createMockTimelineStatus({
      remainingTime: {
        executive24h: 20 * 60 * 60 * 1000,
        detailed48h: 44 * 60 * 60 * 1000,
        implementation72h: 68 * 60 * 60 * 1000
      }
    });

    mockTimelineManager.getTimelineStatus.mockResolvedValue(mockTimelineStatus);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/timeline',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null
    };

    const result = await handler(event);

    expect(result.headers).toEqual({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    });
  });

  it('should generate appropriate next steps for different scenarios', async () => {
    // Test paused with multiple gaps
    const pausedStatus = createMockTimelineStatus({
      status: 'paused',
      pauseEvent: createMockTimelinePauseEvent({
        assessmentId: 'test-assessment-123',
        pauseReason: 'critical-gaps',
        affectedGaps: ['gap-1', 'gap-2', 'gap-3'],
        estimatedResolutionTime: 60,
        nextStepsDescription: 'Resolve critical gaps'
      }),
      remainingTime: {
        executive24h: 20 * 60 * 60 * 1000,
        detailed48h: 44 * 60 * 60 * 1000,
        implementation72h: 68 * 60 * 60 * 1000
      }
    });

    mockTimelineManager.getTimelineStatus.mockResolvedValue(pausedStatus);

    const event: APIGatewayProxyEvent = {
      pathParameters: {
        assessmentId: 'test-assessment-123'
      },
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/assessments/test-assessment-123/timeline',
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null
    };

    const result = await handler(event);
    const responseBody = JSON.parse(result.body);

    expect(responseBody.nextSteps.immediate.some((step: string) => step.includes('Address 3 critical gap(s)'))).toBe(true);
    expect(responseBody.nextSteps.upcoming.some((step: string) => step.includes('automatically resume'))).toBe(true);
    expect(responseBody.nextSteps.upcoming.some((step: string) => step.includes('email confirmation'))).toBe(true);
  });
});