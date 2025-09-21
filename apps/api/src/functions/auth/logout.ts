import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

import { sessionManager } from '../../services/session-manager';
import { withAuth, AuthenticatedEvent } from '../../shared/middleware/auth-middleware';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface LogoutRequestBody {
  refreshToken?: string;
  sessionId?: string;
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
      await sessionManager.revokeSession({
        userId: event.user.sub,
        reason: 'user_logout_all',
        revokedBy: event.user.sub
      });
    } else {
      // Logout from current session only
      await logoutCurrentSession(body.refreshToken, body.sessionId, event.user.sub, requestLogger);
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
  sessionId: string | undefined,
  userId: string,
  requestLogger: any
): Promise<void> {
  try {
    if (sessionId) {
      // If session ID is provided, revoke that specific session
      await sessionManager.revokeSession({
        sessionId,
        reason: 'user_logout',
        revokedBy: userId
      });
      requestLogger.info('Session revoked by session ID', { userId, sessionId });
      return;
    }

    if (refreshToken) {
      // Find session by refresh token and revoke it
      const session = await sessionManager.getSessionByRefreshToken(refreshToken, userId);
      if (session) {
        await sessionManager.revokeSession({
          sessionId: session.sessionId,
          reason: 'user_logout',
          revokedBy: userId
        });
        requestLogger.info('Session revoked by refresh token', {
          userId,
          sessionId: session.sessionId
        });
      } else {
        requestLogger.warn('Session not found for refresh token', { userId });
      }
      return;
    }

    // If neither session ID nor refresh token provided, this is acceptable for access-token-only logout
    requestLogger.info('No session-specific logout information provided', { userId });

  } catch (error) {
    requestLogger.error('Failed to logout current session', {
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