import { GapResolutionRequest } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { GapAnalysisService } from '../../services/gap-analysis-service';

// Use lazy initialization for testability
let gapAnalysisService: GapAnalysisService;

const getGapAnalysisService = () => {
  if (!gapAnalysisService) {
    gapAnalysisService = new GapAnalysisService();
  }
  return gapAnalysisService;
};

// For testing purposes only
export const __resetService = () => {
  gapAnalysisService = undefined as any;
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Gap resolution request:', JSON.stringify(event, null, 2));

  try {
    // Extract gap ID from path parameters
    const gapId = event.pathParameters?.gapId;

    if (!gapId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Gap ID is required'
        })
      };
    }

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Request body is required'
        })
      };
    }

    let requestBody: GapResolutionRequest;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Invalid JSON in request body'
        })
      };
    }

    // Validate request
    if (!requestBody.gapId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Gap ID is required in request body'
        })
      };
    }

    if (requestBody.gapId !== gapId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Gap ID in path must match gap ID in request body'
        })
      };
    }

    // Validate that either clientResponse or skipGap is provided
    if (!requestBody.skipGap && (!requestBody.clientResponse || requestBody.clientResponse.trim() === '')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Either clientResponse or skipGap must be provided'
        })
      };
    }

    console.log(`Processing gap resolution for gap ${gapId}:`, {
      hasResponse: !!requestBody.clientResponse,
      skipGap: !!requestBody.skipGap,
      hasAdditionalContext: !!requestBody.additionalContext
    });

    // Resolve the gap
    const service = getGapAnalysisService();
    const result = await service.resolveGap(requestBody);

    console.log(`Gap resolution completed for gap ${gapId}:`, {
      resolved: result.resolved,
      newGapsCount: result.newGaps?.length || 0,
      impactOnCompleteness: result.impactOnCompleteness
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Gap resolution failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = errorMessage.includes('not found') ? 404 :
                      errorMessage.includes('validation') ? 400 : 500;

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
        gapId: event.pathParameters?.gapId
      })
    };
  }
};

// Handle preflight OPTIONS requests
export const options = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: ''
  };
};