import { DynamoDBClient, QueryCommand, QueryCommandInput } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Assessment } from '@scalemap/shared';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

import { jwtService } from '../../services/jwt';

const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'scalemap-table';

interface ListAssessmentsQuery {
  status?: string;
  limit?: string;
}

export const handler: APIGatewayProxyHandler = async (
  event,
  _context,
  _callback
): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,GET',
  };

  try {
    // Validate authentication and extract company ID
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Authentication token required',
        }),
      };
    }

    let companyId: string;
    try {
      const token = jwtService.extractTokenFromHeader(authHeader);
      if (!token) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Authentication token malformed',
          }),
        };
      }

      const payload = await jwtService.validateAccessToken(token);
      companyId = payload.companyId;

      // Additional check for email verification if required
      if (!payload.emailVerified) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Email verification required',
          }),
        };
      }
    } catch (error) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid or expired authentication token',
        }),
      };
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const { status, limit } = queryParams as ListAssessmentsQuery;

    // Parse status filter - default to draft and in-progress assessments
    const statusFilter = status
      ? status.split(',')
      : [
          'payment-pending',
          'document-processing',
          'triaging',
          'analyzing',
          'synthesizing',
          'validating',
        ];
    const limitValue = limit ? parseInt(limit, 10) : 50;

    // Validate limit
    if (limitValue < 1 || limitValue > 100) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Limit must be between 1 and 100',
        }),
      };
    }

    // Query assessments for this company using GSI1
    const dynamoQueryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :companyPK AND begins_with(GSI1SK, :assessmentPrefix)',
      ExpressionAttributeValues: marshall({
        ':companyPK': `COMPANY#${companyId}`,
        ':assessmentPrefix': 'ASSESSMENT#',
      }),
      ScanIndexForward: false, // Sort by newest first (GSI1SK has timestamp)
      Limit: limitValue,
    };

    // Add filter expression for status if needed
    if (statusFilter.length > 0) {
      dynamoQueryParams.FilterExpression =
        '#status IN (' + statusFilter.map((_, i) => `:status${i}`).join(', ') + ')';
      dynamoQueryParams.ExpressionAttributeNames = { '#status': 'status' };

      // Add status values to expression attribute values
      const statusValues: Record<string, string> = {};
      statusFilter.forEach((statusValue, index) => {
        statusValues[`:status${index}`] = statusValue;
      });

      dynamoQueryParams.ExpressionAttributeValues = marshall({
        ...unmarshall(dynamoQueryParams.ExpressionAttributeValues || {}),
        ...statusValues,
      });
    }

    const result = await dynamoDb.send(new QueryCommand(dynamoQueryParams));

    // Process results
    const assessments: Assessment[] = [];
    if (result && result.Items && Array.isArray(result.Items)) {
      for (const item of result.Items) {
        const assessment = unmarshall(item) as Assessment;

        // Remove internal DynamoDB fields
        const cleanAssessment = { ...assessment };
        delete (cleanAssessment as any).PK;
        delete (cleanAssessment as any).SK;
        delete (cleanAssessment as any).GSI1PK;
        delete (cleanAssessment as any).GSI1SK;
        delete (cleanAssessment as any).GSI2PK;
        delete (cleanAssessment as any).GSI2SK;
        delete (cleanAssessment as any).TTL;

        assessments.push(cleanAssessment);
      }
    }

    // Return list of assessments
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assessments,
        count: assessments.length,
        hasMore: result && result.LastEvaluatedKey !== undefined,
      }),
    };
  } catch (error) {
    console.error('Error listing assessments:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
    };
  }
};
