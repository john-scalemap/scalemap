import { APIGatewayProxyEvent } from 'aws-lambda';

import { authorization } from '../../../services/authorization';
import { db } from '../../../services/database';
import { S3Service } from '../../../services/s3-service';
import { handler } from '../upload-handler';

// Mock dependencies
jest.mock('../../../services/authorization');
jest.mock('../../../services/database');
jest.mock('../../../services/s3-service');

const mockAuthorization = authorization as jest.Mocked<typeof authorization>;
const mockDb = db as jest.Mocked<typeof db>;

describe('Document Upload Handler', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    requestContext: {
      requestId: 'test-request-id'
    } as any,
    pathParameters: {
      assessmentId: 'test-assessment-id'
    },
    headers: {
      'Authorization': 'Bearer test-token'
    }
  };

  const mockUser = {
    sub: 'test-user-id',
    email: 'test@example.com',
    companyId: 'test-company-id',
    role: 'user',
    permissions: ['assessments:read', 'assessments:update'],
    emailVerified: true,
    iat: Date.now(),
    exp: Date.now() + 3600000,
    jti: 'test-jwt-id'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockAuthorization.authenticateAndAuthorize.mockResolvedValue({
      success: true,
      user: mockUser,
      message: ''
    });

    mockDb.get.mockResolvedValue({
      companyId: 'test-company-id',
      status: 'active'
    });

    mockDb.query.mockResolvedValue([]);
    mockDb.put.mockResolvedValue(undefined);
  });

  describe('successful upload URL generation', () => {
    it('should generate upload URL for valid request', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'test-document.pdf',
          contentType: 'application/pdf',
          size: 1024 * 1024 // 1MB
        })
      } as APIGatewayProxyEvent;

      const mockS3Service = {
        getPresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.aws.com/presigned-url')
      };

      (S3Service as jest.Mock).mockImplementation(() => mockS3Service);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.uploadUrl).toBe('https://s3.aws.com/presigned-url');
      expect(responseBody.data.documentId).toBeDefined();
      expect(responseBody.data.maxFileSize).toBe(50 * 1024 * 1024);
      expect(responseBody.data.allowedTypes).toContain('application/pdf');
    });

    it('should create document record in DynamoDB', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'test-document.pdf',
          contentType: 'application/pdf',
          size: 1024 * 1024
        })
      } as APIGatewayProxyEvent;

      const mockS3Service = {
        getPresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.aws.com/presigned-url')
      };

      (S3Service as jest.Mock).mockImplementation(() => mockS3Service);

      await handler(event);

      expect(mockDb.put).toHaveBeenCalledWith(
        expect.objectContaining({
          PK: 'ASSESSMENT#test-assessment-id',
          SK: expect.stringMatching(/^DOCUMENT#/),
          EntityType: 'Document',
          Data: expect.objectContaining({
            assessmentId: 'test-assessment-id',
            companyId: 'test-company-id',
            metadata: expect.objectContaining({
              originalFilename: 'test-document.pdf',
              mimeType: 'application/pdf',
              fileSize: 1024 * 1024,
              uploadedBy: 'test-user-id'
            })
          })
        })
      );
    });

    it('should support domain categorization', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'financial-report.pdf',
          contentType: 'application/pdf',
          size: 1024 * 1024,
          domain: 'Finance & Accounting'
        })
      } as APIGatewayProxyEvent;

      const mockS3Service = {
        getPresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.aws.com/presigned-url')
      };

      (S3Service as jest.Mock).mockImplementation(() => mockS3Service);

      await handler(event);

      expect(mockDb.put).toHaveBeenCalledWith(
        expect.objectContaining({
          Data: expect.objectContaining({
            categorization: expect.objectContaining({
              category: 'Finance & Accounting',
              manualOverride: true
            })
          })
        })
      );
    });
  });

  describe('validation errors', () => {
    it('should reject missing assessment ID', async () => {
      const event = {
        ...mockEvent,
        pathParameters: {},
        body: JSON.stringify({
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('MISSING_ASSESSMENT_ID');
    });

    it('should reject missing request body', async () => {
      const event = {
        ...mockEvent,
        body: null
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('INVALID_REQUEST');
    });

    it('should reject invalid filename', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: '',
          contentType: 'application/pdf',
          size: 1024
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('INVALID_FILENAME');
    });

    it('should reject unsupported file type', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'test.txt',
          contentType: 'text/plain',
          size: 1024
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('should reject file size too large', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'large-file.pdf',
          contentType: 'application/pdf',
          size: 60 * 1024 * 1024 // 60MB - over limit
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FILE_TOO_LARGE');
    });

    it('should reject dangerous filename patterns', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: '../../../malicious.pdf',
          contentType: 'application/pdf',
          size: 1024
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('INVALID_FILENAME');
    });
  });

  describe('authorization errors', () => {
    it('should reject unauthorized user', async () => {
      mockAuthorization.authenticateAndAuthorize.mockResolvedValue({
        success: false,
        message: 'Invalid token',
        user: undefined
      });

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject access to non-existent assessment', async () => {
      mockDb.get.mockResolvedValue(null);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('ASSESSMENT_NOT_FOUND');
    });

    it('should reject access to assessment from different company', async () => {
      mockDb.get.mockResolvedValue({
        companyId: 'different-company-id',
        status: 'active'
      });

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('storage limits', () => {
    it('should reject when total storage limit exceeded', async () => {
      // Mock existing documents that exceed storage limit
      const existingDocuments = Array(10).fill(null).map((_, _i) => ({
        Data: {
          metadata: {
            fileSize: 50 * 1024 * 1024 // 50MB each
          }
        }
      }));

      mockDb.query.mockResolvedValue(existingDocuments);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 10 * 1024 * 1024 // 10MB - would exceed 500MB total limit
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(413);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('STORAGE_LIMIT_EXCEEDED');
    });
  });

  describe('error handling', () => {
    it('should handle S3 service errors', async () => {
      const mockS3Service = {
        getPresignedUploadUrl: jest.fn().mockRejectedValue(new Error('S3 service unavailable'))
      };

      (S3Service as jest.Mock).mockImplementation(() => mockS3Service);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle database errors', async () => {
      mockDb.put.mockRejectedValue(new Error('Database unavailable'));

      const mockS3Service = {
        getPresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.aws.com/presigned-url')
      };

      (S3Service as jest.Mock).mockImplementation(() => mockS3Service);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('INTERNAL_ERROR');
    });
  });
});