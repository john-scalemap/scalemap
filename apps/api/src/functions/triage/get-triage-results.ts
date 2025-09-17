import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { TriageService } from '../../services/triage-service';
import { withAuth } from '../../shared/middleware/auth-middleware';
import { errorHandler } from '../../shared/middleware/error-handler';

const triageService = new TriageService();

/**
 * GET /triage/{assessmentId}/results
 * Get triage results for an assessment
 */
async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const assessmentId = event.pathParameters?.assessmentId;

    if (!assessmentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({
          error: 'Assessment ID is required'
        })
      };
    }

    console.log(`Getting triage results for assessment: ${assessmentId}`);

    // Get triage results
    const triageResults = await triageService.getTriageResults(assessmentId);

    if (!triageResults) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({
          error: 'Triage results not found'
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({
        success: true,
        data: {
          assessmentId,
          triageResults: {
            criticalDomains: triageResults.criticalDomains,
            domainScores: Object.fromEntries(
              Object.entries(triageResults.domainScores).map(([domain, score]) => [
                domain,
                {
                  score: score.score,
                  confidence: score.confidence,
                  severity: score.severity,
                  priorityLevel: score.priorityLevel,
                  agentActivation: score.agentActivation,
                  reasoning: score.reasoning
                }
              ])
            ),
            confidence: triageResults.confidence,
            reasoning: triageResults.reasoning,
            industryContext: {
              sector: triageResults.industryContext.sector,
              regulatoryClassification: triageResults.industryContext.regulatoryClassification,
              specificRules: triageResults.industryContext.specificRules
            },
            processingMetrics: {
              processingTime: triageResults.processingMetrics.processingTime,
              modelUsed: triageResults.processingMetrics.modelUsed,
              costEstimate: triageResults.processingMetrics.costEstimate
            }
          }
        }
      })
    };

  } catch (error) {
    console.error('Error getting triage results:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({
        error: 'Internal server error retrieving triage results',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

export const getTriageResults = errorHandler(withAuth(handler));