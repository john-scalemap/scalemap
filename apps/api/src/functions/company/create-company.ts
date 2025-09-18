import { randomUUID } from 'crypto';

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'create-company' });

  try {
    requestLogger.info('Company creation requested');
    Monitoring.incrementCounter('CompanyCreationRequests');

    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Request body is required' },
          meta: { timestamp: new Date().toISOString(), requestId }
        }),
      };
    }

    const companyData = JSON.parse(event.body);
    const companyId = randomUUID();

    // Create company record
    const company = {
      PK: `COMPANY#${companyId}`,
      SK: 'METADATA',
      GSI1PK: `USER#${companyData.ownerId}`,
      GSI1SK: `COMPANY#${companyId}`,
      id: companyId,
      name: companyData.name,
      industry: companyData.industry,
      businessModel: companyData.businessModel,
      size: companyData.size,
      description: companyData.description || '',
      website: companyData.website || '',
      headquarters: companyData.headquarters || { country: 'Unknown', city: 'Unknown' },
      ownerId: companyData.ownerId,
      subscription: {
        planId: 'starter',
        status: 'trial',
        billingPeriod: 'monthly',
        startDate: new Date().toISOString(),
        features: ['basic_assessments', 'basic_agents'],
        limits: {
          maxAssessments: 5,
          maxAgents: 2,
          maxUsers: 1,
          maxStorageGB: 1
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.put(company);

    requestLogger.info('Company created successfully', { companyId });
    Monitoring.incrementCounter('CompanyCreationSuccess');

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: { companyId, name: companyData.name },
        meta: { timestamp: new Date().toISOString(), requestId }
      }),
    };

  } catch (error) {
    Monitoring.recordError('create-company', 'UnexpectedError', error as Error);
    requestLogger.error('Company creation failed', { error: (error as Error).message });

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