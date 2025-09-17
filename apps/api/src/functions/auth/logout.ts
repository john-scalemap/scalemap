import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { jwtService } from '../../services/jwt';
import { withAuth, AuthenticatedEvent } from '../../shared/middleware/auth-middleware';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface LogoutRequestBody {
  refreshToken?: string;
  logoutAllSessions?: boolean;
}

const logoutHandler = async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'logout' });

  try {
    requestLogger.info('Logout initiated', { userId: event.user.sub });
    Monitoring.incrementCounter('LogoutAttempts');

    const body: LogoutRequestBody = event.body ? JSON.parse(event.body) : {};

    if (body.logoutAllSessions) {
      // Logout from all sessions
      await logoutAllSessions(event.user.sub, requestLogger);
    } else {
      // Logout from current session only
      await logoutCurrentSession(body.refreshToken, event.user.sub, requestLogger);
    }

    requestLogger.info('Logout successful', {
      userId: event.user.sub,
      allSessions: body.logoutAllSessions || false
    });

    Monitoring.incrementCounter('LogoutSuccess', {
      type: body.logoutAllSessions ? 'all_sessions' : 'current_session'
    });

    const response: ApiResponse = {
      success: true,
      data: {
        message: body.logoutAllSessions
          ? 'Successfully logged out from all sessions'
          : 'Successfully logged out',
        loggedOutAt: new Date().toISOString()
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
    Monitoring.recordError('logout', 'UnexpectedError', error as Error);
    requestLogger.error('Logout failed', {
      error: (error as Error).message,
      userId: event.user.sub
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

async function logoutCurrentSession(
  refreshToken: string | undefined,
  userId: string,
  requestLogger: any
): Promise<void> {
  try {
    if (!refreshToken) {
      // If no refresh token provided, we can't identify the specific session
      // This is acceptable for access-token-only logout
      requestLogger.info('No refresh token provided for session-specific logout', { userId });
      return;
    }

    // Validate and decode refresh token to get session info
    try {
      const _refreshPayload = await jwtService.validateRefreshToken(refreshToken);

      // Find and delete the session with this refresh token
      const sessions = await db.query(
        'GSI2PK = :userKey',
        { ':userKey': `USER#${userId}` },
        { indexName: 'GSI2' }
      );

      for (const session of sessions) {
        if (session.refreshToken === refreshToken) {
          await db.delete(`SESSION#${session.sessionId}`, 'METADATA');
          requestLogger.info('Session deleted', {
            userId,
            sessionId: session.sessionId
          });
          break;
        }
      }
    } catch (tokenError) {
      // If refresh token is invalid, try to clean up any matching sessions anyway
      requestLogger.warn('Invalid refresh token during logout', {
        error: (tokenError as Error).message,
        userId
      });
    }

  } catch (error) {
    requestLogger.error('Failed to logout current session', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

async function logoutAllSessions(userId: string, requestLogger: any): Promise<void> {
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

    requestLogger.info('All sessions deleted', {
      userId,
      sessionCount: sessions.length
    });

  } catch (error) {
    requestLogger.error('Failed to logout all sessions', {
      error: (error as Error).message,
      userId
    });
    throw error;
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

// Export the handler wrapped with authentication middleware
export const handler = withAuth(logoutHandler);