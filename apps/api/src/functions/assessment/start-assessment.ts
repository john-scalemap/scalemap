import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  ReturnValue,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Assessment, AssessmentStatus } from '@scalemap/shared';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

import { corsPolicy } from '../../services/cors-policy';
import { jwtService } from '../../services/jwt';
import { rateLimiters } from '../../services/rate-limiter';

const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'scalemap-table';

export const handler: APIGatewayProxyHandler = async (
  event,
  _context
): Promise<APIGatewayProxyResult> => {
  const corsHeaders = corsPolicy.getCorsHeaders(event);

  try {
    // Rate limiting check
    const rateLimitResult = await rateLimiters.moderate.isAllowed(event);
    if (!rateLimitResult.allowed && rateLimitResult.result) {
      return rateLimitResult.result;
    }

    // Extract assessment ID from path parameters
    const assessmentId = event.pathParameters?.id;
    if (!assessmentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Assessment ID is required',
          },
        }),
      };
    }

    // Extract and validate JWT token
    let companyId: string;
    try {
      const token = jwtService.extractTokenFromHeader(event.headers.Authorization);
      if (!token) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication token required',
            },
          }),
        };
      }

      const payload = await jwtService.validateAccessToken(token);
      companyId = payload.companyId;

      if (!payload.emailVerified) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: {
              code: 'EMAIL_NOT_VERIFIED',
              message: 'Email verification required',
            },
          }),
        };
      }
    } catch (error) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired authentication token',
          },
        }),
      };
    }

    // Get the existing assessment
    const getParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA',
      }),
    };

    const getResult = await dynamoDb.send(new GetItemCommand(getParams));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'ASSESSMENT_NOT_FOUND',
            message: 'Assessment not found',
          },
        }),
      };
    }

    const assessment = unmarshall(getResult.Item) as Assessment;

    // Verify the assessment belongs to the user's company
    if (assessment.companyId !== companyId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to access this assessment',
          },
        }),
      };
    }

    // Check if assessment can be started
    const validStartStatuses: AssessmentStatus[] = [
      'document-processing',
      'triaging',
      'paused-for-gaps',
    ];
    if (!validStartStatuses.includes(assessment.status)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot start assessment with status: ${assessment.status}. Valid statuses: ${validStartStatuses.join(', ')}`,
          },
        }),
      };
    }

    // Update assessment to analyzing status
    const now = new Date().toISOString();
    const updateParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA',
      }),
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #startedAt = :startedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#startedAt': 'startedAt',
      },
      ExpressionAttributeValues: marshall({
        ':status': 'analyzing' as AssessmentStatus,
        ':updatedAt': now,
        ':startedAt': now,
      }),
      ReturnValues: ReturnValue.ALL_NEW,
    };

    const updateResult = await dynamoDb.send(new UpdateItemCommand(updateParams));

    if (!updateResult.Attributes) {
      throw new Error('Failed to update assessment');
    }

    const updatedAssessment = unmarshall(updateResult.Attributes) as Assessment;

    // TODO: Trigger assessment analysis workflow
    // This would typically send a message to SQS or EventBridge to start the analysis

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        data: updatedAssessment,
        meta: {
          timestamp: now,
          requestId: event.requestContext?.requestId || 'unknown',
        },
      }),
    };
  } catch (error) {
    console.error('Error starting assessment:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      }),
    };
  }
};
