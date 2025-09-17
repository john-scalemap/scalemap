import { APIGatewayProxyEvent } from 'aws-lambda';
import * as bcrypt from 'bcrypt';

import { db } from '../../../services/database';
import { jwtService } from '../../../services/jwt';
import { handler } from '../login';

// Mock dependencies
jest.mock('../../../services/database');
jest.mock('../../../services/jwt');
jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockJwtService = jwtService as jest.Mocked<typeof jwtService>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

describe('Login Function', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '192.168.1.1'
      }
    } as any,
    headers: {
      'User-Agent': 'test-agent'
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'SecurePassword123',
      rememberMe: false
    })
  };

  const mockUserRecord = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    companyId: 'test-company-id',
    role: 'admin',
    emailVerified: true,
    status: 'active',
    passwordHash: 'hashed_password'
  };

  const mockCompanyRecord = {
    id: 'test-company-id',
    name: 'Test Company'
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 900,
    tokenType: 'Bearer' as const,
    scope: ['assessments:read', 'agents:read']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default bcrypt mock behavior
    // bcrypt already mocked to return true in beforeEach
  });

  it('should successfully login with valid credentials', async () => {
    // Mock database responses
    mockDb.query.mockResolvedValue([mockUserRecord]);
    mockDb.get.mockResolvedValue(mockCompanyRecord);
    mockDb.put.mockResolvedValue(undefined as any);
    mockDb.update.mockResolvedValue(null);

    // Password verification already mocked in beforeEach

    // Mock JWT token generation
    mockJwtService.generateTokens.mockResolvedValue(mockTokens);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    expect(bcrypt.compare).toHaveBeenCalledWith('SecurePassword123', 'hashed_password');
    expect(mockJwtService.generateTokens).toHaveBeenCalled();
    expect(mockDb.put).toHaveBeenCalled(); // Session creation
    expect(mockDb.update).toHaveBeenCalled(); // Last login update

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.user.email).toBe('test@example.com');
    expect(responseBody.data.tokens).toEqual(mockTokens);
    expect(result.headers?.['Strict-Transport-Security']).toBeDefined();
  });

  it('should reject login with non-existent email', async () => {
    mockDb.query.mockResolvedValue([]);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(401);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should reject login with invalid password', async () => {
    mockDb.query.mockResolvedValue([mockUserRecord]);
    // Override default bcrypt behavior for this test
    (mockBcryptCompare as any).mockResolvedValue(false);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(401);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should reject login for pending account', async () => {
    const pendingUserRecord = { ...mockUserRecord, status: 'pending' };
    mockDb.query.mockResolvedValue([pendingUserRecord]);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(403);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('should reject login for suspended account', async () => {
    const suspendedUserRecord = { ...mockUserRecord, status: 'suspended' };
    mockDb.query.mockResolvedValue([suspendedUserRecord]);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(403);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('should reject login with invalid email format', async () => {
    const invalidEmailEvent = {
      ...mockEvent,
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'SecurePassword123'
      })
    };

    const result = await handler(invalidEmailEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should reject login with missing password', async () => {
    const noPasswordEvent = {
      ...mockEvent,
      body: JSON.stringify({
        email: 'test@example.com',
        password: ''
      })
    };

    const result = await handler(noPasswordEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should handle missing company gracefully', async () => {
    mockDb.query.mockResolvedValue([mockUserRecord]);
    mockDb.get.mockResolvedValue(null); // Company not found
    // bcrypt already mocked to return true in beforeEach

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });

  it('should handle database errors gracefully', async () => {
    mockDb.query.mockRejectedValue(new Error('Database error'));

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });

  it('should handle JWT generation errors gracefully', async () => {
    mockDb.query.mockResolvedValue([mockUserRecord]);
    mockDb.get.mockResolvedValue(mockCompanyRecord);
    // bcrypt already mocked to return true in beforeEach
    mockJwtService.generateTokens.mockRejectedValue(new Error('JWT error'));

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });
});