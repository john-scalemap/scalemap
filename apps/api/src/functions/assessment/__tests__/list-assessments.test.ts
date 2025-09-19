import { marshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// Mock AWS SDK BEFORE importing the handler
const mockDynamoDBSend = jest.fn();
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockDynamoDBSend,
  })),
  QueryCommand: jest.fn().mockImplementation((params) => params),
}));

import { handler } from '../list-assessments';

// Mock JWT service
jest.mock('../../../services/jwt', () => ({
  jwtService: {
    extractTokenFromHeader: jest.fn().mockReturnValue('test-jwt-token'),
    validateAccessToken: jest.fn().mockResolvedValue({
      companyId: 'test-company-id-123',
      emailVerified: true,
    }),
  },
}));

// Set default behavior for DynamoDB mock to return empty results
mockDynamoDBSend.mockResolvedValue({
  Items: [],
  Count: 0,
});

const createMockEvent = (
  queryStringParameters: Record<string, string> | null = null,
  headers: Record<string, string> = {}
): APIGatewayProxyEvent => ({
  body: null,
  headers: {
    Authorization: 'Bearer test-jwt-token',
    ...headers,
  },
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/assessments',
  pathParameters: null,
  queryStringParameters,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {} as any,
  resource: '',
});

const createMockAssessment = (id: string, status: string = 'document-processing') => ({
  PK: `ASSESSMENT#${id}`,
  SK: 'METADATA',
  GSI1PK: 'COMPANY#test-company-id-123',
  GSI1SK: `ASSESSMENT#2024-01-01T00:00:00.000Z`,
  GSI2PK: `STATUS#${status}`,
  GSI2SK: 'CREATED#2024-01-01T00:00:00.000Z',
  id,
  companyId: 'test-company-id-123',
  companyName: 'Test Company',
  contactEmail: 'test@example.com',
  title: `Test Assessment ${id}`,
  description: 'Test description',
  status,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  domainResponses: {},
  progress: {
    overall: 25,
    domains: {},
    completeness: 25,
    estimatedTimeRemaining: '45-60 minutes',
  },
  deliverySchedule: {
    executive24h: '2024-01-02T00:00:00.000Z',
    detailed48h: '2024-01-03T00:00:00.000Z',
    implementation72h: '2024-01-04T00:00:00.000Z',
  },
  clarificationPolicy: {
    allowClarificationUntil: 'detailed48h',
    maxClarificationRequests: 3,
    maxTimelineExtension: 86400000,
  },
  TTL: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
});

