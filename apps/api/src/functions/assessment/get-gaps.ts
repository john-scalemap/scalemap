import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { AssessmentGap, GapTrackingEntity } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamoDb = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-1',
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  }),
});

const tableName = process.env.DYNAMODB_TABLE_NAME || 'scalemap-prod';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get gaps request:', JSON.stringify(event, null, 2));

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

    // Parse query parameters for filtering
    const queryParams = event.queryStringParameters || {};
    const category = queryParams.category; // 'critical', 'important', 'nice-to-have'
    const status = queryParams.status || 'pending'; // 'pending', 'resolved'
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    // Validate parameters
    if (category && !['critical', 'important', 'nice-to-have'].includes(category)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Invalid category. Must be critical, important, or nice-to-have'
        })
      };
    }

    if (!['pending', 'resolved'].includes(status)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Invalid status. Must be pending or resolved'
        })
      };
    }

    if (limit < 1 || limit > 100) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Limit must be between 1 and 100'
        })
      };
    }

    console.log(`Getting gaps for assessment ${assessmentId}:`, {
      category,
      status,
      limit
    });

    let gaps: AssessmentGap[] = [];

    if (category) {
      // Query by category using GSI1
      const params = {
        TableName: tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :categoryKey',
        FilterExpression: 'begins_with(PK, :assessmentKey)',
        ExpressionAttributeValues: marshall({
          ':categoryKey': `GAP#${category}`,
          ':assessmentKey': `ASSESSMENT#${assessmentId}`
        }),
        Limit: limit,
        ScanIndexForward: false // Higher priority first
      };

      const result = await dynamoDb.send(new QueryCommand(params));

      if (result.Items) {
        gaps = result.Items.map(item => {
          const gapEntity = unmarshall(item) as GapTrackingEntity;
          return gapEntity.Data;
        }).filter(gap => {
          // Apply status filter
          return status === 'resolved' ? gap.resolved : !gap.resolved;
        });
      }
    } else {
      // Query by status using GSI2
      const params = {
        TableName: tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :statusKey',
        FilterExpression: 'begins_with(PK, :assessmentKey)',
        ExpressionAttributeValues: marshall({
          ':statusKey': `GAP#${status}`,
          ':assessmentKey': `ASSESSMENT#${assessmentId}`
        }),
        Limit: limit,
        ScanIndexForward: false // Most recent first
      };

      const result = await dynamoDb.send(new QueryCommand(params));

      if (result.Items) {
        gaps = result.Items.map(item => {
          const gapEntity = unmarshall(item) as GapTrackingEntity;
          return gapEntity.Data;
        });
      }
    }

    // Sort gaps by priority (highest first) and then by detected date
    gaps.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

    // Calculate summary statistics
    const summary = {
      totalGaps: gaps.length,
      criticalGaps: gaps.filter(g => g.category === 'critical').length,
      importantGaps: gaps.filter(g => g.category === 'important').length,
      niceToHaveGaps: gaps.filter(g => g.category === 'nice-to-have').length,
      resolvedGaps: gaps.filter(g => g.resolved).length,
      pendingGaps: gaps.filter(g => !g.resolved).length,
      averagePriority: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g.priority, 0) / gaps.length : 0,
      estimatedTotalResolutionTime: gaps.filter(g => !g.resolved).reduce((sum, g) => sum + g.estimatedResolutionTime, 0)
    };

    console.log(`Retrieved ${gaps.length} gaps for assessment ${assessmentId}:`, summary);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        assessmentId,
        gaps,
        summary,
        filters: {
          category: category || 'all',
          status,
          limit
        }
      })
    };

  } catch (error) {
    console.error('Get gaps failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      statusCode: 500,
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