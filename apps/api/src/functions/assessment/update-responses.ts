import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Assessment, DomainName, DomainResponse, AssessmentProgress, IndustryClassification } from '@scalemap/shared';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

import { rateLimiters } from '../../services/rate-limiter';

const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'scalemap-table';

interface UpdateResponsesRequest {
  domainResponses?: Record<string, DomainResponse>;
  progress?: AssessmentProgress;
  industryClassification?: IndustryClassification;
  assessmentContext?: Assessment['assessmentContext'];
}

const calculateEstimatedTime = (progress: AssessmentProgress): string => {
  const totalQuestions = Object.values(progress.domains).reduce((sum, domain) => sum + domain.total, 0);
  const completedQuestions = Object.values(progress.domains).reduce((sum, domain) => sum + domain.completed, 0);

  const remainingQuestions = totalQuestions - completedQuestions;
  const estimatedMinutes = Math.ceil(remainingQuestions * 0.75); // 45 seconds per question

  if (estimatedMinutes <= 5) return '< 5 minutes';
  if (estimatedMinutes <= 15) return '5-15 minutes';
  if (estimatedMinutes <= 30) return '15-30 minutes';
  if (estimatedMinutes <= 45) return '30-45 minutes';
  return '45-60 minutes';
};

const calculateOverallProgress = (domains: Record<DomainName, any>): number => {
  const totalQuestions = Object.values(domains).reduce((sum: number, domain: any) => sum + domain.total, 0);
  const completedQuestions = Object.values(domains).reduce((sum: number, domain: any) => sum + domain.completed, 0);

  return totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;
};

const calculateCompleteness = (
  domainResponses: Record<string, DomainResponse>,
  domains: Record<DomainName, any>
): number => {
  const totalRequiredQuestions = Object.values(domains)
    .reduce((sum: number, domain: any) => sum + domain.requiredQuestions, 0);

  const completedRequiredQuestions = Object.entries(domainResponses)
    .reduce((sum, [domainName, domainResponse]) => {
      const domainProgress = domains[domainName as DomainName];
      if (!domainProgress) return sum;

      const completedInDomain = Math.min(
        Object.keys(domainResponse.questions).length,
        domainProgress.requiredQuestions
      );
      return sum + completedInDomain;
    }, 0);

  return totalRequiredQuestions > 0 ?
    Math.round((completedRequiredQuestions / totalRequiredQuestions) * 100) : 0;
};

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,PUT'
  };

  try {
    // Rate limiting check
    const rateLimitResult = await rateLimiters.moderate.isAllowed(event);
    if (!rateLimitResult.allowed && rateLimitResult.result) {
      return rateLimitResult.result;
    }

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

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Request body is required'
        })
      };
    }

    const updateData: UpdateResponsesRequest = JSON.parse(event.body);

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

    // Get existing assessment
    const getParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA'
      })
    };

    const getResult = await dynamoDb.send(new GetItemCommand(getParams));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Assessment not found'
        })
      };
    }

    const existingAssessment = unmarshall(getResult.Item) as Assessment;

    // Prepare update expression parts
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    // Update domain responses if provided
    if (updateData.domainResponses) {
      updateExpressions.push('#domainResponses = :domainResponses');
      expressionAttributeNames['#domainResponses'] = 'domainResponses';
      expressionAttributeValues[':domainResponses'] = updateData.domainResponses;
    }

    // Update progress if provided
    if (updateData.progress) {
      // Recalculate progress metrics
      const updatedProgress = {
        ...updateData.progress,
        overall: calculateOverallProgress(updateData.progress.domains),
        completeness: calculateCompleteness(
          updateData.domainResponses || existingAssessment.domainResponses,
          updateData.progress.domains
        ),
        estimatedTimeRemaining: calculateEstimatedTime(updateData.progress)
      };

      updateExpressions.push('#progress = :progress');
      expressionAttributeNames['#progress'] = 'progress';
      expressionAttributeValues[':progress'] = updatedProgress;
    }

    // Update industry classification if provided
    if (updateData.industryClassification) {
      updateExpressions.push('#industryClassification = :industryClassification');
      expressionAttributeNames['#industryClassification'] = 'industryClassification';
      expressionAttributeValues[':industryClassification'] = updateData.industryClassification;
    }

    // Update assessment context if provided
    if (updateData.assessmentContext) {
      updateExpressions.push('#assessmentContext = :assessmentContext');
      expressionAttributeNames['#assessmentContext'] = 'assessmentContext';
      expressionAttributeValues[':assessmentContext'] = updateData.assessmentContext;
    }

    // Perform the update
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
      throw new Error('Failed to update assessment');
    }

    const updatedAssessment = unmarshall(updateResult.Attributes) as Assessment;

    // Return updated assessment
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedAssessment)
    };

  } catch (error) {
    console.error('Error updating assessment responses:', error);

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