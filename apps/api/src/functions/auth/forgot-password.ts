import { randomUUID } from 'crypto';

import { PasswordResetRequest, ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { emailService } from '../../services/email';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';


export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'forgot-password' });

  try {
    requestLogger.info('Password reset requested');
    Monitoring.incrementCounter('PasswordResetRequests');

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId);
    }

    const { email }: PasswordResetRequest = JSON.parse(event.body);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createErrorResponse(400, 'INVALID_EMAIL_FORMAT', 'Invalid email format', requestId);
    }

    // Check rate limiting - look for recent reset requests
    const recentResetAttempts = await checkResetRateLimit(email, requestLogger);
    if (recentResetAttempts >= 3) {
      requestLogger.warn('Password reset rate limit exceeded', { email });
      Monitoring.incrementCounter('PasswordResetFailures', { reason: 'rate_limit_exceeded' });

      return createErrorResponse(429, 'RATE_LIMIT_EXCEEDED', 'Too many password reset requests. Please try again later.', requestId);
    }

    // Find user by email
    const userRecords = await db.query(
      'GSI1PK = :email',
      { ':email': `EMAIL#${email.toLowerCase()}` },
      { indexName: 'GSI1' }
    );

    if (userRecords.length === 0) {
      // Don't reveal that email doesn't exist - return success to prevent email enumeration
      requestLogger.info('Password reset requested for non-existent email', { email });
      Monitoring.incrementCounter('PasswordResetRequests', { result: 'email_not_found' });

      return createSuccessResponse('If the email address exists in our system, you will receive password reset instructions.', requestId);
    }

    const userRecord = userRecords[0]!; // Safe: we checked length > 0 above

    // Check if user account is active
    if (userRecord.status !== 'active') {
      requestLogger.warn('Password reset requested for inactive account', {
        userId: userRecord.id,
        status: userRecord.status
      });

      // Still return success to prevent account status enumeration
      return createSuccessResponse('If the email address exists in our system, you will receive password reset instructions.', requestId);
    }

    // Generate secure reset token
    const resetToken = randomUUID();
    const resetTokenExpiry = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour from now

    // Create password reset record
    const resetData = {
      PK: `PASSWORD_RESET#${resetToken}`,
      SK: 'METADATA',
      GSI2PK: `EMAIL#${email.toLowerCase()}`,
      GSI2SK: `RESET#${new Date().toISOString()}`,
      token: resetToken,
      email: email.toLowerCase(),
      userId: userRecord.id,
      expiresAt: resetTokenExpiry.toISOString(),
      used: false,
      attempts: 0,
      maxAttempts: 5,
      ipAddress: event.requestContext?.identity?.sourceIp || 'unknown',
      userAgent: event.headers?.['User-Agent'] || 'unknown',
      TTL: Math.floor(resetTokenExpiry.getTime() / 1000), // DynamoDB TTL
      createdAt: new Date().toISOString()
    };

    // Store reset token and send email
    await Promise.all([
      db.put(resetData),
      emailService.sendPasswordResetEmail(email, resetToken)
    ]);

    requestLogger.info('Password reset email sent', {
      userId: userRecord.id,
      email,
      tokenId: resetToken
    });

    Monitoring.incrementCounter('PasswordResetEmailsSent');

    return createSuccessResponse('If the email address exists in our system, you will receive password reset instructions.', requestId);

  } catch (error) {
    Monitoring.recordError('forgot-password', 'UnexpectedError', error as Error);
    requestLogger.error('Password reset request failed', { error: (error as Error).message });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

async function checkResetRateLimit(email: string, requestLogger: any): Promise<number> {
  try {
    // Check for password reset attempts in the last hour
    const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)).toISOString();

    const recentResets = await db.query(
      'GSI2PK = :email AND GSI2SK > :timeThreshold',
      {
        ':email': `EMAIL#${email.toLowerCase()}`,
        ':timeThreshold': `RESET#${oneHourAgo}`
      },
      { indexName: 'GSI2' }
    );

    return recentResets.length;

  } catch (error) {
    requestLogger.error('Error checking password reset rate limit', {
      error: (error as Error).message,
      email
    });
    // Return 0 to not block legitimate requests if rate limit check fails
    return 0;
  }
}

function createSuccessResponse(message: string, requestId: string): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: true,
    data: {
      message,
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    },
    body: JSON.stringify(response),
  };
}

function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId: string
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: { code, message },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    },
    body: JSON.stringify(response),
  };
}