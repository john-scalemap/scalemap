import {
  SESClient,
  SendEmailCommand,
  GetSendStatisticsCommand,
  CreateTemplateCommand,
  DeleteTemplateCommand
} from '@aws-sdk/client-ses';
import { Assessment, AssessmentGap } from '@scalemap/shared';

export interface EmailConfig {
  region: string;
  fromEmail: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface EmailResult {
  messageId: string;
  success: boolean;
  error?: string;
}

export interface EnhancedEmailRequest {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  source?: string;
  metadata?: Record<string, any>;
}

export interface EmailProgress {
  assessment: Assessment;
  stage: '24h' | '48h' | '72h';
  progressPercentage: number;
  activatedAgents: string[];
}

export class SESService {
  private client: SESClient;
  private fromEmail: string;

  constructor(config?: Partial<EmailConfig>) {
    const finalConfig = {
      region: process.env.SES_REGION || process.env.AWS_REGION || 'eu-west-1',
      fromEmail: process.env.SES_FROM_EMAIL || 'john@scalemap.uk',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      ...config
    };

    this.fromEmail = finalConfig.fromEmail;

    const clientConfig: any = {
      region: finalConfig.region,
    };

    if (finalConfig.accessKeyId && finalConfig.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: finalConfig.accessKeyId,
        secretAccessKey: finalConfig.secretAccessKey,
      };
    }

    this.client = new SESClient(clientConfig);
  }

