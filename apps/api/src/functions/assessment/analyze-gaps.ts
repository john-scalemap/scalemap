import { GapAnalysisRequest } from '@scalemap/shared';
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
  console.log('Gap analysis request:', JSON.stringify(event, null, 2));

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

    // Parse request body for analysis options
    let requestBody: Partial<GapAnalysisRequest> = {};
    if (event.body) {
      try {
        requestBody = JSON.parse(event.body);
      } catch (parseError) {
        console.warn('Failed to parse request body, using defaults:', parseError);
      }
    }

    // Build gap analysis request
    const gapAnalysisRequest: GapAnalysisRequest = {
      assessmentId,
      forceReanalysis: requestBody.forceReanalysis || false,
      focusDomains: requestBody.focusDomains,
      analysisDepth: requestBody.analysisDepth || 'standard'
    };

    // Validate analysis depth
    if (!['quick', 'standard', 'comprehensive'].includes(gapAnalysisRequest.analysisDepth)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Invalid analysis depth. Must be quick, standard, or comprehensive'
        })
      };
    }

    console.log(`Starting gap analysis for assessment ${assessmentId} with depth: ${gapAnalysisRequest.analysisDepth}`);

    // Perform gap analysis
    const service = getGapAnalysisService();
    const result = await service.analyzeGaps(gapAnalysisRequest);

    console.log(`Gap analysis completed for assessment ${assessmentId}:`, {
      totalGaps: result?.gapAnalysis?.totalGapsCount,
      criticalGaps: result?.gapAnalysis?.criticalGapsCount,
      completenessScore: result?.gapAnalysis?.overallCompletenessScore,
      processingTime: result?.processingTime,
      costEstimate: result?.costEstimate
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
    console.error('Gap analysis failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      assessmentId: event.pathParameters?.assessmentId,
      requestBody: event.body
    });

    // Map specific errors to appropriate HTTP status codes
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    let statusCode = 500;

    if (errorMessage.includes('not found') || errorMessage.includes('Assessment not found')) {
      statusCode = 404;
    } else if (errorMessage.includes('validation') || errorMessage.includes('Invalid')) {
      statusCode = 400;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      statusCode = 429;
    } else if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      statusCode = 403;
    }

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
        assessmentId: event.pathParameters?.assessmentId,
        correlationId: event.requestContext?.requestId || 'unknown'
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