import { APIGatewayProxyEvent } from 'aws-lambda';

import { authorization } from '../../../services/authorization';
import { db } from '../../../services/database';
import { OpenAIService } from '../../../services/openai-service';
import { handler } from '../categorize-document';

// Mock dependencies
jest.mock('../../../services/authorization');
jest.mock('../../../services/database');
jest.mock('../../../services/openai-service');

const mockAuthorization = authorization as jest.Mocked<typeof authorization>;
const mockDb = db as jest.Mocked<typeof db>;
const mockOpenAIService = OpenAIService as jest.MockedClass<typeof OpenAIService>;

describe('Document Categorization Handler', () => {
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
    id: 'test-user-id',
    email: 'test@example.com',
    companyId: 'test-company-id',
    role: 'user'
  };

  const mockDocumentRecord = {
    Data: {
      documentId: 'test-document-id',
      assessmentId: 'test-assessment-id',
      companyId: 'test-company-id',
      metadata: {
        originalFilename: 'financial-report.pdf'
      },
      processing: {
        status: 'completed',
        extractedText: 'This is a financial report containing revenue, expenses, and profit data for Q4 2024. The company showed strong performance in all financial metrics.'
      },
      categorization: {
        category: null,
        confidence: null,
        manualOverride: false
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockAuthorization.hasPermission.mockReturnValue(true);

    mockDb.get.mockResolvedValue(mockDocumentRecord);
    mockDb.update.mockResolvedValue(null);
  });

  describe('manual categorization', () => {
    it('should apply manual categorization', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id',
          manualCategory: 'Finance & Accounting'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.category).toBe('Finance & Accounting');
      expect(responseBody.data.confidence).toBe(1.0);
      expect(responseBody.data.manualOverride).toBe(true);

      expect(mockDb.update).toHaveBeenCalledWith(
        'ASSESSMENT#test-assessment-id',
        'DOCUMENT#test-document-id',
        expect.stringContaining('SET #categorization'),
        expect.objectContaining({
          ':category': 'Finance & Accounting',
          ':confidence': 1.0,
          ':manualOverride': true,
          ':categorizedBy': 'test-user-id'
        }),
        expect.any(Object)
      );
    });

    it('should reject invalid manual category', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id',
          manualCategory: 'Invalid Domain'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('INVALID_DOMAIN');
    });
  });

  describe('AI-powered categorization', () => {
    it('should categorize document using AI', async () => {
      const mockOpenAIInstance = {
        generateCompletion: jest.fn().mockResolvedValue(JSON.stringify({
          primaryCategory: 'Finance & Accounting',
          confidence: 0.92,
          reasoning: 'Document contains financial metrics and revenue data',
          suggestions: [
            {
              domain: 'Finance & Accounting',
              confidence: 0.92,
              reasoning: 'Contains revenue, expenses, and profit data'
            },
            {
              domain: 'Strategy & Planning',
              confidence: 0.65,
              reasoning: 'Mentions performance metrics and quarterly data'
            }
          ]
        }))
      };

      mockOpenAIService.mockImplementation(() => mockOpenAIInstance as any);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.category).toBe('Finance & Accounting');
      expect(responseBody.data.confidence).toBe(0.92);
      expect(responseBody.data.manualOverride).toBe(false);
      expect(responseBody.data.suggestedCategories).toHaveLength(2);

      expect(mockOpenAIInstance.generateCompletion).toHaveBeenCalledWith(
        expect.stringContaining('Analyze the following document content'),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          maxTokens: 500,
          temperature: 0.1
        })
      );
    });

    it('should use fallback categorization when AI fails', async () => {
      const mockOpenAIInstance = {
        generateCompletion: jest.fn().mockRejectedValue(new Error('OpenAI API unavailable'))
      };

      mockOpenAIService.mockImplementation(() => mockOpenAIInstance as any);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      // Should get fallback category based on filename keywords
      expect(responseBody.data.category).toBe('Finance & Accounting');
      expect(responseBody.data.confidence).toBeLessThan(1.0);
    });

    it('should handle malformed AI response', async () => {
      const mockOpenAIInstance = {
        generateCompletion: jest.fn().mockResolvedValue('Invalid JSON response')
      };

      mockOpenAIService.mockImplementation(() => mockOpenAIInstance as any);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      // Should fall back to filename-based categorization
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
    });

    it('should truncate long extracted text', async () => {
      const longTextDocument = {
        ...mockDocumentRecord,
        Data: {
          ...mockDocumentRecord.Data,
          processing: {
            ...mockDocumentRecord.Data.processing,
            extractedText: 'A'.repeat(10000) // Very long text
          }
        }
      };

      mockDb.get.mockResolvedValue(longTextDocument);

      const mockOpenAIInstance = {
        generateCompletion: jest.fn().mockResolvedValue(JSON.stringify({
          primaryCategory: 'Finance & Accounting',
          confidence: 0.85
        }))
      };

      mockOpenAIService.mockImplementation(() => mockOpenAIInstance as any);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      } as APIGatewayProxyEvent;

      await handler(event);

      const promptCall = mockOpenAIInstance.generateCompletion.mock.calls[0][0];
      expect(promptCall.length).toBeLessThan(5000); // Should be truncated
      expect(promptCall).toContain('content truncated');
    });
  });

  describe('fallback categorization', () => {
    it('should categorize based on filename keywords', async () => {
      const hrDocument = {
        ...mockDocumentRecord,
        Data: {
          ...mockDocumentRecord.Data,
          metadata: {
            originalFilename: 'employee_handbook.pdf'
          }
        }
      };

      mockDb.get.mockResolvedValue(hrDocument);

      const mockOpenAIInstance = {
        generateCompletion: jest.fn().mockRejectedValue(new Error('AI service down'))
      };

      mockOpenAIService.mockImplementation(() => mockOpenAIInstance as any);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.category).toBe('HR & People');
    });

    it('should default to Operations when no keywords match', async () => {
      const unknownDocument = {
        ...mockDocumentRecord,
        Data: {
          ...mockDocumentRecord.Data,
          metadata: {
            originalFilename: 'random_document.pdf'
          }
        }
      };

      mockDb.get.mockResolvedValue(unknownDocument);

      const mockOpenAIInstance = {
        generateCompletion: jest.fn().mockRejectedValue(new Error('AI service down'))
      };

      mockOpenAIService.mockImplementation(() => mockOpenAIInstance as any);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.category).toBe('Operations & Production');
      expect(responseBody.data.confidence).toBe(0.3 * 0.8); // Fallback confidence
    });
  });

  describe('validation and error handling', () => {
    it('should reject missing document ID', async () => {
      const event = {
        ...mockEvent,
        body: JSON.stringify({})
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('INVALID_DOCUMENT_ID');
    });

    it('should reject document not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'non-existent-id'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('should reject document from different company', async () => {
      const otherCompanyDocument = {
        ...mockDocumentRecord,
        Data: {
          ...mockDocumentRecord.Data,
          companyId: 'different-company-id'
        }
      };

      mockDb.get.mockResolvedValue(otherCompanyDocument);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('ACCESS_DENIED');
    });

    it('should reject document not yet processed', async () => {
      const unprocessedDocument = {
        ...mockDocumentRecord,
        Data: {
          ...mockDocumentRecord.Data,
          processing: {
            status: 'pending',
            extractedText: null
          }
        }
      };

      mockDb.get.mockResolvedValue(unprocessedDocument);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('DOCUMENT_NOT_PROCESSED');
    });

    it('should reject document with no extracted text', async () => {
      const noTextDocument = {
        ...mockDocumentRecord,
        Data: {
          ...mockDocumentRecord.Data,
          processing: {
            status: 'completed',
            extractedText: ''
          }
        }
      };

      mockDb.get.mockResolvedValue(noTextDocument);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('NO_TEXT_CONTENT');
    });

    it('should reject already categorized document without force flag', async () => {
      const categorizedDocument = {
        ...mockDocumentRecord,
        Data: {
          ...mockDocumentRecord.Data,
          categorization: {
            category: 'Finance & Accounting',
            confidence: 0.95,
            manualOverride: false
          }
        }
      };

      mockDb.get.mockResolvedValue(categorizedDocument);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('ALREADY_CATEGORIZED');
    });

    it('should allow recategorization with force flag', async () => {
      const categorizedDocument = {
        ...mockDocumentRecord,
        Data: {
          ...mockDocumentRecord.Data,
          categorization: {
            category: 'Finance & Accounting',
            confidence: 0.95,
            manualOverride: false
          }
        }
      };

      mockDb.get.mockResolvedValue(categorizedDocument);

      const mockOpenAIInstance = {
        generateCompletion: jest.fn().mockResolvedValue(JSON.stringify({
          primaryCategory: 'Strategy & Planning',
          confidence: 0.88
        }))
      };

      mockOpenAIService.mockImplementation(() => mockOpenAIInstance as any);

      const event = {
        ...mockEvent,
        body: JSON.stringify({
          documentId: 'test-document-id',
          forceRecategorize: true
        })
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.category).toBe('Strategy & Planning');
    });
  });
});