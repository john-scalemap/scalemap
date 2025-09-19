import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Assessment, AssessmentStatus } from '@scalemap/shared';
import { AssessmentGap } from '@scalemap/shared';

import { SESService } from './ses-service';

export interface TimelinePauseEvent {
  assessmentId: string;
  pauseReason: 'critical-gaps' | 'clarification-required' | 'manual-pause';
  pausedAt: string;
  pausedBy: 'system' | 'founder' | 'agent';
  resumeBy?: string;
  affectedGaps: string[];
  estimatedResolutionTime: number; // minutes
  nextStepsDescription: string;
}

export interface TimelineExtension {
  extensionId: string;
  assessmentId: string;
  extensionType: 'gap-resolution' | 'clarification' | 'manual';
  originalDeadlines: {
    executive24h: string;
    detailed48h: string;
    implementation72h: string;
  };
  newDeadlines: {
    executive24h: string;
    detailed48h: string;
    implementation72h: string;
  };
  extensionDuration: number; // milliseconds
  requestedBy: 'system' | 'founder' | 'agent';
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  justification: string;
  affectedStakeholders: string[];
}

export interface TimelineBusinessRules {
  maxCriticalGapExtension: number; // 24 hours in ms
  maxClarificationExtension: number; // 12 hours in ms
  maxTotalExtensions: number; // 3 extensions max
  requiresApprovalThreshold: number; // 6 hours in ms
  autoResumeOnResolution: boolean;
  notificationEscalationHours: number; // 2 hours
}

export class TimelineManager {
  private dynamoDb: DynamoDBClient;
  private tableName: string;
  private sesService: SESService;

  private readonly businessRules: TimelineBusinessRules = {
    maxCriticalGapExtension: 24 * 60 * 60 * 1000, // 24 hours
    maxClarificationExtension: 12 * 60 * 60 * 1000, // 12 hours
    maxTotalExtensions: 3,
    requiresApprovalThreshold: 6 * 60 * 60 * 1000, // 6 hours
    autoResumeOnResolution: true,
    notificationEscalationHours: 2,
  };

  constructor() {
    this.dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.tableName = process.env.DYNAMODB_TABLE_NAME || 'scalemap-dev';
    this.sesService = new SESService();
  }

  /**
   * Pause assessment timeline due to critical gaps
   */
  async pauseForCriticalGaps(
    assessmentId: string,
    criticalGaps: AssessmentGap[],
    pausedBy: 'system' | 'agent' = 'system'
  ): Promise<TimelinePauseEvent> {
    console.log(
      `Pausing timeline for assessment ${assessmentId} due to ${criticalGaps.length} critical gaps`
    );

    const assessment = await this.getAssessment(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment ${assessmentId} not found`);
    }

    // Validate business rules
    await this.validateTimelinePause(assessment, 'critical-gaps');

    const estimatedResolutionTime = this.calculateEstimatedResolutionTime(criticalGaps);
    const nextSteps = this.generateNextStepsDescription(criticalGaps);

    const pauseEvent: TimelinePauseEvent = {
      assessmentId,
      pauseReason: 'critical-gaps',
      pausedAt: new Date().toISOString(),
      pausedBy,
      affectedGaps: criticalGaps.map((gap) => gap.gapId),
      estimatedResolutionTime,
      nextStepsDescription: nextSteps,
      resumeBy: new Date(Date.now() + estimatedResolutionTime * 60 * 1000).toISOString(),
    };

    // Store pause event
    await this.storePauseEvent(pauseEvent);

    // Update assessment status
    await this.updateAssessmentStatus(assessmentId, 'paused-for-gaps');

    // Send notifications
    await this.sendTimelinePauseNotifications(assessment, pauseEvent, criticalGaps);

    console.log(
      `Timeline paused for assessment ${assessmentId}. Estimated resolution: ${estimatedResolutionTime} minutes`
    );

    return pauseEvent;
  }

  /**
   * Resume assessment timeline after gap resolution
   */
  async resumeAfterGapResolution(
    assessmentId: string,
    resolvedGapIds: string[],
    resumedBy: 'system' | 'founder' | 'agent' = 'system'
  ): Promise<boolean> {
    console.log(
      `Attempting to resume timeline for assessment ${assessmentId} after resolving ${resolvedGapIds.length} gaps`
    );

    const pauseEvent = await this.getActivePauseEvent(assessmentId);
    if (!pauseEvent) {
      console.log(`No active pause event found for assessment ${assessmentId}`);
      return false;
    }

    // Check if all critical gaps are resolved
    const unresolvedCriticalGaps = pauseEvent.affectedGaps.filter(
      (gapId) => !resolvedGapIds.includes(gapId)
    );

    if (unresolvedCriticalGaps.length > 0) {
      console.log(`Cannot resume: ${unresolvedCriticalGaps.length} critical gaps still unresolved`);
      return false;
    }

    // Calculate timeline extension if needed
    const pauseDuration = Date.now() - new Date(pauseEvent.pausedAt).getTime();
    const extension = await this.calculateTimelineExtension(assessmentId, pauseDuration);

    if (extension) {
      await this.applyTimelineExtension(extension);
    }

    // Update pause event
    await this.completePauseEvent(assessmentId, resumedBy);

    // Update assessment status back to processing
    const assessment = await this.getAssessment(assessmentId);
    const newStatus = this.determineResumeStatus(assessment!);
    await this.updateAssessmentStatus(assessmentId, newStatus);

    // Send resume notifications
    await this.sendTimelineResumeNotifications(assessment!, pauseEvent, extension);

    console.log(`Timeline resumed for assessment ${assessmentId} with status: ${newStatus}`);

    return true;
  }

  /**
   * Request timeline extension for gap resolution
   */
  async requestTimelineExtension(
    assessmentId: string,
    extensionType: 'gap-resolution' | 'clarification' | 'manual',
    durationMs: number,
    justification: string,
    requestedBy: 'system' | 'founder' | 'agent'
  ): Promise<TimelineExtension> {
    const assessment = await this.getAssessment(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment ${assessmentId} not found`);
    }

