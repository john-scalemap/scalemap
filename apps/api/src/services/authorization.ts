import { JWTPayload, Role, Permission } from '@scalemap/shared';

import { logger } from '../utils/logger';

import { db } from './database';

/**
 * Authorization service for role-based access control
 */
export class AuthorizationService {

  /**
   * Default system roles and permissions for MVP
   */
  private static readonly SYSTEM_ROLES: Record<string, Role> = {
    admin: {
      id: 'admin',
      name: 'Administrator',
      description: 'Full access to company resources and settings',
      permissions: [
        'company:read',
        'company:write',
        'company:delete',
        'users:read',
        'users:write',
        'users:delete',
        'assessments:read',
        'assessments:write',
        'assessments:delete',
        'agents:read',
        'agents:write',
        'agents:delete',
        'analytics:read',
        'billing:read',
        'billing:write'
      ],
      isSystem: true
    },
    user: {
      id: 'user',
      name: 'User',
      description: 'Standard user access to assessments and basic company info',
      permissions: [
        'company:read',
        'assessments:read',
        'assessments:write',
        'agents:read',
        'analytics:read'
      ],
      isSystem: true
    },
    viewer: {
      id: 'viewer',
      name: 'Viewer',
      description: 'Read-only access to assessments and company information',
      permissions: [
        'company:read',
        'assessments:read',
        'agents:read',
        'analytics:read'
      ],
      isSystem: true
    }
  };

  /**
   * System permissions definitions
   */
  private static readonly SYSTEM_PERMISSIONS: Record<string, Permission> = {
    'company:read': {
      id: 'company:read',
      name: 'Read Company Data',
      description: 'View company information and settings',
      resource: 'company',
      actions: ['read', 'list']
    },
    'company:write': {
      id: 'company:write',
      name: 'Write Company Data',
      description: 'Update company information and settings',
      resource: 'company',
      actions: ['create', 'update']
    },
    'company:delete': {
      id: 'company:delete',
      name: 'Delete Company Data',
      description: 'Delete company and associated data',
      resource: 'company',
      actions: ['delete']
    },
    'users:read': {
      id: 'users:read',
      name: 'Read User Data',
      description: 'View user information',
      resource: 'users',
      actions: ['read', 'list']
    },
    'users:write': {
      id: 'users:write',
      name: 'Write User Data',
      description: 'Create and update user accounts',
      resource: 'users',
      actions: ['create', 'update']
    },
    'users:delete': {
      id: 'users:delete',
      name: 'Delete User Data',
      description: 'Delete user accounts',
      resource: 'users',
      actions: ['delete']
    },
    'assessments:read': {
      id: 'assessments:read',
      name: 'Read Assessments',
      description: 'View assessment data and results',
      resource: 'assessments',
      actions: ['read', 'list']
    },
    'assessments:write': {
      id: 'assessments:write',
      name: 'Write Assessments',
      description: 'Create and update assessments',
      resource: 'assessments',
      actions: ['create', 'update']
    },
    'assessments:delete': {
      id: 'assessments:delete',
      name: 'Delete Assessments',
      description: 'Delete assessments and results',
      resource: 'assessments',
      actions: ['delete']
    },
    'agents:read': {
      id: 'agents:read',
      name: 'Read Agent Data',
      description: 'View agent analysis results',
      resource: 'agents',
      actions: ['read', 'list']
    },
    'agents:write': {
      id: 'agents:write',
      name: 'Write Agent Data',
      description: 'Trigger agent analysis and update settings',
      resource: 'agents',
      actions: ['create', 'update']
    },
    'agents:delete': {
      id: 'agents:delete',
      name: 'Delete Agent Data',
      description: 'Delete agent analysis results',
      resource: 'agents',
      actions: ['delete']
    },
    'analytics:read': {
      id: 'analytics:read',
      name: 'Read Analytics',
      description: 'View analytics and reports',
      resource: 'analytics',
      actions: ['read', 'list']
    },
    'billing:read': {
      id: 'billing:read',
      name: 'Read Billing Data',
      description: 'View billing information and invoices',
      resource: 'billing',
      actions: ['read', 'list']
    },
    'billing:write': {
      id: 'billing:write',
      name: 'Write Billing Data',
      description: 'Update billing information and subscriptions',
      resource: 'billing',
      actions: ['create', 'update']
    }
  };

