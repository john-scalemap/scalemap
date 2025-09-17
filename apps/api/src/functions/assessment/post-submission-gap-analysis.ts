import {
  Assessment,
  GapAnalysisRequest,
  AssessmentGap
} from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult, SQSEvent, EventBridgeEvent } from 'aws-lambda';

import { AssessmentService } from '../../services/assessment-service';
import { GapAnalysisService } from '../../services/gap-analysis-service';
import { SESService } from '../../services/ses-service';

const gapAnalysisService = new GapAnalysisService();
const sesService = new SESService();
const assessmentService = new AssessmentService();

/**
 * Core business logic for gap analysis - independent of trigger source
 */
async function performGapAnalysis(assessmentId: string, triggerType: 'api' | 'event' | 'sqs' = 'api'): Promise<{
  success: boolean;
  gaps: AssessmentGap[];
  completenessScore: number;
  notificationSent: boolean;
  error?: string;
}> {
  try {
    console.log(`Processing post-submission gap analysis for assessment ${assessmentId} (trigger: ${triggerType})`);

    // Get the assessment
    const assessment = await assessmentService.getAssessment(assessmentId);
    if (!assessment) {
      return {
        success: false,
        gaps: [],
        completenessScore: 0,
        notificationSent: false,
        error: 'Assessment not found'
      };
    }

    // Check if assessment is in a state that allows gap analysis
    if (!['triaging', 'analyzing', 'synthesizing', 'completed'].includes(assessment.status)) {
      return {
        success: false,
        gaps: [],
        completenessScore: 0,
        notificationSent: false,
        error: `Assessment status '${assessment.status}' does not allow gap analysis`
      };
    }

    // Perform gap analysis
    const gapAnalysisRequest: GapAnalysisRequest = {
      assessmentId,
      forceReanalysis: triggerType === 'api', // Force reanalysis for manual triggers
      analysisDepth: 'comprehensive'
    };

    const gapAnalysisResult = await gapAnalysisService.analyzeGaps(gapAnalysisRequest);
    const gaps = gapAnalysisResult.gapAnalysis.detectedGaps;
    const completenessScore = gapAnalysisResult.gapAnalysis.overallCompletenessScore;

    // Send notification if there are critical gaps
    let notificationSent = false;
    const criticalGaps = gaps.filter(gap => gap.category === 'critical');

    if (criticalGaps.length > 0) {
      const shouldNotify = await shouldSendGapNotification(assessment, gaps);

      if (shouldNotify) {
        await sendGapNotificationEmail(assessment, gaps, completenessScore);
        notificationSent = true;
      }
    }

    console.log(`Gap analysis completed for assessment ${assessmentId}:`, {
      totalGaps: gaps.length,
      criticalGaps: criticalGaps.length,
      completenessScore,
      notificationSent
    });

    return {
      success: true,
      gaps,
      completenessScore,
      notificationSent
    };

  } catch (error) {
    console.error('Gap analysis failed:', error);
    return {
      success: false,
      gaps: [],
      completenessScore: 0,
      notificationSent: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * API Gateway handler for manual gap analysis triggers
 */
export const apiGatewayHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Gap analysis API trigger:', JSON.stringify(event, null, 2));

  try {
    const assessmentId = event.pathParameters?.assessmentId;

    if (!assessmentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Assessment ID is required',
          triggerType: 'api'
        })
      };
    }

    const result = await performGapAnalysis(assessmentId, 'api');

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 400;
      return {
        statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: result.error,
          assessmentId
        })
      };
    }

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
        gapAnalysis: {
          totalGaps: result.gaps.length,
          criticalGaps: result.gaps.filter(g => g.category === 'critical').length,
          overallCompletenessScore: result.completenessScore,
          detectedGaps: result.gaps
        },
        notificationSent: result.notificationSent,
        triggerType: 'api',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('API Gateway gap analysis failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
        assessmentId: event.pathParameters?.assessmentId
      })
    };
  }
};

/**
 * SQS handler for async gap analysis processing
 */
export const sqsHandler = async (event: SQSEvent): Promise<void> => {
  console.log('Gap analysis SQS trigger:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const messageBody = JSON.parse(record.body);
      const assessmentId = messageBody.assessmentId;

      if (!assessmentId) {
        console.error('SQS message missing assessmentId:', record.body);
        continue;
      }

      const result = await performGapAnalysis(assessmentId, 'sqs');

      if (!result.success) {
        console.error(`SQS gap analysis failed for ${assessmentId}:`, result.error);
        // In a real system, you might want to send to a DLQ or retry
        continue;
      }

      console.log(`SQS gap analysis completed for ${assessmentId}:`, {
        totalGaps: result.gaps.length,
        criticalGaps: result.gaps.filter(g => g.category === 'critical').length,
        completenessScore: result.completenessScore,
        notificationSent: result.notificationSent
      });

    } catch (error) {
      console.error('SQS record processing failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        recordId: record.messageId,
        body: record.body
      });
    }
  }
};

/**
 * EventBridge handler for scheduled gap analysis
 */
