import { AgentPersonaStatus } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { AgentService } from '../../services/agent-service';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface UpdateAgentStatusRequest {
  status: AgentPersonaStatus;
  activity?: string;
  metadata?: Record<string, unknown>;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'update-agent-status' });

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'PUT,OPTIONS',
  };

  try {
    const agentId = event.pathParameters?.id;

    if (!agentId) {
      requestLogger.warn('Agent ID not provided');
      Monitoring.incrementCounter('UpdateAgentStatusBadRequest');

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

    // Verify authorization - this is a system operation
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      requestLogger.warn('No authorization header provided');
      Monitoring.incrementCounter('UpdateAgentStatusUnauthorized');

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'Authorization required',
          timestamp: new Date().toISOString(),
          requestId,
        }),
      };
    }

    // Validate request body
    if (!event.body) {
      requestLogger.warn('Request body is required');
      Monitoring.incrementCounter('UpdateAgentStatusBadRequest');

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Request body is required',
          timestamp: new Date().toISOString(),
          requestId,
        }),
      };
    }

    let updateRequest: UpdateAgentStatusRequest;
    try {
      updateRequest = JSON.parse(event.body);
    } catch (parseError) {
      requestLogger.warn('Invalid JSON in request body');
      Monitoring.incrementCounter('UpdateAgentStatusBadRequest');

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid JSON in request body',
          timestamp: new Date().toISOString(),
          requestId,
        }),
      };
    }

    // Validate status
    const validStatuses: AgentPersonaStatus[] = ['available', 'analyzing', 'completed', 'offline', 'maintenance'];
    if (!updateRequest.status || !validStatuses.includes(updateRequest.status)) {
      requestLogger.warn('Invalid status provided', { status: updateRequest.status });
      Monitoring.incrementCounter('UpdateAgentStatusBadRequest');

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid status. Must be one of: ' + validStatuses.join(', '),
          timestamp: new Date().toISOString(),
          requestId,
        }),
      };
    }

    requestLogger.info('Update agent status requested', {
      agentId,
      status: updateRequest.status,
      activity: updateRequest.activity
    });

    Monitoring.incrementCounter('UpdateAgentStatusRequests', {
      agentId,
      status: updateRequest.status
    });

    const agentService = new AgentService();

    // First verify agent exists
    const agent = await agentService.getAgentById(agentId);
    if (!agent) {
      requestLogger.warn('Agent not found', { agentId });
      Monitoring.incrementCounter('UpdateAgentStatusNotFound', { agentId });

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

    // Prepare metadata
    const metadata = {
      ...updateRequest.metadata,
      ...(updateRequest.activity && { activity: updateRequest.activity }),
      updatedBy: 'system', // In the future, this could be the user/service that made the update
      previousStatus: agent.status
    };

    // Update agent status
    await agentService.updateAgentStatus(agentId, updateRequest.status, metadata);

    const response = {
      agentId,
      status: updateRequest.status,
      activity: updateRequest.activity,
      timestamp: new Date().toISOString(),
      requestId,
    };

    Monitoring.incrementCounter('UpdateAgentStatusSuccess', {
      agentId,
      status: updateRequest.status
    });

    requestLogger.info('Agent status updated successfully', {
      agentId,
      status: updateRequest.status,
      activity: updateRequest.activity
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    const err = error as Error;
    Monitoring.recordError('update-agent-status', 'UnexpectedError', err);
    requestLogger.error('Failed to update agent status', { error: err.message });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to update agent status',
        message: err.message,
        timestamp: new Date().toISOString(),
        requestId,
      }),
    };
  }
};