  /**
   * Send assessment confirmation email
   */
  async sendAssessmentConfirmation(assessment: Assessment): Promise<EmailResult> {
    const subject = `ScaleMap Assessment Confirmed - ${assessment.companyName}`;
    const deliverySchedule = assessment.deliverySchedule;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Assessment Confirmed</h2>

        <p>Thank you for submitting your operational assessment. Our AI specialists are now beginning their comprehensive analysis of ${assessment.companyName}.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Delivery Timeline</h3>
          <ul>
            <li><strong>24 hours:</strong> Executive Summary - ${new Date(deliverySchedule.executive24h).toLocaleDateString()}</li>
            <li><strong>48 hours:</strong> Detailed Analysis Report - ${new Date(deliverySchedule.detailed48h).toLocaleDateString()}</li>
            <li><strong>72 hours:</strong> Implementation Kit & Playbooks - ${new Date(deliverySchedule.implementation72h).toLocaleDateString()}</li>
          </ul>
        </div>

        <p>You'll receive progress updates as our domain specialists complete their analysis.</p>

        <p>Best regards,<br>
        The ScaleMap Team</p>
      </div>
    `;

    return await this.sendEmail(
      assessment.contactEmail,
      subject,
      htmlBody,
      `Assessment Confirmed - ${assessment.companyName}\n\nThank you for submitting your assessment...`
    );
  }

  /**
   * Send 24-hour executive summary
   */
  async send24HourExecutiveSummary(assessment: Assessment, reportUrl: string): Promise<EmailResult> {
    const subject = `Executive Summary Ready - ${assessment.companyName}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Executive Summary Complete</h2>

        <p>Your 24-hour executive summary is ready. Our AI specialists have identified the key operational areas requiring attention.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Key Highlights</h3>
          <p>• Priority domains identified and analyzed</p>
          <p>• Initial operational health assessment complete</p>
          <p>• High-level recommendations drafted</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${reportUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Executive Summary
          </a>
        </div>

        <p><strong>Next Steps:</strong> Your detailed 48-hour analysis is in progress and will include comprehensive findings and validation opportunities.</p>

        <p>Best regards,<br>
        The ScaleMap Team</p>
      </div>
    `;

    return await this.sendEmail(assessment.contactEmail, subject, htmlBody);
  }

  /**
   * Send 48-hour detailed report with validation request
   */
  async send48HourDetailedReport(assessment: Assessment, reportUrl: string): Promise<EmailResult> {
    const subject = `Detailed Analysis Ready - ${assessment.companyName} - Validation Required`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Detailed Analysis Complete</h2>

        <p>Your comprehensive 48-hour analysis is complete. Please review the findings and provide validation before we finalize your implementation kit.</p>

        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <strong>⏰ Validation Required:</strong> Please review and validate your priority recommendations within 12 hours to ensure your 72-hour implementation kit is perfectly targeted.
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${reportUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Review & Validate Report
          </a>
        </div>

        <p><strong>What's Included:</strong></p>
        <ul>
          <li>Comprehensive domain analysis with agent insights</li>
          <li>Operational health heatmaps and visualizations</li>
          <li>Priority recommendations with impact analysis</li>
          <li>Validation interface for final customization</li>
        </ul>

        <p>Best regards,<br>
        The ScaleMap Team</p>
      </div>
    `;

    return await this.sendEmail(assessment.contactEmail, subject, htmlBody);
  }

  /**
   * Send 72-hour implementation kit
   */
  async send72HourImplementationKit(assessment: Assessment, kitUrl: string): Promise<EmailResult> {
    const subject = `Implementation Kit Ready - ${assessment.companyName} - Your Complete Growth Playbook`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">🎉 Your Complete Implementation Kit is Ready!</h2>

        <p>Congratulations! Your 72-hour implementation kit has been completed and is ready for execution.</p>

        <div style="background-color: #f0fdf4; border: 2px solid #16a34a; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #16a34a;">Everything You Need to Execute</h3>
          <p>✅ Change Management Playbooks<br>
          ✅ Stakeholder Communication Kits<br>
          ✅ Progress Tracking Dashboards<br>
          ✅ Risk Mitigation Guides<br>
          ✅ Resource Planning Tools</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${kitUrl}" style="background-color: #16a34a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 18px;">
            Access Your Implementation Kit
          </a>
        </div>

        <p><strong>Implementation Support:</strong> Your kit includes everything a consultant would provide for independent execution, plus self-service support resources.</p>

        <p>We'd love to hear about your implementation progress. We'll follow up in 30 days to see how you're doing!</p>

        <p>Best regards,<br>
        The ScaleMap Team</p>
      </div>
    `;

    return await this.sendEmail(assessment.contactEmail, subject, htmlBody);
  }

  /**
   * Send analysis progress update
   */
  async sendAnalysisProgressUpdate(progress: EmailProgress): Promise<EmailResult> {
    const { assessment, stage, progressPercentage, activatedAgents } = progress;

    const subject = `Analysis Progress Update - ${assessment.companyName} (${progressPercentage}% Complete)`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Analysis in Progress</h2>

        <p>Your ${assessment.companyName} operational analysis is progressing well.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Current Status</h3>
          <div style="background-color: #e5e7eb; height: 20px; border-radius: 10px; margin: 10px 0;">
            <div style="background-color: #2563eb; height: 100%; width: ${progressPercentage}%; border-radius: 10px;"></div>
          </div>
          <p style="text-align: center; margin: 5px 0; font-weight: bold;">${progressPercentage}% Complete</p>
        </div>

        <div style="margin: 20px 0;">
          <h3>Active Specialists:</h3>
          <ul>
            ${activatedAgents.map(agent => `<li>${agent}</li>`).join('')}
          </ul>
        </div>

        <p>Your ${stage} deliverable will be ready on schedule. We'll notify you immediately when it's available.</p>

        <p>Best regards,<br>
        The ScaleMap Team</p>
      </div>
    `;

    return await this.sendEmail(assessment.contactEmail, subject, htmlBody);
  }

  /**
   * Send payment confirmation
   */
  async sendPaymentConfirmation(
    email: string,
    amount: number,
    currency: string,
    paymentId: string
  ): Promise<EmailResult> {
    const subject = 'Payment Confirmed - ScaleMap Assessment';

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Payment Confirmed</h2>

        <p>Thank you for your payment. Your ScaleMap assessment has been confirmed and our analysis will begin immediately.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Payment Details</h3>
          <p><strong>Amount:</strong> ${currency.toUpperCase()} ${amount.toFixed(2)}</p>
          <p><strong>Payment ID:</strong> ${paymentId}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <p>You will receive your assessment confirmation email shortly with timeline details.</p>

        <p>Best regards,<br>
        The ScaleMap Team</p>
      </div>
    `;

    return await this.sendEmail(email, subject, htmlBody);
  }

  /**
   * Send basic email
   */
  public async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<EmailResult> {
    try {
      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            ...(textBody && {
              Text: {
                Data: textBody,
                Charset: 'UTF-8',
              },
            }),
          },
        },
      });

      const result = await this.client.send(command);

      return {
        messageId: result.MessageId || '',
        success: true,
      };

    } catch (error) {
      console.error('SES email error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        messageId: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get email sending statistics
   */
  async getSendingStatistics() {
    try {
      const command = new GetSendStatisticsCommand({});
      const result = await this.client.send(command);
      return result.SendDataPoints;
    } catch (error) {
      console.error('SES statistics error:', error);
      return [];
    }
  }

  /**
   * Create email template
   */
  async createEmailTemplate(template: EmailTemplate): Promise<boolean> {
    try {
      const command = new CreateTemplateCommand({
        Template: {
          TemplateName: template.name,
          SubjectPart: template.subject,
          HtmlPart: template.htmlBody,
          TextPart: template.textBody,
        },
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('SES template creation error:', error);
      return false;
    }
  }

  /**
   * Delete email template
   */
  async deleteEmailTemplate(templateName: string): Promise<boolean> {
    try {
      const command = new DeleteTemplateCommand({
        TemplateName: templateName,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('SES template deletion error:', error);
      return false;
    }
  }

  /**
   * Send enhanced email with metadata support
   */
  async sendEnhancedEmail(request: EnhancedEmailRequest): Promise<EmailResult> {
    try {
      console.log(`Sending email to ${request.to}:`, {
        subject: request.subject,
        source: request.source || 'general',
        metadata: request.metadata
      });

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [request.to],
        },
        Message: {
          Subject: {
            Data: request.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: request.htmlBody,
              Charset: 'UTF-8',
            },
            ...(request.textBody && {
              Text: {
                Data: request.textBody,
                Charset: 'UTF-8',
              }
            })
          },
        },
      });

      const result = await this.client.send(command);

      console.log(`Email sent successfully:`, {
        messageId: result.MessageId,
        to: request.to,
        source: request.source
      });

      return {
        messageId: result.MessageId || '',
        success: true,
      };
    } catch (error) {
      console.error('SES email error:', error);
      return {
        messageId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email error',
      };
    }
  }

  /**
   * Send gap notification email
   */
  async sendGapNotificationEmail(
    assessment: Assessment,
    gaps: AssessmentGap[],
    completenessScore: number
  ): Promise<EmailResult> {
    const criticalGaps = gaps.filter(gap => gap.category === 'critical');
    const importantGaps = gaps.filter(gap => gap.category === 'important');

    const emailSubject = criticalGaps.length > 0
      ? `⚠️ Critical gaps detected in your ScaleMap assessment`
      : `📊 Additional information requested for your ScaleMap assessment`;

    const gapPortalUrl = `https://scalemap.uk/assessments/${assessment.id}/gaps`;

    const htmlBody = this.generateGapNotificationHtml(
      assessment,
      gaps,
      completenessScore,
      gapPortalUrl,
      criticalGaps.length,
      importantGaps.length
    );

    const textBody = this.generateGapNotificationText(
      assessment,
      gaps,
      completenessScore,
      gapPortalUrl,
      criticalGaps.length,
      importantGaps.length
    );

    return this.sendEnhancedEmail({
      to: assessment.contactEmail,
      subject: emailSubject,
      htmlBody,
      textBody,
      source: 'gap-analysis',
      metadata: {
        assessmentId: assessment.id,
        criticalGaps: criticalGaps.length,
        totalGaps: gaps.length,
        completenessScore
      }
    });
  }

  /**
   * Generate HTML email template for gap notification
   */
  private generateGapNotificationHtml(
    assessment: Assessment,
    gaps: AssessmentGap[],
    completenessScore: number,
    gapPortalUrl: string,
    criticalCount: number,
    importantCount: number
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ScaleMap Assessment - Additional Information Needed</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .gap-summary { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .critical-gap { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 10px; margin: 10px 0; }
        .important-gap { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px; margin: 10px 0; }
        .cta-button { background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .progress-bar { background-color: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { background-color: ${completenessScore >= 85 ? '#10b981' : completenessScore >= 70 ? '#f59e0b' : '#ef4444'}; height: 100%; width: ${completenessScore}%; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ScaleMap Assessment Update</h1>
            <p>Additional Information Needed</p>
        </div>

        <div class="content">
            <p>Dear ${assessment.companyName} team,</p>

            <p>Thank you for submitting your ScaleMap assessment. Our AI analysis has identified some areas where additional information would significantly improve the quality and accuracy of your recommendations.</p>

            <div class="gap-summary">
                <h3>Assessment Completeness: ${completenessScore}%</h3>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <p><strong>${gaps.length} gap${gaps.length === 1 ? '' : 's'} identified:</strong></p>
                <ul>
                    <li><strong>${criticalCount}</strong> critical gap${criticalCount === 1 ? '' : 's'} requiring attention</li>
                    <li><strong>${importantCount}</strong> important gap${importantCount === 1 ? '' : 's'} for enhanced analysis</li>
                </ul>
            </div>

            ${criticalCount > 0 ? `
            <h3>🔴 Critical Gaps Requiring Immediate Attention</h3>
            <p>These gaps significantly impact our ability to provide accurate recommendations:</p>
            ${gaps.filter(gap => gap.category === 'critical').map(gap => `
            <div class="critical-gap">
                <strong>${gap.domain.replace('-', ' ').toUpperCase()}</strong><br>
                ${gap.description}<br>
                <em>Key questions: ${gap.suggestedQuestions.slice(0, 2).join('; ')}</em>
            </div>
            `).join('')}
            ` : ''}

            ${importantCount > 0 ? `
            <h3>🟡 Important Information for Enhanced Analysis</h3>
            <p>Additional details in these areas will improve recommendation quality:</p>
            ${gaps.filter(gap => gap.category === 'important').slice(0, 3).map(gap => `
            <div class="important-gap">
                <strong>${gap.domain.replace('-', ' ').toUpperCase()}</strong><br>
                ${gap.description}
            </div>
            `).join('')}
            ` : ''}

            <p><strong>Next Steps:</strong></p>
            <ol>
                <li>Click the button below to access your gap resolution portal</li>
                <li>Review and respond to the identified gaps</li>
                <li>Our analysis will automatically update with your additional information</li>
            </ol>

            <div style="text-align: center;">
                <a href="${gapPortalUrl}" class="cta-button">Complete Gap Resolution</a>
            </div>

            <p><em>Estimated time to complete: ${Math.ceil(gaps.reduce((sum, gap) => sum + gap.estimatedResolutionTime, 0) / 60)} minutes</em></p>

            <p>If you have any questions or need assistance, please don't hesitate to contact our team.</p>

            <p>Best regards,<br>
            The ScaleMap Team</p>
        </div>

        <div class="footer">
            <p>This email was sent regarding your ScaleMap assessment (ID: ${assessment.id})</p>
            <p>ScaleMap - Scaling businesses through intelligent operational insights</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text email for gap notification
   */
  private generateGapNotificationText(
    assessment: Assessment,
    gaps: AssessmentGap[],
    completenessScore: number,
    gapPortalUrl: string,
    criticalCount: number,
    importantCount: number
  ): string {
    return `
ScaleMap Assessment Update - Additional Information Needed

Dear ${assessment.companyName} team,

Thank you for submitting your ScaleMap assessment. Our AI analysis has identified some areas where additional information would significantly improve the quality and accuracy of your recommendations.

ASSESSMENT COMPLETENESS: ${completenessScore}%

GAPS IDENTIFIED: ${gaps.length}
- ${criticalCount} critical gaps requiring attention
- ${importantCount} important gaps for enhanced analysis

${criticalCount > 0 ? `
CRITICAL GAPS REQUIRING IMMEDIATE ATTENTION:
${gaps.filter(gap => gap.category === 'critical').map(gap => `
• ${gap.domain.replace('-', ' ').toUpperCase()}: ${gap.description}
  Key questions: ${gap.suggestedQuestions.slice(0, 2).join('; ')}
`).join('')}
` : ''}

NEXT STEPS:
1. Visit your gap resolution portal: ${gapPortalUrl}
2. Review and respond to the identified gaps
3. Our analysis will automatically update with your additional information

Estimated time to complete: ${Math.ceil(gaps.reduce((sum, gap) => sum + gap.estimatedResolutionTime, 0) / 60)} minutes

If you have any questions or need assistance, please don't hesitate to contact our team.

Best regards,
The ScaleMap Team

---
This email was sent regarding your ScaleMap assessment (ID: ${assessment.id})
ScaleMap - Scaling businesses through intelligent operational insights
`;
  }
}