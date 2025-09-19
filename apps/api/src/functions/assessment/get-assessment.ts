import { DynamoDBClient, GetItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Assessment } from '@scalemap/shared';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'scalemap-table';

function cleanAssessmentData(item: any): Assessment {
  const assessment = { ...item };
  delete assessment.PK;
  delete assessment.SK;
  delete assessment.GSI1PK;
  delete assessment.GSI1SK;
  delete assessment.GSI2PK;
  delete assessment.GSI2SK;
  delete assessment.TTL;
  return assessment;
}

async function getSingleAssessment(
  assessmentId: string,
  corsHeaders: any
): Promise<APIGatewayProxyResult> {
  // Get assessment from DynamoDB
  const getParams = {
    TableName: TABLE_NAME,
    Key: marshall({
      PK: `ASSESSMENT#${assessmentId}`,
      SK: 'METADATA',
    }),
  };

  const result = await dynamoDb.send(new GetItemCommand(getParams));

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Assessment not found',
        },
      }),
    };
  }

  const assessment = unmarshall(result.Item) as Assessment;
  const cleanAssessment = cleanAssessmentData(assessment);

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      data: cleanAssessment,
    }),
  };
}

async function listAssessments(event: any, corsHeaders: any): Promise<APIGatewayProxyResult> {
  // Parse query parameters
  const queryParams = event.queryStringParameters || {};
  const companyId = queryParams.companyId;
  const status = queryParams.status;
  const page = parseInt(queryParams.page || '1');
  const limit = parseInt(queryParams.limit || '10');

  // For now, scan all assessments since we need JWT parsing to filter by company
  // TODO: Use GSI1 with COMPANY#{companyId} when JWT context is available
  const queryParams_ddb = {
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :pk)',
    ExpressionAttributeValues: marshall({
      ':pk': 'ASSESSMENT#',
    }),
    Limit: limit,
  };

  const result = await dynamoDb.send(new ScanCommand(queryParams_ddb));

  const assessments = (result.Items || [])
    .map((item) => cleanAssessmentData(unmarshall(item)))
    .filter((assessment) => {
      // Filter by status if provided
      if (status && status !== assessment.status) {
        return false;
      }
      // Filter by company if provided
      if (companyId && companyId !== assessment.companyId) {
        return false;
      }
      return true;
    });

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      data: {
        assessments,
        pagination: {
          page,
          limit,
          total: assessments.length,
          totalPages: Math.ceil(assessments.length / limit),
        },
      },
    }),
  };
}

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,GET',
  };

  try {
    // Validate authentication
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication token required',
          },
        }),
      };
    }

    // Extract assessment ID from path
    const assessmentId = event.pathParameters?.id;

    if (assessmentId) {
      // Single assessment request: GET /assessments/{id}
      return await getSingleAssessment(assessmentId, corsHeaders);
    } else {
      // List assessments request: GET /assessments
      return await listAssessments(event, corsHeaders);
    }
  } catch (error) {
    console.error('Error retrieving assessment:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      }),
    };
  }
};
