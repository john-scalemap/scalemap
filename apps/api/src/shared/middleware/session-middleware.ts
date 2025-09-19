import { JWTPayload, ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { jwtService } from '../../services/jwt';
import { sessionManager } from '../../services/session-manager';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

export interface SessionAuthenticatedEvent extends APIGatewayProxyEvent {
  user: JWTPayload;
  sessionId: string;
}

export interface SessionMiddlewareOptions {
  requireActiveSession?: boolean;
  allowRefreshTokenValidation?: boolean;
}

/**
 * Session validation middleware that extends auth middleware
 * Validates both JWT tokens and active sessions
 */
export function withSessionValidation(
  handler: (event: SessionAuthenticatedEvent) => Promise<APIGatewayProxyResult>,
  options: SessionMiddlewareOptions = {}
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const requestId = event.requestContext?.requestId || 'unknown';
    const requestLogger = logger.child({ requestId, middleware: 'session' });

    try {
      requestLogger.info('Session validation middleware invoked');

      // Extract token from Authorization header
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const token = jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        requestLogger.warn('No authentication token provided');
        Monitoring.incrementCounter('SessionMiddlewareFailures', { reason: 'no_token' });
        return createUnauthorizedResponse('Authentication token is required', requestId);
      }

      // Validate JWT token
      let payload: JWTPayload;
      try {
        payload = await jwtService.validateAccessToken(token);
      } catch (error) {
        requestLogger.warn('Invalid JWT token', {
          error: (error as Error).message
        });
        Monitoring.incrementCounter('SessionMiddlewareFailures', { reason: 'invalid_jwt' });
        return createUnauthorizedResponse('Invalid or expired authentication token', requestId);
      }

      // Extract session information from request
      const sessionId = extractSessionId(event);

      if (options.requireActiveSession && !sessionId) {
        requestLogger.warn('Session ID required but not provided', { userId: payload.sub });
        Monitoring.incrementCounter('SessionMiddlewareFailures', { reason: 'no_session_id' });
        return createUnauthorizedResponse('Session information is required', requestId);
      }

      // Validate session if session ID is provided
      if (sessionId) {
        const sessionValidation = await sessionManager.validateSession(sessionId);

        if (!sessionValidation.isValid) {
          requestLogger.warn('Session validation failed', {
            sessionId,
            userId: payload.sub,
            error: sessionValidation.error
          });
          Monitoring.incrementCounter('SessionMiddlewareFailures', {
            reason: 'invalid_session',
            sessionError: sessionValidation.error || 'unknown'
          });

          return createUnauthorizedResponse(
            sessionValidation.error === 'Session expired'
              ? 'Session has expired. Please log in again.'
              : 'Invalid session. Please log in again.',
            requestId
          );
        }

        // Verify session belongs to the token user
        if (sessionValidation.session!.userId !== payload.sub) {
          requestLogger.warn('Session user mismatch', {
            sessionId,
            sessionUserId: sessionValidation.session!.userId,
            tokenUserId: payload.sub
          });
          Monitoring.incrementCounter('SessionMiddlewareFailures', { reason: 'session_user_mismatch' });
          return createUnauthorizedResponse('Session validation failed', requestId);
        }

        requestLogger.info('Session validation successful', {
          sessionId,
          userId: payload.sub,
          deviceId: sessionValidation.session!.deviceId
        });
      }

      Monitoring.incrementCounter('SessionMiddlewareSuccess', {
        userRole: payload.role,
        hasSession: sessionId ? 'true' : 'false'
      });

      // Call the protected handler with session-authenticated event
      const sessionAuthenticatedEvent = {
        ...event,
        user: payload,
        sessionId: sessionId ?? ''
      } as SessionAuthenticatedEvent;

      return await handler(sessionAuthenticatedEvent);

    } catch (error) {
      requestLogger.error('Session validation middleware error', {
        error: (error as Error).message
      });

      Monitoring.recordError('session-middleware', 'UnexpectedError', error as Error);
      return createInternalErrorResponse('Session validation error', requestId);
    }
  };
}

/**
 * Extract session ID from various sources in the request
 */
function extractSessionId(event: APIGatewayProxyEvent): string | null {
  // Try to extract from custom header first
  const sessionHeader = event.headers?.['X-Session-ID'] || event.headers?.['x-session-id'];
  if (sessionHeader) {
    return sessionHeader;
  }

  // Try to extract from request body if it's a POST/PUT request
  if (event.body && (event.httpMethod === 'POST' || event.httpMethod === 'PUT')) {
    try {
      const body = JSON.parse(event.body);
      if (body.sessionId) {
        return body.sessionId;
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Try to extract from query parameters
  if (event.queryStringParameters?.sessionId) {
    return event.queryStringParameters.sessionId;
  }

  return null;
}

/**
 * Middleware to require specific session validation
 */
export function withStrictSessionValidation(
  handler: (event: SessionAuthenticatedEvent) => Promise<APIGatewayProxyResult>
) {
  return withSessionValidation(handler, {
    requireActiveSession: true,
    allowRefreshTokenValidation: false
  });
}

/**
 * Create standardized error responses
 */
function createUnauthorizedResponse(message: string, requestId: string): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  return {
    statusCode: 401,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Session-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'WWW-Authenticate': 'Bearer realm="scalemap-api"'
    },
    body: JSON.stringify(response)
  };
}

function createInternalErrorResponse(message: string, requestId: string): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  return {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Session-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(response)
  };
}