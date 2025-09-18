import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { Assessment, AssessmentStatus, DomainName, DomainProgress } from '@scalemap/shared';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

import { jwtService } from '../../services/jwt';
import { rateLimiters } from '../../services/rate-limiter';
import { parseEventBody } from '../../utils/json-parser';
import { corsPolicy } from '../../services/cors-policy';

const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'scalemap-table';

interface CreateAssessmentRequest {
  companyName: string;
  contactEmail: string;
  title: string;
  description: string;
  assessmentContext?: {
    primaryBusinessChallenges: string[];
    strategicObjectives: string[];
    resourceConstraints: {
      budget: 'limited' | 'moderate' | 'substantial';
      team: 'stretched' | 'adequate' | 'well-staffed';
      timeAvailability: 'minimal' | 'moderate' | 'flexible';
    };
  };
}

const DOMAIN_QUESTION_COUNTS: Record<DomainName, { total: number; required: number; optional: number }> = {
  'strategic-alignment': { total: 7, required: 6, optional: 1 },
  'financial-management': { total: 9, required: 7, optional: 2 },
  'revenue-engine': { total: 9, required: 7, optional: 2 },
  'operational-excellence': { total: 8, required: 7, optional: 1 },
  'people-organization': { total: 9, required: 7, optional: 2 },
  'technology-data': { total: 8, required: 7, optional: 1 },
  'customer-experience': { total: 8, required: 7, optional: 1 },
  'supply-chain': { total: 6, required: 4, optional: 2 },
  'risk-compliance': { total: 8, required: 6, optional: 2 },
  'partnerships': { total: 7, required: 6, optional: 1 },
  'customer-success': { total: 8, required: 6, optional: 2 },
  'change-management': { total: 8, required: 7, optional: 1 }
};

const createInitialDomainProgress = (): Record<DomainName, DomainProgress> => {
  const domains: Record<DomainName, DomainProgress> = {} as Record<DomainName, DomainProgress>;

  Object.entries(DOMAIN_QUESTION_COUNTS).forEach(([domain, counts]) => {
    domains[domain as DomainName] = {
      completed: 0,
      total: counts.total,
      status: 'not-started',
      requiredQuestions: counts.required,
      optionalQuestions: counts.optional
    };
  });

  return domains;
};

export const handler: APIGatewayProxyHandler = async (event, _context, _callback): Promise<APIGatewayProxyResult> => {
  const corsHeaders = corsPolicy.getCorsHeaders(event);

  try {
    // Rate limiting check
    const rateLimitResult = await rateLimiters.strict.isAllowed(event);
    if (!rateLimitResult.allowed && rateLimitResult.result) {
      return rateLimitResult.result;
    }

    // Parse request body
    const parseResult = parseEventBody<CreateAssessmentRequest>(
      event.body,
      event.requestContext?.requestId || 'unknown'
    );
    if (!parseResult.success) {
      return parseResult.response;
    }
    const requestData = parseResult.data;

    // Validate required fields
    if (!requestData.companyName?.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Company name is required'
        })
      };
    }

    if (!requestData.contactEmail?.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Contact email is required'
        })
      };
    }

    if (!requestData.title?.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Assessment title is required'
        })
      };
    }

    if (!requestData.description?.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Assessment description is required'
        })
      };
    }

    // Extract user/company ID from JWT token (simplified for now)
    // In production, you'd decode and validate the JWT token
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

    // Extract and validate JWT token
    let companyId: string;
    try {
      const token = jwtService.extractTokenFromHeader(event.headers.Authorization);
      if (!token) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Authentication token malformed'
          })
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
            error: 'Email verification required'
          })
        };
      }
    } catch (error) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid or expired authentication token'
        })
      };
    }

    // Create assessment object
    const assessmentId = uuidv4();
    const now = new Date().toISOString();

    const assessment: Assessment = {
      id: assessmentId,
      companyId,
      companyName: requestData.companyName.trim(),
      contactEmail: requestData.contactEmail.trim(),
      title: requestData.title.trim(),
      description: requestData.description.trim(),
      status: 'document-processing' as AssessmentStatus,
      createdAt: now,
      updatedAt: now,
      assessmentContext: requestData.assessmentContext,
      domainResponses: {},
      progress: {
        overall: 0,
        domains: createInitialDomainProgress(),
        completeness: 0,
        estimatedTimeRemaining: '45-60 minutes'
      },
      deliverySchedule: {
        executive24h: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        detailed48h: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        implementation72h: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      },
      clarificationPolicy: {
        allowClarificationUntil: 'detailed48h',
        maxClarificationRequests: 3,
        maxTimelineExtension: 24 * 60 * 60 * 1000
      }
    };

    // Store in DynamoDB
    const putParams = {
      TableName: TABLE_NAME,
      Item: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA',
        GSI1PK: `COMPANY#${companyId}`,
        GSI1SK: `ASSESSMENT#${now}`,
        GSI2PK: `STATUS#${assessment.status}`,
        GSI2SK: `CREATED#${now}`,
        ...assessment,
        TTL: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
      }, { removeUndefinedValues: true })
    };

    await dynamoDb.send(new PutItemCommand(putParams));

    // Return created assessment
    return {
      statusCode: 201,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assessment)
    };

  } catch (error) {
    console.error('Error creating assessment:', error);

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