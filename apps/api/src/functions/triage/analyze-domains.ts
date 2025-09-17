import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { AssessmentService } from '../../services/assessment-service';
import { TriageService } from '../../services/triage-service';
import { withAuth } from '../../shared/middleware/auth-middleware';
import { errorHandler } from '../../shared/middleware/error-handler';

const triageService = new TriageService();
const assessmentService = new AssessmentService();

/**
 * POST /triage/analyze
 * Perform domain triage analysis for an assessment
 */
async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { assessmentId } = JSON.parse(event.body || '{}');

    if (!assessmentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({
          error: 'Assessment ID is required'
        })
      };
    }

    console.log(`Starting triage analysis for assessment: ${assessmentId}`);

    // Get the assessment
    const assessment = await assessmentService.getAssessment(assessmentId);
    if (!assessment) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({
          error: 'Assessment not found'
        })
      };
    }

    // Verify assessment is ready for triage
    if (assessment.status !== 'triaging' && assessment.status !== 'payment-pending') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({
          error: `Assessment is not ready for triage (status: ${assessment.status})`
        })
      };
    }

    // Perform triage analysis
    const triageResult = await triageService.performTriage(assessment);

    // Update assessment with triage results
    await assessmentService.updateAssessment(assessmentId, {
      triageResult,
      status: 'analyzing',
      triageCompletedAt: new Date().toISOString()
    });

    console.log(`Triage analysis completed for assessment: ${assessmentId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({
        success: true,
        data: {
          assessmentId,
          triageResult: {
            criticalDomains: triageResult.criticalDomains,
            confidence: triageResult.confidence,
            reasoning: triageResult.reasoning,
            processingTime: triageResult.processingTime,
            modelUsed: triageResult.modelUsed
          }
        }
      })
    };

  } catch (error) {
    console.error('Error in triage analysis:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({
        error: 'Internal server error during triage analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

export const analyzeDomains = errorHandler(withAuth(handler));