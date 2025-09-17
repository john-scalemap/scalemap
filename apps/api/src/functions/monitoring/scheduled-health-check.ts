import { ScheduledEvent } from 'aws-lambda'

import { healthService } from '../../services/health-service'
import { monitoringService } from '../../services/monitoring-service'
import { errorHandler } from '../../shared/middleware/error-handler'

export const handler = async (event: ScheduledEvent) => {
  console.log('Scheduled health check started:', JSON.stringify(event, null, 2))

  const startTime = Date.now()

  try {
    // Perform detailed health check
    const healthStatus = await healthService.getDetailedHealth()

    const duration = (Date.now() - startTime) / 1000

    // Record overall health check metrics
    await monitoringService.recordLambdaMetrics(
      'scheduled-health-check',
      duration,
      process.memoryUsage().heapUsed,
      healthStatus.status === 'healthy' ? 0 : 1
    )

    // Record health metrics for each component
    if (healthStatus.components) {
      for (const component of healthStatus.components) {
        const isHealthy = component.status === 'healthy'
        const responseTime = component.responseTime / 1000 // Convert to seconds

        await monitoringService.publishHealthMetrics(
          component.name,
          isHealthy,
          responseTime
        )

        // Check thresholds and create incidents if needed
        await monitoringService.checkThresholds(component.name, {
          ComponentHealth: isHealthy ? 1 : 0,
          ResponseTime: responseTime,
          ErrorCount: isHealthy ? 0 : 1
        })
      }
    }

    // Record overall system health
    await monitoringService.publishHealthMetrics(
      'system',
      healthStatus.status === 'healthy',
      healthStatus.responseTime ? healthStatus.responseTime / 1000 : duration
    )

    // Log health status for debugging
    console.log('Health check completed:', {
      status: healthStatus.status,
      componentCount: healthStatus.components?.length || 0,
      duration
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Health check completed successfully',
        status: healthStatus.status,
        timestamp: new Date().toISOString(),
        components: healthStatus.components?.map(c => ({
          name: c.name,
          status: c.status,
          responseTime: c.responseTime
        }))
      })
    }

  } catch (error) {
    console.error('Scheduled health check failed:', error)

    // Record error metrics
    const errorDuration = (Date.now() - startTime) / 1000
    await monitoringService.recordLambdaMetrics(
      'scheduled-health-check',
      errorDuration,
      process.memoryUsage().heapUsed,
      1
    )

    // Create critical incident for health check failure
    await monitoringService.createIncident({
      alertName: 'Health Check System Failure',
      severity: 'critical',
      status: 'open',
      description: `Scheduled health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      affectedComponents: ['health-check-system']
    })

    return errorHandler(error)
  }
}