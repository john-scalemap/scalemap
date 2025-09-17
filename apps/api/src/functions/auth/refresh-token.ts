import { AuthTokens, AuthUser, ApiResponse, UserRole } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { jwtService } from '../../services/jwt';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface RefreshTokenRequest {
  refreshToken: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'refresh-token' });

  try {
    requestLogger.info('Token refresh requested');
    Monitoring.incrementCounter('TokenRefreshAttempts');

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId);
    }

    const { refreshToken }: RefreshTokenRequest = JSON.parse(event.body);

    if (!refreshToken) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Refresh token is required', requestId);
    }

    // Validate refresh token
    let refreshPayload: { sub: string; jti: string };
    try {
      refreshPayload = await jwtService.validateRefreshToken(refreshToken);
    } catch (error) {
      requestLogger.warn('Invalid refresh token', {
        error: (error as Error).message
      });
      Monitoring.incrementCounter('TokenRefreshFailures', { reason: 'invalid_token' });

      return createErrorResponse(401, 'INVALID_TOKEN', 'Invalid or expired refresh token', requestId);
    }

    // Get user record
    const userRecord = await db.get(`USER#${refreshPayload.sub}`, 'METADATA');
    if (!userRecord) {
      requestLogger.warn('User not found for refresh token', { userId: refreshPayload.sub });
      Monitoring.incrementCounter('TokenRefreshFailures', { reason: 'user_not_found' });

      return createErrorResponse(401, 'USER_NOT_FOUND', 'User account not found', requestId);
    }

    // Check if user is still active
    if (userRecord.status !== 'active') {
      requestLogger.warn('Token refresh attempt for inactive user', {
        userId: refreshPayload.sub,
        status: userRecord.status
      });
      Monitoring.incrementCounter('TokenRefreshFailures', { reason: 'user_inactive' });

      return createErrorResponse(403, 'ACCOUNT_SUSPENDED', 'User account is not active', requestId);
    }

    // Verify the refresh token exists in an active session
    const sessions = await db.query(
      'GSI2PK = :userKey',
      { ':userKey': `USER#${refreshPayload.sub}` },
      { indexName: 'GSI2' }
    );

    const validSession = sessions.find(session => session.refreshToken === refreshToken);
    if (!validSession) {
      requestLogger.warn('Refresh token not found in any session', {
        userId: refreshPayload.sub
      });
      Monitoring.incrementCounter('TokenRefreshFailures', { reason: 'session_not_found' });

      return createErrorResponse(401, 'INVALID_TOKEN', 'Invalid refresh token session', requestId);
    }

    // Check if session is expired
    const sessionExpiresAt = new Date(validSession.expiresAt as string);
    if (sessionExpiresAt < new Date()) {
      requestLogger.warn('Session expired', {
        userId: refreshPayload.sub,
        sessionId: validSession.sessionId
      });

      // Clean up expired session
      await db.delete(`SESSION#${validSession.sessionId}`, 'METADATA');

      Monitoring.incrementCounter('TokenRefreshFailures', { reason: 'session_expired' });
      return createErrorResponse(401, 'SESSION_EXPIRED', 'Session has expired', requestId);
    }

    // Build AuthUser object
    const authUser: AuthUser = {
      id: userRecord.id as string,
      email: userRecord.email as string,
      firstName: userRecord.firstName as string,
      lastName: userRecord.lastName as string,
      companyId: userRecord.companyId as string,
      role: userRecord.role as UserRole,
      emailVerified: userRecord.emailVerified as boolean,
      permissions: getPermissionsForRole(userRecord.role as string)
    };

    // Generate new tokens
    const newTokens = await jwtService.generateTokens(authUser);

    // Update session with new refresh token and last used timestamp
    await db.update(
      `SESSION#${validSession.sessionId}`,
      'METADATA',
      'SET refreshToken = :refreshToken, lastUsedAt = :lastUsed',
      {
        ':refreshToken': newTokens.refreshToken,
        ':lastUsed': new Date().toISOString()
      }
    );

    requestLogger.info('Token refresh successful', {
      userId: refreshPayload.sub,
      sessionId: validSession.sessionId
    });

    Monitoring.incrementCounter('TokenRefreshSuccess', {
      userRole: userRecord.role as string
    });

    const response: ApiResponse<AuthTokens> = {
      success: true,
      data: newTokens,
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
    Monitoring.recordError('refresh-token', 'UnexpectedError', error as Error);
    requestLogger.error('Token refresh failed', { error: (error as Error).message });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

function getPermissionsForRole(role: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    'admin': [
      'assessments:create',
      'assessments:read',
      'assessments:update',
      'assessments:delete',
      'agents:create',
      'agents:read',
      'agents:update',
      'agents:delete',
      'company:read',
      'company:update',
      'users:read',
      'users:update',
      'analytics:read'
    ],
    'user': [
      'assessments:create',
      'assessments:read',
      'assessments:update',
      'agents:read',
      'agents:update',
      'company:read',
      'analytics:read'
    ],
    'viewer': [
      'assessments:read',
      'agents:read',
      'company:read',
      'analytics:read'
    ]
  };

  return rolePermissions[role] || rolePermissions['viewer'] || [];
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