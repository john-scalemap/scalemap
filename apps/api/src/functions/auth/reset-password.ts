import { PasswordResetConfirm, ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as bcrypt from 'bcrypt';

import { db } from '../../services/database';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'reset-password' });

  try {
    requestLogger.info('Password reset confirmation requested');
    Monitoring.incrementCounter('PasswordResetConfirmations');

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId);
    }

    const { token, newPassword, confirmPassword }: PasswordResetConfirm = JSON.parse(event.body);

    // Validate request
    const validationError = validateResetRequest(token, newPassword, confirmPassword);
    if (validationError) {
      return createErrorResponse(400, validationError.code, validationError.message, requestId);
    }

    // Get password reset record
    const resetRecord = await db.get(`PASSWORD_RESET#${token}`, 'METADATA');
    if (!resetRecord) {
      requestLogger.warn('Invalid password reset token', { token: token.substring(0, 8) + '...' });
      Monitoring.incrementCounter('PasswordResetFailures', { reason: 'invalid_token' });

      return createErrorResponse(400, 'INVALID_TOKEN', 'Invalid or expired password reset token', requestId);
    }

    // Check if token has been used
    if (resetRecord.used) {
      requestLogger.warn('Attempted reuse of password reset token', {
        token: token.substring(0, 8) + '...',
        userId: resetRecord.userId
      });
      Monitoring.incrementCounter('PasswordResetFailures', { reason: 'token_already_used' });

      return createErrorResponse(400, 'TOKEN_ALREADY_USED', 'Password reset token has already been used', requestId);
    }

    // Check if token is expired
    const expiresAt = new Date(resetRecord.expiresAt as string);
    if (expiresAt < new Date()) {
      requestLogger.warn('Expired password reset token', {
        token: token.substring(0, 8) + '...',
        userId: resetRecord.userId
      });
      Monitoring.incrementCounter('PasswordResetFailures', { reason: 'token_expired' });

      return createErrorResponse(400, 'TOKEN_EXPIRED', 'Password reset token has expired', requestId);
    }

    // Check attempts
    const attempts = (resetRecord.attempts as number) || 0;
    const maxAttempts = (resetRecord.maxAttempts as number) || 5;
    if (attempts >= maxAttempts) {
      requestLogger.warn('Password reset max attempts exceeded', {
        token: token.substring(0, 8) + '...',
        userId: resetRecord.userId,
        attempts
      });
      Monitoring.incrementCounter('PasswordResetFailures', { reason: 'max_attempts_exceeded' });

      return createErrorResponse(429, 'RATE_LIMIT_EXCEEDED', 'Maximum password reset attempts exceeded', requestId);
    }

    // Increment attempts
    await db.update(
      `PASSWORD_RESET#${token}`,
      'METADATA',
      'SET attempts = attempts + :inc',
      { ':inc': 1 }
    );

    // Get user record
    const userId = resetRecord.userId as string;
    const userRecord = await db.get(`USER#${userId}`, 'METADATA');
    if (!userRecord) {
      requestLogger.error('User not found for password reset', { userId });
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User account not found', requestId);
    }

    // Check if user is still active
    if (userRecord.status !== 'active') {
      requestLogger.warn('Password reset attempt for inactive user', {
        userId,
        status: userRecord.status
      });
      Monitoring.incrementCounter('PasswordResetFailures', { reason: 'user_inactive' });

      return createErrorResponse(403, 'ACCOUNT_INACTIVE', 'User account is not active', requestId);
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password and mark reset token as used
    await Promise.all([
      db.update(
        `USER#${userId}`,
        'METADATA',
        'SET passwordHash = :password, updatedAt = :updatedAt',
        {
          ':password': hashedPassword,
          ':updatedAt': new Date().toISOString()
        }
      ),
      db.update(
        `PASSWORD_RESET#${token}`,
        'METADATA',
        'SET used = :used, usedAt = :usedAt',
        {
          ':used': true,
          ':usedAt': new Date().toISOString()
        }
      )
    ]);

    // Invalidate all existing sessions for security
    await invalidateAllUserSessions(userId, requestLogger);

    requestLogger.info('Password reset successful', {
      userId,
      email: resetRecord.email
    });

    Monitoring.incrementCounter('PasswordResetSuccess');

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Password has been reset successfully. Please log in with your new password.',
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

  } catch (error) {
    Monitoring.recordError('reset-password', 'UnexpectedError', error as Error);
    requestLogger.error('Password reset confirmation failed', { error: (error as Error).message });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

function validateResetRequest(token: string, newPassword: string, confirmPassword: string): { code: string; message: string } | null {
  // Token validation
  if (!token || token.length < 10) {
    return { code: 'INVALID_TOKEN', message: 'Invalid reset token' };
  }

  // Password validation
  if (newPassword.length < 8) {
    return { code: 'PASSWORD_TOO_WEAK', message: 'Password must be at least 8 characters long' };
  }

  if (!/(?=.*[a-z])/.test(newPassword)) {
    return { code: 'PASSWORD_TOO_WEAK', message: 'Password must contain at least one lowercase letter' };
  }

  if (!/(?=.*[A-Z])/.test(newPassword)) {
    return { code: 'PASSWORD_TOO_WEAK', message: 'Password must contain at least one uppercase letter' };
  }

  if (!/(?=.*\d)/.test(newPassword)) {
    return { code: 'PASSWORD_TOO_WEAK', message: 'Password must contain at least one number' };
  }

  // Password confirmation
  if (newPassword !== confirmPassword) {
    return { code: 'PASSWORD_MISMATCH', message: 'Passwords do not match' };
  }

  return null;
}

async function invalidateAllUserSessions(userId: string, requestLogger: any): Promise<void> {
  try {
    // Get all sessions for the user
    const sessions = await db.query(
      'GSI2PK = :userKey',
      { ':userKey': `USER#${userId}` },
      { indexName: 'GSI2' }
    );

    // Delete all sessions
    const deletePromises = sessions.map(session =>
      db.delete(`SESSION#${session.sessionId}`, 'METADATA')
    );

    await Promise.all(deletePromises);

    requestLogger.info('All user sessions invalidated', {
      userId,
      sessionCount: sessions.length
    });

  } catch (error) {
    requestLogger.error('Failed to invalidate user sessions', {
      error: (error as Error).message,
      userId
    });
    // Don't throw - password reset should still succeed even if session cleanup fails
  }
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