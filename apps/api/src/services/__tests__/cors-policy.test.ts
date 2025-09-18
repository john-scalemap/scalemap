import { APIGatewayProxyEvent } from 'aws-lambda';

import { CorsPolicy, corsPolicy } from '../cors-policy';

describe('CorsPolicy', () => {
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    mockEvent = {
      body: null,
      headers: {
        origin: 'https://scalemap.ai'
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

    // Reset environment variable
    delete process.env.NODE_ENV;
    delete process.env.STAGE;
  });

  describe('Environment-specific configurations', () => {
    it('should use development config by default', () => {
      const policy = CorsPolicy.getInstance();
      const config = policy.getConfig();

      expect(config.allowedOrigins).toContain('http://localhost:3000');
      expect(config.allowCredentials).toBe(true);
    });

    it('should use staging config when NODE_ENV is staging', () => {
      process.env.NODE_ENV = 'staging';

      // Create new instance to pick up environment change
      const policy = new (CorsPolicy as any)();
      const config = policy.getConfig();

      expect(config.allowedOrigins).toContain('https://scalemap-staging.vercel.app');
      expect(config.maxAge).toBe(3600);
    });

    it('should use production config when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';

      const policy = new (CorsPolicy as any)();
      const config = policy.getConfig();

      expect(config.allowedOrigins).toContain('https://scalemap.ai');
      expect(config.allowedOrigins).toContain('https://www.scalemap.ai');
      expect(config.allowedOrigins).not.toContain('http://localhost:3000');
    });
  });

  describe('getCorsHeaders', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should return correct CORS headers for allowed origin', () => {
      const event = {
        ...mockEvent,
        headers: { origin: 'https://scalemap.ai' }
      };

      const policy = new (CorsPolicy as any)();
      const headers = policy.getCorsHeaders(event);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://scalemap.ai');
      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should return default origin for disallowed origin', () => {
      const event = {
        ...mockEvent,
        headers: { origin: 'https://malicious-site.com' }
      };

      const policy = new (CorsPolicy as any)();
      const headers = policy.getCorsHeaders(event);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://scalemap.ai');
    });

    it('should handle missing origin header', () => {
      const event = {
        ...mockEvent,
        headers: {}
      };

      const policy = new (CorsPolicy as any)();
      const headers = policy.getCorsHeaders(event);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://scalemap.ai');
    });
  });

  describe('getSecurityHeaders', () => {
    it('should return comprehensive security headers', () => {
      const headers = corsPolicy.getSecurityHeaders();

      expect(headers).toMatchObject({
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
      });
    });
  });

  describe('getAllHeaders', () => {
    it('should combine CORS and security headers', () => {
      const headers = corsPolicy.getAllHeaders(mockEvent);

      // Should include CORS headers
      expect(headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(headers['Access-Control-Allow-Methods']).toBeDefined();

      // Should include security headers
      expect(headers['Strict-Transport-Security']).toBeDefined();
      expect(headers['X-Content-Type-Options']).toBeDefined();

      // Should include standard headers
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    });
  });

  describe('isOriginAllowed', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should allow configured origins', () => {
      const policy = new (CorsPolicy as any)();

      expect(policy.isOriginAllowed('https://scalemap.ai')).toBe(true);
      expect(policy.isOriginAllowed('https://www.scalemap.ai')).toBe(true);
      expect(policy.isOriginAllowed('https://app.scalemap.ai')).toBe(true);
    });

    it('should reject non-configured origins', () => {
      const policy = new (CorsPolicy as any)();

      expect(policy.isOriginAllowed('https://malicious-site.com')).toBe(false);
      expect(policy.isOriginAllowed('http://scalemap.ai')).toBe(false); // Wrong protocol
      expect(policy.isOriginAllowed('https://fake-scalemap.ai')).toBe(false);
    });

    it('should be permissive with localhost in development', () => {
      process.env.NODE_ENV = 'development';
      const policy = new (CorsPolicy as any)();

      expect(policy.isOriginAllowed('http://localhost:3000')).toBe(true);
      expect(policy.isOriginAllowed('http://localhost:3001')).toBe(true);
      expect(policy.isOriginAllowed('http://localhost:8080')).toBe(true); // Any localhost port
    });

    it('should reject undefined origin', () => {
      const policy = new (CorsPolicy as any)();

      expect(policy.isOriginAllowed(undefined)).toBe(false);
      expect(policy.isOriginAllowed('')).toBe(false);
    });
  });

  describe('handlePreflightRequest', () => {
    it('should return proper preflight response', () => {
      const response = corsPolicy.handlePreflightRequest(mockEvent);

      expect(response.statusCode).toBe(200);
      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(response.headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(response.headers['Access-Control-Allow-Headers']).toBeDefined();
      expect(response.body).toBe('');
    });
  });

  describe('validateRequest', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should validate allowed origin and method', () => {
      const event = {
        ...mockEvent,
        headers: { origin: 'https://scalemap.ai' },
        httpMethod: 'POST'
      };

      const policy = new (CorsPolicy as any)();
      const result = policy.validateRequest(event);

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject disallowed origin', () => {
      const event = {
        ...mockEvent,
        headers: { origin: 'https://malicious-site.com' },
        httpMethod: 'POST'
      };

      const policy = new (CorsPolicy as any)();
      const result = policy.validateRequest(event);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Origin');
      expect(result.reason).toContain('not allowed');
    });

    it('should reject disallowed method', () => {
      const event = {
        ...mockEvent,
        headers: { origin: 'https://scalemap.ai' },
        httpMethod: 'TRACE'
      };

      const policy = new (CorsPolicy as any)();
      const result = policy.validateRequest(event);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Method');
      expect(result.reason).toContain('not allowed');
    });

    it('should allow requests without origin header', () => {
      const event = {
        ...mockEvent,
        headers: {},
        httpMethod: 'POST'
      };

      const policy = new (CorsPolicy as any)();
      const result = policy.validateRequest(event);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Development environment special handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should allow any localhost origin in development', () => {
      const policy = new (CorsPolicy as any)();

      const testOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8080',
        'http://127.0.0.1:3000'
      ];

      testOrigins.forEach(origin => {
        expect(policy.isOriginAllowed(origin)).toBe(true);
      });
    });

    it('should still reject non-localhost origins in development', () => {
      const policy = new (CorsPolicy as any)();

      expect(policy.isOriginAllowed('https://malicious-site.com')).toBe(false);
      expect(policy.isOriginAllowed('http://example.com')).toBe(false);
    });
  });

  describe('Singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = CorsPolicy.getInstance();
      const instance2 = CorsPolicy.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Edge cases', () => {
    it('should handle case-sensitive origins correctly', () => {
      process.env.NODE_ENV = 'production';
      const policy = new (CorsPolicy as any)();

      expect(policy.isOriginAllowed('https://ScaleMap.ai')).toBe(false); // Wrong case
      expect(policy.isOriginAllowed('https://scalemap.ai')).toBe(true); // Correct case
    });

    it('should handle origins with trailing slashes', () => {
      process.env.NODE_ENV = 'production';
      const policy = new (CorsPolicy as any)();

      expect(policy.isOriginAllowed('https://scalemap.ai/')).toBe(false); // With trailing slash
      expect(policy.isOriginAllowed('https://scalemap.ai')).toBe(true); // Without trailing slash
    });

    it('should handle different header case variations', () => {
      const events = [
        { ...mockEvent, headers: { origin: 'https://scalemap.ai' } },
        { ...mockEvent, headers: { Origin: 'https://scalemap.ai' } },
        { ...mockEvent, headers: { ORIGIN: 'https://scalemap.ai' } }
      ];

      events.forEach(event => {
        const headers = corsPolicy.getCorsHeaders(event);
        expect(headers['Access-Control-Allow-Origin']).toBeDefined();
      });
    });
  });
});