import { jest } from '@jest/globals'
import { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'

import { monitoringService } from '../monitoring-service'

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-cloudwatch')
jest.mock('@aws-sdk/client-sns')
jest.mock('@aws-sdk/client-dynamodb')

const mockCloudWatchSend = jest.fn() as jest.MockedFunction<any>
const mockSNSSend = jest.fn() as jest.MockedFunction<any>
const mockDynamoSend = jest.fn() as jest.MockedFunction<any>

;(CloudWatchClient as jest.Mock).mockImplementation(() => ({
  send: mockCloudWatchSend
}))

;(SNSClient as jest.Mock).mockImplementation(() => ({
  send: mockSNSSend
}))

;(DynamoDBClient as jest.Mock).mockImplementation(() => ({
  send: mockDynamoSend
}))

describe('MonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment variables
    delete process.env.ALERT_SNS_TOPIC_ARN
  })

  describe('publishMetric', () => {
    it('should publish metric to CloudWatch', async () => {
      mockCloudWatchSend.mockResolvedValueOnce({} as any)

      await monitoringService.publishMetric({
        metricName: 'TestMetric',
        value: 100,
        unit: 'Count',
        dimensions: { Component: 'test' }
      })

      expect(mockCloudWatchSend).toHaveBeenCalledWith(
        expect.any(PutMetricDataCommand)
      )
    })

    it('should handle metric publishing errors', async () => {
      mockCloudWatchSend.mockRejectedValueOnce(new Error('CloudWatch error'))

      await expect(
        monitoringService.publishMetric({
          metricName: 'TestMetric',
          value: 100,
          unit: 'Count'
        })
      ).rejects.toThrow('Failed to publish metric')
    })
  })

  describe('publishHealthMetrics', () => {
    it('should publish health and response time metrics', async () => {
      mockCloudWatchSend.mockResolvedValue({})

      await monitoringService.publishHealthMetrics('dynamodb', true, 0.15)

      expect(mockCloudWatchSend).toHaveBeenCalledTimes(2)

      // Check that health metric was published
      const healthCall = mockCloudWatchSend.mock.calls.find((call: any) => {
        const command = call[0] as any as any
        return command.input.MetricData[0].MetricName === 'ComponentHealth'
      })
      expect(healthCall).toBeDefined()
      expect(healthCall?.[0].input.MetricData[0].Value).toBe(1) // healthy = 1

      // Check that response time metric was published
      const responseTimeCall = mockCloudWatchSend.mock.calls.find((call: any) => {
        const command = call[0] as any as any
        return command.input.MetricData[0].MetricName === 'ResponseTime'
      })
      expect(responseTimeCall).toBeDefined()
      expect(responseTimeCall?.[0].input.MetricData[0].Value).toBe(0.15)
    })

    it('should publish error metric when unhealthy', async () => {
      mockCloudWatchSend.mockResolvedValue({})

      await monitoringService.publishHealthMetrics('dynamodb', false, 5.0)

      expect(mockCloudWatchSend).toHaveBeenCalledTimes(3)

      // Check that error metric was published
      const errorCall = mockCloudWatchSend.mock.calls.find((call: any) => {
        const command = call[0] as any as any
        return command.input.MetricData[0].MetricName === 'ErrorCount'
      })
      expect(errorCall).toBeDefined()
      expect((errorCall as any)?.[0].input.MetricData[0].Value).toBe(1)
    })
  })

  describe('getMetricStatistics', () => {
    it('should retrieve metric statistics from CloudWatch', async () => {
      const mockDatapoints = [
        { Timestamp: new Date(), Average: 150 },
        { Timestamp: new Date(), Average: 200 }
      ]

      mockCloudWatchSend.mockResolvedValueOnce({
        Datapoints: mockDatapoints
      } as any)

      const result = await monitoringService.getMetricStatistics(
        'ResponseTime',
        new Date(Date.now() - 3600000),
        new Date(),
        300,
        'Average',
        { Component: 'dynamodb' }
      )

      expect(result).toEqual(mockDatapoints)
      expect(mockCloudWatchSend).toHaveBeenCalledWith(
        expect.any(GetMetricStatisticsCommand)
      )
    })

    it('should handle empty metric data', async () => {
      mockCloudWatchSend.mockResolvedValueOnce({} as any)

      const result = await monitoringService.getMetricStatistics(
        'ResponseTime',
        new Date(Date.now() - 3600000),
        new Date()
      )

      expect(result).toEqual([])
    })
  })

  describe('createIncident', () => {
    it('should create incident and send alert', async () => {
      mockDynamoSend.mockResolvedValueOnce({} as any)
      mockSNSSend.mockResolvedValueOnce({} as any)
      process.env.ALERT_SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789:alerts'

      const incidentId = await monitoringService.createIncident({
        alertName: 'Test Alert',
        severity: 'high',
        status: 'open',
        description: 'Test incident',
        affectedComponents: ['dynamodb']
      })

      expect(incidentId).toMatch(/^INC-\d+-[A-Z0-9]{8}$/)
      expect(mockDynamoSend).toHaveBeenCalledWith(
        expect.any(PutItemCommand)
      )
      expect(mockSNSSend).toHaveBeenCalledWith(
        expect.any(PublishCommand)
      )
    })

    it('should create incident without sending alert when SNS not configured', async () => {
      mockDynamoSend.mockResolvedValueOnce({} as any)

      const incidentId = await monitoringService.createIncident({
        alertName: 'Test Alert',
        severity: 'low',
        status: 'open',
        description: 'Test incident',
        affectedComponents: ['ses']
      })

      expect(incidentId).toBeDefined()
      expect(mockDynamoSend).toHaveBeenCalled()
      expect(mockSNSSend).not.toHaveBeenCalled()
    })
  })

  describe('checkThresholds', () => {
    it('should create incident when threshold is breached', async () => {
      mockDynamoSend.mockResolvedValueOnce({} as any)

      await monitoringService.checkThresholds('dynamodb', {
        ComponentHealth: 0, // unhealthy
        ResponseTime: 10,   // > 5 second threshold
        ErrorCount: 1
      })

      // Should create incidents for both health and response time thresholds
      expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    })

    it('should not create incident when thresholds are not breached', async () => {
      await monitoringService.checkThresholds('dynamodb', {
        ComponentHealth: 1,   // healthy
        ResponseTime: 2,      // < 5 second threshold
        ErrorCount: 0
      })

      expect(mockDynamoSend).not.toHaveBeenCalled()
    })
  })

  describe('recordLambdaMetrics', () => {
    it('should record Lambda function metrics', async () => {
      mockCloudWatchSend.mockResolvedValue({})

      await monitoringService.recordLambdaMetrics(
        'test-function',
        1.5,      // duration
        128000000, // memory used
        0         // no errors
      )

      expect(mockCloudWatchSend).toHaveBeenCalledTimes(3)

      // Check that duration, memory, and invocation metrics were published
      const metricNames = mockCloudWatchSend.mock.calls.map((call: any) =>
        (call[0] as any).input.MetricData[0].MetricName
      )

      expect(metricNames).toContain('Duration')
      expect(metricNames).toContain('MemoryUtilization')
      expect(metricNames).toContain('Invocations')
    })

    it('should record error metric when errors occur', async () => {
      mockCloudWatchSend.mockResolvedValue({} as any)

      await monitoringService.recordLambdaMetrics(
        'test-function',
        2.0,
        128000000,
        1 // 1 error
      )

      expect(mockCloudWatchSend).toHaveBeenCalledTimes(4)

      const metricNames = mockCloudWatchSend.mock.calls.map((call: any) =>
        (call[0] as any).input.MetricData[0].MetricName
      )

      expect(metricNames).toContain('Errors')
    })
  })
})