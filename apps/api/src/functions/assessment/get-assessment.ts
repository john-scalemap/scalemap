import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Assessment } from '@scalemap/shared';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'scalemap-table';

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,GET'
  };

  try {
    // Extract assessment ID from path
    const assessmentId = event.pathParameters?.id;
    if (!assessmentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Assessment ID is required'
        })
      };
    }

    // Validate authentication
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Authentication token required'
        })
      };
    }

    // Get assessment from DynamoDB
    const getParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA'
      })
    };

    const result = await dynamoDb.send(new GetItemCommand(getParams));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Assessment not found'
        })
      };
    }

    const assessment = unmarshall(result.Item) as Assessment;

    // Basic authorization check - ensure user can access this assessment
    // In production, you'd extract companyId from JWT and verify access
    const userCompanyId = 'temp-company-id'; // This would come from the decoded JWT

    if (assessment.companyId !== userCompanyId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Access denied - insufficient permissions'
        })
      };
    }

    // Remove internal DynamoDB fields
    const cleanAssessment = {
      ...assessment
    };
    delete (cleanAssessment as any).PK;
    delete (cleanAssessment as any).SK;
    delete (cleanAssessment as any).GSI1PK;
    delete (cleanAssessment as any).GSI1SK;
    delete (cleanAssessment as any).GSI2PK;
    delete (cleanAssessment as any).GSI2SK;
    delete (cleanAssessment as any).TTL;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cleanAssessment)
    };

  } catch (error) {
    console.error('Error retrieving assessment:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    };
  }
};