export const eventBridgeHandler = async (event: EventBridgeEvent<string, any>): Promise<void> => {
  console.log('Gap analysis EventBridge trigger:', JSON.stringify(event, null, 2));

  try {
    const assessmentId = event.detail?.assessmentId;

    if (!assessmentId) {
      console.error('EventBridge event missing assessmentId:', event.detail);
      return;
    }

    const result = await performGapAnalysis(assessmentId, 'event');

    if (!result.success) {
      console.error(`EventBridge gap analysis failed for ${assessmentId}:`, result.error);
      return;
    }

    console.log(`EventBridge gap analysis completed for ${assessmentId}:`, {
      totalGaps: result.gaps.length,
      criticalGaps: result.gaps.filter(g => g.category === 'critical').length,
      completenessScore: result.completenessScore,
      notificationSent: result.notificationSent
    });

  } catch (error) {
    console.error('EventBridge gap analysis failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventId: event.id,
      source: event.source
    });
  }
};

/**
 * Default handler that maintains backward compatibility
 * This determines the event type and routes to the appropriate handler
 */
export const handler = async (event: any): Promise<APIGatewayProxyResult | void> => {
  // Determine event type and route accordingly
  if ('pathParameters' in event) {
    // API Gateway event
    return await apiGatewayHandler(event as APIGatewayProxyEvent);
  } else if ('Records' in event) {
    // SQS event
    await sqsHandler(event as SQSEvent);
    return;
  } else if ('source' in event && 'detail' in event) {
    // EventBridge event
    await eventBridgeHandler(event as EventBridgeEvent<string, any>);
    return;
  } else {
    console.error('Unknown event type:', JSON.stringify(event, null, 2));
    throw new Error('Unsupported event type');
  }
};

/**
 * Determine if a gap notification email should be sent
 */
async function shouldSendGapNotification(
  assessment: Assessment,
  gaps: AssessmentGap[]
): Promise<boolean> {
  // Skip notification if already paused for gaps
  if (assessment.status === 'paused-for-gaps') {
    return false;
  }

  // Send notification for critical gaps
  const criticalGaps = gaps.filter(gap => gap.category === 'critical');
  return criticalGaps.length > 0;
}

/**
 * Send gap notification email to the assessment contact
 */
async function sendGapNotificationEmail(
  assessment: Assessment,
  gaps: AssessmentGap[],
  completenessScore: number
): Promise<void> {
  const criticalGaps = gaps.filter(gap => gap.category === 'critical');
  const importantGaps = gaps.filter(gap => gap.category === 'important');

  const emailSubject = `Critical Information Gaps Detected - ${assessment.companyName} Assessment`;
  const emailHtml = generateGapNotificationHtml(assessment, gaps, completenessScore);
  const emailText = generateGapNotificationText(assessment, gaps, completenessScore);

  console.log(`Sending gap notification email for assessment ${assessment.id}:`, {
    to: assessment.contactEmail,
    criticalGaps: criticalGaps.length,
    importantGaps: importantGaps.length
  });

  await sesService.sendEmail(
    assessment.contactEmail,
    emailSubject,
    emailHtml,
    emailText
  );
}

function generateGapNotificationHtml(assessment: Assessment, gaps: AssessmentGap[], completenessScore: number): string {
  const criticalGaps = gaps.filter(gap => gap.category === 'critical');
  const importantGaps = gaps.filter(gap => gap.category === 'important');

  return `
    <h2>Critical Information Gaps Detected</h2>
    <p>Dear ${assessment.contactEmail},</p>
    <p>Our analysis has identified critical information gaps in your assessment that require immediate attention.</p>

    <h3>Assessment Summary</h3>
    <ul>
      <li><strong>Company:</strong> ${assessment.companyName}</li>
      <li><strong>Overall Completeness:</strong> ${completenessScore}%</li>
      <li><strong>Critical Gaps:</strong> ${criticalGaps.length}</li>
      <li><strong>Important Gaps:</strong> ${importantGaps.length}</li>
    </ul>

    <h3>Critical Gaps Requiring Immediate Attention</h3>
    ${criticalGaps.map(gap => `
      <div style="border: 1px solid #dc3545; padding: 10px; margin: 10px 0; border-radius: 5px;">
        <h4>${gap.description}</h4>
        <p><strong>Domain:</strong> ${gap.domain}</p>
        <p><strong>Priority:</strong> ${gap.priority}/10</p>
        <p><strong>Estimated Resolution Time:</strong> ${gap.estimatedResolutionTime} minutes</p>
      </div>
    `).join('')}

    <p>Please log into your assessment portal to provide the missing information.</p>
    <p>Best regards,<br>The ScaleMap Team</p>
  `;
}

function generateGapNotificationText(assessment: Assessment, gaps: AssessmentGap[], completenessScore: number): string {
  const criticalGaps = gaps.filter(gap => gap.category === 'critical');

  return `
Critical Information Gaps Detected

Dear ${assessment.contactEmail},

Our analysis has identified critical information gaps in your assessment that require immediate attention.

Assessment Summary:
- Company: ${assessment.companyName}
- Overall Completeness: ${completenessScore}%
- Critical Gaps: ${criticalGaps.length}

Critical Gaps:
${criticalGaps.map(gap => `
- ${gap.description}
  Domain: ${gap.domain}
  Priority: ${gap.priority}/10
  Estimated Resolution Time: ${gap.estimatedResolutionTime} minutes
`).join('')}

Please log into your assessment portal to provide the missing information.

Best regards,
The ScaleMap Team
  `;
}