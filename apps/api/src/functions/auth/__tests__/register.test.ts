import { APIGatewayProxyEvent } from 'aws-lambda';

import { db } from '../../../services/database';
import { handler } from '../register';

// Mock dependencies
jest.mock('../../../services/database');
jest.mock('../../../services/email');
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password')
}));

const mockDb = db as jest.Mocked<typeof db>;

describe('Register Function', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    requestContext: {
      requestId: 'test-request-id'
    } as any,
    headers: {
      'User-Agent': 'test-agent'
    },
    body: JSON.stringify({
      user: {
        email: 'test@example.com',
        password: 'ComplexP@ssw0rd2024',
        confirmPassword: 'ComplexP@ssw0rd2024',
        firstName: 'John',
        lastName: 'Doe',
        gdprConsent: true
      },
      company: {
        name: 'Test Company',
        industry: {
          sector: 'technology',
          subSector: 'saas',
          regulatoryClassification: 'lightly-regulated',
          specificRegulations: []
        },
        businessModel: 'b2b-saas',
        size: 'small'
      }
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully register a new user and company', async () => {
    // Mock no existing user
    mockDb.query.mockResolvedValue([]);
    mockDb.put.mockResolvedValue(undefined as any);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(201);
    // Should call put for user, company, and verification records
    expect(mockDb.put).toHaveBeenCalled();

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.email).toBe('test@example.com');
    expect(responseBody.data.emailVerified).toBe(false);
  });

  it('should reject registration if email already exists', async () => {
    // Mock existing user
    mockDb.query.mockResolvedValue([{ id: 'existing-user' }]);

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(409);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('should reject registration with invalid email format', async () => {
    const invalidEvent = {
      ...mockEvent,
      body: JSON.stringify({
        ...JSON.parse(mockEvent.body!),
        user: {
          ...JSON.parse(mockEvent.body!).user,
          email: 'invalid-email'
        }
      })
    };

    const result = await handler(invalidEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_EMAIL_FORMAT');
  });

  it('should reject registration with weak password', async () => {
    const weakPasswordEvent = {
      ...mockEvent,
      body: JSON.stringify({
        ...JSON.parse(mockEvent.body!),
        user: {
          ...JSON.parse(mockEvent.body!).user,
          password: '123',
          confirmPassword: '123'
        }
      })
    };

    const result = await handler(weakPasswordEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('PASSWORD_TOO_SHORT');
  });

  it('should reject registration with mismatched passwords', async () => {
    const mismatchEvent = {
      ...mockEvent,
      body: JSON.stringify({
        ...JSON.parse(mockEvent.body!),
        user: {
          ...JSON.parse(mockEvent.body!).user,
          password: 'ComplexP@ssw0rd2024',
          confirmPassword: 'DifferentP@ssw0rd2024'
        }
      })
    };

    const result = await handler(mismatchEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('PASSWORD_MISMATCH');
  });

  it('should reject registration without GDPR consent', async () => {
    const noConsentEvent = {
      ...mockEvent,
      body: JSON.stringify({
        ...JSON.parse(mockEvent.body!),
        user: {
          ...JSON.parse(mockEvent.body!).user,
          password: 'ComplexP@ssw0rd2024',
          confirmPassword: 'ComplexP@ssw0rd2024',
          gdprConsent: false
        }
      })
    };

    const result = await handler(noConsentEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('GDPR_CONSENT_REQUIRED');
  });

  it('should handle database errors gracefully', async () => {
    // Mock query to throw error when checking if user exists
    mockDb.query.mockRejectedValue(new Error('Database error'));

    // Use a valid password that passes all validation
    const validEvent = {
      ...mockEvent,
      body: JSON.stringify({
        ...JSON.parse(mockEvent.body!),
        user: {
          ...JSON.parse(mockEvent.body!).user,
          password: 'ComplexP@ssw0rd2024',
          confirmPassword: 'ComplexP@ssw0rd2024'
        }
      })
    };

    const result = await handler(validEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });
});