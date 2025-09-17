import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { AgentService } from '../../services/agent-service';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'get-agent' });

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  };

  try {
    const agentId = event.pathParameters?.id;

    if (!agentId) {
      requestLogger.warn('Agent ID not provided');
      Monitoring.incrementCounter('GetAgentBadRequest');

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Agent ID is required',
          timestamp: new Date().toISOString(),
          requestId,
        }),
      };
    }

    requestLogger.info('Get agent requested', { agentId });
    Monitoring.incrementCounter('GetAgentRequests', { agentId });

    const agentService = new AgentService();
    const agent = await agentService.getAgentById(agentId);

    if (!agent) {
      requestLogger.warn('Agent not found', { agentId });
      Monitoring.incrementCounter('GetAgentNotFound', { agentId });

      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Agent not found',
          agentId,
          timestamp: new Date().toISOString(),
          requestId,
        }),
      };
    }

    // Get current status if available
    let currentStatus = null;
    try {
      currentStatus = await agentService.getAgentStatus(agentId);
    } catch (statusError) {
      // Non-critical error, log but continue
      requestLogger.warn('Failed to retrieve agent status', {
        agentId,
        error: (statusError as Error).message
      });
    }

    const response = {
      agent: {
        ...agent,
        // Override status with current status if available
        ...(currentStatus && {
          status: currentStatus.status,
          lastStatusUpdate: currentStatus.timestamp,
          statusMetadata: currentStatus.metadata
        })
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    Monitoring.incrementCounter('GetAgentSuccess', { agentId });
    requestLogger.info('Agent retrieved successfully', { agentId });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    const err = error as Error;
    Monitoring.recordError('get-agent', 'UnexpectedError', err);
    requestLogger.error('Failed to retrieve agent', { error: err.message });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to retrieve agent',
        message: err.message,
        timestamp: new Date().toISOString(),
        requestId,
      }),
    };
  }
};