import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'get-company' });

  try {
    requestLogger.info('Company retrieval requested');
    Monitoring.incrementCounter('CompanyRetrievalRequests');

    const companyId = event.pathParameters?.id;
    if (!companyId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Company ID is required' },
          meta: { timestamp: new Date().toISOString(), requestId }
        }),
      };
    }

    const company = await db.get(`COMPANY#${companyId}`, 'METADATA');

    if (!company) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: { code: 'COMPANY_NOT_FOUND', message: 'Company not found' },
          meta: { timestamp: new Date().toISOString(), requestId }
        }),
      };
    }

    requestLogger.info('Company retrieved successfully', { companyId });
    Monitoring.incrementCounter('CompanyRetrievalSuccess');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          id: company.id,
          name: company.name,
          industry: company.industry,
          businessModel: company.businessModel,
          size: company.size,
          description: company.description,
          website: company.website,
          headquarters: company.headquarters,
          subscription: company.subscription,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt
        },
        meta: { timestamp: new Date().toISOString(), requestId }
      }),
    };

  } catch (error) {
    Monitoring.recordError('get-company', 'UnexpectedError', error as Error);
    requestLogger.error('Company retrieval failed', { error: (error as Error).message });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        meta: { timestamp: new Date().toISOString(), requestId }
      }),
    };
  }
};