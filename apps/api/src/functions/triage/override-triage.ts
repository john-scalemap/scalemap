import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { TriageService } from '../../services/triage-service';
import { errorHandler } from '../../shared/middleware/error-handler';
import { withAdminRole } from '../../shared/middleware/role-middleware';

const triageService = new TriageService();

/**
 * PUT /triage/{assessmentId}/override
 * Override triage results (founder/admin only)
 */
async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const assessmentId = event.pathParameters?.assessmentId;
    const { newDomains, reason } = JSON.parse(event.body || '{}');

    if (!assessmentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({
          error: 'Assessment ID is required'
        })
      };
    }

    if (!newDomains || !Array.isArray(newDomains) || newDomains.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({
          error: 'New domains array is required and must not be empty'
        })
      };
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({
          error: 'Override reason is required'
        })
      };
    }

    // Validate domain names
    const validDomains = [
      'strategic-alignment', 'financial-management', 'revenue-engine',
      'operational-excellence', 'people-organization', 'technology-data',
      'customer-experience', 'supply-chain', 'risk-compliance',
      'partnerships', 'customer-success', 'change-management'
    ];

    const invalidDomains = newDomains.filter(domain => !validDomains.includes(domain));
    if (invalidDomains.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({
          error: `Invalid domain names: ${invalidDomains.join(', ')}`
        })
      };
    }

    // Validate domain count (3-5 domains)
    if (newDomains.length < 3 || newDomains.length > 5) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({
          error: 'Domain selection must include 3-5 domains'
        })
      };
    }

    // Get user info from context (set by auth middleware)
    const userContext = (event as any).requestContext?.authorizer;
    const userId = userContext?.userId || 'system';
    // const _userRole = userContext?.role || 'user';

    console.log(`Processing triage override for assessment ${assessmentId} by user ${userId}`);

    // Perform the override
    const updatedResults = await triageService.overrideTriageResults(
      assessmentId,
      newDomains,
      userId,
      reason.trim()
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({
        success: true,
        data: {
          assessmentId,
          overriddenBy: userId,
          newDomains,
          reason,
          updatedResults: {
            criticalDomains: updatedResults.criticalDomains,
            confidence: updatedResults.confidence,
            reasoning: updatedResults.reasoning
          },
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Error overriding triage results:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({
        error: 'Internal server error during triage override',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

// Apply both auth and role middleware (admin only)
export const overrideTriage = errorHandler(
  withAdminRole(handler, 'triage', 'override')
);