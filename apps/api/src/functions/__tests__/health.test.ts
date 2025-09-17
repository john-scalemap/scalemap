import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { healthService } from '../../services/health-service';
import { handler } from '../health';

// Mock the health service
jest.mock('../../services/health-service', () => ({
  healthService: {
    getBasicHealth: jest.fn()
  }
}));
const mockHealthService = healthService as jest.Mocked<typeof healthService>;

describe('Health endpoint', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    httpMethod: 'GET',
    path: '/health',
    headers: {},
    queryStringParameters: null,
    body: null,
    requestContext: {
      requestId: 'test-request-id'
    } as any
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 with healthy status', async () => {
    mockHealthService.getBasicHealth.mockResolvedValue({
      status: 'healthy',
      timestamp: '2025-09-15T10:00:00Z'
    });

    const result = await handler(mockEvent as APIGatewayProxyEvent) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });

    const body = JSON.parse(result.body);
    expect(body).toMatchObject({
      status: 'healthy',
      message: 'ScaleMap API is healthy',
      timestamp: '2025-09-15T10:00:00Z',
      requestId: 'test-request-id',
    });
    expect(body.version).toBeDefined();
    expect(body.uptime).toBeDefined();
  });

  it('should return 503 with unhealthy status', async () => {
    mockHealthService.getBasicHealth.mockResolvedValue({
      status: 'unhealthy',
      timestamp: '2025-09-15T10:00:00Z'
    });

    const result = await handler(mockEvent as APIGatewayProxyEvent) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(503);

    const body = JSON.parse(result.body);
    expect(body).toMatchObject({
      status: 'unhealthy',
      message: 'ScaleMap API is unhealthy',
    });
  });

  it('should handle errors gracefully', async () => {
    // Mock console.error to avoid test output pollution
    const originalError = console.error;
    console.error = jest.fn();

    mockHealthService.getBasicHealth.mockRejectedValue(new Error('Service error'));

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);
    expect(result.headers).toBeDefined();
    expect(result.body).toBeDefined();

    const body = JSON.parse(result.body);
    expect(body.error).toBe('Internal server error');

    console.error = originalError;
  });
});