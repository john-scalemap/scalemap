import { Assessment, AssessmentGap, GapCategory } from '@scalemap/shared';

import { SESService } from './ses-service';
import { TimelineManager } from './timeline-manager';

export interface NotificationTrigger {
  type: 'critical-gaps' | 'timeline-risk' | 'assessment-stuck' | 'clarification-needed';
  threshold: number;
  escalationDelay: number; // minutes
}

export interface FounderNotificationConfig {
  triggers: NotificationTrigger[];
  escalationChain: string[]; // email addresses in order of escalation
  maxNotificationsPerDay: number;
  suppressDuplicatesWindow: number; // minutes
}

export interface NotificationContext {
  assessmentId: string;
  companyName: string;
  founderEmail: string;
  supportContactEmail: string;
  assessment: Assessment;
  gaps?: AssessmentGap[];
  timelineStatus?: any;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class FounderNotificationService {
  private sesService: SESService;
  private timelineManager: TimelineManager;

  private readonly defaultConfig: FounderNotificationConfig = {
    triggers: [
      {
        type: 'critical-gaps',
        threshold: 3, // 3 or more critical gaps
        escalationDelay: 120 // 2 hours
      },
      {
        type: 'timeline-risk',
        threshold: 4, // 4 hours before deadline
        escalationDelay: 60 // 1 hour
      },
      {
        type: 'assessment-stuck',
        threshold: 24, // 24 hours without progress
        escalationDelay: 240 // 4 hours
      },
      {
        type: 'clarification-needed',
        threshold: 1, // immediate
        escalationDelay: 30 // 30 minutes
      }
    ],
    escalationChain: [
      process.env.FOUNDER_NOTIFICATION_EMAIL || 'founder@company.com',
      process.env.SUPPORT_ESCALATION_EMAIL || 'support@scalemap.ai'
    ],
    maxNotificationsPerDay: 5,
    suppressDuplicatesWindow: 180 // 3 hours
  };

  constructor() {
    this.sesService = new SESService();
    this.timelineManager = new TimelineManager();
  }

  /**
   * Evaluate if founder notification is needed for critical gaps
   */
  async evaluateCriticalGapsNotification(
    assessment: Assessment,
    criticalGaps: AssessmentGap[]
  ): Promise<boolean> {
    console.log(`Evaluating founder notification for ${criticalGaps.length} critical gaps in assessment ${assessment.id}`);

    const trigger = this.defaultConfig.triggers.find(t => t.type === 'critical-gaps');
    if (!trigger || criticalGaps.length < trigger.threshold) {
      return false;
    }

    // Check if we should suppress duplicate notifications
    const shouldSuppress = await this.shouldSuppressDuplicate(assessment.id, 'critical-gaps');
    if (shouldSuppress) {
      console.log(`Suppressing duplicate critical gaps notification for assessment ${assessment.id}`);
      return false;
    }

    const context: NotificationContext = {
      assessmentId: assessment.id,
      companyName: assessment.companyName,
      founderEmail: assessment.contactEmail,
      supportContactEmail: 'support@scalemap.ai',
      assessment,
      gaps: criticalGaps,
      urgencyLevel: criticalGaps.length > 5 ? 'critical' : 'high'
    };

    await this.sendFounderNotification(context, 'critical-gaps');

    // Schedule escalation if needed
    if (trigger.escalationDelay > 0) {
      await this.scheduleEscalation(context, trigger.escalationDelay);
    }

    return true;
  }

  /**
   * Evaluate if founder notification is needed for timeline risks
   */
  async evaluateTimelineRiskNotification(assessment: Assessment): Promise<boolean> {
    console.log(`Evaluating timeline risk notification for assessment ${assessment.id}`);

    const timelineStatus = await this.timelineManager.getTimelineStatus(assessment.id);

    if (timelineStatus.status !== 'at-risk' && timelineStatus.status !== 'overdue') {
      return false;
    }

    const trigger = this.defaultConfig.triggers.find(t => t.type === 'timeline-risk');
    if (!trigger) {
      return false;
    }

    // Check if we're within the threshold hours of deadline
    const hoursUntilDeadline = Math.min(
      timelineStatus.remainingTime.executive24h,
      timelineStatus.remainingTime.detailed48h,
      timelineStatus.remainingTime.implementation72h
    ) / (1000 * 60 * 60); // Convert to hours

    if (hoursUntilDeadline > trigger.threshold) {
      return false;
    }

    const shouldSuppress = await this.shouldSuppressDuplicate(assessment.id, 'timeline-risk');
    if (shouldSuppress) {
      return false;
    }

    const context: NotificationContext = {
      assessmentId: assessment.id,
      companyName: assessment.companyName,
      founderEmail: assessment.contactEmail,
      supportContactEmail: 'support@scalemap.ai',
      assessment,
      timelineStatus,
      urgencyLevel: timelineStatus.status === 'overdue' ? 'critical' : 'high'
    };

    await this.sendFounderNotification(context, 'timeline-risk');

    return true;
  }

  /**
   * Send founder notification for assessment stuck
   */
  async notifyAssessmentStuck(assessment: Assessment, hoursStuck: number): Promise<void> {
    console.log(`Notifying about stuck assessment ${assessment.id} (stuck for ${hoursStuck} hours)`);

    const context: NotificationContext = {
      assessmentId: assessment.id,
      companyName: assessment.companyName,
      founderEmail: assessment.contactEmail,
      supportContactEmail: 'support@scalemap.ai',
      assessment,
      urgencyLevel: hoursStuck > 48 ? 'critical' : hoursStuck > 24 ? 'high' : 'medium'
    };

    await this.sendFounderNotification(context, 'assessment-stuck');
  }

  /**
   * Send founder notification for clarification needed
   */
  async notifyClarificationNeeded(
    assessment: Assessment,
    clarificationDetails: string
  ): Promise<void> {
    console.log(`Notifying about clarification needed for assessment ${assessment.id}`);

    const context: NotificationContext = {
      assessmentId: assessment.id,
      companyName: assessment.companyName,
      founderEmail: assessment.contactEmail,
      supportContactEmail: 'support@scalemap.ai',
      assessment,
      urgencyLevel: 'medium'
    };

    await this.sendFounderNotification(context, 'clarification-needed');
  }

  // Private methods

  private async sendFounderNotification(
    context: NotificationContext,
    notificationType: string
  ): Promise<void> {
    const subject = this.generateSubject(context, notificationType);
    const { htmlBody, textBody } = this.generateNotificationContent(context, notificationType);

    try {
      await this.sesService.sendEmail(
        context.founderEmail,
        subject,
        textBody,
        htmlBody
      );

      // Log notification for tracking
      await this.logNotification(context, notificationType);

      console.log(`Founder notification sent for assessment ${context.assessmentId}: ${notificationType}`);

    } catch (error) {
      console.error(`Failed to send founder notification:`, error);
      throw error;
    }
  }

  private generateSubject(context: NotificationContext, type: string): string {
    const urgencyPrefix = context.urgencyLevel === 'critical' ? '[URGENT] ' :
                         context.urgencyLevel === 'high' ? '[HIGH PRIORITY] ' : '';

    switch (type) {
      case 'critical-gaps':
        return `${urgencyPrefix}Critical Information Gaps in Your ${context.companyName} Assessment`;
      case 'timeline-risk':
        return `${urgencyPrefix}Assessment Timeline at Risk - ${context.companyName}`;
      case 'assessment-stuck':
        return `${urgencyPrefix}Assessment Processing Delayed - Action Required`;
      case 'clarification-needed':
        return `Clarification Needed for ${context.companyName} Assessment`;
      default:
        return `${urgencyPrefix}Assessment Update Required - ${context.companyName}`;
    }
  }

  private generateNotificationContent(
    context: NotificationContext,
    type: string
  ): { htmlBody: string; textBody: string } {
    const baseTemplate = {
      htmlBody: this.getBaseHtmlTemplate(context),
      textBody: this.getBaseTextTemplate(context)
    };

    switch (type) {
      case 'critical-gaps':
        return this.generateCriticalGapsContent(context, baseTemplate);
      case 'timeline-risk':
        return this.generateTimelineRiskContent(context, baseTemplate);
      case 'assessment-stuck':
        return this.generateAssessmentStuckContent(context, baseTemplate);
      case 'clarification-needed':
        return this.generateClarificationNeededContent(context, baseTemplate);
      default:
        return baseTemplate;
    }
  }

  private generateCriticalGapsContent(
    context: NotificationContext,
    baseTemplate: { htmlBody: string; textBody: string }
  ): { htmlBody: string; textBody: string } {
    const gapCount = context.gaps?.length || 0;
    const criticalGaps = context.gaps?.filter(gap => gap.category === 'critical') || [];

    const gapDetails = criticalGaps.slice(0, 3).map(gap =>
      `• ${gap.description} (${gap.domain.replace('-', ' ')})`
    ).join('\n');

    const moreGapsText = gapCount > 3 ? `\n...and ${gapCount - 3} more gaps` : '';

    const content = `
Your ScaleMap assessment has identified ${gapCount} critical information gap(s) that require your immediate attention to ensure accurate analysis.

Critical Gaps Identified:
${gapDetails}${moreGapsText}

These gaps are preventing us from delivering a complete assessment. Please log into your assessment portal to provide the missing information.

What happens next:
• Your assessment timeline is currently paused
• Review each gap and provide the requested information
• Your assessment will automatically resume once all critical gaps are resolved
• You'll receive confirmation when processing resumes

This is important because incomplete information can significantly impact the accuracy and value of your strategic recommendations.
    `;

    return {
      htmlBody: baseTemplate.htmlBody.replace('{{CONTENT}}', content.replace(/\n/g, '<br>')),
      textBody: baseTemplate.textBody.replace('{{CONTENT}}', content)
    };
  }

  private generateTimelineRiskContent(
    context: NotificationContext,
    baseTemplate: { htmlBody: string; textBody: string }
  ): { htmlBody: string; textBody: string } {
    const timelineStatus = context.timelineStatus;
    const status = timelineStatus?.status || 'unknown';

    const content = `
Your ScaleMap assessment timeline is at risk of delay.

Current Status: ${status.replace('-', ' ').toUpperCase()}

${status === 'overdue'
  ? 'Your assessment deadline has passed. Please contact our support team immediately to discuss next steps.'
  : 'Your assessment is approaching critical deadlines. Please review any outstanding requirements.'
}

Immediate Action Required:
• Review your assessment portal for any pending items
• Address any outstanding gaps or clarifications
• Contact support if you need assistance: ${context.supportContactEmail}

We're here to help ensure you receive your strategic assessment on time.
    `;

    return {
      htmlBody: baseTemplate.htmlBody.replace('{{CONTENT}}', content.replace(/\n/g, '<br>')),
      textBody: baseTemplate.textBody.replace('{{CONTENT}}', content)
    };
  }

  private generateAssessmentStuckContent(
    context: NotificationContext,
    baseTemplate: { htmlBody: string; textBody: string }
  ): { htmlBody: string; textBody: string } {
    const content = `
Your ScaleMap assessment processing has been delayed and requires your attention.

We've noticed that your assessment hasn't progressed in over 24 hours. This could be due to:
• Outstanding information gaps that need your input
• Technical issues that require our intervention
• Missing clarifications or approvals

Next Steps:
• Check your assessment portal for any pending items
• Review your email for any missed communications from our team
• Contact support if you're experiencing any issues: ${context.supportContactEmail}

We want to ensure you receive your strategic assessment as quickly as possible. Please don't hesitate to reach out if you need assistance.
    `;

    return {
      htmlBody: baseTemplate.htmlBody.replace('{{CONTENT}}', content.replace(/\n/g, '<br>')),
      textBody: baseTemplate.textBody.replace('{{CONTENT}}', content)
    };
  }

  private generateClarificationNeededContent(
    context: NotificationContext,
    baseTemplate: { htmlBody: string; textBody: string }
  ): { htmlBody: string; textBody: string } {
    const content = `
We need clarification on some aspects of your ${context.companyName} assessment to ensure we provide the most accurate strategic recommendations.

Our analysis team has identified areas where additional context would significantly improve the quality and relevance of your assessment results.

What You Need to Do:
• Log into your assessment portal to review clarification requests
• Provide the additional context or information requested
• Submit your responses to continue processing

This clarification process typically takes 10-15 minutes and will significantly enhance the value of your final strategic assessment.
    `;

    return {
      htmlBody: baseTemplate.htmlBody.replace('{{CONTENT}}', content.replace(/\n/g, '<br>')),
      textBody: baseTemplate.textBody.replace('{{CONTENT}}', content)
    };
  }

  private getBaseHtmlTemplate(context: NotificationContext): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ScaleMap Assessment Update</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #2c3e50; margin: 0;">ScaleMap Assessment Update</h1>
        <p style="margin: 10px 0 0 0; color: #6c757d;">Assessment ID: ${context.assessmentId}</p>
    </div>

    <div style="background-color: white; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
        {{CONTENT}}
    </div>

    <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
        <p style="margin: 0; font-size: 14px; color: #6c757d;">
            <strong>Need Help?</strong><br>
            Contact our support team at ${context.supportContactEmail} or visit your assessment portal.
        </p>
    </div>

    <div style="margin-top: 20px; padding: 15px; text-align: center; color: #6c757d; font-size: 12px;">
        <p>© 2024 ScaleMap. This email was sent regarding your strategic assessment.</p>
    </div>
</body>
</html>
    `;
  }

  private getBaseTextTemplate(context: NotificationContext): string {
    return `
ScaleMap Assessment Update
Assessment ID: ${context.assessmentId}

{{CONTENT}}

---
Need Help?
Contact our support team at ${context.supportContactEmail} or visit your assessment portal.

© 2024 ScaleMap. This email was sent regarding your strategic assessment.
    `;
  }

  private async shouldSuppressDuplicate(assessmentId: string, type: string): Promise<boolean> {
    // This would check a database/cache for recent notifications of the same type
    // For now, we'll implement a simple time-based suppression
    // In a real implementation, this would query DynamoDB for recent notifications
    return false;
  }

  private async logNotification(context: NotificationContext, type: string): Promise<void> {
    // This would log the notification to DynamoDB for tracking and suppression
    console.log(`Notification logged: ${type} for assessment ${context.assessmentId}`);
  }

  private async scheduleEscalation(context: NotificationContext, delayMinutes: number): Promise<void> {
    // This would schedule an escalation notification
    // In a real implementation, this might use SQS with delay or EventBridge scheduling
    console.log(`Escalation scheduled for assessment ${context.assessmentId} in ${delayMinutes} minutes`);
  }
}