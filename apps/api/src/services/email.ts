import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';

import { logger } from '../utils/logger';
import { Monitoring } from '../utils/monitoring';

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface SendEmailOptions {
  to: string | string[];
  from?: string;
  replyTo?: string;
  template: EmailTemplate;
  templateData?: Record<string, string>;
}

export class EmailService {
  private defaultFromAddress: string;
  private baseUrl: string;

  constructor() {
    this.defaultFromAddress = process.env.SES_FROM_ADDRESS || 'noreply@scalemap.com';
    this.baseUrl = process.env.FRONTEND_BASE_URL || 'https://app.scalemap.com';
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, from = this.defaultFromAddress, replyTo, template, templateData } = options;

    try {
      logger.info('Sending email', {
        to: Array.isArray(to) ? to.length : 1,
        subject: template.subject
      });

      const processedTemplate = this.processTemplate(template, templateData);

      const params: SendEmailCommandInput = {
        Source: from,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to]
        },
        Message: {
          Subject: {
            Data: processedTemplate.subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: processedTemplate.htmlBody,
              Charset: 'UTF-8'
            },
            Text: {
              Data: processedTemplate.textBody,
              Charset: 'UTF-8'
            }
          }
        },
        ReplyToAddresses: replyTo ? [replyTo] : undefined
      };

      const command = new SendEmailCommand(params);
      await sesClient.send(command);

      logger.info('Email sent successfully', {
        to: Array.isArray(to) ? to.length : 1,
        subject: template.subject
      });

      Monitoring.incrementCounter('EmailsSent', {
        type: this.getEmailType(template.subject)
      });

    } catch (error) {
      logger.error('Failed to send email', {
        error: (error as Error).message,
        to: Array.isArray(to) ? to.length : 1,
        subject: template.subject
      });

      Monitoring.recordError('email', 'SendEmailError', error as Error);
      throw error;
    }
  }

  async sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
    const verificationUrl = `${this.baseUrl}/verify-email?token=${verificationToken}`;

    const template: EmailTemplate = {
      subject: 'Verify your ScaleMap account',
      htmlBody: this.getVerificationEmailHtml(verificationUrl),
      textBody: this.getVerificationEmailText(verificationUrl)
    };

    await this.sendEmail({
      to: email,
      template
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.baseUrl}/reset-password?token=${resetToken}`;

    const template: EmailTemplate = {
      subject: 'Reset your ScaleMap password',
      htmlBody: this.getPasswordResetEmailHtml(resetUrl),
      textBody: this.getPasswordResetEmailText(resetUrl)
    };

    await this.sendEmail({
      to: email,
      template
    });
  }

  async sendWelcomeEmail(email: string, firstName: string, companyName: string): Promise<void> {
    const template: EmailTemplate = {
      subject: 'Welcome to ScaleMap!',
      htmlBody: this.getWelcomeEmailHtml(firstName, companyName),
      textBody: this.getWelcomeEmailText(firstName, companyName)
    };

    await this.sendEmail({
      to: email,
      template
    });
  }

  private processTemplate(template: EmailTemplate, data?: Record<string, string>): EmailTemplate {
    if (!data) return template;

    let processedSubject = template.subject;
    let processedHtmlBody = template.htmlBody;
    let processedTextBody = template.textBody;

    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), value);
      processedHtmlBody = processedHtmlBody.replace(new RegExp(placeholder, 'g'), value);
      processedTextBody = processedTextBody.replace(new RegExp(placeholder, 'g'), value);
    });

    return {
      subject: processedSubject,
      htmlBody: processedHtmlBody,
      textBody: processedTextBody
    };
  }

  private getEmailType(subject: string): string {
    if (subject.toLowerCase().includes('verify')) return 'verification';
    if (subject.toLowerCase().includes('reset') || subject.toLowerCase().includes('password')) return 'password_reset';
    if (subject.toLowerCase().includes('welcome')) return 'welcome';
    return 'general';
  }

  private getVerificationEmailHtml(verificationUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your ScaleMap Account</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin-bottom: 10px;">Welcome to ScaleMap!</h1>
    <p style="font-size: 18px; margin-bottom: 30px;">Please verify your email address to get started</p>
  </div>

  <div style="background-color: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
    <p style="margin-bottom: 20px;">Thank you for signing up for ScaleMap. To complete your account setup and start scaling your business, please verify your email address by clicking the button below:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
    </div>

    <p style="margin-bottom: 20px;">If the button doesn't work, you can also copy and paste this link into your browser:</p>
    <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px; font-family: monospace;">${verificationUrl}</p>
  </div>

  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px;">
    <p style="margin: 0; font-size: 14px;"><strong>Important:</strong> This verification link will expire in 24 hours. If you don't verify your email within this time, you'll need to request a new verification link.</p>
  </div>

  <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
    <p style="font-size: 12px; color: #6b7280; margin-bottom: 10px;">If you didn't create a ScaleMap account, you can safely ignore this email.</p>
    <p style="font-size: 12px; color: #6b7280;">© 2025 ScaleMap. All rights reserved.</p>
  </div>
</body>
</html>`;
  }

  private getVerificationEmailText(verificationUrl: string): string {
    return `
Welcome to ScaleMap!

Thank you for signing up for ScaleMap. To complete your account setup and start scaling your business, please verify your email address by visiting the following link:

${verificationUrl}

Important: This verification link will expire in 24 hours. If you don't verify your email within this time, you'll need to request a new verification link.

If you didn't create a ScaleMap account, you can safely ignore this email.

© 2025 ScaleMap. All rights reserved.
`;
  }

  private getPasswordResetEmailHtml(resetUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your ScaleMap Password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin-bottom: 10px;">Reset Your Password</h1>
    <p style="font-size: 18px; margin-bottom: 30px;">We received a request to reset your password</p>
  </div>

  <div style="background-color: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
    <p style="margin-bottom: 20px;">Click the button below to reset your password. If you didn't request this, you can safely ignore this email.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background-color: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
    </div>

    <p style="margin-bottom: 20px;">If the button doesn't work, you can also copy and paste this link into your browser:</p>
    <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px; font-family: monospace;">${resetUrl}</p>
  </div>

  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px;">
    <p style="margin: 0; font-size: 14px;"><strong>Security Note:</strong> This password reset link will expire in 1 hour. If you don't reset your password within this time, you'll need to request a new reset link.</p>
  </div>

  <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
    <p style="font-size: 12px; color: #6b7280; margin-bottom: 10px;">If you didn't request a password reset, please contact our support team.</p>
    <p style="font-size: 12px; color: #6b7280;">© 2025 ScaleMap. All rights reserved.</p>
  </div>
</body>
</html>`;
  }

  private getPasswordResetEmailText(resetUrl: string): string {
    return `
Reset Your ScaleMap Password

We received a request to reset your password. Click the link below to reset it:

${resetUrl}

Security Note: This password reset link will expire in 1 hour. If you don't reset your password within this time, you'll need to request a new reset link.

If you didn't request a password reset, you can safely ignore this email.

© 2025 ScaleMap. All rights reserved.
`;
  }

  private getWelcomeEmailHtml(firstName: string, companyName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ScaleMap</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin-bottom: 10px;">Welcome to ScaleMap, ${firstName}!</h1>
    <p style="font-size: 18px; margin-bottom: 30px;">Your ${companyName} account is ready</p>
  </div>

  <div style="background-color: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
    <p style="margin-bottom: 20px;">Congratulations! Your email has been verified and your ScaleMap account is now active. You're ready to start scaling your business with our AI-powered assessment and agent tools.</p>

    <h3 style="color: #2563eb; margin-top: 25px; margin-bottom: 15px;">What's Next?</h3>
    <ul style="margin-bottom: 20px;">
      <li style="margin-bottom: 8px;">Complete your company profile</li>
      <li style="margin-bottom: 8px;">Take your first business assessment</li>
      <li style="margin-bottom: 8px;">Explore our AI agents for business optimization</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${this.baseUrl}/dashboard" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Get Started</a>
    </div>
  </div>

  <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
    <p style="font-size: 12px; color: #6b7280; margin-bottom: 10px;">Need help? Contact our support team at support@scalemap.com</p>
    <p style="font-size: 12px; color: #6b7280;">© 2025 ScaleMap. All rights reserved.</p>
  </div>
</body>
</html>`;
  }

  private getWelcomeEmailText(firstName: string, companyName: string): string {
    return `
Welcome to ScaleMap, ${firstName}!

Congratulations! Your email has been verified and your ${companyName} ScaleMap account is now active. You're ready to start scaling your business with our AI-powered assessment and agent tools.

What's Next?
- Complete your company profile
- Take your first business assessment
- Explore our AI agents for business optimization

Get started: ${this.baseUrl}/dashboard

Need help? Contact our support team at support@scalemap.com

© 2025 ScaleMap. All rights reserved.
`;
  }
}

// Default email service instance
export const emailService = new EmailService();