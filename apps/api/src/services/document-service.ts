import { logger } from '../utils/logger';
import { Monitoring } from '../utils/monitoring';

import { db } from './database';
import { S3Service } from './s3-service';
import { TextractService } from './textract-service';

export interface DocumentListItem {
  documentId: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  status: 'pending_upload' | 'pending' | 'processing' | 'completed' | 'failed';
  category?: string;
  confidence?: number;
  manualOverride?: boolean;
  hasPreview: boolean;
  downloadUrl?: string;
}

export interface DocumentDetails extends DocumentListItem {
  extractedText?: string;
  processingErrors?: string[];
  textractJobId?: string;
  processingTime?: number;
  suggestedCategories?: Array<{
    domain: string;
    confidence: number;
    reasoning: string;
  }>;
  s3Key: string;
  encryptionStatus: string;
}

// Internal document data structure from database
interface DocumentData {
  documentId: string;
  companyId: string;
  metadata: {
    originalFilename: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
    uploadedBy: string;
  };
  storage: {
    s3Key: string;
    encryptionStatus: string;
  };
  processing: {
    status: 'pending_upload' | 'pending' | 'processing' | 'completed' | 'failed';
    extractedText?: string;
    processingErrors?: string[];
    textractJobId?: string;
    processingTime?: number;
  };
  categorization: {
    category?: string;
    confidence?: number;
    manualOverride?: boolean;
    suggestedCategories?: Array<{
      domain: string;
      confidence: number;
      reasoning: string;
    }>;
  };
}

export interface DocumentSearchOptions {
  category?: string;
  status?: string;
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class DocumentService {
  private s3Service: S3Service;
  private textractService: TextractService;
  private serviceLogger = logger.child({ service: 'DocumentService' });

  constructor() {
    this.s3Service = new S3Service();
    this.textractService = new TextractService();
  }

  /**
   * List documents for an assessment with filtering and pagination
   */
  async listDocuments(
    assessmentId: string,
    companyId: string,
    options: DocumentSearchOptions = {}
  ): Promise<{
    documents: DocumentListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      this.serviceLogger.info('Listing documents', { assessmentId, companyId, options });

      // Query documents from DynamoDB
      const documents = await db.query(
        'PK = :assessmentId AND begins_with(SK, :docPrefix)',
        {
          ':assessmentId': `ASSESSMENT#${assessmentId}`,
          ':docPrefix': 'DOCUMENT#'
        }
      );

      // Filter documents by company
      let filteredDocuments = documents.filter(doc =>
        doc.EntityType === 'Document' &&
        (doc.Data as DocumentData)?.companyId === companyId
      );

      // Apply filters
      if (options.category) {
        filteredDocuments = filteredDocuments.filter(doc =>
          (doc.Data as DocumentData)?.categorization?.category === options.category
        );
      }

      if (options.status) {
        filteredDocuments = filteredDocuments.filter(doc =>
          (doc.Data as DocumentData)?.processing?.status === options.status
        );
      }

      if (options.uploadedBy) {
        filteredDocuments = filteredDocuments.filter(doc =>
          (doc.Data as DocumentData)?.metadata?.uploadedBy === options.uploadedBy
        );
      }

      if (options.dateFrom) {
        filteredDocuments = filteredDocuments.filter(doc =>
          (doc.Data as DocumentData)?.metadata?.uploadedAt >= options.dateFrom!
        );
      }

      if (options.dateTo) {
        filteredDocuments = filteredDocuments.filter(doc =>
          (doc.Data as DocumentData)?.metadata?.uploadedAt <= options.dateTo!
        );
      }

      if (options.search) {
        const searchLower = options.search.toLowerCase();
        filteredDocuments = filteredDocuments.filter(doc => {
          const data = doc.Data as DocumentData;
          return data?.metadata?.originalFilename?.toLowerCase().includes(searchLower) ||
                 data?.processing?.extractedText?.toLowerCase().includes(searchLower);
        });
      }

      // Sort by upload date (newest first)
      filteredDocuments.sort((a, b) => {
        const aData = a.Data as DocumentData;
        const bData = b.Data as DocumentData;
        return new Date(bData.metadata.uploadedAt).getTime() -
               new Date(aData.metadata.uploadedAt).getTime();
      });

      // Apply pagination
      const page = options.page || 1;
      const limit = options.limit || 20;
      const startIndex = (page - 1) * limit;
      const paginatedDocuments = filteredDocuments.slice(startIndex, startIndex + limit);

      // Transform to DocumentListItem format
      const documentList: DocumentListItem[] = await Promise.all(
        paginatedDocuments.map(async (doc) => {
          const data = doc.Data as DocumentData;
          let downloadUrl: string | undefined;

          // Generate download URL for completed documents
          if (data.processing.status === 'completed') {
            try {
              downloadUrl = await this.s3Service.getPresignedDownloadUrl(data.storage.s3Key, 3600);
            } catch (error) {
              this.serviceLogger.warn('Failed to generate download URL', {
                documentId: data.documentId,
                error: (error as Error).message
              });
            }
          }

          return {
            documentId: data.documentId,
            originalFilename: data.metadata.originalFilename,
            fileSize: data.metadata.fileSize,
            mimeType: data.metadata.mimeType,
            uploadedAt: data.metadata.uploadedAt,
            uploadedBy: data.metadata.uploadedBy,
            status: data.processing.status,
            category: data.categorization.category,
            confidence: data.categorization.confidence,
            manualOverride: data.categorization.manualOverride,
            hasPreview: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'].includes(data.metadata.mimeType),
            downloadUrl
          };
        })
      );

      return {
        documents: documentList,
        pagination: {
          page,
          limit,
          total: filteredDocuments.length,
          totalPages: Math.ceil(filteredDocuments.length / limit)
        }
      };

    } catch (error) {
      this.serviceLogger.error('Failed to list documents', {
        assessmentId,
        companyId,
        error: (error as Error).message
      });
      throw new Error(`Failed to list documents: ${(error as Error).message}`);
    }
  }

