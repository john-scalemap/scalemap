import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { TriageService } from '../../services/triage-service';
import { errorHandler } from '../../shared/middleware/error-handler';
import { withAdminRole } from '../../shared/middleware/role-middleware';

const triageService = new TriageService();

/**
 * GET /triage/metrics
 * Get triage performance metrics (admin only)
 */
async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const timeframe = event.queryStringParameters?.timeframe as 'day' | 'week' | 'month' || 'week';

    console.log(`Getting triage metrics for timeframe: ${timeframe}`);

    // Get triage metrics
    const metrics = await triageService.getTriageMetrics(timeframe);

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
          timeframe,
          metrics: {
            totalTriages: metrics.totalTriages,
            averageProcessingTime: Math.round(metrics.averageProcessingTime),
            averageConfidence: Math.round(metrics.averageConfidence * 100) / 100,
            successRate: Math.round(metrics.successRate * 100) / 100,
            overrideRate: Math.round(metrics.overrideRate * 100) / 100,
            industryBreakdown: metrics.industryBreakdown
          },
          generatedAt: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Error getting triage metrics:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({
        error: 'Internal server error retrieving triage metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

// Admin-only endpoint
export const getMetrics = errorHandler(
  withAdminRole(handler, 'triage', 'read')
);