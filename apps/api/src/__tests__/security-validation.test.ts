import { APIGatewayProxyResult } from 'aws-lambda';

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

describe('Security Validation Tests', () => {
  const mockHandler = jest.fn().mockResolvedValue({
    statusCode: 200,
    body: JSON.stringify({ success: true })
  } as APIGatewayProxyResult);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTPS and Security Headers', () => {
    it('should include proper CORS headers in unauthorized response', async () => {
      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: {}, // No Authorization header
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      expect(result.headers).toEqual({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'WWW-Authenticate': 'Bearer realm="scalemap-api"'
      });
    });

    it('should include proper CORS headers in forbidden response', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        sub: 'user-123',
        email: 'user@company.com',
        companyId: 'company-123',
        role: 'viewer',
        permissions: ['company:read'],
        emailVerified: true,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-123'
      });
      mockDb.get.mockResolvedValue({
        status: 'active'
      });
      mockDb.update.mockResolvedValue({});

      const protectedHandler = withAuth(
        withRoles(mockHandler, {
          resource: 'users',
          action: 'write',
          allowedRoles: ['admin']
        })
      );

      const event = {
        httpMethod: 'POST',
        path: '/api/users',
        headers: { Authorization: 'Bearer valid-token' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(403);
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      });
    });
  });

  describe('Token Security', () => {
    it('should handle malformed Authorization header', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue(null);

      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: { Authorization: 'InvalidFormat' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      expect(mockJwtService.extractTokenFromHeader).toHaveBeenCalledWith('InvalidFormat');
    });

    it('should handle expired tokens', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('expired-token');
      mockJwtService.validateAccessToken.mockRejectedValue(new Error('Token expired'));

      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: { Authorization: 'Bearer expired-token' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Invalid or expired authentication token');
    });

    it('should handle tampered tokens', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('tampered-token');
      mockJwtService.validateAccessToken.mockRejectedValue(new Error('Invalid signature'));

      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: { Authorization: 'Bearer tampered-token' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
    });

    it('should handle case-insensitive Authorization header', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        sub: 'user-123',
        email: 'user@company.com',
        companyId: 'company-123',
        role: 'admin',
        permissions: ['company:read'],
        emailVerified: true,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-123'
      });
      mockDb.get.mockResolvedValue({ status: 'active' });
      mockDb.update.mockResolvedValue({});

      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: { authorization: 'Bearer valid-token' }, // lowercase
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockJwtService.extractTokenFromHeader).toHaveBeenCalledWith('Bearer valid-token');
    });
  });

  describe('User Account Security', () => {
    it('should deny access for suspended accounts', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        sub: 'user-123',
        email: 'user@company.com',
        companyId: 'company-123',
        role: 'admin',
        permissions: ['company:read'],
        emailVerified: true,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-123'
      });
      mockDb.get.mockResolvedValue({ status: 'suspended' });

      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: { Authorization: 'Bearer valid-token' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('User account is not active');
    });

    it('should deny access for inactive accounts', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        sub: 'user-123',
        email: 'user@company.com',
        companyId: 'company-123',
        role: 'admin',
        permissions: ['company:read'],
        emailVerified: true,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-123'
      });
      mockDb.get.mockResolvedValue({ status: 'inactive' });

      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: { Authorization: 'Bearer valid-token' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('User account is not active');
    });

    it('should handle deleted user accounts', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        sub: 'deleted-user',
        email: 'deleted@company.com',
        companyId: 'company-123',
        role: 'admin',
        permissions: ['company:read'],
        emailVerified: true,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-123'
      });
      mockDb.get.mockResolvedValue(null); // User not found

      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: { Authorization: 'Bearer valid-token' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('User account not found');
    });
  });

  describe('Cross-Company Access Prevention', () => {
    it('should prevent access to different company resources', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        sub: 'user-123',
        email: 'user@company.com',
        companyId: 'company-123',
        role: 'admin',
        permissions: ['company:read'],
        emailVerified: true,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-123'
      });
      mockDb.get.mockResolvedValue({ status: 'active' });
      mockDb.update.mockResolvedValue({});

      const protectedHandler = withAuth(
        withRoles(mockHandler, {
          resource: 'company',
          action: 'read',
          resourceIdFromEvent: () => 'different-company-456'
        })
      );

      const event = {
        httpMethod: 'GET',
        path: '/api/company/different-company-456',
        headers: { Authorization: 'Bearer valid-token' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: { companyId: 'different-company-456' },
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Access denied to resource');
    });

    it('should allow access to own company resources', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        sub: 'user-123',
        email: 'user@company.com',
        companyId: 'company-123',
        role: 'admin',
        permissions: ['company:read'],
        emailVerified: true,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-123'
      });
      mockDb.get.mockResolvedValue({ status: 'active' });
      mockDb.update.mockResolvedValue({});

      const protectedHandler = withAuth(
        withRoles(mockHandler, {
          resource: 'company',
          action: 'read',
          resourceIdFromEvent: () => 'company-123'
        })
      );

      const event = {
        httpMethod: 'GET',
        path: '/api/company/company-123',
        headers: { Authorization: 'Bearer valid-token' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: { companyId: 'company-123' },
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('Error Information Disclosure Prevention', () => {
    it('should not leak sensitive information in error messages', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockRejectedValue(
        new Error('Detailed JWT error: secret key mismatch in signature validation')
      );

      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: { Authorization: 'Bearer valid-token' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Invalid or expired authentication token');
      expect(body.error.message).not.toContain('secret key');
      expect(body.error.message).not.toContain('signature validation');
    });

    it('should include request ID for debugging while hiding sensitive details', async () => {
      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: {}, // No authorization
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'debug-request-123' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.meta.requestId).toBe('debug-request-123');
      expect(body.meta.timestamp).toBeDefined();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).not.toContain('debug');
      expect(body.error.message).not.toContain('internal');
    });
  });

  describe('Rate Limiting Compliance', () => {
    it('should handle database connection failures gracefully', async () => {
      mockJwtService.extractTokenFromHeader.mockReturnValue('valid-token');
      mockJwtService.validateAccessToken.mockResolvedValue({
        sub: 'user-123',
        email: 'user@company.com',
        companyId: 'company-123',
        role: 'admin',
        permissions: ['company:read'],
        emailVerified: true,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-123'
      });
      mockDb.get.mockRejectedValue(new Error('Database connection timeout'));

      const protectedHandler = withAuth(mockHandler);

      const event = {
        httpMethod: 'GET',
        path: '/api/test',
        headers: { Authorization: 'Bearer valid-token' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: { requestId: 'test-request' } as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await protectedHandler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('Authentication error');
    });
  });
});