  /**
   * Get detailed document information
   */
  async getDocument(
    assessmentId: string,
    documentId: string,
    companyId: string
  ): Promise<DocumentDetails | null> {
    try {
      this.serviceLogger.info('Getting document details', { assessmentId, documentId, companyId });

      const document = await db.get(
        `ASSESSMENT#${assessmentId}`,
        `DOCUMENT#${documentId}`
      );

      if (!document || (document.Data as DocumentData)?.companyId !== companyId) {
        return null;
      }

      const data = document.Data as DocumentData;
      let downloadUrl: string | undefined;

      // Generate download URL for completed documents
      if (data.processing.status === 'completed') {
        try {
          downloadUrl = await this.s3Service.getPresignedDownloadUrl(data.storage.s3Key, 3600);
        } catch (error) {
          this.serviceLogger.warn('Failed to generate download URL', {
            documentId,
            error: (error as Error).message
          });
        }
      }

      return {
        documentId: data.documentId,
        originalFilename: data.metadata.originalFilename,
        fileSize: data.metadata.fileSize,
        mimeType: data.metadata.mimeType,
        uploadedAt: data.metadata.uploadedAt,
        uploadedBy: data.metadata.uploadedBy,
        status: data.processing.status,
        category: data.categorization.category,
        confidence: data.categorization.confidence,
        manualOverride: data.categorization.manualOverride,
        hasPreview: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'].includes(data.metadata.mimeType),
        downloadUrl,
        extractedText: data.processing.extractedText,
        processingErrors: data.processing.processingErrors,
        textractJobId: data.processing.textractJobId,
        processingTime: data.processing.processingTime,
        suggestedCategories: data.categorization.suggestedCategories,
        s3Key: data.storage.s3Key,
        encryptionStatus: data.storage.encryptionStatus
      };

    } catch (error) {
      this.serviceLogger.error('Failed to get document details', {
        assessmentId,
        documentId,
        companyId,
        error: (error as Error).message
      });
      throw new Error(`Failed to get document details: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(
    assessmentId: string,
    documentId: string,
    companyId: string,
    userId: string
  ): Promise<void> {
    try {
      this.serviceLogger.info('Deleting document', { assessmentId, documentId, companyId, userId });

      // Get document to verify ownership and get S3 key
      const document = await this.getDocument(assessmentId, documentId, companyId);
      if (!document) {
        throw new Error('Document not found or access denied');
      }

      // Delete from S3
      try {
        await this.s3Service.deleteDocument(document.s3Key);

        // Also try to delete processed content
        const processedKey = document.s3Key.replace('/raw/', '/processed/').replace(/\.[^.]+$/, '.json');
        await this.s3Service.deleteDocument(processedKey);
      } catch (s3Error) {
        this.serviceLogger.warn('Failed to delete S3 objects', {
          documentId,
          s3Key: document.s3Key,
          error: (s3Error as Error).message
        });
        // Continue with DynamoDB deletion even if S3 fails
      }

      // Delete from DynamoDB
      await db.delete(
        `ASSESSMENT#${assessmentId}`,
        `DOCUMENT#${documentId}`
      );

      Monitoring.incrementCounter('DocumentDeleted', {
        domain: document.category || 'uncategorized'
      });

      this.serviceLogger.info('Document deleted successfully', {
        assessmentId,
        documentId,
        userId
      });

    } catch (error) {
      this.serviceLogger.error('Failed to delete document', {
        assessmentId,
        documentId,
        companyId,
        userId,
        error: (error as Error).message
      });
      throw new Error(`Failed to delete document: ${(error as Error).message}`);
    }
  }

