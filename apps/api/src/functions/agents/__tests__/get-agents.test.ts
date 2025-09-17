import { APIGatewayProxyEvent } from 'aws-lambda';

// Create mock service instance
const mockAgentService = {
  getAllAgents: jest.fn(),
  getAgentsByDomain: jest.fn(),
  getAgentsByIndustry: jest.fn(),
};

// Mock the services first
jest.mock('../../../services/agent-service', () => ({
  AgentService: jest.fn().mockImplementation(() => mockAgentService)
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })
  }
}));

jest.mock('../../../utils/monitoring', () => ({
  Monitoring: {
    recordSuccess: jest.fn(),
    recordError: jest.fn(),
    incrementCounter: jest.fn(),
    recordLatency: jest.fn(),
    recordValue: jest.fn(),
  }
}));

import { handler } from '../get-agents';

const mockAgents = [
  {
    id: 'strategic-alignment',
    name: 'Dr. Alexandra Chen',
    title: 'Strategic Transformation Consultant',
    status: 'available',
    domainExpertise: {
      primaryDomains: ['strategic-alignment'],
      industrySpecializations: ['technology'],
      regulatoryExpertise: [],
      yearsExperience: 12
    },
    personality: {
      communicationStyle: 'analytical',
      approach: 'data-driven',
      backstory: 'Former McKinsey Principal',
      keyPhrase: 'Strategy without execution is hallucination',
      professionalBackground: 'Strategic transformation',
      strengthAreas: ['Strategic vision development']
    },
    performance: {
      assessmentsCompleted: 127,
      avgConfidenceScore: 0.89,
      avgProcessingTimeMs: 38000,
      successRate: 0.94
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  },
  {
    id: 'financial-management',
    name: 'Marcus Rodriguez',
    title: 'Financial Operations Expert',
    status: 'analyzing',
    domainExpertise: {
      primaryDomains: ['financial-management'],
      industrySpecializations: ['saas', 'fintech'],
      regulatoryExpertise: ['SOX'],
      yearsExperience: 15
    },
    personality: {
      communicationStyle: 'direct',
      approach: 'data-driven',
      backstory: 'Former CFO at 3 scale-ups',
      keyPhrase: 'Cash flow is king',
      professionalBackground: 'Financial operations',
      strengthAreas: ['FP&A optimization']
    },
    performance: {
      assessmentsCompleted: 98,
      avgConfidenceScore: 0.91,
      avgProcessingTimeMs: 35000,
      successRate: 0.96
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  }
];


const createMockEvent = (queryStringParameters: Record<string, string> | null = null): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/agents',
  pathParameters: null,
  queryStringParameters,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    authorizer: {},
    httpMethod: 'GET',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-agent',
      userArn: null,
      clientCert: null
    },
    path: '/agents',
    protocol: 'HTTP/1.1',
    requestId: 'test-request-id',
    requestTime: '01/Jan/2023:00:00:00 +0000',
    requestTimeEpoch: 1672531200000,
    resourceId: 'test-resource',
    resourcePath: '/agents',
    stage: 'test'
  },
  resource: '/agents'
});

describe('get-agents handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all agents when no filters are provided', async () => {
    mockAgentService.getAllAgents.mockResolvedValue(mockAgents);

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockAgentService.getAllAgents).toHaveBeenCalledTimes(1);

    const body = JSON.parse(result.body);
    expect(body.agents).toEqual(mockAgents);
    expect(body.total).toBe(2);
    expect(body.filters.domain).toBeUndefined();
    expect(body.filters.industry).toBeUndefined();
    expect(body.filters.status).toBeUndefined();
  });

  it('filters agents by domain when domain parameter is provided', async () => {
    const filteredAgents = [mockAgents[0]]; // Only strategic agent
    mockAgentService.getAgentsByDomain.mockResolvedValue(filteredAgents);

    const event = createMockEvent({ domain: 'strategic-alignment' });
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockAgentService.getAgentsByDomain).toHaveBeenCalledWith('strategic-alignment');

    const body = JSON.parse(result.body);
    expect(body.agents).toEqual(filteredAgents);
    expect(body.total).toBe(1);
    expect(body.filters.domain).toBe('strategic-alignment');
  });

  it('filters agents by industry when industry parameter is provided', async () => {
    const filteredAgents = [mockAgents[0]]; // Only technology agent
    mockAgentService.getAgentsByIndustry.mockResolvedValue(filteredAgents);

    const event = createMockEvent({ industry: 'technology' });
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockAgentService.getAgentsByIndustry).toHaveBeenCalledWith('technology');

    const body = JSON.parse(result.body);
    expect(body.agents).toEqual(filteredAgents);
    expect(body.total).toBe(1);
    expect(body.filters.industry).toBe('technology');
  });

  it('filters agents by status when status parameter is provided', async () => {
    mockAgentService.getAllAgents.mockResolvedValue(mockAgents);

    const event = createMockEvent({ status: 'available' });
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockAgentService.getAllAgents).toHaveBeenCalledTimes(1);

    const body = JSON.parse(result.body);
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].status).toBe('available');
    expect(body.total).toBe(1);
    expect(body.filters.status).toBe('available');
  });

  it('combines domain and status filters', async () => {
    const domainAgents = mockAgents; // Both agents match domain
    mockAgentService.getAgentsByDomain.mockResolvedValue(domainAgents);

    const event = createMockEvent({ domain: 'strategic-alignment', status: 'available' });
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockAgentService.getAgentsByDomain).toHaveBeenCalledWith('strategic-alignment');

    const body = JSON.parse(result.body);
    // Should filter by status after getting domain results
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].status).toBe('available');
    expect(body.filters.domain).toBe('strategic-alignment');
    expect(body.filters.status).toBe('available');
  });

  it('returns empty array when no agents match filters', async () => {
    mockAgentService.getAllAgents.mockResolvedValue(mockAgents);

    const event = createMockEvent({ status: 'offline' });
    const result = await handler(event);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.agents).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('handles service errors gracefully', async () => {
    mockAgentService.getAllAgents.mockRejectedValue(new Error('Database connection failed'));

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toBe('Failed to retrieve agents');
    expect(body.message).toBe('Database connection failed');
    expect(body.requestId).toBe('test-request-id');
  });

  it('includes proper CORS headers', async () => {
    mockAgentService.getAllAgents.mockResolvedValue(mockAgents);

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    });
  });

  it('includes request metadata in response', async () => {
    mockAgentService.getAllAgents.mockResolvedValue(mockAgents);

    const event = createMockEvent();
    const result = await handler(event);

    const body = JSON.parse(result.body);
    expect(body.requestId).toBe('test-request-id');
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp)).toBeInstanceOf(Date);
  });
});