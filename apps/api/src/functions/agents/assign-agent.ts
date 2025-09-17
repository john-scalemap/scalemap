import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { AgentService } from '../../services/agent-service';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface AssignAgentRequest {
  assessmentId: string;
  agentId: string;
  role: 'primary' | 'supporting' | 'collaborative';
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'assign-agent' });

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };

  try {
    // Verify authorization
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      requestLogger.warn('No authorization header provided');
      Monitoring.incrementCounter('AssignAgentUnauthorized');

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
      Monitoring.incrementCounter('AssignAgentBadRequest');

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

    let assignRequest: AssignAgentRequest;
    try {
      assignRequest = JSON.parse(event.body);
    } catch (parseError) {
      requestLogger.warn('Invalid JSON in request body');
      Monitoring.incrementCounter('AssignAgentBadRequest');

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

    // Validate required fields
    const { assessmentId, agentId, role } = assignRequest;
    if (!assessmentId || !agentId || !role) {
      requestLogger.warn('Missing required fields', { assessmentId, agentId, role });
      Monitoring.incrementCounter('AssignAgentBadRequest');

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'assessmentId, agentId, and role are required',
          timestamp: new Date().toISOString(),
          requestId,
        }),
      };
    }

    // Validate role
    const validRoles = ['primary', 'supporting', 'collaborative'];
    if (!validRoles.includes(role)) {
      requestLogger.warn('Invalid role provided', { role });
      Monitoring.incrementCounter('AssignAgentBadRequest');

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid role. Must be one of: ' + validRoles.join(', '),
          timestamp: new Date().toISOString(),
          requestId,
        }),
      };
    }

    requestLogger.info('Assign agent requested', { assessmentId, agentId, role });
    Monitoring.incrementCounter('AssignAgentRequests', { agentId, role });

    const agentService = new AgentService();

    // Verify agent exists
    const agent = await agentService.getAgentById(agentId);
    if (!agent) {
      requestLogger.warn('Agent not found', { agentId });
      Monitoring.incrementCounter('AssignAgentNotFound', { agentId });

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

    // Assign agent to assessment
    await agentService.assignAgentToAssessment(assessmentId, agentId, role);

    const response = {
      assessmentId,
      agentId,
      agentName: agent.name,
      role,
      assignedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      requestId,
    };

    Monitoring.incrementCounter('AssignAgentSuccess', { agentId, role });
    requestLogger.info('Agent assigned successfully', { assessmentId, agentId, role });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    const err = error as Error;
    Monitoring.recordError('assign-agent', 'UnexpectedError', err);
    requestLogger.error('Failed to assign agent', { error: err.message });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to assign agent',
        message: err.message,
        timestamp: new Date().toISOString(),
        requestId,
      }),
    };
  }
};