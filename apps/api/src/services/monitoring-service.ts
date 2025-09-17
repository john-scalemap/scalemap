import { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand, Statistic } from '@aws-sdk/client-cloudwatch'
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'

import { ServiceError } from '../shared/middleware/error-handler'

export interface MetricData {
  metricName: string
  value: number
  unit: 'Count' | 'Seconds' | 'Percent' | 'Bytes' | 'None'
  dimensions?: { [key: string]: string }
  timestamp?: Date
}

export interface AlertConfig {
  metricName: string
  threshold: number
  comparisonOperator: 'GreaterThanThreshold' | 'LessThanThreshold' | 'GreaterThanOrEqualToThreshold' | 'LessThanOrEqualToThreshold'
  evaluationPeriods: number
  period: number
  statistic: 'Average' | 'Sum' | 'Maximum' | 'Minimum' | 'SampleCount'
}

export interface IncidentRecord {
  incidentId: string
  alertName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'acknowledged' | 'resolved'
  description: string
  affectedComponents: string[]
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  escalatedTo?: string
}

class MonitoringService {
  private cloudWatchClient: CloudWatchClient
  private snsClient: SNSClient
  private dynamoClient: DynamoDBClient
  private namespace: string
  private tableName: string

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1'
    this.cloudWatchClient = new CloudWatchClient({ region })
    this.snsClient = new SNSClient({ region })
    this.dynamoClient = new DynamoDBClient({ region })
    this.namespace = process.env.CLOUDWATCH_NAMESPACE || 'ScaleMap/Application'
    this.tableName = process.env.DYNAMODB_TABLE_NAME || 'scalemap-main'
  }

  async publishMetric(metric: MetricData): Promise<void> {
    try {
      const dimensions = metric.dimensions ?
        Object.entries(metric.dimensions).map(([name, value]) => ({ Name: name, Value: value })) :
        []

      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: [{
          MetricName: metric.metricName,
          Value: metric.value,
          Unit: metric.unit,
          Dimensions: dimensions,
          Timestamp: metric.timestamp || new Date()
        }]
      })

      await this.cloudWatchClient.send(command)
    } catch (error) {
      console.error('Failed to publish metric:', error)
      throw new ServiceError(`Failed to publish metric: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async publishHealthMetrics(componentName: string, isHealthy: boolean, responseTime: number): Promise<void> {
    const dimensions = { Component: componentName }

    // Publish health status (1 for healthy, 0 for unhealthy)
    await this.publishMetric({
      metricName: 'ComponentHealth',
      value: isHealthy ? 1 : 0,
      unit: 'Count',
      dimensions
    })

    // Publish response time
    await this.publishMetric({
      metricName: 'ResponseTime',
      value: responseTime,
      unit: 'Seconds',
      dimensions
    })

    // Publish error count if unhealthy
    if (!isHealthy) {
      await this.publishMetric({
        metricName: 'ErrorCount',
        value: 1,
        unit: 'Count',
        dimensions
      })
    }
  }

  async getMetricStatistics(
    metricName: string,
    startTime: Date,
    endTime: Date,
    period: number = 300,
    statistic: Statistic = Statistic.Average,
    dimensions?: { [key: string]: string }
  ): Promise<any> {
    try {
      const dimensionArray = dimensions ?
        Object.entries(dimensions).map(([name, value]) => ({ Name: name, Value: value })) :
        []

      const command = new GetMetricStatisticsCommand({
        Namespace: this.namespace,
        MetricName: metricName,
        Dimensions: dimensionArray,
        StartTime: startTime,
        EndTime: endTime,
        Period: period,
        Statistics: [statistic]
      })

      const response = await this.cloudWatchClient.send(command)
      return response.Datapoints || []
    } catch (error) {
      console.error('Failed to get metric statistics:', error)
      throw new ServiceError(`Failed to get metric statistics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async createIncident(incident: Omit<IncidentRecord, 'incidentId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const incidentId = `INC-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
      const timestamp = new Date().toISOString()

      const incidentRecord: IncidentRecord = {
        ...incident,
        incidentId,
        createdAt: timestamp,
        updatedAt: timestamp
      }

      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: {
          PK: { S: `INCIDENT#${incidentId}` },
          SK: { S: `CREATED#${timestamp}` },
          GSI1PK: { S: `INCIDENTS#${incident.severity.toUpperCase()}` },
          GSI1SK: { S: `STATUS#${incident.status.toUpperCase()}#${timestamp}` },
          incidentId: { S: incidentId },
          alertName: { S: incident.alertName },
          severity: { S: incident.severity },
          status: { S: incident.status },
          description: { S: incident.description },
          affectedComponents: { SS: incident.affectedComponents },
          createdAt: { S: timestamp },
          updatedAt: { S: timestamp },
          TTL: { N: (Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)).toString() } // 90 days TTL
        }
      })

      await this.dynamoClient.send(command)

      // Send alert notification
      await this.sendAlert(incidentRecord)

      return incidentId
    } catch (error) {
      console.error('Failed to create incident:', error)
      throw new ServiceError(`Failed to create incident: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async sendAlert(incident: IncidentRecord): Promise<void> {
    try {
      const snsTopicArn = process.env.ALERT_SNS_TOPIC_ARN
      if (!snsTopicArn) {
        console.warn('No SNS topic configured for alerts')
        return
      }

      const message = {
        incidentId: incident.incidentId,
        alertName: incident.alertName,
        severity: incident.severity,
        description: incident.description,
        affectedComponents: incident.affectedComponents,
        timestamp: incident.createdAt
      }

      const subject = `[${incident.severity.toUpperCase()}] ScaleMap Alert: ${incident.alertName}`

      const command = new PublishCommand({
        TopicArn: snsTopicArn,
        Subject: subject,
        Message: JSON.stringify(message, null, 2)
      })

      await this.snsClient.send(command)
    } catch (error) {
      console.error('Failed to send alert:', error)
      // Don't throw here as we don't want alert failures to break the monitoring
    }
  }

  async checkThresholds(componentName: string, metrics: { [key: string]: number }): Promise<void> {
    const alerts: AlertConfig[] = this.getAlertConfigurations(componentName)

    for (const alert of alerts) {
      const metricValue = metrics[alert.metricName]
      if (metricValue === undefined) continue

      let isThresholdBreached = false

      switch (alert.comparisonOperator) {
        case 'GreaterThanThreshold':
          isThresholdBreached = metricValue > alert.threshold
          break
        case 'LessThanThreshold':
          isThresholdBreached = metricValue < alert.threshold
          break
        case 'GreaterThanOrEqualToThreshold':
          isThresholdBreached = metricValue >= alert.threshold
          break
        case 'LessThanOrEqualToThreshold':
          isThresholdBreached = metricValue <= alert.threshold
          break
      }

      if (isThresholdBreached) {
        await this.createIncident({
          alertName: `${componentName} ${alert.metricName} Alert`,
          severity: this.getSeverityForMetric(alert.metricName, componentName),
          status: 'open',
          description: `${alert.metricName} for ${componentName} is ${metricValue}, which ${alert.comparisonOperator.replace('Threshold', '')} threshold of ${alert.threshold}`,
          affectedComponents: [componentName]
        })
      }
    }
  }

  private getAlertConfigurations(componentName: string): AlertConfig[] {
    // Define alert configurations for different components
    const baseAlerts: AlertConfig[] = [
      {
        metricName: 'ResponseTime',
        threshold: 5, // 5 seconds
        comparisonOperator: 'GreaterThanThreshold',
        evaluationPeriods: 2,
        period: 300,
        statistic: 'Average'
      },
      {
        metricName: 'ErrorCount',
        threshold: 5,
        comparisonOperator: 'GreaterThanThreshold',
        evaluationPeriods: 1,
        period: 300,
        statistic: 'Sum'
      },
      {
        metricName: 'ComponentHealth',
        threshold: 0.5, // Less than 50% healthy
        comparisonOperator: 'LessThanThreshold',
        evaluationPeriods: 1,
        period: 300,
        statistic: 'Average'
      }
    ]

    // Add component-specific alerts
    if (componentName === 'dynamodb') {
      baseAlerts.push({
        metricName: 'ResponseTime',
        threshold: 2, // DynamoDB should be faster
        comparisonOperator: 'GreaterThanThreshold',
        evaluationPeriods: 2,
        period: 300,
        statistic: 'Average'
      })
    }

    return baseAlerts
  }

  private getSeverityForMetric(metricName: string, componentName: string): 'low' | 'medium' | 'high' | 'critical' {
    // Determine severity based on metric and component
    if (componentName === 'dynamodb' && metricName === 'ComponentHealth') {
      return 'critical' // Database down is critical
    }

    if (metricName === 'ComponentHealth') {
      return 'high' // Any component down is high severity
    }

    if (metricName === 'ResponseTime') {
      return 'medium' // Slow response is medium severity
    }

    return 'low' // Default to low severity
  }

  async recordLambdaMetrics(functionName: string, duration: number, memoryUsed: number, errorCount: number = 0): Promise<void> {
    const dimensions = { FunctionName: functionName }

    await Promise.all([
      this.publishMetric({
        metricName: 'Duration',
        value: duration,
        unit: 'Seconds',
        dimensions
      }),
      this.publishMetric({
        metricName: 'MemoryUtilization',
        value: memoryUsed,
        unit: 'Bytes',
        dimensions
      }),
      this.publishMetric({
        metricName: 'Invocations',
        value: 1,
        unit: 'Count',
        dimensions
      })
    ])

    if (errorCount > 0) {
      await this.publishMetric({
        metricName: 'Errors',
        value: errorCount,
        unit: 'Count',
        dimensions
      })
    }
  }
}

export const monitoringService = new MonitoringService()