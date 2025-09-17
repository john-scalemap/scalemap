import { APIGatewayProxyEvent } from 'aws-lambda';

import { db } from '../../../services/database';
import { handler } from '../update-profile';

// Mock dependencies
jest.mock('../../../services/database');
jest.mock('../../../shared/middleware/auth-middleware', () => ({
  withAuth: (handler: any) => handler
}));

const mockDb = db as jest.Mocked<typeof db>;

describe('Update Profile Function', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    requestContext: {
      requestId: 'test-request-id'
    } as any,
    body: JSON.stringify({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      timezone: 'America/New_York',
      language: 'en'
    })
  };

  // Mock authenticated event
  const authenticatedEvent = {
    ...mockEvent,
    user: {
      sub: 'test-user-id',
      email: 'test@example.com',
      role: 'user'
    }
  };

  const mockCurrentUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    preferences: {
      notifications: {
        email: true,
        push: false
      }
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  };

  const mockUpdatedUser = {
    ...mockCurrentUser,
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    timezone: 'America/New_York',
    language: 'en',
    updatedAt: expect.any(String)
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully update user profile with basic fields', async () => {
    mockDb.get.mockResolvedValue(mockCurrentUser);
    mockDb.update.mockResolvedValue(mockUpdatedUser);

    const result = await handler(authenticatedEvent as any);

    expect(result.statusCode).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(
      'USER#test-user-id',
      'METADATA',
      expect.stringContaining('SET firstName = :firstName'),
      expect.objectContaining({
        ':firstName': 'John',
        ':lastName': 'Doe',
        ':phone': '+1234567890',
        ':timezone': 'America/New_York',
        ':language': 'en',
        ':updatedAt': expect.any(String)
      }),
      expect.objectContaining({
        '#lang': 'language'
      })
    );

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.firstName).toBe('John');
  });

  it('should successfully update nested preferences', async () => {
    const eventWithPreferences = {
      ...authenticatedEvent,
      body: JSON.stringify({
        preferences: {
          notifications: {
            email: false,
            weeklyDigest: true
          },
          dashboard: {
            defaultView: 'analytics',
            itemsPerPage: 50
          }
        }
      })
    };

    mockDb.get.mockResolvedValue(mockCurrentUser);
    mockDb.update.mockResolvedValue({
      ...mockCurrentUser,
      preferences: {
        notifications: {
          email: false,
          push: false,
          weeklyDigest: true
        },
        dashboard: {
          defaultView: 'analytics',
          itemsPerPage: 50
        }
      }
    });

    const result = await handler(eventWithPreferences as any);

    expect(result.statusCode).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(
      'USER#test-user-id',
      'METADATA',
      expect.stringContaining('preferences.notifications = :notifications'),
      expect.objectContaining({
        ':notifications': expect.objectContaining({
          email: false,
          weeklyDigest: true
        }),
        ':dashboard': expect.objectContaining({
          defaultView: 'analytics',
          itemsPerPage: 50
        })
      }),
      undefined
    );
  });

  it('should reject invalid phone number format', async () => {
    const eventWithInvalidPhone = {
      ...authenticatedEvent,
      body: JSON.stringify({
        phone: 'invalid-phone'
      })
    };

    const result = await handler(eventWithInvalidPhone as any);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_PHONE');
  });

  it('should reject invalid timezone', async () => {
    const eventWithInvalidTimezone = {
      ...authenticatedEvent,
      body: JSON.stringify({
        timezone: 'Invalid/Timezone'
      })
    };

    const result = await handler(eventWithInvalidTimezone as any);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_TIMEZONE');
  });

  it('should reject unsupported language', async () => {
    const eventWithInvalidLanguage = {
      ...authenticatedEvent,
      body: JSON.stringify({
        language: 'invalid'
      })
    };

    const result = await handler(eventWithInvalidLanguage as any);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_LANGUAGE');
  });

  it('should handle user not found', async () => {
    mockDb.get.mockResolvedValue(null);

    const result = await handler(authenticatedEvent as any);

    expect(result.statusCode).toBe(404);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('USER_NOT_FOUND');
  });

  it('should handle database errors', async () => {
    mockDb.get.mockRejectedValue(new Error('Database error'));

    const result = await handler(authenticatedEvent as any);

    expect(result.statusCode).toBe(500);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });

  it('should validate dashboard preferences correctly', async () => {
    const eventWithInvalidPrefs = {
      ...authenticatedEvent,
      body: JSON.stringify({
        preferences: {
          dashboard: {
            defaultView: 'invalid-view',
            itemsPerPage: 1000 // Too high
          }
        }
      })
    };

    const result = await handler(eventWithInvalidPrefs as any);

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(['INVALID_DEFAULT_VIEW', 'INVALID_ITEMS_PER_PAGE']).toContain(responseBody.error.code);
  });
});