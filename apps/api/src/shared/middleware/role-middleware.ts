import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

import { authorizationService } from '../../services/authorization';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

import { AuthenticatedEvent } from './auth-middleware';

export interface RoleMiddlewareOptions {
  resource: string;
  action: string;
  allowedRoles?: string[];
  requiredPermissions?: string[];
  resourceIdFromEvent?: (event: AuthenticatedEvent) => string | undefined;
}

/**
 * Role-based authorization middleware for Lambda functions
 * Should be used after auth-middleware
 */
export function withRoles(
  handler: (event: AuthenticatedEvent) => Promise<APIGatewayProxyResult>,
  options: RoleMiddlewareOptions
) {
  return async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    const requestId = event.requestContext?.requestId || 'unknown';
    const requestLogger = logger.child({
      requestId,
      middleware: 'role',
      userId: event.user.sub,
      resource: options.resource,
      action: options.action
    });

    try {
      requestLogger.info('Role-based authorization middleware invoked');

      const user = event.user;

      // Check allowed roles if specified
      if (options.allowedRoles && !authorizationService.hasAnyRole(user, options.allowedRoles)) {
        requestLogger.warn('User does not have required role', {
          userRole: user.role,
          allowedRoles: options.allowedRoles
        });
        Monitoring.incrementCounter('RoleMiddlewareFailures', {
          reason: 'insufficient_role',
          userRole: user.role,
          resource: options.resource
        });

        return createForbiddenResponse('Insufficient role permissions', requestId);
      }

      // Check required permissions if specified
      if (options.requiredPermissions) {
        const missingPermissions = options.requiredPermissions.filter(
          perm => !authorizationService.hasPermission(user, perm)
        );

        if (missingPermissions.length > 0) {
          requestLogger.warn('User missing required permissions', {
            userPermissions: user.permissions,
            requiredPermissions: options.requiredPermissions,
            missingPermissions
          });
          Monitoring.incrementCounter('RoleMiddlewareFailures', {
            reason: 'missing_permissions',
            resource: options.resource
          });

          return createForbiddenResponse('Missing required permissions', requestId);
        }
      }

      // Check resource-level access
      const resourceId = options.resourceIdFromEvent ? options.resourceIdFromEvent(event) : undefined;

      if (!authorizationService.canAccessResource(user, options.resource, options.action, resourceId)) {
        requestLogger.warn('User cannot access resource', {
          resource: options.resource,
          action: options.action,
          resourceId
        });
        Monitoring.incrementCounter('RoleMiddlewareFailures', {
          reason: 'resource_access_denied',
          resource: options.resource,
          action: options.action
        });

        return createForbiddenResponse('Access denied to resource', requestId);
      }

      // For MVP: Validate single user per company constraint for user management operations
      if (options.resource === 'users' && options.action === 'create') {
        const canAddUser = await authorizationService.validateSingleUserPerCompany(user.companyId);
        if (!canAddUser) {
          requestLogger.warn('Cannot add user - single user per company limit reached', {
            companyId: user.companyId
          });
          Monitoring.incrementCounter('RoleMiddlewareFailures', {
            reason: 'single_user_limit',
            resource: options.resource
          });

          return createForbiddenResponse('Company already has maximum number of users for MVP', requestId);
        }
      }

      requestLogger.info('Role-based authorization successful', {
        userRole: user.role,
        permissions: user.permissions.length
      });

      Monitoring.incrementCounter('RoleMiddlewareSuccess', {
        userRole: user.role,
        resource: options.resource,
        action: options.action
      });

      // Call the protected handler
      return await handler(event);

    } catch (error) {
      requestLogger.error('Role-based authorization middleware error', {
        error: (error as Error).message
      });

      Monitoring.recordError('role-middleware', 'UnexpectedError', error as Error);

      return createInternalErrorResponse('Authorization error', requestId);
    }
  };
}

/**
 * Convenience function for admin-only operations
 */
export function withAdminRole(
  handler: (event: AuthenticatedEvent) => Promise<APIGatewayProxyResult>,
  resource: string,
  action: string
) {
  return withRoles(handler, {
    resource,
    action,
    allowedRoles: ['admin']
  });
}

/**
 * Convenience function for company data operations
 */
export function withCompanyAccess(
  handler: (event: AuthenticatedEvent) => Promise<APIGatewayProxyResult>,
  action: string,
  adminOnly = false
) {
  return withRoles(handler, {
    resource: 'company',
    action,
    allowedRoles: adminOnly ? ['admin'] : ['admin', 'user', 'viewer'],
    requiredPermissions: [`company:${action === 'read' ? 'read' : 'write'}`],
    resourceIdFromEvent: (event) => event.user.companyId
  });
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