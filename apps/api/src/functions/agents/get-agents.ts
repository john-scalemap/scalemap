import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { AgentService } from '../../services/agent-service';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'get-agents' });

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  };

  try {
    requestLogger.info('Get agents requested', {
      queryParams: event.queryStringParameters
    });

    Monitoring.incrementCounter('GetAgentsRequests');

    const agentService = new AgentService();
    const { domain, industry, status } = event.queryStringParameters || {};

    let agents;

    if (domain) {
      requestLogger.info('Filtering agents by domain', { domain });
      agents = await agentService.getAgentsByDomain(domain);
    } else if (industry) {
      requestLogger.info('Filtering agents by industry', { industry });
      agents = await agentService.getAgentsByIndustry(industry);
    } else {
      requestLogger.info('Retrieving all agents');
      agents = await agentService.getAllAgents();
    }

    // Filter by status if provided
    if (status) {
      agents = agents.filter(agent => agent.status === status);
      requestLogger.info('Filtered agents by status', { status, count: agents.length });
    }

    const response = {
      agents,
      total: agents.length,
      filters: {
        domain,
        industry,
        status
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    Monitoring.incrementCounter('GetAgentsSuccess', {
      domain: domain || 'all',
      industry: industry || 'all',
      status: status || 'all',
      count: agents.length.toString()
    });

    requestLogger.info('Agents retrieved successfully', {
      count: agents.length,
      filters: { domain, industry, status }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    const err = error as Error;
    Monitoring.recordError('get-agents', 'UnexpectedError', err);
    requestLogger.error('Failed to retrieve agents', { error: err.message });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to retrieve agents',
        message: err.message,
        timestamp: new Date().toISOString(),
        requestId,
      }),
    };
  }
};