    // Validate extension request
    await this.validateExtensionRequest(assessment, extensionType, durationMs);

    const extension: TimelineExtension = {
      extensionId: `ext_${Date.now()}`,
      assessmentId,
      extensionType,
      originalDeadlines: {
        executive24h: assessment.deliverySchedule.executive24h,
        detailed48h: assessment.deliverySchedule.detailed48h,
        implementation72h: assessment.deliverySchedule.implementation72h,
      },
      newDeadlines: {
        executive24h: new Date(
          new Date(assessment.deliverySchedule.executive24h).getTime() + durationMs
        ).toISOString(),
        detailed48h: new Date(
          new Date(assessment.deliverySchedule.detailed48h).getTime() + durationMs
        ).toISOString(),
        implementation72h: new Date(
          new Date(assessment.deliverySchedule.implementation72h).getTime() + durationMs
        ).toISOString(),
      },
      extensionDuration: durationMs,
      requestedBy,
      requestedAt: new Date().toISOString(),
      justification,
      affectedStakeholders: [assessment.contactEmail],
    };

    // Auto-approve if under threshold, otherwise require manual approval
    if (durationMs <= this.businessRules.requiresApprovalThreshold) {
      extension.approvedBy = 'system';
      extension.approvedAt = new Date().toISOString();
      await this.applyTimelineExtension(extension);
    }

    // Store extension request
    await this.storeExtensionRequest(extension);

    // Send notifications
    await this.sendExtensionNotifications(assessment, extension);