describe('list-assessments Lambda function', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set default environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.DYNAMODB_TABLE_NAME = 'test-table';
  });

  describe('Authentication', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const event = createMockEvent(null, {});
      delete event.headers.Authorization;

      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result?.statusCode).toBe(401);
      expect(JSON.parse(result?.body || '')).toEqual({
        error: 'Authentication token required',
      });
    });

    it('should return 401 when authorization header is malformed', async () => {
      const event = createMockEvent(null, {
        Authorization: 'InvalidToken',
      });

      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result?.statusCode).toBe(401);
      expect(JSON.parse(result?.body || '')).toEqual({
        error: 'Authentication token required',
      });
    });
  });

  describe('Query Parameters Validation', () => {
    it('should return 400 when limit is less than 1', async () => {
      const event = createMockEvent({ limit: '0' });

      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result?.statusCode).toBe(400);
      expect(JSON.parse(result?.body || '')).toEqual({
        error: 'Limit must be between 1 and 100',
      });
    });

    it('should return 400 when limit is greater than 100', async () => {
      const event = createMockEvent({ limit: '101' });

      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result?.statusCode).toBe(400);
      expect(JSON.parse(result?.body || '')).toEqual({
        error: 'Limit must be between 1 and 100',
      });
    });
  });

  describe('DynamoDB Query', () => {
    it('should successfully query assessments with default status filter', async () => {
      const mockAssessment1 = createMockAssessment('assessment-1', 'document-processing');
      const mockAssessment2 = createMockAssessment('assessment-2', 'triaging');

      mockDynamoDBSend.mockResolvedValueOnce({
        Items: [marshall(mockAssessment1), marshall(mockAssessment2)],
        Count: 2,
        LastEvaluatedKey: undefined,
      });

      const event = createMockEvent();
      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      // Debug the response
      console.log('Response status:', result.statusCode);
      console.log('Response body:', result.body);

      expect(result?.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.count).toBe(2);
      expect(body.hasMore).toBe(false);
      expect(body.assessments).toHaveLength(2);
      expect(body.assessments[0].id).toBe('assessment-1');
      expect(body.assessments[1].id).toBe('assessment-2');

      // Verify DynamoDB query was called correctly
      expect(mockDynamoDBSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'scalemap-table',
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :companyPK AND begins_with(GSI1SK, :assessmentPrefix)',
          ScanIndexForward: false,
          Limit: 50,
        })
      );
    });

    it('should include payment-pending assessments in default filter', async () => {
      const paymentPendingAssessment = createMockAssessment(
        'assessment-pending',
        'payment-pending'
      );
      const inProgressAssessment = createMockAssessment(
        'assessment-processing',
        'document-processing'
      );

      mockDynamoDBSend.mockResolvedValueOnce({
        Items: [marshall(paymentPendingAssessment), marshall(inProgressAssessment)],
        Count: 2,
        LastEvaluatedKey: undefined,
      });

      const event = createMockEvent(); // No status filter = default
      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.assessments).toHaveLength(2);

      // Verify payment-pending assessment is included
      const paymentPending = body.assessments.find((a: any) => a.status === 'payment-pending');
      expect(paymentPending).toBeDefined();
      expect(paymentPending.id).toBe('assessment-pending');

      // Verify the DynamoDB call includes payment-pending in the filter
      const dynamoCall = mockDynamoDBSend.mock.calls[0][0];

      // Check filter expression and values - DynamoDB uses marshalled values
      expect(dynamoCall.FilterExpression).toContain('#status IN');
      const expressionValues = dynamoCall.ExpressionAttributeValues;
      const hasPaymentPending = Object.values(expressionValues).some(
        (val: any) => val.S === 'payment-pending'
      );
      expect(hasPaymentPending).toBe(true);
    });

    it('should filter by custom status values', async () => {
      const mockAssessment = createMockAssessment('assessment-1', 'completed');

      mockDynamoDBSend.mockResolvedValueOnce({
        Items: [marshall(mockAssessment)],
        Count: 1,
        LastEvaluatedKey: undefined,
      });

      const event = createMockEvent({ status: 'completed,failed' });
      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result?.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.count).toBe(1);
      expect(body.assessments[0].status).toBe('completed');

      // Verify status filter was applied
      expect(mockDynamoDBSend).toHaveBeenCalledWith(
        expect.objectContaining({
          FilterExpression: '#status IN (:status0, :status1)',
          ExpressionAttributeNames: { '#status': 'status' },
        })
      );
    });

    it('should respect custom limit parameter', async () => {
      mockDynamoDBSend.mockResolvedValueOnce({
        Items: [],
        Count: 0,
        LastEvaluatedKey: undefined,
      });

      const event = createMockEvent({ limit: '10' });
      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result?.statusCode).toBe(200);

      // Verify limit was applied
      expect(mockDynamoDBSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 10,
        })
      );
    });

    it('should handle pagination with hasMore flag', async () => {
      mockDynamoDBSend.mockResolvedValueOnce({
        Items: [marshall(createMockAssessment('assessment-1'))],
        Count: 1,
        LastEvaluatedKey: {
          PK: { S: 'ASSESSMENT#assessment-1' },
          SK: { S: 'METADATA' },
        },
      });

      const event = createMockEvent();
      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result?.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.hasMore).toBe(true);
    });
  });

  describe('Data Cleaning', () => {
    it('should remove internal DynamoDB fields from response', async () => {
      const mockAssessment = createMockAssessment('assessment-1');

      mockDynamoDBSend.mockResolvedValueOnce({
        Items: [marshall(mockAssessment)],
        Count: 1,
        LastEvaluatedKey: undefined,
      });

      const event = createMockEvent();
      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result?.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      const assessment = body.assessments[0];

      // Verify internal fields are removed
      expect(assessment.PK).toBeUndefined();
      expect(assessment.SK).toBeUndefined();
      expect(assessment.GSI1PK).toBeUndefined();
      expect(assessment.GSI1SK).toBeUndefined();
      expect(assessment.GSI2PK).toBeUndefined();
      expect(assessment.GSI2SK).toBeUndefined();
      expect(assessment.TTL).toBeUndefined();

      // Verify essential fields remain
      expect(assessment.id).toBe('assessment-1');
      expect(assessment.companyId).toBe('test-company-id-123');
      expect(assessment.status).toBe('document-processing');
    });
  });

  describe('Empty Results', () => {
    it('should handle empty results gracefully', async () => {
      mockDynamoDBSend.mockResolvedValueOnce({
        Items: [],
        Count: 0,
        LastEvaluatedKey: undefined,
      });

      const event = createMockEvent();
      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result?.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.assessments).toEqual([]);
      expect(body.count).toBe(0);
      expect(body.hasMore).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      const dynamoError = new Error('DynamoDB connection failed');
      mockDynamoDBSend.mockRejectedValueOnce(dynamoError);

      const event = createMockEvent();
      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result?.statusCode).toBe(500);
      expect(JSON.parse(result?.body || '')).toEqual({
        error: 'Internal server error',
        message: 'DynamoDB connection failed',
      });
    });

    it('should include CORS headers in error responses', async () => {
      const event = createMockEvent(null, {});
      delete event.headers.Authorization;

      const result = (await handler(event, {} as Context, {} as any)) as APIGatewayProxyResult;

      expect(result.headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
      });
    });
  });
});
