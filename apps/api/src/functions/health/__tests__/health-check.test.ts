import { APIGatewayProxyEvent } from 'aws-lambda'

import { healthService } from '../../../services/health-service'
import { handler } from '../health-check'

// Mock the health service
jest.mock('../../../services/health-service', () => ({
  healthService: {
    getBasicHealth: jest.fn()
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

describe('health-check handler', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    path: '/health',
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
    // Set up default environment
    process.env.API_VERSION = '1.0.0'
  })

  afterEach(() => {
    delete process.env.API_VERSION
  })

  it('should return 200 when service is healthy', async () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00Z'
    }

    mockHealthService.getBasicHealth.mockResolvedValue(mockHealthStatus)

    const result = await handler(mockEvent as APIGatewayProxyEvent)

    expect(result.statusCode).toBe(200)
    expect(result.headers?.['Content-Type']).toBe('application/json')
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*')

    const body = JSON.parse(result.body)
    expect(body.status).toBe('healthy')
    expect(body.timestamp).toBe('2025-09-15T10:00:00Z')
    expect(body.version).toBe('1.0.0')
    expect(typeof body.uptime).toBe('number')
  })

  it('should return 503 when service is unhealthy', async () => {
    const mockHealthStatus = {
      status: 'unhealthy' as const,
      timestamp: '2025-09-15T10:00:00Z'
    }

    mockHealthService.getBasicHealth.mockResolvedValue(mockHealthStatus)

    const result = await handler(mockEvent as APIGatewayProxyEvent)

    expect(result.statusCode).toBe(503)
    expect(result.headers?.['Content-Type']).toBe('application/json')

    const body = JSON.parse(result.body)
    expect(body.status).toBe('unhealthy')
    expect(body.timestamp).toBe('2025-09-15T10:00:00Z')
  })

  it('should use default version when API_VERSION is not set', async () => {
    delete process.env.API_VERSION

    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00Z'
    }

    mockHealthService.getBasicHealth.mockResolvedValue(mockHealthStatus)

    const result = await handler(mockEvent as APIGatewayProxyEvent)

    const body = JSON.parse(result.body)
    expect(body.version).toBe('1.0.0')
  })

  it('should handle errors gracefully', async () => {
    mockHealthService.getBasicHealth.mockRejectedValue(new Error('Database connection failed'))

    const result = await handler(mockEvent as APIGatewayProxyEvent)

    expect(result.statusCode).toBe(500)
    expect(result.headers?.['Content-Type']).toBe('application/json')

    const body = JSON.parse(result.body)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('An internal error occurred')
  })

  it('should include proper CORS headers', async () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00Z'
    }

    mockHealthService.getBasicHealth.mockResolvedValue(mockHealthStatus)

    const result = await handler(mockEvent as APIGatewayProxyEvent)

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*')
    expect(result.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type')
    expect(result.headers?.['Cache-Control']).toBe('no-cache')
  })

  it('should log health check request', async () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00Z'
    }

    mockHealthService.getBasicHealth.mockResolvedValue(mockHealthStatus)

    await handler(mockEvent as APIGatewayProxyEvent)

    expect(console.log).toHaveBeenCalledWith(
      'Health check endpoint called',
      { path: '/health', method: 'GET' }
    )
  })
})