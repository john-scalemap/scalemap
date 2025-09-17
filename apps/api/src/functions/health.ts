import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { healthService } from '../services/health-service';
import { logger } from '../utils/logger';
import { Monitoring } from '../utils/monitoring';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'health' });

  try {
    requestLogger.info('Health check requested');
    Monitoring.incrementCounter('HealthCheckRequests');

    const healthStatus = await healthService.getBasicHealth();

    const response = {
      status: healthStatus.status,
      message: `ScaleMap API is ${healthStatus.status}`,
      timestamp: healthStatus.timestamp,
      version: process.env.API_VERSION || '1.0.0',
      uptime: process.uptime(),
      requestId,
    };

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

    if (healthStatus.status === 'healthy') {
      Monitoring.incrementCounter('HealthCheckSuccess');
    } else {
      Monitoring.incrementCounter('HealthCheckFailure');
    }

    requestLogger.info('Health check completed', { status: healthStatus.status });

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    Monitoring.recordError('health', 'UnexpectedError', error as Error);
    requestLogger.error('Health check failed', { error: (error as Error).message });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        requestId,
      }),
    };
  }
};