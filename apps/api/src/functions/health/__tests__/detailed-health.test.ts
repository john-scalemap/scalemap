import { APIGatewayProxyEvent } from 'aws-lambda'

import { healthService } from '../../../services/health-service'
import { handler } from '../detailed-health'

// Mock the health service
jest.mock('../../../services/health-service', () => ({
  healthService: {
    getDetailedHealth: jest.fn()
  }
}))

const mockHealthService = healthService as jest.Mocked<typeof healthService>

// Mock console.log and console.error
const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeAll(() => {
  console.log = jest.fn()
  console.error = jest.fn()
})

afterAll(() => {
  console.log = originalConsoleLog
  console.error = originalConsoleError
})

describe('detailed-health handler', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    path: '/health/detailed',
    httpMethod: 'GET',
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
    body: null,
    isBase64Encoded: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.API_VERSION = '1.0.0'
  })

  afterEach(() => {
    delete process.env.API_VERSION
  })

  it('should return detailed health status', async () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00Z',
      components: [
        {
          name: 'dynamodb',
          status: 'healthy' as const,
          responseTime: 45,
          lastCheck: '2025-09-15T10:00:00Z'
        },
        {
          name: 'ses',
          status: 'healthy' as const,
          responseTime: 120,
          lastCheck: '2025-09-15T10:00:00Z'
        }
      ],
      responseTime: 200
    }

    mockHealthService.getDetailedHealth.mockResolvedValue(mockHealthStatus)

    const result = await handler(mockEvent as APIGatewayProxyEvent)

    expect(result.statusCode).toBe(200)
    expect(result.headers?.['Content-Type']).toBe('application/json')
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*')

    const body = JSON.parse(result.body)
    expect(body.status).toBe('healthy')
    expect(body.components).toHaveLength(2)
    expect(body.components[0].name).toBe('dynamodb')
    expect(body.components[1].name).toBe('ses')
    expect(body.responseTime).toBe(200)
    expect(typeof body.uptime).toBe('number')
  })

  it('should return degraded status when some components are unhealthy', async () => {
    const mockHealthStatus = {
      status: 'degraded' as const,
      timestamp: '2025-09-15T10:00:00Z',
      components: [
        {
          name: 'dynamodb',
          status: 'healthy' as const,
          responseTime: 45,
          lastCheck: '2025-09-15T10:00:00Z'
        },
        {
          name: 'openai',
          status: 'unhealthy' as const,
          responseTime: 5000,
          lastCheck: '2025-09-15T10:00:00Z',
          details: { error: 'Connection timeout' }
        }
      ],
      responseTime: 5100
    }

    mockHealthService.getDetailedHealth.mockResolvedValue(mockHealthStatus)

    const result = await handler(mockEvent as APIGatewayProxyEvent)

    expect(result.statusCode).toBe(200) // Detailed endpoint always returns 200
    const body = JSON.parse(result.body)
    expect(body.status).toBe('degraded')
    expect(body.components[1].status).toBe('unhealthy')
    expect(body.components[1].details.error).toBe('Connection timeout')
  })

  it('should include all expected fields in response', async () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00Z',
      components: [],
      responseTime: 50
    }

    mockHealthService.getDetailedHealth.mockResolvedValue(mockHealthStatus)

    const result = await handler(mockEvent as APIGatewayProxyEvent)

    const body = JSON.parse(result.body)
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('uptime')
    expect(body).toHaveProperty('version')
    expect(body).toHaveProperty('components')
    expect(body).toHaveProperty('responseTime')
  })

  it('should handle errors gracefully', async () => {
    mockHealthService.getDetailedHealth.mockRejectedValue(new Error('Service unavailable'))

    const result = await handler(mockEvent as APIGatewayProxyEvent)

    expect(result.statusCode).toBe(500)
    expect(result.headers?.['Content-Type']).toBe('application/json')

    const body = JSON.parse(result.body)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('An internal error occurred')
  })

  it('should include proper cache control headers', async () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00Z',
      components: [],
      responseTime: 50
    }

    mockHealthService.getDetailedHealth.mockResolvedValue(mockHealthStatus)

    const result = await handler(mockEvent as APIGatewayProxyEvent)

    expect(result.headers?.['Cache-Control']).toBe('no-cache, must-revalidate')
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*')
    expect(result.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type')
  })

  it('should log detailed health check request', async () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00Z',
      components: [],
      responseTime: 50
    }

    mockHealthService.getDetailedHealth.mockResolvedValue(mockHealthStatus)

    await handler(mockEvent as APIGatewayProxyEvent)

    expect(console.log).toHaveBeenCalledWith(
      'Detailed health check endpoint called',
      { path: '/health/detailed', method: 'GET' }
    )
  })
})