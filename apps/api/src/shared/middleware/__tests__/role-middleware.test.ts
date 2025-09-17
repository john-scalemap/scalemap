import { JWTPayload } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

import { authorizationService } from '../../../services/authorization';
import { AuthenticatedEvent } from '../auth-middleware';
import { withRoles, withAdminRole, withCompanyAccess } from '../role-middleware';

// Mock dependencies
jest.mock('../../../services/authorization');
jest.mock('../../../utils/logger', () => ({
  logger: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }))
  }
}));
jest.mock('../../../utils/monitoring');

const mockAuthorizationService = authorizationService as jest.Mocked<typeof authorizationService>;

describe('Role Middleware', () => {
  const mockUser: JWTPayload = {
    sub: 'user-123',
    email: 'admin@company.com',
    companyId: 'company-123',
    role: 'admin',
    permissions: [
      'company:read',
      'company:write',
      'assessments:read',
      'assessments:write'
    ],
    emailVerified: true,
    iat: Date.now(),
    exp: Date.now() + 3600,
    jti: 'jwt-123'
  };

  const mockEvent: AuthenticatedEvent = {
    httpMethod: 'GET',
    path: '/api/test',
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      requestId: 'test-request-id'
    } as any,
    resource: '',
    body: null,
    isBase64Encoded: false,
    user: mockUser
  };

  const mockHandler = jest.fn().mockResolvedValue({
    statusCode: 200,
    body: JSON.stringify({ success: true })
  } as APIGatewayProxyResult);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withRoles', () => {
    it('should allow access with correct role', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(true);
      mockAuthorizationService.hasPermission.mockReturnValue(true);
      mockAuthorizationService.canAccessResource.mockReturnValue(true);

      const protectedHandler = withRoles(mockHandler, {
        resource: 'company',
        action: 'read',
        allowedRoles: ['admin']
      });

      const result = await protectedHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should deny access with incorrect role', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(false);

      const protectedHandler = withRoles(mockHandler, {
        resource: 'company',
        action: 'read',
        allowedRoles: ['viewer']
      });

      const result = await protectedHandler(mockEvent);

      expect(result.statusCode).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should deny access without required permissions', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(true);
      mockAuthorizationService.hasPermission
        .mockReturnValueOnce(false); // Missing first permission

      const protectedHandler = withRoles(mockHandler, {
        resource: 'billing',
        action: 'write',
        requiredPermissions: ['billing:write']
      });

      const result = await protectedHandler(mockEvent);

      expect(result.statusCode).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should deny access when resource access is denied', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(true);
      mockAuthorizationService.hasPermission.mockReturnValue(true);
      mockAuthorizationService.canAccessResource.mockReturnValue(false);

      const protectedHandler = withRoles(mockHandler, {
        resource: 'company',
        action: 'read',
        resourceIdFromEvent: () => 'other-company'
      });

      const result = await protectedHandler(mockEvent);

      expect(result.statusCode).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should enforce single user per company constraint for user creation', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(true);
      mockAuthorizationService.hasPermission.mockReturnValue(true);
      mockAuthorizationService.canAccessResource.mockReturnValue(true);
      mockAuthorizationService.validateSingleUserPerCompany.mockResolvedValue(false);

      const protectedHandler = withRoles(mockHandler, {
        resource: 'users',
        action: 'create'
      });

      const result = await protectedHandler(mockEvent);

      expect(result.statusCode).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('maximum number of users for MVP');
    });

    it('should allow user creation when single user constraint is satisfied', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(true);
      mockAuthorizationService.hasPermission.mockReturnValue(true);
      mockAuthorizationService.canAccessResource.mockReturnValue(true);
      mockAuthorizationService.validateSingleUserPerCompany.mockResolvedValue(true);

      const protectedHandler = withRoles(mockHandler, {
        resource: 'users',
        action: 'create'
      });

      const result = await protectedHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should handle resource ID extraction from event', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(true);
      mockAuthorizationService.hasPermission.mockReturnValue(true);
      mockAuthorizationService.canAccessResource.mockReturnValue(true);

      const eventWithParams = {
        ...mockEvent,
        pathParameters: { companyId: 'company-123' }
      };

      const protectedHandler = withRoles(mockHandler, {
        resource: 'company',
        action: 'read',
        resourceIdFromEvent: (event) => event.pathParameters?.companyId
      });

      await protectedHandler(eventWithParams);

      expect(mockAuthorizationService.canAccessResource).toHaveBeenCalledWith(
        mockUser,
        'company',
        'read',
        'company-123'
      );
    });

    it('should return 500 on unexpected error', async () => {
      mockAuthorizationService.hasAnyRole.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const protectedHandler = withRoles(mockHandler, {
        resource: 'company',
        action: 'read'
      });

      const result = await protectedHandler(mockEvent);

      expect(result.statusCode).toBe(500);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('withAdminRole', () => {
    it('should only allow admin users', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(true);
      mockAuthorizationService.canAccessResource.mockReturnValue(true);

      const adminHandler = withAdminRole(mockHandler, 'users', 'write');

      await adminHandler(mockEvent);

      expect(mockAuthorizationService.hasAnyRole).toHaveBeenCalledWith(
        mockUser,
        ['admin']
      );
    });

    it('should deny non-admin users', async () => {
      const userWithViewerRole = {
        ...mockUser,
        role: 'viewer'
      };

      const eventWithViewer = {
        ...mockEvent,
        user: userWithViewerRole
      };

      mockAuthorizationService.hasAnyRole.mockReturnValue(false);

      const adminHandler = withAdminRole(mockHandler, 'users', 'write');

      const result = await adminHandler(eventWithViewer);

      expect(result.statusCode).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('withCompanyAccess', () => {
    it('should allow company access for admin', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(true);
      mockAuthorizationService.hasPermission.mockReturnValue(true);
      mockAuthorizationService.canAccessResource.mockReturnValue(true);

      const companyHandler = withCompanyAccess(mockHandler, 'read');

      await companyHandler(mockEvent);

      expect(mockAuthorizationService.hasAnyRole).toHaveBeenCalledWith(
        mockUser,
        ['admin', 'user', 'viewer']
      );
      expect(mockAuthorizationService.hasPermission).toHaveBeenCalledWith(
        mockUser,
        'company:read'
      );
    });

    it('should enforce admin-only for write operations when specified', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(true);
      mockAuthorizationService.hasPermission.mockReturnValue(true);
      mockAuthorizationService.canAccessResource.mockReturnValue(true);

      const adminOnlyHandler = withCompanyAccess(mockHandler, 'write', true);

      await adminOnlyHandler(mockEvent);

      expect(mockAuthorizationService.hasAnyRole).toHaveBeenCalledWith(
        mockUser,
        ['admin']
      );
      expect(mockAuthorizationService.hasPermission).toHaveBeenCalledWith(
        mockUser,
        'company:write'
      );
    });

    it('should use company ID from user token for resource validation', async () => {
      mockAuthorizationService.hasAnyRole.mockReturnValue(true);
      mockAuthorizationService.hasPermission.mockReturnValue(true);
      mockAuthorizationService.canAccessResource.mockReturnValue(true);

      const companyHandler = withCompanyAccess(mockHandler, 'read');

      await companyHandler(mockEvent);

      expect(mockAuthorizationService.canAccessResource).toHaveBeenCalledWith(
        mockUser,
        'company',
        'read',
        'company-123'
      );
    });
  });
});