import { APIGatewayProxyEvent } from 'aws-lambda';

import { db } from '../../../services/database';
import { emailService } from '../../../services/email';
import { handler } from '../forgot-password';

// Mock dependencies
jest.mock('../../../services/database');
jest.mock('../../../services/email');

const mockDb = db as jest.Mocked<typeof db>;
const mockEmailService = emailService as jest.Mocked<typeof emailService>;

describe('Forgot Password Function', () => {
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
      email: 'test@example.com'
    })
  };

  const mockUserRecord = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    status: 'active'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully send password reset email for valid user', async () => {
    // Mock existing user
    mockDb.query
      .mockResolvedValueOnce([]) // Rate limit check - no recent attempts
      .mockResolvedValueOnce([mockUserRecord]); // User lookup

    mockDb.put.mockResolvedValue(undefined as any);
    mockEmailService.sendPasswordResetEmail.mockResolvedValue();

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    expect(mockDb.put).toHaveBeenCalled();
    expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(String)
    );

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.message).toContain('If the email address exists');
  });

  it('should return success even for non-existent email to prevent enumeration', async () => {
    // Mock no recent attempts and no user found
    mockDb.query
      .mockResolvedValueOnce([]) // Rate limit check
      .mockResolvedValueOnce([]); // User lookup - not found

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.message).toContain('If the email address exists');
  });

  it('should return success for inactive user to prevent enumeration', async () => {
    const inactiveUser = { ...mockUserRecord, status: 'suspended' };

    mockDb.query
      .mockResolvedValueOnce([]) // Rate limit check
      .mockResolvedValueOnce([inactiveUser]); // Inactive user

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.message).toContain('If the email address exists');
  });

  it('should reject request if rate limit exceeded', async () => {
    // Mock 3 recent reset attempts (rate limit exceeded)
    const recentAttempts = [
      { token: 'token1' },
      { token: 'token2' },
      { token: 'token3' }
    ];

    mockDb.query.mockResolvedValueOnce(recentAttempts);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(429);
    expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should reject invalid email format', async () => {
    const invalidEmailEvent = {
      ...mockEvent,
      body: JSON.stringify({
        email: 'invalid-email'
      })
    };

    const result = await handler(invalidEmailEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_EMAIL_FORMAT');
  });

  it('should reject missing request body', async () => {
    const noBodyEvent = { ...mockEvent, body: null };

    const result = await handler(noBodyEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_REQUEST');
  });

  it('should handle database errors gracefully', async () => {
    mockDb.query.mockRejectedValue(new Error('Database error'));

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });

  it('should handle email service errors gracefully', async () => {
    mockDb.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockUserRecord]);

    mockDb.put.mockResolvedValue(undefined as any);
    mockEmailService.sendPasswordResetEmail.mockRejectedValue(new Error('Email service error'));

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });
});