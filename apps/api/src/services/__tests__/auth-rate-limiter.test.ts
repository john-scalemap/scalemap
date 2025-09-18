import { APIGatewayProxyEvent } from 'aws-lambda';

import { AuthRateLimiter, authRateLimiters } from '../auth-rate-limiter';
import { db } from '../database';

// Mock the database service
jest.mock('../database', () => ({
  db: {
    get: jest.fn().mockResolvedValue(null),
    put: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock logger and monitoring
jest.mock('../../utils/logger', () => ({
  logger: {
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    })),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../utils/monitoring', () => ({
  Monitoring: {
    incrementCounter: jest.fn(),
    recordError: jest.fn()
  }
}));

const mockDb = db as jest.Mocked<typeof db>;

describe('AuthRateLimiter', () => {
  let rateLimiter: AuthRateLimiter;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    rateLimiter = new AuthRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      blockDurationMs: 15 * 60 * 1000, // 15 minutes
      keyPrefix: 'TEST_RATE_LIMIT'
    });

    mockEvent = {
      body: null,
      headers: {
        'User-Agent': 'test-agent'
      },
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/auth/login',
      pathParameters: null,
      queryStringParameters: null,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: 'test',
        apiId: 'test',
        authorizer: null,
        protocol: 'HTTP/1.1',
        httpMethod: 'POST',
        path: '/auth/login',
        stage: 'test',
        requestId: 'test-request-id',
        requestTime: '2023-01-01T00:00:00.000Z',
        requestTimeEpoch: 1672531200000,
        resourceId: 'test',
        resourcePath: '/auth/login',
        identity: {
          accessKey: null,
          accountId: null,
          apiKey: null,
          apiKeyId: null,
          caller: null,
          clientCert: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          sourceIp: '192.168.1.1',
          user: null,
          userAgent: 'test-agent',
          userArn: null
        }
      },
      resource: '/auth/login'
    };

    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow request when no previous attempts', async () => {
      mockDb.get.mockResolvedValue(null);
      mockDb.put.mockResolvedValue(undefined);

      const result = await rateLimiter.checkRateLimit(mockEvent);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1
      expect(result.result).toBeUndefined();
      expect(mockDb.put).toHaveBeenCalled();
    });

    it('should increment counter for subsequent requests', async () => {
      const existingEntry = {
        PK: 'TEST_RATE_LIMIT#192.168.1.1:test-hash',
        SK: 'RATE_LIMIT',
        count: 2,
        windowStart: new Date().toISOString(),
        blocked: false,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        TTL: Math.floor((Date.now() + 15 * 60 * 1000) / 1000)
      };

      mockDb.get.mockResolvedValue(existingEntry);
      (mockDb.update as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await rateLimiter.checkRateLimit(mockEvent);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // 5 - (2 + 1)
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.any(String),
        'RATE_LIMIT',
        'ADD #count :increment SET updatedAt = :updatedAt',
        {
          ':increment': 1,
          ':updatedAt': expect.any(String)
        },
        { '#count': 'count' }
      );
    });

    it('should block when limit exceeded', async () => {
      const existingEntry = {
        PK: 'TEST_RATE_LIMIT#192.168.1.1:test-hash',
        SK: 'RATE_LIMIT',
        count: 5, // At the limit
        windowStart: new Date().toISOString(),
        blocked: false,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        TTL: Math.floor((Date.now() + 15 * 60 * 1000) / 1000)
      };

      mockDb.get.mockResolvedValue(existingEntry);
      (mockDb.update as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await rateLimiter.checkRateLimit(mockEvent);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.result).toBeDefined();
      expect(result.result!.statusCode).toBe(429);

      // Should block the client
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.any(String),
        'RATE_LIMIT',
        'SET blocked = :blocked, expiresAt = :expiresAt, #ttl = :ttl, updatedAt = :updatedAt',
        expect.objectContaining({
          ':blocked': true,
          ':expiresAt': expect.any(String),
          ':ttl': expect.any(Number),
          ':updatedAt': expect.any(String)
        }),
        { '#ttl': 'TTL' }
      );
    });

    it('should continue blocking when client is already blocked', async () => {
      const blockedEntry = {
        PK: 'TEST_RATE_LIMIT#192.168.1.1:test-hash',
        SK: 'RATE_LIMIT',
        count: 6,
        windowStart: new Date().toISOString(),
        blocked: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // Block expires in 10 minutes
        TTL: Math.floor((Date.now() + 10 * 60 * 1000) / 1000)
      };

      mockDb.get.mockResolvedValue(blockedEntry);

      const result = await rateLimiter.checkRateLimit(mockEvent);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.result).toBeDefined();
      expect(result.result!.statusCode).toBe(429);
    });

    it('should reset window after time expires', async () => {
      const oldEntry = {
        PK: 'TEST_RATE_LIMIT#192.168.1.1:test-hash',
        SK: 'RATE_LIMIT',
        count: 5,
        windowStart: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 minutes ago
        blocked: false,
        expiresAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Expired 5 minutes ago
        TTL: Math.floor((Date.now() - 5 * 60 * 1000) / 1000)
      };

      mockDb.get.mockResolvedValue(oldEntry);
      mockDb.put.mockResolvedValue(undefined);

      const result = await rateLimiter.checkRateLimit(mockEvent);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // Should be reset
      expect(mockDb.put).toHaveBeenCalled(); // Should create new entry
    });

    it('should handle database errors gracefully', async () => {
      mockDb.get.mockRejectedValue(new Error('Database error'));

      const result = await rateLimiter.checkRateLimit(mockEvent);

      // Should allow request on error
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should generate proper rate limit response headers', async () => {
      const existingEntry = {
        PK: 'TEST_RATE_LIMIT#192.168.1.1:test-hash',
        SK: 'RATE_LIMIT',
        count: 5,
        windowStart: new Date().toISOString(),
        blocked: false,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        TTL: Math.floor((Date.now() + 15 * 60 * 1000) / 1000)
      };

      mockDb.get.mockResolvedValue(existingEntry);
      (mockDb.update as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await rateLimiter.checkRateLimit(mockEvent);

      expect(result.result).toBeDefined();
      const response = result.result!;

      expect(response.headers).toMatchObject({
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '0',
        'Retry-After': expect.any(String),
        'Access-Control-Allow-Origin': '*',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      });

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: expect.stringContaining('Too many requests')
        },
        meta: {
          timestamp: expect.any(String),
          retryAfter: expect.any(Number),
          resetTime: expect.any(Number)
        }
      });
    });
  });

  describe('Pre-configured rate limiters', () => {
    it('should have correct configuration for login rate limiter', () => {
      const config = (authRateLimiters.login as any).config;

      expect(config.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(config.max).toBe(5);
      expect(config.blockDurationMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(config.keyPrefix).toBe('AUTH_LOGIN');
    });

    it('should have correct configuration for register rate limiter', () => {
      const config = (authRateLimiters.register as any).config;

      expect(config.windowMs).toBe(10 * 60 * 1000); // 10 minutes
      expect(config.max).toBe(3);
      expect(config.blockDurationMs).toBe(30 * 60 * 1000); // 30 minutes
      expect(config.keyPrefix).toBe('AUTH_REGISTER');
    });

    it('should have correct configuration for password reset rate limiter', () => {
      const config = (authRateLimiters.passwordReset as any).config;

      expect(config.windowMs).toBe(60 * 60 * 1000); // 1 hour
      expect(config.max).toBe(3);
      expect(config.blockDurationMs).toBe(60 * 60 * 1000); // 1 hour
      expect(config.keyPrefix).toBe('AUTH_PASSWORD_RESET');
    });
  });

  describe('Client identification', () => {
    it('should generate consistent identifier for same IP and User-Agent', async () => {
      mockDb.get.mockResolvedValue(null);
      mockDb.put.mockResolvedValue(undefined);

      const result1 = await rateLimiter.checkRateLimit(mockEvent);
      const result2 = await rateLimiter.checkRateLimit(mockEvent);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);

      // Should use the same key for both requests
      expect(mockDb.get).toHaveBeenCalledTimes(2);
      const firstCallKey = (mockDb.get as jest.Mock).mock.calls[0][0];
      const secondCallKey = (mockDb.get as jest.Mock).mock.calls[1][0];
      expect(firstCallKey).toBe(secondCallKey);
    });

    it('should generate different identifiers for different IPs', async () => {
      mockDb.get.mockResolvedValue(null);
      mockDb.put.mockResolvedValue(undefined);

      const event1 = { ...mockEvent };
      const event2 = {
        ...mockEvent,
        requestContext: {
          ...mockEvent.requestContext,
          identity: {
            ...mockEvent.requestContext.identity,
            sourceIp: '192.168.1.2' // Different IP
          }
        }
      };

      await rateLimiter.checkRateLimit(event1);
      await rateLimiter.checkRateLimit(event2);

      const firstCallKey = (mockDb.get as jest.Mock).mock.calls[0][0];
      const secondCallKey = (mockDb.get as jest.Mock).mock.calls[1][0];
      expect(firstCallKey).not.toBe(secondCallKey);
    });
  });
});