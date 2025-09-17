import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { TimelineManager } from '../../services/timeline-manager';

// Use lazy initialization for testability
let timelineManager: TimelineManager;

const getTimelineManager = () => {
  if (!timelineManager) {
    timelineManager = new TimelineManager();
  }
  return timelineManager;
};

// For testing purposes only
export const __resetService = () => {
  timelineManager = undefined as any;
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Timeline status request:', JSON.stringify(event, null, 2));

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

    console.log(`Getting timeline status for assessment ${assessmentId}`);

    // Get timeline status
    const service = getTimelineManager();
    const timelineStatus = await service.getTimelineStatus(assessmentId);

    console.log(`Timeline status retrieved for assessment ${assessmentId}:`, {
      status: timelineStatus.status,
      isPaused: !!timelineStatus.pauseEvent,
      extensionsCount: timelineStatus.extensions.length,
      riskFactorsCount: timelineStatus.riskFactors.length
    });

    // Format next steps based on current status
    const nextSteps = generateNextStepsFromStatus(timelineStatus);

    const response = {
      assessmentId,
      timeline: timelineStatus,
      nextSteps,
      lastUpdated: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Timeline status retrieval failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = errorMessage.includes('not found') ? 404 :
                      errorMessage.includes('validation') ? 400 : 500;

    return {
      statusCode,
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

function generateNextStepsFromStatus(timelineStatus: any): {
  immediate: string[];
  upcoming: string[];
  summary: string;
} {
  const immediate: string[] = [];
  const upcoming: string[] = [];

  if (timelineStatus.status === 'paused' && timelineStatus.pauseEvent) {
    immediate.push('Review and resolve critical gaps to resume your assessment timeline');
    immediate.push('Access the gap resolution interface in your assessment portal');

    if (timelineStatus.pauseEvent.affectedGaps.length > 0) {
      immediate.push(`Address ${timelineStatus.pauseEvent.affectedGaps.length} critical gap(s) requiring your attention`);
    }

    upcoming.push('Your assessment will automatically resume once all critical gaps are resolved');
    upcoming.push('You will receive an email confirmation when timeline resumes');
  } else if (timelineStatus.status === 'at-risk') {
    immediate.push('Your assessment deadline is approaching - review any pending items');
    immediate.push('Contact support if you need assistance with any requirements');

    upcoming.push('Your assessment will continue processing according to schedule');
    upcoming.push('You will receive delivery confirmation emails as each phase completes');
  } else if (timelineStatus.status === 'extended') {
    immediate.push('Your assessment timeline has been extended - no immediate action required');

    upcoming.push('Your assessment will continue processing according to the updated schedule');
    upcoming.push('You will receive delivery confirmation emails as each phase completes');
  } else if (timelineStatus.status === 'overdue') {
    immediate.push('Your assessment deadline has passed - please contact support immediately');
    immediate.push('Review any outstanding requirements that may be blocking completion');

    upcoming.push('Our team will work with you to determine the best path forward');
  } else {
    // on-track
    immediate.push('Your assessment is processing normally - no action required');

    upcoming.push('You will receive your executive summary within 24 hours');
    upcoming.push('Detailed report and implementation kit will follow according to schedule');
  }

  // Add risk factor specific steps
  if (timelineStatus.riskFactors.length > 0) {
    for (const risk of timelineStatus.riskFactors) {
      if (risk.includes('gap')) {
        immediate.push('Monitor gap resolution progress to prevent timeline delays');
      } else if (risk.includes('deadline')) {
        immediate.push('Prepare for accelerated delivery if needed');
      } else if (risk.includes('extension')) {
        immediate.push('Be aware that extension options may be limited');
      }
    }
  }

  const summary = timelineStatus.status === 'paused'
    ? `Your assessment is currently paused due to ${timelineStatus.pauseEvent?.pauseReason.replace('-', ' ')}. Please complete the required actions to resume processing.`
    : timelineStatus.status === 'at-risk'
    ? 'Your assessment timeline is at risk. Please review the immediate action items below.'
    : timelineStatus.status === 'overdue'
    ? 'Your assessment deadline has passed. Please contact support for assistance.'
    : 'Your assessment is progressing normally according to schedule.';

  return {
    immediate,
    upcoming,
    summary
  };
}

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