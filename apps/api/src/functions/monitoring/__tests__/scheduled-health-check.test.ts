import { jest } from '@jest/globals'

import { handler } from '../scheduled-health-check'

import { ScheduledEvent } from 'aws-lambda'

// Mock dependencies
jest.mock('../../../services/health-service')
jest.mock('../../../services/monitoring-service')

import { healthService } from '../../../services/health-service'
import { monitoringService } from '../../../services/monitoring-service'

const mockHealthService = healthService as jest.Mocked<typeof healthService>
const mockMonitoringService = monitoringService as jest.Mocked<typeof monitoringService>

describe('Scheduled Health Check Lambda', () => {
  const mockEvent: ScheduledEvent = {
    id: 'test-event-id',
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    account: '123456789012',
    time: '2025-09-15T10:00:00Z',
    region: 'us-east-1',
    detail: {},
    version: '0',
    resources: ['arn:aws:events:us-east-1:123456789012:rule/test-rule']
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should successfully execute health check and record metrics', async () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00.000Z',
      components: [
        {
          name: 'dynamodb',
          status: 'healthy' as const,
          responseTime: 150,
          lastCheck: '2025-09-15T10:00:00.000Z'
        },
        {
          name: 'ses',
          status: 'healthy' as const,
          responseTime: 300,
          lastCheck: '2025-09-15T10:00:00.000Z'
        }
      ],
      responseTime: 1000
    }

    mockHealthService.getDetailedHealth.mockResolvedValueOnce(mockHealthStatus)
    mockMonitoringService.recordLambdaMetrics.mockResolvedValueOnce()
    mockMonitoringService.publishHealthMetrics.mockResolvedValueOnce()
    mockMonitoringService.checkThresholds.mockResolvedValueOnce()

    const result = await handler(mockEvent)

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toMatchObject({
      message: 'Health check completed successfully',
      status: 'healthy'
    })

    // Verify health service was called
    expect(mockHealthService.getDetailedHealth).toHaveBeenCalledTimes(1)

    // Verify metrics were recorded for Lambda function
    expect(mockMonitoringService.recordLambdaMetrics).toHaveBeenCalledWith(
      'scheduled-health-check',
      expect.any(Number),
      expect.any(Number),
      0 // no errors for healthy status
    )

    // Verify health metrics were published for each component
    expect(mockMonitoringService.publishHealthMetrics).toHaveBeenCalledTimes(3) // 2 components + system
    expect(mockMonitoringService.publishHealthMetrics).toHaveBeenCalledWith('dynamodb', true, 0.15)
    expect(mockMonitoringService.publishHealthMetrics).toHaveBeenCalledWith('ses', true, 0.3)
    expect(mockMonitoringService.publishHealthMetrics).toHaveBeenCalledWith('system', true, 1)

    // Verify thresholds were checked for each component
    expect(mockMonitoringService.checkThresholds).toHaveBeenCalledTimes(2)
  })

  it('should handle unhealthy components and record appropriate metrics', async () => {
    const mockHealthStatus = {
      status: 'degraded' as const,
      timestamp: '2025-09-15T10:00:00.000Z',
      components: [
        {
          name: 'dynamodb',
          status: 'healthy' as const,
          responseTime: 150,
          lastCheck: '2025-09-15T10:00:00.000Z'
        },
        {
          name: 'openai',
          status: 'unhealthy' as const,
          responseTime: 5000,
          lastCheck: '2025-09-15T10:00:00.000Z'
        }
      ],
      responseTime: 2000
    }

    mockHealthService.getDetailedHealth.mockResolvedValueOnce(mockHealthStatus)
    mockMonitoringService.recordLambdaMetrics.mockResolvedValueOnce()
    mockMonitoringService.publishHealthMetrics.mockResolvedValueOnce()
    mockMonitoringService.checkThresholds.mockResolvedValueOnce()

    const result = await handler(mockEvent)

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toMatchObject({
      status: 'degraded'
    })

    // Verify metrics were recorded with error count for degraded status
    expect(mockMonitoringService.recordLambdaMetrics).toHaveBeenCalledWith(
      'scheduled-health-check',
      expect.any(Number),
      expect.any(Number),
      1 // 1 error for degraded status
    )

    // Verify unhealthy component metrics
    expect(mockMonitoringService.publishHealthMetrics).toHaveBeenCalledWith('openai', false, 5)
  })

  it('should handle health service errors and create critical incident', async () => {
    const mockError = new Error('Health service failed')
    mockHealthService.getDetailedHealth.mockRejectedValueOnce(mockError)
    mockMonitoringService.recordLambdaMetrics.mockResolvedValueOnce()
    mockMonitoringService.createIncident.mockResolvedValueOnce('INC-123')

    const result = await handler(mockEvent)

    expect(result.statusCode).toBe(500)

    // Verify error metrics were recorded
    expect(mockMonitoringService.recordLambdaMetrics).toHaveBeenCalledWith(
      'scheduled-health-check',
      expect.any(Number),
      expect.any(Number),
      1
    )

    // Verify critical incident was created
    expect(mockMonitoringService.createIncident).toHaveBeenCalledWith({
      alertName: 'Health Check System Failure',
      severity: 'critical',
      status: 'open',
      description: 'Scheduled health check failed: Health service failed',
      affectedComponents: ['health-check-system']
    })
  })

  it('should handle components without response time data', async () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00.000Z',
      components: [
        {
          name: 'dynamodb',
          status: 'healthy' as const,
          responseTime: 150,
          lastCheck: '2025-09-15T10:00:00.000Z'
        }
      ]
      // No responseTime at the top level
    }

    mockHealthService.getDetailedHealth.mockResolvedValueOnce(mockHealthStatus)
    mockMonitoringService.recordLambdaMetrics.mockResolvedValueOnce()
    mockMonitoringService.publishHealthMetrics.mockResolvedValueOnce()
    mockMonitoringService.checkThresholds.mockResolvedValueOnce()

    const result = await handler(mockEvent)

    expect(result.statusCode).toBe(200)

    // Should use duration as fallback for system response time
    expect(mockMonitoringService.publishHealthMetrics).toHaveBeenCalledWith(
      'system',
      true,
      expect.any(Number)
    )
  })

  it('should handle missing components array', async () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00.000Z'
      // No components array
    }

    mockHealthService.getDetailedHealth.mockResolvedValueOnce(mockHealthStatus)
    mockMonitoringService.recordLambdaMetrics.mockResolvedValueOnce()
    mockMonitoringService.publishHealthMetrics.mockResolvedValueOnce()

    const result = await handler(mockEvent)

    expect(result.statusCode).toBe(200)

    // Should still record system-level metrics
    expect(mockMonitoringService.publishHealthMetrics).toHaveBeenCalledWith(
      'system',
      true,
      expect.any(Number)
    )

    // Should not try to check thresholds for components
    expect(mockMonitoringService.checkThresholds).not.toHaveBeenCalled()
  })
})