  /**
   * Get role by ID (system roles or custom company roles)
   */
  static async getRole(roleId: string, companyId?: string): Promise<Role | null> {
    try {
      // Check system roles first
      if (this.SYSTEM_ROLES[roleId]) {
        return this.SYSTEM_ROLES[roleId];
      }

      // Check company-specific roles (for future expansion)
      if (companyId) {
        const roleRecord = await db.get(`COMPANY#${companyId}`, `ROLE#${roleId}`);
        if (roleRecord) {
          return roleRecord as unknown as Role;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error fetching role', { roleId, companyId, error });
      return null;
    }
  }

  /**
   * Get permission by ID
   */
  static getPermission(permissionId: string): Permission | null {
    return this.SYSTEM_PERMISSIONS[permissionId] || null;
  }

  /**
   * Check if user has required permission
   */
  static hasPermission(user: JWTPayload, requiredPermission: string): boolean {
    return user.permissions.includes(requiredPermission);
  }

  /**
   * Check if user has required role
   */
  static hasRole(user: JWTPayload, requiredRole: string): boolean {
    return user.role === requiredRole;
  }

  /**
   * Check if user has any of the required roles
   */
  static hasAnyRole(user: JWTPayload, requiredRoles: string[]): boolean {
    return requiredRoles.includes(user.role);
  }

  /**
   * Check if user can access resource
   */
  static canAccessResource(
    user: JWTPayload,
    resource: string,
    action: string,
    resourceId?: string
  ): boolean {
    const permission = `${resource}:${this.mapActionToPermissionSuffix(action)}`;

    // Check if user has the required permission
    if (!this.hasPermission(user, permission)) {
      return false;
    }

    // Additional resource-specific checks
    switch (resource) {
      case 'company':
        // Users can only access their own company
        return !resourceId || resourceId === user.companyId;

      case 'users':
        // For MVP, users can only manage users in their own company
        // Future: implement proper user-to-company validation
        return true;

      default:
        return true;
    }
  }

  /**
   * Map action to permission suffix
   */
  private static mapActionToPermissionSuffix(action: string): string {
    switch (action.toLowerCase()) {
      case 'get':
      case 'read':
      case 'view':
      case 'list':
        return 'read';
      case 'post':
      case 'create':
      case 'add':
        return 'write';
      case 'put':
      case 'patch':
      case 'update':
      case 'edit':
        return 'write';
      case 'delete':
      case 'remove':
        return 'delete';
      default:
        return action.toLowerCase();
    }
  }

  /**
   * Get user permissions from role
   */
  static async getUserPermissions(userId: string, role: string, companyId: string): Promise<string[]> {
    try {
      const roleDefinition = await this.getRole(role, companyId);
      if (!roleDefinition) {
        logger.warn('Role not found', { userId, role, companyId });
        return [];
      }

      return roleDefinition.permissions;
    } catch (error) {
      logger.error('Error fetching user permissions', { userId, role, companyId, error });
      return [];
    }
  }

  /**
   * Validate single user per company constraint (MVP requirement)
   */
  static async validateSingleUserPerCompany(companyId: string, excludeUserId?: string): Promise<boolean> {
    try {
      // Query users in the company using GSI2
      const users = await db.query(
        'GSI2PK = :pk',
        {
          ':pk': `COMPANY#${companyId}#USERS`
        },
        {
          indexName: 'GSI2'
        }
      );

      // Filter out the excluded user if provided
      const activeUsers = users.filter((user: any) =>
        user.status === 'active' &&
        (!excludeUserId || user.id !== excludeUserId)
      ) || [];

      // For MVP, only allow one active user per company
      return activeUsers.length === 0;
    } catch (error) {
      logger.error('Error validating single user per company', { companyId, excludeUserId, error });
      return false;
    }
  }

  /**
   * Get all system roles (for UI display)
   */
  static getSystemRoles(): Role[] {
    return Object.values(this.SYSTEM_ROLES);
  }

  /**
   * Get all system permissions (for UI display)
   */
  static getSystemPermissions(): Permission[] {
    return Object.values(this.SYSTEM_PERMISSIONS);
  }

  /**
   * Authenticate and authorize a user for a specific action
   * @param event - API Gateway event containing JWT token
   * @param requiredPermission - Permission required for the action
   * @param context - Additional context for authorization
   */
  static async authenticateAndAuthorize(
    event: any,
    requiredPermission: string,
    context?: { assessmentId?: string; companyId?: string }
  ): Promise<{
    success: boolean;
    user?: JWTPayload;
    message: string;
  }> {
    try {
      // Extract JWT token from Authorization header
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      if (!authHeader) {
        return {
          success: false,
          message: 'Missing authorization header'
        };
      }

      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        return {
          success: false,
          message: 'Missing JWT token'
        };
      }

      // For now, return a mock user - this should be replaced with actual JWT verification
      const mockUser: JWTPayload = {
        sub: 'test-user-id',
        email: 'test@example.com',
        role: 'admin',
        companyId: context?.companyId || 'test-company-id',
        permissions: ['assessments:read', 'assessments:write', 'assessments:update'],
        emailVerified: true,
        iat: Date.now(),
        exp: Date.now() + 3600000,
        jti: 'test-jwt-id'
      };

      // Check if user has the required permission
      if (!this.hasPermission(mockUser, requiredPermission)) {
        return {
          success: false,
          message: `Insufficient permissions. Required: ${requiredPermission}`
        };
      }

      return {
        success: true,
        user: mockUser,
        message: 'Authorization successful'
      };
    } catch (error) {
      logger.error('Authorization error', { error });
      return {
        success: false,
        message: 'Authorization failed'
      };
    }
  }
}

export const authorizationService = AuthorizationService;
export const authorization = AuthorizationService;