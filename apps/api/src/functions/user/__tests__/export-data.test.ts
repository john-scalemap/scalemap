import { APIGatewayProxyEvent } from 'aws-lambda';

import { db } from '../../../services/database';
import { handler } from '../export-data';

// Mock dependencies
jest.mock('../../../services/database');
jest.mock('../../../shared/middleware/auth-middleware', () => ({
  withAuth: (handler: any) => handler
}));

const mockDb = db as jest.Mocked<typeof db>;

describe('Export User Data Function', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    requestContext: {
      requestId: 'test-request-id'
    } as any
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

  const mockUserRecord = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    timezone: 'America/New_York',
    language: 'en',
    role: 'user',
    companyId: 'company-123',
    emailVerified: true,
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-06-01T00:00:00Z',
    lastLoginAt: '2023-12-01T00:00:00Z',
    preferences: {
      notifications: {
        email: true,
        push: false
      },
      privacy: {
        dataRetention: 'standard'
      }
    }
  };

  const mockCompanyRecord = {
    id: 'company-123',
    name: 'Test Corp',
    description: 'A test company',
    website: 'https://test.com',
    industry: {
      sector: 'technology'
    },
    businessModel: 'b2b-saas',
    size: 'small'
  };

  const mockSessions = [
    {
      pk: 'USER#test-user-id',
      sk: 'SESSION#session-1',
      id: 'session-1',
      deviceInfo: 'Chrome Browser',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      createdAt: '2023-12-01T10:00:00Z'
    }
  ];

  const mockAssessments = [
    {
      pk: 'USER#test-user-id',
      sk: 'ASSESSMENT#assessment-1',
      id: 'assessment-1',
      type: 'scaling-readiness',
      status: 'completed',
      results: { score: 85 },
      createdAt: '2023-11-01T00:00:00Z'
    }
  ];

  const mockAuditLogs = [
    {
      pk: 'USER#test-user-id',
      sk: 'AUDIT#audit-1',
      id: 'audit-1',
      action: 'LOGIN',
      resource: 'USER',
      timestamp: '2023-12-01T10:00:00Z',
      ipAddress: '192.168.1.1'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully export complete user data', async () => {
    mockDb.get
      .mockResolvedValueOnce(mockUserRecord) // User record
      .mockResolvedValueOnce(mockCompanyRecord); // Company record

    mockDb.query
      .mockResolvedValueOnce(mockSessions) // Sessions
      .mockResolvedValueOnce(mockAssessments) // Assessments
      .mockResolvedValueOnce(mockAuditLogs); // Audit logs

    const result = await handler(authenticatedEvent as any);

    expect(result.statusCode).toBe(200);
    expect(mockDb.get).toHaveBeenCalledWith('USER#test-user-id', 'METADATA');
    expect(mockDb.get).toHaveBeenCalledWith('COMPANY#company-123', 'METADATA');
    expect(mockDb.query).toHaveBeenCalledTimes(3);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);

    // Check export structure
    const exportData = responseBody.data;
    expect(exportData.exportInfo).toBeDefined();
    expect(exportData.personalInformation).toEqual(
      expect.objectContaining({
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      })
    );
    expect(exportData.companyInformation).toEqual(
      expect.objectContaining({
        id: 'company-123',
        name: 'Test Corp'
      })
    );
    expect(exportData.sessionData).toHaveLength(1);
    expect(exportData.assessmentData).toHaveLength(1);
    expect(exportData.activityLogs).toHaveLength(1);
    expect(exportData.gdprInfo).toBeDefined();

    // Check response headers
    expect(result.headers).toEqual(
      expect.objectContaining({
        'Content-Disposition': expect.stringContaining('attachment; filename="scalemap-data-export-')
      })
    );
  });

  it('should export data for user without company', async () => {
    const userWithoutCompany = { ...mockUserRecord, companyId: null };

    mockDb.get
      .mockResolvedValueOnce(userWithoutCompany) // User record
      .mockResolvedValueOnce(null); // No company record

    mockDb.query
      .mockResolvedValueOnce([]) // No sessions
      .mockResolvedValueOnce([]) // No assessments
      .mockResolvedValueOnce([]); // No audit logs

    const result = await handler(authenticatedEvent as any);

    expect(result.statusCode).toBe(200);

    const responseBody = JSON.parse(result.body);
    const exportData = responseBody.data;

    expect(exportData.companyInformation).toBeNull();
    expect(exportData.sessionData).toHaveLength(0);
    expect(exportData.assessmentData).toHaveLength(0);
    expect(exportData.activityLogs).toHaveLength(0);
  });

  it('should handle user not found', async () => {
    mockDb.get.mockResolvedValue(null);

    const result = await handler(authenticatedEvent as any);

    expect(result.statusCode).toBe(404);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('USER_NOT_FOUND');
  });

  it('should handle database query failures gracefully', async () => {
    mockDb.get.mockResolvedValueOnce(mockUserRecord);
    mockDb.query
      .mockRejectedValueOnce(new Error('Database error'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await handler(authenticatedEvent as any);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);

    // Should still return export with empty sessions due to error
    const exportData = responseBody.data;
    expect(exportData.sessionData).toHaveLength(0);
  });

  it('should include correct GDPR information', async () => {
    mockDb.get.mockResolvedValueOnce(mockUserRecord);
    mockDb.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await handler(authenticatedEvent as any);

    const responseBody = JSON.parse(result.body);
    const gdprInfo = responseBody.data.gdprInfo;

    expect(gdprInfo.legalBasisForProcessing).toBeDefined();
    expect(gdprInfo.dataRetentionPeriod).toBe('3 years after account deletion');
    expect(gdprInfo.rightsInformation).toEqual(
      expect.objectContaining({
        rightToAccess: expect.any(String),
        rightToRectification: expect.any(String),
        rightToErasure: expect.any(String),
        rightToPortability: expect.any(String),
        rightToObject: expect.any(String)
      })
    );
  });

  it('should handle minimal data retention setting', async () => {
    const userWithMinimalRetention = {
      ...mockUserRecord,
      preferences: {
        ...mockUserRecord.preferences,
        privacy: { dataRetention: 'minimal' }
      }
    };

    mockDb.get.mockResolvedValueOnce(userWithMinimalRetention);
    mockDb.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await handler(authenticatedEvent as any);

    const responseBody = JSON.parse(result.body);
    expect(responseBody.data.gdprInfo.dataRetentionPeriod).toBe('1 year after account deletion');
  });
});