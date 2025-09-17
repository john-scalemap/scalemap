import { BulkGapResolutionRequest } from '@scalemap/shared';
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
  console.log('Bulk gap resolution request:', JSON.stringify(event, null, 2));

  try {
    // Extract assessment ID from path parameters
    const assessmentId = event.pathParameters?.assessmentId;

    if (!assessmentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Assessment ID is required'
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

    let requestBody: BulkGapResolutionRequest;
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
    if (!requestBody.assessmentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Assessment ID is required in request body'
        })
      };
    }

    if (requestBody.assessmentId !== assessmentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Assessment ID in path must match assessment ID in request body'
        })
      };
    }

    if (!requestBody.resolutions || !Array.isArray(requestBody.resolutions)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Resolutions array is required'
        })
      };
    }

    if (requestBody.resolutions.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'At least one resolution is required'
        })
      };
    }

    // Validate each resolution
    for (let i = 0; i < requestBody.resolutions.length; i++) {
      const resolution = requestBody.resolutions[i];

      if (!resolution) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
          },
          body: JSON.stringify({
            error: `Resolution ${i + 1} is missing`
          })
        };
      }

      if (!resolution.gapId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
          },
          body: JSON.stringify({
            error: `Resolution ${i + 1}: Gap ID is required`
          })
        };
      }

      if (!resolution.skipGap && (!resolution.clientResponse || resolution.clientResponse.trim() === '')) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
          },
          body: JSON.stringify({
            error: `Resolution ${i + 1}: Either clientResponse or skipGap must be provided`
          })
        };
      }
    }

    // Limit bulk operations to prevent timeouts
    if (requestBody.resolutions.length > 50) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Maximum 50 resolutions allowed per bulk request'
        })
      };
    }

    console.log(`Processing bulk gap resolution for assessment ${assessmentId}:`, {
      resolutionCount: requestBody.resolutions.length,
      gapIds: requestBody.resolutions.map(r => r.gapId)
    });

    // Process bulk gap resolution
    const service = getGapAnalysisService();
    const result = await service.resolveBulkGaps(requestBody);

    console.log(`Bulk gap resolution completed for assessment ${assessmentId}:`, {
      processedCount: result.processedCount,
      resolvedCount: result.resolvedCount,
      newGapsCount: result.newGapsCount,
      failedCount: result.failedResolutions.length,
      overallCompletenessScore: result.overallCompletenessScore
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
    console.error('Bulk gap resolution failed:', error);

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
        assessmentId: event.pathParameters?.assessmentId
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