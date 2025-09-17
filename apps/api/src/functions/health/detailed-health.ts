import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

import { healthService } from '../../services/health-service'
import { errorHandler } from '../../shared/middleware/error-handler'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Detailed health check endpoint called', { path: event.path, method: event.httpMethod })

    const healthStatus = await healthService.getDetailedHealth()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache, must-revalidate'
      },
      body: JSON.stringify({
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        uptime: process.uptime(),
        version: process.env.API_VERSION || '1.0.0',
        components: healthStatus.components,
        responseTime: healthStatus.responseTime
      })
    }
  } catch (error) {
    console.error('Detailed health check error:', error)
    return errorHandler(error)
  }
}