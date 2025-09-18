import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { emailService } from '../../services/email';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'verify-email' });

  try {
    requestLogger.info('Email verification requested');
    Monitoring.incrementCounter('EmailVerificationRequests');

    // Get token from query parameters
    const token = event.queryStringParameters?.token;
    if (!token) {
      return createErrorResponse(400, 'INVALID_TOKEN', 'Verification token is required', requestId);
    }

    // Look up verification record
    const verificationRecord = await db.get(`EMAIL_VERIFICATION#${token}`, 'METADATA');
    if (!verificationRecord) {
      Monitoring.incrementCounter('EmailVerificationFailures', { reason: 'token_not_found' });
      return createErrorResponse(404, 'INVALID_TOKEN', 'Invalid or expired verification token', requestId);
    }

    // Check if token is expired
    const expiresAt = new Date(verificationRecord.expiresAt as string);
    if (expiresAt < new Date()) {
      Monitoring.incrementCounter('EmailVerificationFailures', { reason: 'token_expired' });
      return createErrorResponse(400, 'TOKEN_EXPIRED', 'Verification token has expired', requestId);
    }

    // Check attempts
    const attempts = (verificationRecord.attempts as number) || 0;
    const maxAttempts = (verificationRecord.maxAttempts as number) || 5;
    if (attempts >= maxAttempts) {
      Monitoring.incrementCounter('EmailVerificationFailures', { reason: 'max_attempts' });
      return createErrorResponse(429, 'RATE_LIMIT_EXCEEDED', 'Maximum verification attempts exceeded', requestId);
    }

    // Update attempts count
    await db.update(
      `EMAIL_VERIFICATION#${token}`,
      'METADATA',
      'SET attempts = attempts + :inc',
      { ':inc': 1 }
    );

    // Get user record
    const userId = verificationRecord.userId as string;
    const userRecord = await db.get(`USER#${userId}`, 'METADATA');
    if (!userRecord) {
      requestLogger.error('User not found for verification', { userId });
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found', requestId);
    }

    // Check if already verified
    if (userRecord.emailVerified) {
      return createSuccessResponse('Email already verified', requestId);
    }

    // Update user as verified and active
    await db.update(
      `USER#${userId}`,
      'METADATA',
      'SET emailVerified = :verified, #status = :status, updatedAt = :updatedAt',
      {
        ':verified': true,
        ':status': 'active'
      },
      {
        '#status': 'status'
      }
    );

    // Get company information for welcome email
    const companyId = userRecord.companyId as string;
    const companyRecord = await db.get(`COMPANY#${companyId}`, 'METADATA');

    // Send welcome email
    if (companyRecord) {
      await emailService.sendWelcomeEmail(
        userRecord.email as string,
        userRecord.firstName as string,
        companyRecord.name as string
      );
    }

    // Delete verification record (clean up)
    await db.delete(`EMAIL_VERIFICATION#${token}`, 'METADATA');

    requestLogger.info('Email verification completed successfully', {
      userId,
      email: userRecord.email
    });

    Monitoring.incrementCounter('EmailVerificationSuccess');

    return createSuccessResponse('Email verified successfully', requestId);

  } catch (error) {
    Monitoring.recordError('verify-email', 'UnexpectedError', error as Error);
    requestLogger.error('Email verification failed', { error: (error as Error).message });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

function createSuccessResponse(message: string, requestId: string): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: true,
    data: { message, verified: true },
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
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
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
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    },
    body: JSON.stringify(response),
  };
}