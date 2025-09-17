import { APIGatewayProxyEvent, S3Event } from 'aws-lambda';

import { handler as categorizeHandler } from '../../functions/documents/categorize-document';
import { handler as processHandler } from '../../functions/documents/process-document';
import { handler as uploadHandler } from '../../functions/documents/upload-handler';
import { db } from '../database';
import { DocumentService } from '../document-service';
import { S3Service } from '../s3-service';
import { TextractService } from '../textract-service';


// Integration test that verifies the complete document workflow
describe('Document Integration Tests', () => {
  const TEST_COMPANY_ID = 'integration-test-company';
  const TEST_ASSESSMENT_ID = 'integration-test-assessment';
  const TEST_USER_ID = 'integration-test-user';

  let documentService: DocumentService;
  let s3Service: S3Service;
  let textractService: TextractService;

  beforeAll(async () => {
    // Initialize services with test configuration
    documentService = new DocumentService();
    s3Service = new S3Service({
      bucketName: process.env.S3_BUCKET_NAME || 'scalemap-documents-test',
      region: process.env.AWS_REGION || 'eu-west-1'
    });
    textractService = new TextractService();

    // Setup test assessment in database
    await db.put({
      PK: `ASSESSMENT#${TEST_ASSESSMENT_ID}`,
      SK: 'METADATA',
      EntityType: 'Assessment',
      Data: {
        assessmentId: TEST_ASSESSMENT_ID,
        companyId: TEST_COMPANY_ID,
        status: 'active',
        createdAt: new Date().toISOString()
      }
    });
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await db.delete(`ASSESSMENT#${TEST_ASSESSMENT_ID}`, 'METADATA');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete document workflow', () => {
    it('should handle complete document upload and processing workflow', async () => {
      // Step 1: Request upload URL
      const uploadEvent: APIGatewayProxyEvent = {
        requestContext: { requestId: 'test-upload-request' } as any,
        pathParameters: { assessmentId: TEST_ASSESSMENT_ID },
        headers: { 'Authorization': 'Bearer test-token' },
        body: JSON.stringify({
          filename: 'test-financial-report.pdf',
          contentType: 'application/pdf',
          size: 1024 * 1024, // 1MB
          domain: 'Finance & Accounting'
        })
      } as unknown as APIGatewayProxyEvent;

      // Mock authorization for upload
      jest.doMock('../../services/authorization', () => ({
        authorization: {
          authenticateAndAuthorize: jest.fn().mockResolvedValue({
            success: true,
            user: {
              id: TEST_USER_ID,
              companyId: TEST_COMPANY_ID,
              email: 'test@example.com',
              role: 'user'
            }
          })
        }
      }));

      const uploadResult = await uploadHandler(uploadEvent);
      expect(uploadResult.statusCode).toBe(200);

      const uploadResponse = JSON.parse(uploadResult.body);
      expect(uploadResponse.success).toBe(true);
      const documentId = uploadResponse.data.documentId;
      const uploadUrl = uploadResponse.data.uploadUrl;

      expect(documentId).toBeDefined();
      expect(uploadUrl).toContain('https://');

      // Step 2: Simulate S3 upload completion event
      const s3Event: S3Event = {
        Records: [{
          eventVersion: '2.1',
          eventSource: 'aws:s3',
          awsRegion: 'eu-west-1',
          eventTime: new Date().toISOString(),
          eventName: 's3:ObjectCreated:Put',
          s3: {
            s3SchemaVersion: '1.0',
            configurationId: 'test-config',
            bucket: {
              name: process.env.S3_BUCKET_NAME || 'scalemap-documents-test',
              ownerIdentity: { principalId: 'test' },
              arn: `arn:aws:s3:::${process.env.S3_BUCKET_NAME || 'scalemap-documents-test'}`
            },
            object: {
              key: `${TEST_COMPANY_ID}/${TEST_ASSESSMENT_ID}/raw/${documentId}.pdf`,
              size: 1024 * 1024,
              eTag: 'test-etag',
              sequencer: 'test-sequencer'
            }
          }
        } as any]
      };

      // Mock Textract for processing
      const mockTextractResult = {
        text: 'Financial Report Q4 2024\n\nRevenue: $1,000,000\nExpenses: $750,000\nNet Income: $250,000\n\nThis report shows strong financial performance across all metrics.',
        confidence: 0.95,
        tables: [],
        forms: [],
        processingTime: 2500,
        pageCount: 3
      };

      jest.doMock('../../services/textract-service', () => ({
        TextractService: jest.fn().mockImplementation(() => ({
          analyzeDocument: jest.fn().mockResolvedValue(mockTextractResult)
        }))
      }));

      // Process the document
      await processHandler(s3Event);

      // Step 3: Verify document was processed
      const processedDocument = await documentService.getDocument(
        TEST_ASSESSMENT_ID,
        documentId,
        TEST_COMPANY_ID
      );

      expect(processedDocument).toBeTruthy();
      expect(processedDocument!.status).toBe('completed');
      expect(processedDocument!.extractedText).toContain('Financial Report Q4 2024');
      expect(processedDocument!.extractedText).toContain('Revenue: $1,000,000');

      // Step 4: Categorize the document
      const categorizeEvent: APIGatewayProxyEvent = {
        requestContext: { requestId: 'test-categorize-request' } as any,
        pathParameters: {
          assessmentId: TEST_ASSESSMENT_ID,
          documentId
        },
        headers: { 'Authorization': 'Bearer test-token' },
        body: JSON.stringify({
          documentId
        })
      } as unknown as APIGatewayProxyEvent;

      // Mock OpenAI for categorization
      jest.doMock('../../services/openai-service', () => ({
        OpenAIService: jest.fn().mockImplementation(() => ({
          generateCompletion: jest.fn().mockResolvedValue(JSON.stringify({
            primaryCategory: 'Finance & Accounting',
            confidence: 0.94,
            reasoning: 'Document contains financial statements with revenue, expenses, and income data',
            suggestions: [
              {
                domain: 'Finance & Accounting',
                confidence: 0.94,
                reasoning: 'Contains revenue, expenses, and financial metrics'
              },
              {
                domain: 'Strategy & Planning',
                confidence: 0.72,
                reasoning: 'Quarterly performance data relevant to strategic planning'
              }
            ]
          }))
        }))
      }));

      const categorizeResult = await categorizeHandler(categorizeEvent);
      expect(categorizeResult.statusCode).toBe(200);

      const categorizeResponse = JSON.parse(categorizeResult.body);
      expect(categorizeResponse.success).toBe(true);
      expect(categorizeResponse.data.category).toBe('Finance & Accounting');
      expect(categorizeResponse.data.confidence).toBe(0.94);

      // Step 5: Verify final document state
      const finalDocument = await documentService.getDocument(
        TEST_ASSESSMENT_ID,
        documentId,
        TEST_COMPANY_ID
      );

      expect(finalDocument).toBeTruthy();
      expect(finalDocument!.status).toBe('completed');
      expect(finalDocument!.category).toBe('Finance & Accounting');
      expect(finalDocument!.confidence).toBe(0.94);
      expect(finalDocument!.suggestedCategories).toBeDefined();
      expect(finalDocument!.suggestedCategories!.length).toBeGreaterThan(0);

      // Step 6: Test document listing and statistics
      const documentList = await documentService.listDocuments(
        TEST_ASSESSMENT_ID,
        TEST_COMPANY_ID
      );

      expect(documentList.documents.length).toBeGreaterThan(0);
      const foundDocument = documentList.documents.find(d => d.documentId === documentId);
      expect(foundDocument).toBeTruthy();
      expect(foundDocument!.originalFilename).toBe('test-financial-report.pdf');

      const statistics = await documentService.getDocumentStatistics(
        TEST_ASSESSMENT_ID,
        TEST_COMPANY_ID
      );

      expect(statistics.total).toBeGreaterThan(0);
      expect(statistics.byCategory['Finance & Accounting']).toBeGreaterThan(0);
      expect(statistics.byStatus.completed).toBeGreaterThan(0);

      // Cleanup: Delete the test document
      await documentService.deleteDocument(
        TEST_ASSESSMENT_ID,
        documentId,
        TEST_COMPANY_ID,
        TEST_USER_ID
      );
    }, 30000); // 30 second timeout for integration test

    it('should handle document processing errors gracefully', async () => {
      // Test error handling in the workflow
      const uploadEvent: APIGatewayProxyEvent = {
        requestContext: { requestId: 'test-error-request' } as any,
        pathParameters: { assessmentId: TEST_ASSESSMENT_ID },
        headers: { 'Authorization': 'Bearer test-token' },
        body: JSON.stringify({
          filename: 'corrupted-document.pdf',
          contentType: 'application/pdf',
          size: 512 * 1024 // 512KB
        })
      } as unknown as APIGatewayProxyEvent;

      const uploadResult = await uploadHandler(uploadEvent);
      const uploadResponse = JSON.parse(uploadResult.body);
      const documentId = uploadResponse.data.documentId;

      // Simulate processing failure
      const s3Event: S3Event = {
        Records: [{
          s3: {
            object: {
              key: `${TEST_COMPANY_ID}/${TEST_ASSESSMENT_ID}/raw/${documentId}.pdf`,
              size: 512 * 1024
            },
            bucket: {
              name: process.env.S3_BUCKET_NAME || 'scalemap-documents-test'
            }
          }
        } as any]
      };

      // Mock Textract failure
      jest.doMock('../../services/textract-service', () => ({
        TextractService: jest.fn().mockImplementation(() => ({
          analyzeDocument: jest.fn().mockRejectedValue(new Error('Document corrupted or unreadable'))
        }))
      }));

      await processHandler(s3Event);

      // Verify document shows failed status
      const failedDocument = await documentService.getDocument(
        TEST_ASSESSMENT_ID,
        documentId,
        TEST_COMPANY_ID
      );

      expect(failedDocument).toBeTruthy();
      expect(failedDocument!.status).toBe('failed');
      expect(failedDocument!.processingErrors).toBeDefined();
      expect(failedDocument!.processingErrors!.length).toBeGreaterThan(0);

      // Test retry functionality
      await documentService.retryProcessing(
        TEST_ASSESSMENT_ID,
        documentId,
        TEST_COMPANY_ID
      );

      const retriedDocument = await documentService.getDocument(
        TEST_ASSESSMENT_ID,
        documentId,
        TEST_COMPANY_ID
      );

      expect(retriedDocument!.status).toBe('pending');

      // Cleanup
      await documentService.deleteDocument(
        TEST_ASSESSMENT_ID,
        documentId,
        TEST_COMPANY_ID,
        TEST_USER_ID
      );
    });

    it('should enforce security and access controls', async () => {
      // Test that documents are properly isolated by company
      const uploadEvent: APIGatewayProxyEvent = {
        requestContext: { requestId: 'test-security-request' } as any,
        pathParameters: { assessmentId: TEST_ASSESSMENT_ID },
        headers: { 'Authorization': 'Bearer test-token' },
        body: JSON.stringify({
          filename: 'confidential-document.pdf',
          contentType: 'application/pdf',
          size: 256 * 1024
        })
      } as unknown as APIGatewayProxyEvent;

      const uploadResult = await uploadHandler(uploadEvent);
      const uploadResponse = JSON.parse(uploadResult.body);
      const documentId = uploadResponse.data.documentId;

      // Try to access document from different company
      const differentCompanyId = 'different-company-id';

      const documentFromDifferentCompany = await documentService.getDocument(
        TEST_ASSESSMENT_ID,
        documentId,
        differentCompanyId
      );

      expect(documentFromDifferentCompany).toBeNull();

      // Verify document list is also filtered by company
      const documentListDifferentCompany = await documentService.listDocuments(
        TEST_ASSESSMENT_ID,
        differentCompanyId
      );

      const foundInDifferentCompany = documentListDifferentCompany.documents.find(
        d => d.documentId === documentId
      );
      expect(foundInDifferentCompany).toBeUndefined();

      // Cleanup
      await documentService.deleteDocument(
        TEST_ASSESSMENT_ID,
        documentId,
        TEST_COMPANY_ID,
        TEST_USER_ID
      );
    });

    it('should handle concurrent document uploads', async () => {
      const concurrentUploads = Array(5).fill(null).map((_, index) => {
        const uploadEvent: APIGatewayProxyEvent = {
          requestContext: { requestId: `concurrent-request-${index}` } as any,
          pathParameters: { assessmentId: TEST_ASSESSMENT_ID },
          headers: { 'Authorization': 'Bearer test-token' },
          body: JSON.stringify({
            filename: `concurrent-doc-${index}.pdf`,
            contentType: 'application/pdf',
            size: (index + 1) * 128 * 1024 // Variable sizes
          })
        } as unknown as APIGatewayProxyEvent;

        return uploadHandler(uploadEvent);
      });

      const results = await Promise.all(concurrentUploads);

      // All uploads should succeed
      results.forEach((result, index) => {
        expect(result.statusCode).toBe(200);
        const response = JSON.parse(result.body);
        expect(response.success).toBe(true);
        expect(response.data.documentId).toBeDefined();
      });

      // Extract document IDs for cleanup
      const documentIds = results.map(result => {
        const response = JSON.parse(result.body);
        return response.data.documentId;
      });

      // Verify all documents are listed
      const documentList = await documentService.listDocuments(
        TEST_ASSESSMENT_ID,
        TEST_COMPANY_ID
      );

      const concurrentDocuments = documentList.documents.filter(doc =>
        documentIds.includes(doc.documentId)
      );

      expect(concurrentDocuments.length).toBe(5);

      // Cleanup all concurrent documents
      await Promise.all(documentIds.map(documentId =>
        documentService.deleteDocument(
          TEST_ASSESSMENT_ID,
          documentId,
          TEST_COMPANY_ID,
          TEST_USER_ID
        )
      ));
    });
  });

  describe('Document search and filtering', () => {
    it('should support advanced document filtering', async () => {
      // Create test documents with different categories and statuses
      const testDocuments = [
        { filename: 'hr-policy.pdf', category: 'HR & People' },
        { filename: 'financial-report.pdf', category: 'Finance & Accounting' },
        { filename: 'tech-specs.pdf', category: 'Technology & IT' }
      ];

      const documentIds: string[] = [];

      for (const testDoc of testDocuments) {
        const uploadEvent: APIGatewayProxyEvent = {
          requestContext: { requestId: `filter-test-${testDoc.category}` } as any,
          pathParameters: { assessmentId: TEST_ASSESSMENT_ID },
          headers: { 'Authorization': 'Bearer test-token' },
          body: JSON.stringify({
            filename: testDoc.filename,
            contentType: 'application/pdf',
            size: 128 * 1024,
            domain: testDoc.category
          })
        } as unknown as APIGatewayProxyEvent;

        const result = await uploadHandler(uploadEvent);
        const response = JSON.parse(result.body);
        documentIds.push(response.data.documentId);
      }

      // Test category filtering
      const hrDocuments = await documentService.listDocuments(
        TEST_ASSESSMENT_ID,
        TEST_COMPANY_ID,
        { category: 'HR & People' }
      );

      expect(hrDocuments.documents.length).toBeGreaterThan(0);
      expect(hrDocuments.documents.every(doc => doc.category === 'HR & People')).toBe(true);

      // Test filename search
      const searchResults = await documentService.listDocuments(
        TEST_ASSESSMENT_ID,
        TEST_COMPANY_ID,
        { search: 'financial' }
      );

      expect(searchResults.documents.length).toBeGreaterThan(0);
      expect(searchResults.documents.some(doc =>
        doc.originalFilename.toLowerCase().includes('financial')
      )).toBe(true);

      // Test pagination
      const firstPage = await documentService.listDocuments(
        TEST_ASSESSMENT_ID,
        TEST_COMPANY_ID,
        { page: 1, limit: 2 }
      );

      expect(firstPage.documents.length).toBeLessThanOrEqual(2);
      expect(firstPage.pagination.page).toBe(1);
      expect(firstPage.pagination.limit).toBe(2);

      // Cleanup
      await Promise.all(documentIds.map(documentId =>
        documentService.deleteDocument(
          TEST_ASSESSMENT_ID,
          documentId,
          TEST_COMPANY_ID,
          TEST_USER_ID
        )
      ));
    });
  });
});