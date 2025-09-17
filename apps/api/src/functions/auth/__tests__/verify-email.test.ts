import { APIGatewayProxyEvent } from 'aws-lambda';

import { db } from '../../../services/database';
import { emailService } from '../../../services/email';
import { handler } from '../verify-email';

// Mock dependencies
jest.mock('../../../services/database');
jest.mock('../../../services/email');

const mockDb = db as jest.Mocked<typeof db>;
const mockEmailService = emailService as jest.Mocked<typeof emailService>;

describe('Verify Email Function', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    requestContext: {
      requestId: 'test-request-id'
    } as any,
    queryStringParameters: {
      token: 'test-verification-token'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully verify email', async () => {
    // Mock verification record (not expired, within attempts limit)
    const verificationRecord = {
      token: 'test-verification-token',
      email: 'test@example.com',
      userId: 'test-user-id',
      expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      attempts: 0,
      maxAttempts: 5
    };

    // Mock user record (not yet verified)
    const userRecord = {
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      companyId: 'test-company-id',
      emailVerified: false,
      status: 'pending'
    };

    // Mock company record
    const companyRecord = {
      id: 'test-company-id',
      name: 'Test Company'
    };

    mockDb.get
      .mockResolvedValueOnce(verificationRecord)  // verification record
      .mockResolvedValueOnce(userRecord)          // user record
      .mockResolvedValueOnce(companyRecord);      // company record

    mockDb.update.mockResolvedValue(null);
    mockDb.delete.mockResolvedValue();
    mockEmailService.sendWelcomeEmail.mockResolvedValue();

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(
      'EMAIL_VERIFICATION#test-verification-token',
      'METADATA',
      'SET attempts = attempts + :inc',
      { ':inc': 1 }
    );
    expect(mockDb.update).toHaveBeenCalledWith(
      'USER#test-user-id',
      'METADATA',
      'SET emailVerified = :verified, #status = :status, updatedAt = :updatedAt',
      expect.objectContaining({
        ':verified': true,
        ':status': 'active'
      }),
      { '#status': 'status' }
    );
    expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
      'test@example.com',
      'John',
      'Test Company'
    );
    expect(mockDb.delete).toHaveBeenCalledWith(
      'EMAIL_VERIFICATION#test-verification-token',
      'METADATA'
    );

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.verified).toBe(true);
  });

  it('should reject verification with missing token', async () => {
    const eventWithoutToken = {
      ...mockEvent,
      queryStringParameters: null
    };

    const result = await handler(eventWithoutToken as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_TOKEN');
  });

  it('should reject verification with invalid token', async () => {
    mockDb.get.mockResolvedValue(null); // verification record not found

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(404);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_TOKEN');
  });

  it('should reject verification with expired token', async () => {
    const expiredVerificationRecord = {
      token: 'test-verification-token',
      email: 'test@example.com',
      userId: 'test-user-id',
      expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      attempts: 0,
      maxAttempts: 5
    };

    mockDb.get.mockResolvedValue(expiredVerificationRecord);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('TOKEN_EXPIRED');
  });

  it('should reject verification when max attempts exceeded', async () => {
    const maxAttemptsRecord = {
      token: 'test-verification-token',
      email: 'test@example.com',
      userId: 'test-user-id',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      attempts: 5,
      maxAttempts: 5
    };

    mockDb.get.mockResolvedValue(maxAttemptsRecord);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(429);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should handle already verified email gracefully', async () => {
    const verificationRecord = {
      token: 'test-verification-token',
      email: 'test@example.com',
      userId: 'test-user-id',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      attempts: 0,
      maxAttempts: 5
    };

    const verifiedUserRecord = {
      id: 'test-user-id',
      email: 'test@example.com',
      emailVerified: true, // Already verified
      status: 'active'
    };

    mockDb.get
      .mockResolvedValueOnce(verificationRecord)
      .mockResolvedValueOnce(verifiedUserRecord);
    mockDb.update.mockResolvedValue(null);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.message).toBe('Email already verified');
  });

  it('should handle database errors gracefully', async () => {
    mockDb.get.mockRejectedValue(new Error('Database error'));

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });
});