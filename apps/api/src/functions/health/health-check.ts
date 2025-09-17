import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

import { healthService } from '../../services/health-service'
import { errorHandler } from '../../shared/middleware/error-handler'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Health check endpoint called', { path: event.path, method: event.httpMethod })

    const healthStatus = await healthService.getBasicHealth()

    return {
      statusCode: healthStatus.status === 'healthy' ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        uptime: process.uptime(),
        version: process.env.API_VERSION || '1.0.0'
      })
    }
  } catch (error) {
    console.error('Health check error:', error)
    return errorHandler(error)
  }
}