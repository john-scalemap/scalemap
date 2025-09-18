import { JWTPayload } from '@scalemap/shared';
import { APIGatewayProxyEvent } from 'aws-lambda';

import { db } from '../services/database';
import { jwtService } from '../services/jwt';
import { withAuth } from '../shared/middleware/auth-middleware';
import { withRoles } from '../shared/middleware/role-middleware';

// Mock dependencies
jest.mock('../services/database');
jest.mock('../services/jwt');
jest.mock('../utils/logger');
jest.mock('../utils/monitoring');

const mockDb = db as jest.Mocked<typeof db>;
const mockJwtService = jwtService as jest.Mocked<typeof jwtService>;

describe('Authentication and Authorization Integration', () => {
  const mockUserRecord = {
    id: 'user-123',
    email: 'admin@company.com',
    firstName: 'Admin',
    lastName: 'User',
    companyId: 'company-123',
    role: 'admin',
    status: 'active',
    emailVerified: true
  };

  const mockJwtPayload: JWTPayload = {
    sub: 'user-123',
    email: 'admin@company.com',
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

  const createMockEvent = (token?: string): APIGatewayProxyEvent => ({
    httpMethod: 'GET',
    path: '/api/test',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    isBase64Encoded: false
  });

  const mockHandler = jest.fn().mockResolvedValue({
    statusCode: 200,
    body: JSON.stringify({ success: true })
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Authentication Flow', () => {
    it('should successfully authenticate and authorize admin user', async () => {
      // Setup mocks for successful authentication
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue(mockJwtPayload);
      mockDb.get.mockResolvedValue(mockUserRecord);
      mockDb.update.mockResolvedValue({});

      // Create protected endpoint with auth and role middleware
      const protectedHandler = withAuth(
        withRoles(mockHandler, {
          resource: 'company',
          action: 'write',
          allowedRoles: ['admin'],
          requiredPermissions: ['company:write']
        }),
        {
          requireEmailVerification: true,
          allowedRoles: ['admin']
        }
      );

      const event = createMockEvent('valid-token');
      const result = await protectedHandler(event);

      // Verify successful flow
      expect(result.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalled();

      // Verify authentication steps
      expect(mockJwtService.extractTokenFromHeader).toHaveBeenCalledWith('Bearer valid-token');
      expect(mockJwtService.validateAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockDb.get).toHaveBeenCalledWith('USER#user-123', 'METADATA');

      // Verify user last login update
      expect(mockDb.update).toHaveBeenCalledWith(
        'USER#user-123',
        'METADATA',
        'SET lastLoginAt = :lastLogin',
        expect.objectContaining({
          ':lastLogin': expect.any(String)
        })
      );
    });

    it('should fail authentication with missing token', async () => {
      // Setup mock for no token case
      mockJwtService.extractTokenFromHeader.mockReturnValue(null);

      const protectedHandler = withAuth(mockHandler);

      const event = createMockEvent(); // No token
      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication token is required');
    });

    it('should fail authentication with invalid token', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('invalid-token');
      mockJwtService.validateAccessToken.mockRejectedValue(new Error('Invalid token'));

      const protectedHandler = withAuth(mockHandler);

      const event = createMockEvent('invalid-token');
      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Invalid or expired authentication token');
    });

    it('should fail authentication with inactive user', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue(mockJwtPayload);
      mockDb.get.mockResolvedValue({
        ...mockUserRecord,
        status: 'suspended'
      });

      const protectedHandler = withAuth(mockHandler);

      const event = createMockEvent('valid-token');
      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('User account is not active');
    });

    it('should fail authorization with insufficient role', async () => {
      // Setup successful authentication but insufficient role
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        ...mockJwtPayload,
        role: 'viewer',
        permissions: ['company:read', 'assessments:read']
      });
      mockDb.get.mockResolvedValue({
        ...mockUserRecord,
        role: 'viewer'
      });
      mockDb.update.mockResolvedValue({});

      const protectedHandler = withAuth(
        withRoles(mockHandler, {
          resource: 'users',
          action: 'write',
          allowedRoles: ['admin']
        })
      );

      const event = createMockEvent('valid-token');
      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should fail authorization with missing permissions', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        ...mockJwtPayload,
        permissions: ['company:read'] // Missing company:write
      });
      mockDb.get.mockResolvedValue(mockUserRecord);
      mockDb.update.mockResolvedValue({});

      const protectedHandler = withAuth(
        withRoles(mockHandler, {
          resource: 'company',
          action: 'write',
          requiredPermissions: ['company:write']
        })
      );

      const event = createMockEvent('valid-token');
      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should enforce email verification requirement', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        ...mockJwtPayload,
        emailVerified: false
      });
      mockDb.get.mockResolvedValue(mockUserRecord);

      const protectedHandler = withAuth(mockHandler, {
        requireEmailVerification: true
      });

      const event = createMockEvent('valid-token');
      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Email verification is required');
    });

    it('should handle company resource access control', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue(mockJwtPayload);
      mockDb.get.mockResolvedValue(mockUserRecord);
      mockDb.update.mockResolvedValue({});

      const protectedHandler = withAuth(
        withRoles(mockHandler, {
          resource: 'company',
          action: 'read',
          resourceIdFromEvent: (event) => event.pathParameters?.companyId
        })
      );

      // Test with matching company ID
      const eventWithCompanyId = {
        ...createMockEvent('valid-token'),
        pathParameters: { companyId: 'company-123' }
      };

      const result = await protectedHandler(eventWithCompanyId);
      expect(result.statusCode).toBe(200);

      // Test with different company ID
      const eventWithDifferentCompany = {
        ...createMockEvent('valid-token'),
        pathParameters: { companyId: 'other-company' }
      };

      const result2 = await protectedHandler(eventWithDifferentCompany);
      expect(result2.statusCode).toBe(403);
    });

    it('should handle single user per company constraint', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue(mockJwtPayload);
      mockDb.get.mockResolvedValue(mockUserRecord);
      mockDb.update.mockResolvedValue({});

      // Mock existing active user in company
      mockDb.query.mockResolvedValue([{
        id: 'existing-user',
        status: 'active'
      }]);

      const protectedHandler = withAuth(
        withRoles(mockHandler, {
          resource: 'users',
          action: 'create'
        })
      );

      const event = createMockEvent('valid-token');
      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('maximum number of users for MVP');
    });

    it('should successfully handle middleware chain with multiple validations', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue(mockJwtPayload);
      mockDb.get.mockResolvedValue(mockUserRecord);
      mockDb.update.mockResolvedValue({});
      mockDb.query.mockResolvedValue([]); // No existing users

      // Complex middleware chain
      const complexHandler = withAuth(
        withRoles(mockHandler, {
          resource: 'users',
          action: 'create',
          allowedRoles: ['admin'],
          requiredPermissions: ['users:write'],
          resourceIdFromEvent: () => 'company-123'
        }),
        {
          requireEmailVerification: true,
          allowedRoles: ['admin']
        }
      );

      const event = createMockEvent('valid-token');
      const result = await complexHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalled();

      // Verify all middleware steps were executed
      expect(mockJwtService.validateAccessToken).toHaveBeenCalled();
      expect(mockDb.get).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.query).toHaveBeenCalled(); // Single user validation
    });
  });
});