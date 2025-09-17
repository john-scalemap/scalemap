import { JWTPayload } from '@scalemap/shared';

import { AuthorizationService } from '../authorization';
import { db } from '../database';

// Mock database
jest.mock('../database');
const mockDb = db as jest.Mocked<typeof db>;

describe('AuthorizationService', () => {
  const mockUser: JWTPayload = {
    sub: 'user-123',
    email: 'test@company.com',
    companyId: 'company-123',
    role: 'admin',
    permissions: [
      'company:read',
      'company:write',
      'assessments:read',
      'assessments:write',
      'users:read',
      'users:write'
    ],
    emailVerified: true,
    iat: Date.now(),
    exp: Date.now() + 3600,
    jti: 'jwt-123'
  };

  const mockViewerUser: JWTPayload = {
    ...mockUser,
    sub: 'user-456',
    role: 'viewer',
    permissions: [
      'company:read',
      'assessments:read',
      'agents:read',
      'analytics:read'
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRole', () => {
    it('should return system role for admin', async () => {
      const role = await AuthorizationService.getRole('admin');

      expect(role).toBeDefined();
      expect(role?.id).toBe('admin');
      expect(role?.name).toBe('Administrator');
      expect(role?.isSystem).toBe(true);
    });

    it('should return null for non-existent role', async () => {
      const role = await AuthorizationService.getRole('invalid-role');

      expect(role).toBeNull();
    });

    it('should check custom company roles', async () => {
      const customRole = {
        id: 'custom-role',
        name: 'Custom Role',
        description: 'Custom company role',
        permissions: ['assessments:read'],
        isSystem: false,
        companyId: 'company-123'
      };

      mockDb.get.mockResolvedValueOnce(customRole);

      const role = await AuthorizationService.getRole('custom-role', 'company-123');

      expect(role).toEqual(customRole);
      expect(mockDb.get).toHaveBeenCalledWith('COMPANY#company-123', 'ROLE#custom-role');
    });
  });

  describe('getPermission', () => {
    it('should return system permission', () => {
      const permission = AuthorizationService.getPermission('company:read');

      expect(permission).toBeDefined();
      expect(permission?.id).toBe('company:read');
      expect(permission?.resource).toBe('company');
      expect(permission?.actions).toContain('read');
    });

    it('should return null for invalid permission', () => {
      const permission = AuthorizationService.getPermission('invalid:permission');

      expect(permission).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should return true for user with permission', () => {
      const hasPermission = AuthorizationService.hasPermission(mockUser, 'company:read');

      expect(hasPermission).toBe(true);
    });

    it('should return false for user without permission', () => {
      const hasPermission = AuthorizationService.hasPermission(mockUser, 'billing:write');

      expect(hasPermission).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', () => {
      const hasRole = AuthorizationService.hasRole(mockUser, 'admin');

      expect(hasRole).toBe(true);
    });

    it('should return false for non-matching role', () => {
      const hasRole = AuthorizationService.hasRole(mockUser, 'viewer');

      expect(hasRole).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('should return true if user has one of the required roles', () => {
      const hasAnyRole = AuthorizationService.hasAnyRole(mockUser, ['admin', 'user']);

      expect(hasAnyRole).toBe(true);
    });

    it('should return false if user has none of the required roles', () => {
      const hasAnyRole = AuthorizationService.hasAnyRole(mockUser, ['viewer', 'user']);

      expect(hasAnyRole).toBe(false);
    });
  });

  describe('canAccessResource', () => {
    it('should allow admin to access company resource', () => {
      const canAccess = AuthorizationService.canAccessResource(
        mockUser,
        'company',
        'read',
        'company-123'
      );

      expect(canAccess).toBe(true);
    });

    it('should deny access to different company resource', () => {
      const canAccess = AuthorizationService.canAccessResource(
        mockUser,
        'company',
        'read',
        'other-company'
      );

      expect(canAccess).toBe(false);
    });

    it('should deny access without required permission', () => {
      const canAccess = AuthorizationService.canAccessResource(
        mockViewerUser,
        'company',
        'write'
      );

      expect(canAccess).toBe(false);
    });

    it('should allow access without resource ID if user has permission', () => {
      const canAccess = AuthorizationService.canAccessResource(
        mockUser,
        'assessments',
        'read'
      );

      expect(canAccess).toBe(true);
    });
  });

  describe('getUserPermissions', () => {
    it('should return admin role permissions', async () => {
      const permissions = await AuthorizationService.getUserPermissions(
        'user-123',
        'admin',
        'company-123'
      );

      expect(permissions).toContain('company:read');
      expect(permissions).toContain('company:write');
      expect(permissions).toContain('users:read');
    });

    it('should return viewer role permissions', async () => {
      const permissions = await AuthorizationService.getUserPermissions(
        'user-456',
        'viewer',
        'company-123'
      );

      expect(permissions).toContain('company:read');
      expect(permissions).toContain('assessments:read');
      expect(permissions).not.toContain('company:write');
    });

    it('should return empty array for invalid role', async () => {
      const permissions = await AuthorizationService.getUserPermissions(
        'user-123',
        'invalid-role',
        'company-123'
      );

      expect(permissions).toEqual([]);
    });
  });

  describe('validateSingleUserPerCompany', () => {
    it('should allow adding user to empty company', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const canAdd = await AuthorizationService.validateSingleUserPerCompany('company-123');

      expect(canAdd).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith({
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'COMPANY#company-123#USERS'
        }
      });
    });

    it('should deny adding user to company with active user', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 'existing-user',
          status: 'active'
        }
      ]);

      const canAdd = await AuthorizationService.validateSingleUserPerCompany('company-123');

      expect(canAdd).toBe(false);
    });

    it('should allow if only excluded user exists', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 'user-to-exclude',
          status: 'active'
        }
      ]);

      const canAdd = await AuthorizationService.validateSingleUserPerCompany(
        'company-123',
        'user-to-exclude'
      );

      expect(canAdd).toBe(true);
    });

    it('should ignore inactive users', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 'inactive-user',
          status: 'inactive'
        },
        {
          id: 'pending-user',
          status: 'pending'
        }
      ]);

      const canAdd = await AuthorizationService.validateSingleUserPerCompany('company-123');

      expect(canAdd).toBe(true);
    });
  });

  describe('mapActionToPermissionSuffix', () => {
    it('should map read actions correctly', () => {
      // Test private method through public interface
      const canRead = AuthorizationService.canAccessResource(
        mockUser,
        'company',
        'get'
      );
      expect(canRead).toBe(true); // Should map 'get' to 'read' permission
    });

    it('should map write actions correctly', () => {
      const canUpdate = AuthorizationService.canAccessResource(
        mockUser,
        'company',
        'put'
      );
      expect(canUpdate).toBe(true); // Should map 'put' to 'write' permission
    });
  });

  describe('getSystemRoles', () => {
    it('should return all system roles', () => {
      const roles = AuthorizationService.getSystemRoles();

      expect(roles).toHaveLength(3);
      expect(roles.map(r => r.id)).toContain('admin');
      expect(roles.map(r => r.id)).toContain('user');
      expect(roles.map(r => r.id)).toContain('viewer');
    });
  });

  describe('getSystemPermissions', () => {
    it('should return all system permissions', () => {
      const permissions = AuthorizationService.getSystemPermissions();

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.map(p => p.id)).toContain('company:read');
      expect(permissions.map(p => p.id)).toContain('assessments:write');
    });
  });
});