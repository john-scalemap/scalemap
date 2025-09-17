import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

import { monitoringService } from '../../services/monitoring-service'
import { errorHandler, ValidationError } from '../../shared/middleware/error-handler'

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1'
})

interface DashboardData {
  systemOverview: {
    overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    componentCount: number
    activeIncidents: number
    lastChecked: string
  }
  components: Array<{
    name: string
    status: 'healthy' | 'degraded' | 'unhealthy'
    responseTime: number
    uptime: number
    lastCheck: string
  }>
  recentIncidents: Array<{
    incidentId: string
    alertName: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    status: 'open' | 'acknowledged' | 'resolved'
    createdAt: string
    affectedComponents: string[]
  }>
  metrics: {
    responseTimeHistory: Array<{ timestamp: string; value: number }>
    errorRateHistory: Array<{ timestamp: string; value: number }>
    uptimePercentage: number
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse query parameters
    const timeRange = event.queryStringParameters?.timeRange || '1h'
    const component = event.queryStringParameters?.component

    // Validate time range
    const validTimeRanges = ['1h', '6h', '24h', '7d', '30d']
    if (!validTimeRanges.includes(timeRange)) {
      throw new ValidationError('Invalid time range. Must be one of: 1h, 6h, 24h, 7d, 30d')
    }

    const endTime = new Date()
    const startTime = new Date()

    // Calculate start time based on range
    switch (timeRange) {
      case '1h':
        startTime.setHours(startTime.getHours() - 1)
        break
      case '6h':
        startTime.setHours(startTime.getHours() - 6)
        break
      case '24h':
        startTime.setDate(startTime.getDate() - 1)
        break
      case '7d':
        startTime.setDate(startTime.getDate() - 7)
        break
      case '30d':
        startTime.setDate(startTime.getDate() - 30)
        break
    }

    // Get recent incidents
    const recentIncidents = await getRecentIncidents(startTime)

    // Get metric data
    const components = ['dynamodb', 'ses', 'openai', 'stripe', 'system']
    const componentData = await Promise.all(
      components.map(async (comp) => {
        if (component && component !== comp) return null

        try {
          // Get response time metrics
          const responseTimeData = await monitoringService.getMetricStatistics(
            'ResponseTime',
            startTime,
            endTime,
            300,
            'Average',
            { Component: comp }
          )

          // Get health metrics
          const healthData = await monitoringService.getMetricStatistics(
            'ComponentHealth',
            startTime,
            endTime,
            300,
            'Average',
            { Component: comp }
          )

          // Calculate uptime percentage
          const totalDataPoints = healthData.length
          const healthyDataPoints = healthData.filter((point: any) => point.Average >= 0.5).length
          const uptime = totalDataPoints > 0 ? (healthyDataPoints / totalDataPoints) * 100 : 100

          // Get latest metrics
          const latestResponseTime = responseTimeData.length > 0 ?
            responseTimeData[responseTimeData.length - 1].Average : 0
          const latestHealth = healthData.length > 0 ?
            healthData[healthData.length - 1].Average : 1

          return {
            name: comp,
            status: latestHealth >= 0.5 ? 'healthy' : 'unhealthy' as const,
            responseTime: latestResponseTime * 1000, // Convert to milliseconds
            uptime: Math.round(uptime * 100) / 100,
            lastCheck: endTime.toISOString()
          }
        } catch (error) {
          console.error(`Failed to get metrics for component ${comp}:`, error)
          return {
            name: comp,
            status: 'unhealthy' as const,
            responseTime: 0,
            uptime: 0,
            lastCheck: endTime.toISOString()
          }
        }
      })
    )

    const validComponents = componentData.filter(Boolean)

    // Calculate overall system status
    const unhealthyComponents = validComponents.filter(c => c && c.status === 'unhealthy')
    const overallStatus = unhealthyComponents.length === 0 ? 'healthy' :
                         unhealthyComponents.length < validComponents.length ? 'degraded' : 'unhealthy'

    // Get historical metrics for charts
    const responseTimeHistory = await getMetricHistory('ResponseTime', startTime, endTime, { Component: 'system' })
    const errorRateHistory = await getMetricHistory('ErrorCount', startTime, endTime, { Component: 'system' })

    // Calculate overall uptime
    const avgUptime = validComponents.length > 0 ?
      validComponents.reduce((sum, comp) => sum + (comp?.uptime || 0), 0) / validComponents.length : 100

    const dashboardData: DashboardData = {
      systemOverview: {
        overallStatus,
        componentCount: validComponents.length,
        activeIncidents: recentIncidents.filter(i => i.status !== 'resolved').length,
        lastChecked: endTime.toISOString()
      },
      components: validComponents.filter(Boolean) as Array<{ name: string; status: "healthy" | "degraded" | "unhealthy"; responseTime: number; uptime: number; lastCheck: string; }>,
      recentIncidents: recentIncidents.slice(0, 10), // Limit to 10 most recent
      metrics: {
        responseTimeHistory,
        errorRateHistory,
        uptimePercentage: Math.round(avgUptime * 100) / 100
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'max-age=60' // Cache for 1 minute
      },
      body: JSON.stringify(dashboardData)
    }

  } catch (error) {
    console.error('Dashboard data API error:', error)
    return errorHandler(error)
  }
}

async function getRecentIncidents(since: Date) {
  try {
    const command = new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'scalemap-main',
      IndexName: 'GSI1',
      KeyConditionExpression: 'begins_with(GSI1PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': { S: 'INCIDENTS#' },
        ':since': { S: since.toISOString() }
      },
      FilterExpression: 'createdAt >= :since',
      ScanIndexForward: false, // Most recent first
      Limit: 20
    })

    const response = await dynamoClient.send(command)

    return response.Items?.map(item => ({
      incidentId: item.incidentId?.S || '',
      alertName: item.alertName?.S || '',
      severity: item.severity?.S as 'low' | 'medium' | 'high' | 'critical' || 'low',
      status: item.status?.S as 'open' | 'acknowledged' | 'resolved' || 'open',
      createdAt: item.createdAt?.S || '',
      affectedComponents: item.affectedComponents?.SS || []
    })) || []
  } catch (error) {
    console.error('Failed to get recent incidents:', error)
    return []
  }
}

async function getMetricHistory(
  metricName: string,
  startTime: Date,
  endTime: Date,
  dimensions?: { [key: string]: string }
): Promise<Array<{ timestamp: string; value: number }>> {
  try {
    const datapoints = await monitoringService.getMetricStatistics(
      metricName,
      startTime,
      endTime,
      300, // 5-minute periods
      'Average',
      dimensions
    )

    return datapoints
      .sort((a: any, b: any) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime())
      .map((point: any) => ({
        timestamp: point.Timestamp,
        value: point.Average || 0
      }))
  } catch (error) {
    console.error(`Failed to get ${metricName} history:`, error)
    return []
  }
}