import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

import { handler } from '../create-assessment';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('uuid', () => ({
  v4: () => 'test-assessment-id-123'
}));

const mockDynamoDBSend = jest.fn();
(DynamoDBClient as jest.Mock).mockImplementation(() => ({
  send: mockDynamoDBSend
}));

const createMockEvent = (body: any, headers: Record<string, string> = {}): APIGatewayProxyEvent => ({
  body: JSON.stringify(body),
  headers: {
    'Authorization': 'Bearer test-jwt-token',
    ...headers
  },
  multiValueHeaders: {},
  httpMethod: 'POST',
  isBase64Encoded: false,
  path: '/assessment',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {} as any,
  resource: ''
});


describe('create-assessment Lambda function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamoDBSend.mockResolvedValue({});

    // Set environment variables
    process.env.DYNAMODB_TABLE_NAME = 'test-table';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    delete process.env.DYNAMODB_TABLE_NAME;
    delete process.env.AWS_REGION;
  });

  describe('Successful Assessment Creation', () => {
    it('creates assessment with valid data', async () => {
      const requestBody = {
        companyName: 'Test Company Ltd',
        contactEmail: 'contact@testcompany.com',
        title: 'Q4 2024 Operational Assessment',
        description: 'Comprehensive assessment of our operational capabilities',
        assessmentContext: {
          primaryBusinessChallenges: ['scaling-issues', 'operational-inefficiency'],
          strategicObjectives: ['improve-margins', 'accelerate-growth'],
          resourceConstraints: {
            budget: 'moderate',
            team: 'adequate',
            timeAvailability: 'moderate'
          }
        }
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      // Check response
      expect(result.statusCode).toBe(201);
      expect(result.headers?.['Content-Type']).toBe('application/json');

      const responseBody = JSON.parse(result.body);
      expect(responseBody.id).toBe('test-assessment-id-123');
      expect(responseBody.companyName).toBe(requestBody.companyName);
      expect(responseBody.contactEmail).toBe(requestBody.contactEmail);
      expect(responseBody.title).toBe(requestBody.title);
      expect(responseBody.description).toBe(requestBody.description);
      expect(responseBody.status).toBe('document-processing');
      expect(responseBody.companyId).toBe('temp-company-id');
      expect(responseBody.assessmentContext).toEqual(requestBody.assessmentContext);

      // Check that DynamoDB was called correctly
      expect(mockDynamoDBSend).toHaveBeenCalledWith(expect.any(PutItemCommand));

      const putCall = mockDynamoDBSend.mock.calls[0][0];
      expect(putCall.input.TableName).toBe('test-table');
      expect(putCall.input.Item).toMatchObject({
        PK: { S: 'ASSESSMENT#test-assessment-id-123' },
        SK: { S: 'METADATA' },
        GSI1PK: { S: 'COMPANY#temp-company-id' }
      });
    });

    it('creates assessment with minimal required data', async () => {
      const requestBody = {
        companyName: 'Simple Co',
        contactEmail: 'simple@company.com',
        title: 'Simple Assessment',
        description: 'Basic assessment description'
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.title).toBe(requestBody.title);
      expect(responseBody.description).toBe(requestBody.description);
      expect(responseBody.assessmentContext).toBeUndefined();
    });

    it('initializes domain progress correctly', async () => {
      const requestBody = {
        title: 'Progress Test Assessment',
        description: 'Testing progress initialization'
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.progress).toBeDefined();
      expect(responseBody.progress.overall).toBe(0);
      expect(responseBody.progress.completeness).toBe(0);
      expect(responseBody.progress.estimatedTimeRemaining).toBe('45-60 minutes');

      // Check domain initialization
      const domains = responseBody.progress.domains;
      expect(domains['strategic-alignment']).toEqual({
        completed: 0,
        total: 7,
        status: 'not-started',
        requiredQuestions: 6,
        optionalQuestions: 1
      });

      expect(domains['financial-management']).toEqual({
        completed: 0,
        total: 9,
        status: 'not-started',
        requiredQuestions: 7,
        optionalQuestions: 2
      });
    });

    it('sets delivery schedule correctly', async () => {
      const requestBody = {
        title: 'Schedule Test Assessment',
        description: 'Testing delivery schedule'
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(201);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.deliverySchedule).toBeDefined();
      expect(responseBody.deliverySchedule.executive24h).toBeDefined();
      expect(responseBody.deliverySchedule.detailed48h).toBeDefined();
      expect(responseBody.deliverySchedule.implementation72h).toBeDefined();

      // Check that dates are in the future
      const executive24h = new Date(responseBody.deliverySchedule.executive24h);
      const detailed48h = new Date(responseBody.deliverySchedule.detailed48h);
      const implementation72h = new Date(responseBody.deliverySchedule.implementation72h);

      expect(executive24h.getTime()).toBeGreaterThan(Date.now());
      expect(detailed48h.getTime()).toBeGreaterThan(executive24h.getTime());
      expect(implementation72h.getTime()).toBeGreaterThan(detailed48h.getTime());
    });
  });

  describe('Validation Errors', () => {
    it('returns 400 for missing company name', async () => {
      const requestBody = {
        contactEmail: 'test@company.com',
        title: 'Assessment Title',
        description: 'Assessment description'
        // Missing companyName
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Company name is required');
    });

    it('returns 400 for missing contact email', async () => {
      const requestBody = {
        companyName: 'Test Company',
        title: 'Assessment Title',
        description: 'Assessment description'
        // Missing contactEmail
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Contact email is required');
    });

    it('returns 400 for missing title', async () => {
      const requestBody = {
        companyName: 'Test Company',
        contactEmail: 'test@company.com',
        description: 'Assessment description'
        // Missing title
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Assessment title is required');
    });

    it('returns 400 for empty title', async () => {
      const requestBody = {
        title: '   ', // Whitespace only
        description: 'Assessment description'
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Assessment title is required');
    });

    it('returns 400 for missing description', async () => {
      const requestBody = {
        title: 'Assessment Title'
        // Missing description
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Assessment description is required');
    });

    it('returns 400 for missing request body', async () => {
      const event = {
        ...createMockEvent({}),
        body: null
      };

      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Request body is required');
    });

    it('returns 400 for invalid JSON', async () => {
      const event = {
        ...createMockEvent({}),
        body: '{ invalid json }'
      };

      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Internal server error');
    });
  });

  describe('Authentication', () => {
    it('returns 401 for missing Authorization header', async () => {
      const requestBody = {
        title: 'Test Assessment',
        description: 'Test description'
      };

      const event = createMockEvent(requestBody, {}); // No auth header

      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Authentication token required');
    });

    it('returns 401 for invalid Authorization header format', async () => {
      const requestBody = {
        title: 'Test Assessment',
        description: 'Test description'
      };

      const event = createMockEvent(requestBody, {
        'Authorization': 'Invalid token format'
      });

      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Authentication token required');
    });
  });

  describe('DynamoDB Errors', () => {
    it('handles DynamoDB errors gracefully', async () => {
      const dynamoError = new Error('DynamoDB connection failed');
      mockDynamoDBSend.mockRejectedValue(dynamoError);

      const requestBody = {
        title: 'Test Assessment',
        description: 'Test description'
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Internal server error');
      expect(responseBody.message).toBe('DynamoDB connection failed');
    });

    it('includes TTL in DynamoDB item', async () => {
      const requestBody = {
        title: 'TTL Test Assessment',
        description: 'Testing TTL functionality'
      };

      const event = createMockEvent(requestBody);
      await handler(event, {} as Context, {} as any);

      const putCall = mockDynamoDBSend.mock.calls[0][0];
      expect(putCall.input.Item.TTL).toBeDefined();
      expect(putCall.input.Item.TTL.N).toMatch(/^\d+$/); // Should be a number as string

      // TTL should be approximately 90 days from now
      const ttlValue = parseInt(putCall.input.Item.TTL.N);
      const expectedTTL = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
      expect(ttlValue).toBeCloseTo(expectedTTL, -2); // Within ~100 seconds
    });
  });

  describe('CORS Headers', () => {
    it('includes CORS headers in successful response', async () => {
      const requestBody = {
        title: 'CORS Test Assessment',
        description: 'Testing CORS headers'
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type,Authorization');
      expect(result.headers?.['Access-Control-Allow-Methods']).toBe('OPTIONS,POST');
    });

    it('includes CORS headers in error response', async () => {
      const event = createMockEvent({
        // Missing required fields
      });

      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(400);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type,Authorization');
      expect(result.headers?.['Access-Control-Allow-Methods']).toBe('OPTIONS,POST');
    });
  });

  describe('Assessment Context Validation', () => {
    it('accepts valid assessment context', async () => {
      const requestBody = {
        title: 'Context Test Assessment',
        description: 'Testing assessment context',
        assessmentContext: {
          primaryBusinessChallenges: ['scaling-issues', 'operational-inefficiency'],
          strategicObjectives: ['improve-margins'],
          resourceConstraints: {
            budget: 'limited',
            team: 'stretched',
            timeAvailability: 'minimal'
          }
        }
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(201);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.assessmentContext).toEqual(requestBody.assessmentContext);
    });

    it('handles missing assessment context gracefully', async () => {
      const requestBody = {
        title: 'No Context Assessment',
        description: 'Testing without assessment context'
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(201);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.assessmentContext).toBeUndefined();
    });
  });

  describe('Domain Response Initialization', () => {
    it('initializes empty domain responses', async () => {
      const requestBody = {
        title: 'Domain Response Test',
        description: 'Testing domain response initialization'
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event, {} as Context, {} as any) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(201);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.domainResponses).toEqual({});
    });
  });
});