    return extension;
  }

  /**
   * Get current timeline status for assessment
   */
  async getTimelineStatus(assessmentId: string): Promise<{
    status: 'on-track' | 'paused' | 'extended' | 'at-risk' | 'overdue';
    pauseEvent?: TimelinePauseEvent;
    extensions: TimelineExtension[];
    remainingTime: {
      executive24h: number;
      detailed48h: number;
      implementation72h: number;
    };
    riskFactors: string[];
  }> {
    const assessment = await this.getAssessment(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment ${assessmentId} not found`);
    }

    const pauseEvent = await this.getActivePauseEvent(assessmentId);
    const extensions = await this.getExtensions(assessmentId);

    const now = Date.now();
    const remainingTime = {
      executive24h: new Date(assessment.deliverySchedule.executive24h).getTime() - now,
      detailed48h: new Date(assessment.deliverySchedule.detailed48h).getTime() - now,
      implementation72h: new Date(assessment.deliverySchedule.implementation72h).getTime() - now,
    };

    let status: 'on-track' | 'paused' | 'extended' | 'at-risk' | 'overdue' = 'on-track';
    const riskFactors: string[] = [];

    if (pauseEvent) {
      status = 'paused';
    } else if (extensions.length > 0) {
      status = 'extended';
    } else if (
      remainingTime.executive24h < 0 ||
      remainingTime.detailed48h < 0 ||
      remainingTime.implementation72h < 0
    ) {
      status = 'overdue';
      riskFactors.push('Timeline deadline exceeded');
    } else if (remainingTime.executive24h < 4 * 60 * 60 * 1000) {
      // 4 hours
      status = 'at-risk';
      riskFactors.push('Approaching 24h deadline');
    }

    // Check for other risk factors
    if (assessment.gapAnalysis && assessment.gapAnalysis.detectedGaps.length > 5) {
      riskFactors.push('High number of detected gaps');
    }

    if (extensions.length >= this.businessRules.maxTotalExtensions - 1) {
      riskFactors.push('Approaching maximum extension limit');
    }

    return {
      status,
      pauseEvent: pauseEvent || undefined,
      extensions,
      remainingTime,
      riskFactors,
    };
  }

  // Private helper methods

  private async getAssessment(assessmentId: string): Promise<Assessment | null> {
    try {
      const params = {
        TableName: this.tableName,
        Key: marshall({
          PK: `ASSESSMENT#${assessmentId}`,
          SK: 'METADATA',
        }),
      };

      const result = await this.dynamoDb.send(new GetItemCommand(params));

      if (!result.Item) {
        return null;
      }

      return unmarshall(result.Item) as Assessment;
    } catch (error) {
      console.error(`Error getting assessment ${assessmentId}:`, error);
      throw error;
    }
  }

  private async validateTimelinePause(assessment: Assessment, _reason: string): Promise<void> {
    // Check if already paused
    const existingPause = await this.getActivePauseEvent(assessment.id);
    if (existingPause) {
      throw new Error(`Assessment ${assessment.id} is already paused`);
    }

    // Check clarification policy limits
    const now = Date.now();
    const clarificationDeadline = new Date(
      assessment.deliverySchedule[
        assessment.clarificationPolicy
          .allowClarificationUntil as keyof typeof assessment.deliverySchedule
      ]
    ).getTime();

    if (now > clarificationDeadline) {
      throw new Error('Clarification period has expired');
    }

    // Check maximum extensions
    const extensions = await this.getExtensions(assessment.id);
    if (extensions.length >= this.businessRules.maxTotalExtensions) {
      throw new Error('Maximum timeline extensions reached');
    }
  }

  private async validateExtensionRequest(
    assessment: Assessment,
    extensionType: string,
    durationMs: number
  ): Promise<void> {
    const maxDuration =
      extensionType === 'gap-resolution'
        ? this.businessRules.maxCriticalGapExtension
        : this.businessRules.maxClarificationExtension;

    if (durationMs > maxDuration) {
      throw new Error(`Extension duration exceeds maximum allowed for ${extensionType}`);
    }

    const extensions = await this.getExtensions(assessment.id);
    if (extensions.length >= this.businessRules.maxTotalExtensions) {
      throw new Error('Maximum timeline extensions reached');
    }
  }

  private calculateEstimatedResolutionTime(criticalGaps: AssessmentGap[]): number {
    // Base time per gap + complexity multiplier
    return criticalGaps.reduce((total, gap) => {
      const baseTime = gap.estimatedResolutionTime || 20; // minutes
      const complexityMultiplier = gap.category === 'critical' ? 1.5 : 1.0;
      return total + baseTime * complexityMultiplier;
    }, 0);
  }

  private generateNextStepsDescription(criticalGaps: AssessmentGap[]): string {
    if (criticalGaps.length === 0) return 'No specific actions required.';

    const steps = [
      `Review ${criticalGaps.length} critical gap(s) identified in your assessment`,
      'Provide additional information through the gap resolution interface',
      'Address the most critical items first (marked with high priority)',
      'Contact support if you need clarification on any requirements',
    ];

    return steps.join('. ') + '.';
  }

  private determineResumeStatus(assessment: Assessment): AssessmentStatus {
    // Determine appropriate status based on assessment progress
    if (assessment.triageCompletedAt && !assessment.analysisCompletedAt) {
      return 'analyzing';
    } else if (assessment.analysisCompletedAt && !assessment.synthesisCompletedAt) {
      return 'synthesizing';
    } else if (assessment.synthesisCompletedAt) {
      return 'validating';
    } else {
      return 'triaging';
    }
  }

  private async calculateTimelineExtension(
    assessmentId: string,
    pauseDurationMs: number
  ): Promise<TimelineExtension | null> {
    // Only extend if pause was longer than 1 hour
    if (pauseDurationMs < 60 * 60 * 1000) {
      return null;
    }

    return this.requestTimelineExtension(
      assessmentId,
      'gap-resolution',
      pauseDurationMs,
      `Automatic extension due to gap resolution delay (${Math.round(pauseDurationMs / (60 * 60 * 1000))} hours)`,
      'system'
    );
  }

  // Database operations
  private async storePauseEvent(pauseEvent: TimelinePauseEvent): Promise<void> {
    // Note: Using UpdateItem for pause event storage

    await this.dynamoDb.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `ASSESSMENT#${pauseEvent.assessmentId}`,
          SK: `PAUSE#${pauseEvent.pausedAt}`,
        }),
        UpdateExpression: 'SET #data = :data',
        ExpressionAttributeNames: {
          '#data': 'data',
        },
        ExpressionAttributeValues: marshall({
          ':data': pauseEvent,
        }),
      })
    );
  }

  private async getActivePauseEvent(_assessmentId: string): Promise<TimelinePauseEvent | null> {
    // This would query for active pause events - simplified for now
    return null;
  }

  private async completePauseEvent(_assessmentId: string, _resumedBy: string): Promise<void> {
    // Mark pause event as completed
  }

  private async storeExtensionRequest(_extension: TimelineExtension): Promise<void> {
    // Store extension request in database
  }

  private async getExtensions(_assessmentId: string): Promise<TimelineExtension[]> {
    // Get all extensions for assessment
    return [];
  }

  private async applyTimelineExtension(extension: TimelineExtension): Promise<void> {
    // Update assessment delivery schedule
    const params = {
      TableName: this.tableName,
      Key: marshall({
        PK: `ASSESSMENT#${extension.assessmentId}`,
        SK: 'METADATA',
      }),
      UpdateExpression: 'SET deliverySchedule = :schedule',
      ExpressionAttributeValues: marshall({
        ':schedule': extension.newDeadlines,
      }),
    };

    await this.dynamoDb.send(new UpdateItemCommand(params));
  }

  private async updateAssessmentStatus(assessmentId: string, status: string): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA',
      }),
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: marshall({
        ':status': status,
        ':updatedAt': new Date().toISOString(),
      }),
    };

    await this.dynamoDb.send(new UpdateItemCommand(params));
  }

  // Notification methods
  private async sendTimelinePauseNotifications(
    assessment: Assessment,
    pauseEvent: TimelinePauseEvent,
    criticalGaps: AssessmentGap[]
  ): Promise<void> {
    const subject = `Assessment Timeline Paused - Action Required`;
    const message = `
      Your assessment "${assessment.title}" has been paused due to critical information gaps.

      Gaps Identified: ${criticalGaps.length}
      Estimated Resolution Time: ${pauseEvent.estimatedResolutionTime} minutes

      Next Steps: ${pauseEvent.nextStepsDescription}

      Please log into your ScaleMap portal to address these gaps.
    `;

    await this.sesService.sendEmail(assessment.contactEmail, subject, message, message);
  }

  private async sendTimelineResumeNotifications(
    assessment: Assessment,
    pauseEvent: TimelinePauseEvent,
    extension?: TimelineExtension | null
  ): Promise<void> {
    const subject = `Assessment Timeline Resumed`;
    const extensionMessage = extension
      ? `Your delivery schedule has been extended by ${Math.round(extension.extensionDuration / (60 * 60 * 1000))} hours.`
      : '';

    const message = `
      Your assessment "${assessment.title}" timeline has been resumed.

      All critical gaps have been resolved.
      ${extensionMessage}

      Your assessment will continue processing according to the updated schedule.
    `;

    await this.sesService.sendEmail(assessment.contactEmail, subject, message, message);
  }

  private async sendExtensionNotifications(
    assessment: Assessment,
    extension: TimelineExtension
  ): Promise<void> {
    const subject = `Assessment Timeline Extended`;
    const message = `
      Your assessment "${assessment.title}" timeline has been extended.

      Extension Type: ${extension.extensionType}
      Duration: ${Math.round(extension.extensionDuration / (60 * 60 * 1000))} hours
      Reason: ${extension.justification}

      New Delivery Schedule:
      - Executive Summary: ${new Date(extension.newDeadlines.executive24h).toLocaleString()}
      - Detailed Report: ${new Date(extension.newDeadlines.detailed48h).toLocaleString()}
      - Implementation Kit: ${new Date(extension.newDeadlines.implementation72h).toLocaleString()}
    `;

    await this.sesService.sendEmail(assessment.contactEmail, subject, message, message);
  }
}