  /**
   * Get document statistics for an assessment
   */
  async getDocumentStatistics(
    assessmentId: string,
    companyId: string
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    totalSize: number;
    averageProcessingTime?: number;
  }> {
    try {
      this.serviceLogger.info('Getting document statistics', { assessmentId, companyId });

      const documents = await db.query(
        'PK = :assessmentId AND begins_with(SK, :docPrefix)',
        {
          ':assessmentId': `ASSESSMENT#${assessmentId}`,
          ':docPrefix': 'DOCUMENT#'
        }
      );

      const filteredDocuments = documents.filter(doc =>
        doc.EntityType === 'Document' &&
        (doc.Data as DocumentData)?.companyId === companyId
      );

      const stats = {
        total: filteredDocuments.length,
        byStatus: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        totalSize: 0,
        averageProcessingTime: undefined as number | undefined
      };

      let totalProcessingTime = 0;
      let processedCount = 0;

      filteredDocuments.forEach(doc => {
        const data = doc.Data as DocumentData;

        // Count by status
        const status = data.processing.status;
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        // Count by category
        const category = data.categorization.category || 'Uncategorized';
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

        // Sum total size
        stats.totalSize += data.metadata.fileSize || 0;

        // Calculate average processing time
        if (data.processing.processingTime) {
          totalProcessingTime += data.processing.processingTime;
          processedCount++;
        }
      });

      if (processedCount > 0) {
        stats.averageProcessingTime = Math.round(totalProcessingTime / processedCount);
      }

      return stats;

    } catch (error) {
      this.serviceLogger.error('Failed to get document statistics', {
        assessmentId,
        companyId,
        error: (error as Error).message
      });
      throw new Error(`Failed to get document statistics: ${(error as Error).message}`);
    }
  }

  /**
   * Retry processing for a failed document
   */
  async retryProcessing(
    assessmentId: string,
    documentId: string,
    companyId: string
  ): Promise<void> {
    try {
      this.serviceLogger.info('Retrying document processing', { assessmentId, documentId, companyId });

      // Verify document exists and belongs to company
      const document = await this.getDocument(assessmentId, documentId, companyId);
      if (!document) {
        throw new Error('Document not found or access denied');
      }

      if (document.status !== 'failed') {
        throw new Error('Document is not in failed status');
      }

      // Reset processing status
      await db.update(
        `ASSESSMENT#${assessmentId}`,
        `DOCUMENT#${documentId}`,
        'SET #processing.#status = :status, #processing.#errors = :errors, #processing.#retryAt = :retryAt',
        {
          ':status': 'pending',
          ':errors': [],
          ':retryAt': new Date().toISOString()
        },
        {
          '#processing': 'processing',
          '#status': 'status',
          '#errors': 'processingErrors',
          '#retryAt': 'retryAt'
        }
      );

      // Trigger processing by simulating S3 event (in a real implementation,
      // this would trigger the actual processing pipeline)
      this.serviceLogger.info('Document processing retry initiated', {
        assessmentId,
        documentId
      });

      Monitoring.incrementCounter('DocumentProcessingRetry');

    } catch (error) {
      this.serviceLogger.error('Failed to retry document processing', {
        assessmentId,
        documentId,
        companyId,
        error: (error as Error).message
      });
      throw new Error(`Failed to retry processing: ${(error as Error).message}`);
    }
  }

  /**
   * Update document metadata
   */
  async updateDocumentMetadata(
    assessmentId: string,
    documentId: string,
    companyId: string,
    updates: {
      originalFilename?: string;
      category?: string;
    }
  ): Promise<void> {
    try {
      this.serviceLogger.info('Updating document metadata', {
        assessmentId,
        documentId,
        companyId,
        updates
      });

      // Verify document exists and belongs to company
      const document = await this.getDocument(assessmentId, documentId, companyId);
      if (!document) {
        throw new Error('Document not found or access denied');
      }

      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      if (updates.originalFilename) {
        updateExpressions.push('#metadata.#originalFilename = :filename');
        expressionAttributeNames['#metadata'] = 'metadata';
        expressionAttributeNames['#originalFilename'] = 'originalFilename';
        expressionAttributeValues[':filename'] = updates.originalFilename;
      }

      if (updates.category) {
        updateExpressions.push('#categorization.#category = :category, #categorization.#manualOverride = :override');
        expressionAttributeNames['#categorization'] = 'categorization';
        expressionAttributeNames['#category'] = 'category';
        expressionAttributeValues[':category'] = updates.category;
        expressionAttributeValues[':override'] = true;
      }

      if (updateExpressions.length === 0) {
        return; // No updates to perform
      }

      const updateExpression = `SET ${updateExpressions.join(', ')}`;

      await db.update(
        `ASSESSMENT#${assessmentId}`,
        `DOCUMENT#${documentId}`,
        updateExpression,
        expressionAttributeValues,
        expressionAttributeNames
      );

      this.serviceLogger.info('Document metadata updated successfully', {
        assessmentId,
        documentId
      });

    } catch (error) {
      this.serviceLogger.error('Failed to update document metadata', {
        assessmentId,
        documentId,
        companyId,
        updates,
        error: (error as Error).message
      });
      throw new Error(`Failed to update document metadata: ${(error as Error).message}`);
    }
  }
}