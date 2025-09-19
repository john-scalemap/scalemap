import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Assessment } from '@scalemap/shared';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'scalemap-table';

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,PATCH'
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

    // Parse request body
    let updateData: Partial<Assessment>;
    try {
      updateData = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid JSON in request body'
        })
      };
    }

    // Get existing assessment to verify ownership
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

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updateData).forEach(([key, value], index) => {
      if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = value;
      }
    });

    if (updateExpressions.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'No valid fields to update'
        })
      };
    }

    // Update timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const updateParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA'
      }),
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ReturnValues: 'ALL_NEW' as const
    };

    const updateResult = await dynamoDb.send(new UpdateItemCommand(updateParams));

    if (!updateResult.Attributes) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Failed to update assessment'
        })
      };
    }

    const updatedAssessment = unmarshall(updateResult.Attributes);

    // Remove internal DynamoDB fields
    delete (updatedAssessment as any).PK;
    delete (updatedAssessment as any).SK;
    delete (updatedAssessment as any).GSI1PK;
    delete (updatedAssessment as any).GSI1SK;
    delete (updatedAssessment as any).GSI2PK;
    delete (updatedAssessment as any).GSI2SK;
    delete (updatedAssessment as any).TTL;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedAssessment)
    };

  } catch (error) {
    console.error('Error updating assessment:', error);

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