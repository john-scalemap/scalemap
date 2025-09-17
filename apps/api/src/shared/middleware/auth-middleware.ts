import { JWTPayload, ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { jwtService } from '../../services/jwt';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  user: JWTPayload;
}

export interface AuthMiddlewareOptions {
  requireEmailVerification?: boolean;
  requiredPermissions?: string[];
  allowedRoles?: string[];
}

/**
 * Authentication middleware for Lambda functions
 */
export function withAuth(
  handler: (event: AuthenticatedEvent) => Promise<APIGatewayProxyResult>,
  options: AuthMiddlewareOptions = {}
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const requestId = event.requestContext?.requestId || 'unknown';
    const requestLogger = logger.child({ requestId, middleware: 'auth' });

    try {
      requestLogger.info('Authentication middleware invoked');

      // Extract token from Authorization header
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const token = jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        requestLogger.warn('No authentication token provided');
        Monitoring.incrementCounter('AuthMiddlewareFailures', { reason: 'no_token' });

        return createUnauthorizedResponse('Authentication token is required', requestId);
      }

      // Validate token
      let payload: JWTPayload;
      try {
        payload = await jwtService.validateAccessToken(token);
      } catch (error) {
        requestLogger.warn('Invalid authentication token', {
          error: (error as Error).message
        });
        Monitoring.incrementCounter('AuthMiddlewareFailures', { reason: 'invalid_token' });

        return createUnauthorizedResponse('Invalid or expired authentication token', requestId);
      }

      // Check if user exists and is active
      const userRecord = await db.get(`USER#${payload.sub}`, 'METADATA');
      if (!userRecord) {
        requestLogger.warn('User not found', { userId: payload.sub });
        Monitoring.incrementCounter('AuthMiddlewareFailures', { reason: 'user_not_found' });

        return createUnauthorizedResponse('User account not found', requestId);
      }

      if (userRecord.status !== 'active') {
        requestLogger.warn('User account not active', {
          userId: payload.sub,
          status: userRecord.status
        });
        Monitoring.incrementCounter('AuthMiddlewareFailures', { reason: 'user_inactive' });

        return createUnauthorizedResponse('User account is not active', requestId);
      }

      // Check email verification if required
      if (options.requireEmailVerification && !payload.emailVerified) {
        requestLogger.warn('Email verification required', { userId: payload.sub });
        Monitoring.incrementCounter('AuthMiddlewareFailures', { reason: 'email_not_verified' });

        return createForbiddenResponse('Email verification is required', requestId);
      }

      // Check role permissions
      if (options.allowedRoles && !options.allowedRoles.includes(payload.role)) {
        requestLogger.warn('Insufficient role permissions', {
          userId: payload.sub,
          userRole: payload.role,
          allowedRoles: options.allowedRoles
        });
        Monitoring.incrementCounter('AuthMiddlewareFailures', { reason: 'insufficient_role' });

        return createForbiddenResponse('Insufficient permissions', requestId);
      }

      // Check specific permissions
      if (options.requiredPermissions) {
        const missingPermissions = options.requiredPermissions.filter(
          perm => !payload.permissions.includes(perm)
        );

        if (missingPermissions.length > 0) {
          requestLogger.warn('Missing required permissions', {
            userId: payload.sub,
            missingPermissions
          });
          Monitoring.incrementCounter('AuthMiddlewareFailures', { reason: 'missing_permissions' });

          return createForbiddenResponse('Missing required permissions', requestId);
        }
      }

      // Update last used timestamp for user
      try {
        await db.update(
          `USER#${payload.sub}`,
          'METADATA',
          'SET lastLoginAt = :lastLogin',
          { ':lastLogin': new Date().toISOString() }
        );
      } catch (error) {
        // Log but don't fail the request for this
        requestLogger.warn('Failed to update last login timestamp', {
          error: (error as Error).message,
          userId: payload.sub
        });
      }

      requestLogger.info('Authentication successful', {
        userId: payload.sub,
        role: payload.role
      });

      Monitoring.incrementCounter('AuthMiddlewareSuccess', {
        userRole: payload.role
      });

      // Call the protected handler with authenticated event
      const authenticatedEvent = {
        ...event,
        user: payload
      } as AuthenticatedEvent;

      return await handler(authenticatedEvent);

    } catch (error) {
      requestLogger.error('Authentication middleware error', {
        error: (error as Error).message
      });

      Monitoring.recordError('auth-middleware', 'UnexpectedError', error as Error);

      return createInternalErrorResponse('Authentication error', requestId);
    }
  };
}

/**
 * Create a standardized unauthorized response
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
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'WWW-Authenticate': 'Bearer realm="scalemap-api"'
    },
    body: JSON.stringify(response)
  };
}

/**
 * Create a standardized forbidden response
 */
function createForbiddenResponse(message: string, requestId: string): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'FORBIDDEN',
      message
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  return {
    statusCode: 403,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(response)
  };
}

/**
 * Create a standardized internal error response
 */
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
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(response)
  };
}