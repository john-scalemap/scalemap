import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import { SESClient, GetSendQuotaCommand } from '@aws-sdk/client-ses'

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-dynamodb')
jest.mock('@aws-sdk/client-ses')

// Mock the logger and monitoring utilities to avoid noise
jest.mock('../../utils/logger', () => ({
  logger: {
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    })),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}))

jest.mock('../../utils/monitoring', () => ({
  Monitoring: {
    incrementCounter: jest.fn(),
    recordLatency: jest.fn(),
    recordError: jest.fn()
  },
  withTiming: jest.fn((operation) => operation())
}))

const mockDynamoDBClient = {
  send: jest.fn()
}

const mockSESClient = {
  send: jest.fn()
}

// Mock constructors
;(DynamoDBClient as jest.Mock).mockImplementation(() => mockDynamoDBClient)
;(SESClient as jest.Mock).mockImplementation(() => mockSESClient)

// Import health service after mocking
import { healthService } from '../health-service'

// Mock console.error
const originalConsoleError = console.error
beforeAll(() => {
  console.error = jest.fn()
})

afterAll(() => {
  console.error = originalConsoleError
})

describe('HealthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DYNAMODB_TABLE_NAME = 'test-table'
    process.env.AWS_REGION = 'us-east-1'
  })

  afterEach(() => {
    delete process.env.DYNAMODB_TABLE_NAME
    delete process.env.AWS_REGION
  })

  describe('getBasicHealth', () => {
    it('should return healthy status when DynamoDB is accessible', async () => {
      mockDynamoDBClient.send.mockResolvedValue({
        Table: { TableStatus: 'ACTIVE' }
      })

      const result = await healthService.getBasicHealth()

      expect(result.status).toBe('healthy')
      expect(result.timestamp).toBeDefined()
      expect(mockDynamoDBClient.send).toHaveBeenCalledWith(
        expect.any(DescribeTableCommand)
      )
    })

    it('should return unhealthy status when DynamoDB is not accessible', async () => {
      mockDynamoDBClient.send.mockRejectedValue(new Error('Table not found'))

      const result = await healthService.getBasicHealth()

      expect(result.status).toBe('unhealthy')
      expect(result.timestamp).toBeDefined()
    })

    it('should use default table name when not provided', async () => {
      delete process.env.DYNAMODB_TABLE_NAME

      mockDynamoDBClient.send.mockResolvedValue({
        Table: { TableStatus: 'ACTIVE' }
      })

      await healthService.getBasicHealth()

      // Check that send was called with a DescribeTableCommand
      expect(mockDynamoDBClient.send).toHaveBeenCalledWith(
        expect.any(DescribeTableCommand)
      )
    })
  })

  describe('getDetailedHealth', () => {
    it('should return detailed health status for all components', async () => {
      // Mock successful DynamoDB
      mockDynamoDBClient.send.mockResolvedValue({
        Table: { TableStatus: 'ACTIVE' }
      })

      // Mock successful SES
      mockSESClient.send.mockResolvedValue({
        Max24HourSend: 10000,
        MaxSendRate: 14,
        SentLast24Hours: 100
      })

      const result = await healthService.getDetailedHealth()

      expect(result.status).toBe('healthy')
      expect(result.components).toHaveLength(4) // DynamoDB, SES, OpenAI, Stripe
      expect(result.responseTime).toBeDefined()
      expect(result.timestamp).toBeDefined()

      // Check DynamoDB component
      const dynamoComponent = result.components?.find(c => c.name === 'dynamodb')
      expect(dynamoComponent?.status).toBe('healthy')
      expect(dynamoComponent?.responseTime).toBeDefined()

      // Check SES component
      const sesComponent = result.components?.find(c => c.name === 'ses')
      expect(sesComponent?.status).toBe('healthy')
      expect(sesComponent?.responseTime).toBeDefined()
    })

    it('should return degraded status when non-critical services fail', async () => {
      // Mock successful DynamoDB (critical)
      mockDynamoDBClient.send.mockResolvedValue({
        Table: { TableStatus: 'ACTIVE' }
      })

      // Mock failed SES (non-critical)
      mockSESClient.send.mockRejectedValue(new Error('SES quota exceeded'))

      const result = await healthService.getDetailedHealth()

      expect(result.status).toBe('degraded')
      expect(result.components).toHaveLength(4)

      // DynamoDB should be healthy
      const dynamoComponent = result.components?.find(c => c.name === 'dynamodb')
      expect(dynamoComponent?.status).toBe('healthy')

      // SES should be unhealthy
      const sesComponent = result.components?.find(c => c.name === 'ses')
      expect(sesComponent?.status).toBe('unhealthy')
      expect(sesComponent?.details?.error).toBe('SES quota exceeded')
    })

    it('should return unhealthy status when critical services fail', async () => {
      // Mock failed DynamoDB (critical)
      mockDynamoDBClient.send.mockRejectedValue(new Error('Table not found'))

      // Mock successful SES
      mockSESClient.send.mockResolvedValue({})

      const result = await healthService.getDetailedHealth()

      expect(result.status).toBe('unhealthy')

      const dynamoComponent = result.components?.find(c => c.name === 'dynamodb')
      expect(dynamoComponent?.status).toBe('unhealthy')
      expect(dynamoComponent?.details?.error).toBe('Table not found')
    })

    it('should include mock implementations for OpenAI and Stripe', async () => {
      mockDynamoDBClient.send.mockResolvedValue({
        Table: { TableStatus: 'ACTIVE' }
      })
      mockSESClient.send.mockResolvedValue({})

      const result = await healthService.getDetailedHealth()

      // Check OpenAI mock
      const openaiComponent = result.components?.find(c => c.name === 'openai')
      expect(openaiComponent?.status).toBe('healthy')
      expect(openaiComponent?.details?.note).toContain('Mock implementation')

      // Check Stripe mock
      const stripeComponent = result.components?.find(c => c.name === 'stripe')
      expect(stripeComponent?.status).toBe('healthy')
      expect(stripeComponent?.details?.note).toContain('Mock implementation')
    })

    it('should measure response times for each component', async () => {
      mockDynamoDBClient.send.mockResolvedValue({
        Table: { TableStatus: 'ACTIVE' }
      })
      mockSESClient.send.mockResolvedValue({})

      const result = await healthService.getDetailedHealth()

      result.components?.forEach(component => {
        expect(component.responseTime).toBeGreaterThanOrEqual(0)
        expect(typeof component.responseTime).toBe('number')
      })
    })

    it('should include proper timestamps', async () => {
      mockDynamoDBClient.send.mockResolvedValue({
        Table: { TableStatus: 'ACTIVE' }
      })
      mockSESClient.send.mockResolvedValue({})

      const result = await healthService.getDetailedHealth()

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)

      result.components?.forEach(component => {
        expect(component.lastCheck).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
      })
    })
  })
})