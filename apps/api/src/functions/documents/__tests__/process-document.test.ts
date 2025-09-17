import { S3Event } from 'aws-lambda';

import { db } from '../../../services/database';
import { S3Service } from '../../../services/s3-service';
import { TextractService } from '../../../services/textract-service';
import { handler } from '../process-document';

// Mock dependencies
jest.mock('../../../services/textract-service');
jest.mock('../../../services/s3-service');
jest.mock('../../../services/database');

const mockTextractService = TextractService as jest.MockedClass<typeof TextractService>;
const mockS3Service = S3Service as jest.MockedClass<typeof S3Service>;
const mockDb = db as jest.Mocked<typeof db>;

describe('Document Processing Handler', () => {
  const mockS3Event: S3Event = {
    Records: [
      {
        eventVersion: '2.1',
        eventSource: 'aws:s3',
        awsRegion: 'eu-west-1',
        eventTime: '2025-01-01T00:00:00.000Z',
        eventName: 's3:ObjectCreated:Put',
        s3: {
          s3SchemaVersion: '1.0',
          configurationId: 'test-config',
          bucket: {
            name: 'scalemap-documents-prod',
            ownerIdentity: { principalId: 'test' },
            arn: 'arn:aws:s3:::scalemap-documents-prod'
          },
          object: {
            key: 'test-company/test-assessment/raw/test-document-id.pdf',
            size: 1024 * 1024, // 1MB
            eTag: 'test-etag',
            sequencer: 'test-sequencer'
          }
        }
      } as any
    ]
  };

  const mockDocumentRecord = {
    EntityType: 'Document',
    PK: 'ASSESSMENT#test-assessment',
    SK: 'DOCUMENT#test-document-id',
    Data: {
      documentId: 'test-document-id',
      assessmentId: 'test-assessment',
      companyId: 'test-company',
      metadata: {
        originalFilename: 'test-document.pdf',
        mimeType: 'application/pdf'
      },
      storage: {
        s3Key: 'test-company/test-assessment/raw/test-document-id.pdf'
      },
      processing: {
        status: 'pending'
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockDb.query.mockResolvedValue([mockDocumentRecord]);
    mockDb.update.mockResolvedValue(null);

    const mockTextractInstance = {
      analyzeDocument: jest.fn(),
      startDocumentAnalysis: jest.fn()
    };

    const mockS3Instance = {
      uploadDocument: jest.fn().mockResolvedValue({
        key: 'processed-key',
        url: 'processed-url',
        size: 1024,
        contentType: 'application/json',
        etag: 'processed-etag'
      })
    };

    mockTextractService.mockImplementation(() => mockTextractInstance as any);
    mockS3Service.mockImplementation(() => mockS3Instance as any);
  });

  describe('successful document processing', () => {
    it('should process small document synchronously', async () => {
      const mockTextractInstance = new mockTextractService();
      (mockTextractInstance.analyzeDocument as jest.Mock).mockResolvedValue({
        text: 'Extracted text content from the document',
        confidence: 0.95,
        tables: [],
        forms: [],
        processingTime: 1500,
        pageCount: 1
      });

      await handler(mockS3Event);

      expect(mockTextractInstance.analyzeDocument).toHaveBeenCalledWith(
        'scalemap-documents-prod',
        'test-company/test-assessment/raw/test-document-id.pdf'
      );

      // Verify document status was updated to processing
      expect(mockDb.update).toHaveBeenCalledWith(
        'ASSESSMENT#test-assessment',
        'DOCUMENT#test-document-id',
        expect.stringContaining('SET #processing.#status = :status'),
        expect.objectContaining({
          ':status': 'processing'
        }),
        expect.any(Object)
      );

      // Verify document was updated with processing results
      expect(mockDb.update).toHaveBeenCalledWith(
        'ASSESSMENT#test-assessment',
        'DOCUMENT#test-document-id',
        expect.stringContaining('SET'),
        expect.objectContaining({
          ':status': 'completed',
          ':extractedText': 'Extracted text content from the document',
          ':confidence': 0.95
        }),
        expect.any(Object)
      );
    });

    it('should process large document asynchronously', async () => {
      const largeFileEvent = {
        ...mockS3Event,
        Records: [{
          ...mockS3Event.Records[0],
          s3: {
            ...mockS3Event.Records[0]!.s3,
            object: {
              ...mockS3Event.Records[0]!.s3!.object,
              size: 10 * 1024 * 1024 // 10MB - over sync threshold
            }
          }
        }]
      };

      const mockTextractInstance = new mockTextractService();
      (mockTextractInstance.startDocumentAnalysis as jest.Mock).mockResolvedValue({
        jobId: 'test-job-id',
        status: 'IN_PROGRESS'
      });

      await handler(largeFileEvent as S3Event);

      expect(mockTextractInstance.startDocumentAnalysis).toHaveBeenCalledWith(
        'scalemap-documents-prod',
        'test-company/test-assessment/raw/test-document-id.pdf'
      );

      // Verify document was updated with job ID
      expect(mockDb.update).toHaveBeenCalledWith(
        'ASSESSMENT#test-assessment',
        'DOCUMENT#test-document-id',
        expect.stringContaining('textractJobId'),
        expect.objectContaining({
          ':textractJobId': 'test-job-id'
        }),
        expect.any(Object)
      );
    });

    it('should store processed content in S3', async () => {
      const mockTextractInstance = new mockTextractService();
      (mockTextractInstance.analyzeDocument as jest.Mock).mockResolvedValue({
        text: 'Extracted text content',
        confidence: 0.95,
        tables: [],
        forms: [],
        processingTime: 1500,
        pageCount: 1
      });

      const mockS3Instance = new mockS3Service();

      await handler(mockS3Event);

      expect(mockS3Instance.uploadDocument).toHaveBeenCalledWith(
        'test-company/test-assessment/processed/test-document-id.json',
        expect.any(Buffer),
        expect.objectContaining({
          originalName: 'test-document-id.json',
          contentType: 'application/json'
        })
      );

      const uploadCall = (mockS3Instance.uploadDocument as jest.Mock).mock.calls[0];
      const uploadedContent = JSON.parse(uploadCall[1].toString());

      expect(uploadedContent).toEqual(
        expect.objectContaining({
          documentId: 'test-document-id',
          extractedText: 'Extracted text content',
          confidence: 0.95,
          processingTime: expect.any(Number),
          processedAt: expect.any(String)
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle invalid S3 key format', async () => {
      const invalidKeyEvent = {
        ...mockS3Event,
        Records: [{
          ...mockS3Event.Records[0],
          s3: {
            ...mockS3Event.Records[0]!.s3,
            object: {
              ...mockS3Event.Records[0]!.s3!.object,
              key: 'invalid-key-format'
            }
          }
        }]
      };

      // Should not throw, but handle error gracefully
      await handler(invalidKeyEvent as S3Event);

      // Should not call database for invalid key
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should handle document not found in database', async () => {
      mockDb.query.mockResolvedValue([]);

      // Should not throw, but handle error gracefully
      await handler(mockS3Event);

      // Should not call textract service when document not found
      expect(mockTextractService).not.toHaveBeenCalled();
    });

    it('should handle Textract processing errors', async () => {
      const mockTextractInstance = new mockTextractService();
      (mockTextractInstance.analyzeDocument as jest.Mock).mockRejectedValue(
        new Error('Textract service unavailable')
      );

      await handler(mockS3Event);

      // Verify document status was updated to failed
      expect(mockDb.update).toHaveBeenCalledWith(
        'ASSESSMENT#test-assessment',
        'DOCUMENT#test-document-id',
        expect.stringContaining('SET'),
        expect.objectContaining({
          ':status': 'failed',
          ':processingErrors': ['Textract processing failed: Textract service unavailable']
        }),
        expect.any(Object)
      );
    });

    it('should handle database update errors gracefully', async () => {
      mockDb.update.mockRejectedValue(new Error('Database unavailable'));

      const mockTextractInstance = new mockTextractService();
      (mockTextractInstance.analyzeDocument as jest.Mock).mockResolvedValue({
        text: 'Extracted text',
        confidence: 0.95,
        tables: [],
        forms: [],
        processingTime: 1500,
        pageCount: 1
      });

      // Should not throw, but handle error gracefully
      await handler(mockS3Event);

      // Should still call textract despite database error
      expect(mockTextractInstance.analyzeDocument).toHaveBeenCalled();
    });

    it('should handle S3 upload errors for processed content', async () => {
      const mockTextractInstance = new mockTextractService();
      (mockTextractInstance.analyzeDocument as jest.Mock).mockResolvedValue({
        text: 'Extracted text',
        confidence: 0.95,
        tables: [],
        forms: [],
        processingTime: 1500,
        pageCount: 1
      });

      const mockS3Instance = new mockS3Service();
      (mockS3Instance.uploadDocument as jest.Mock).mockRejectedValue(
        new Error('S3 upload failed')
      );

      // Should complete processing even if S3 upload fails
      await handler(mockS3Event);

      expect(mockDb.update).toHaveBeenCalledWith(
        'ASSESSMENT#test-assessment',
        'DOCUMENT#test-document-id',
        expect.stringContaining('SET'),
        expect.objectContaining({
          ':status': 'completed',
          ':extractedText': 'Extracted text'
        }),
        expect.any(Object)
      );
    });
  });

  describe('multiple document processing', () => {
    it('should process multiple documents in parallel', async () => {
      const multiDocumentEvent: S3Event = {
        Records: [
          mockS3Event.Records[0],
          {
            ...mockS3Event.Records[0]!,
            s3: {
              ...mockS3Event.Records[0]!.s3,
              object: {
                ...mockS3Event.Records[0]!.s3.object,
                key: 'test-company/test-assessment/raw/second-document-id.pdf'
              }
            }
          } as any
        ]
      };

      mockDb.query
        .mockResolvedValueOnce([mockDocumentRecord])
        .mockResolvedValueOnce([{
          ...mockDocumentRecord,
          Data: {
            ...mockDocumentRecord.Data,
            documentId: 'second-document-id'
          }
        }]);

      const mockTextractInstance = new mockTextractService();
      (mockTextractInstance.analyzeDocument as jest.Mock).mockResolvedValue({
        text: 'Extracted text',
        confidence: 0.95,
        tables: [],
        forms: [],
        processingTime: 1500,
        pageCount: 1
      });

      await handler(multiDocumentEvent);

      expect(mockTextractInstance.analyzeDocument).toHaveBeenCalledTimes(2);
      expect(mockDb.update).toHaveBeenCalledTimes(6); // 2 status updates + 2 processing updates + 2 completion updates
    });

    it('should handle partial failures in batch processing', async () => {
      const multiDocumentEvent: S3Event = {
        Records: [
          mockS3Event.Records[0],
          {
            ...mockS3Event.Records[0]!,
            s3: {
              ...mockS3Event.Records[0]!.s3,
              object: {
                ...mockS3Event.Records[0]!.s3.object,
                key: 'invalid-key-format'
              }
            }
          } as any
        ]
      };

      const mockTextractInstance = new mockTextractService();
      (mockTextractInstance.analyzeDocument as jest.Mock).mockResolvedValue({
        text: 'Extracted text',
        confidence: 0.95,
        tables: [],
        forms: [],
        processingTime: 1500,
        pageCount: 1
      });

      // Should not throw even if one document fails
      await handler(multiDocumentEvent);

      // First document should be processed successfully
      expect(mockTextractInstance.analyzeDocument).toHaveBeenCalledTimes(1);
    });
  });
});