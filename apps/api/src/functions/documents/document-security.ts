import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';

import { authorization } from '../../services/authorization';
import { db } from '../../services/database';
import { DocumentService } from '../../services/document-service';
import { S3Service } from '../../services/s3-service';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface DocumentAccessLog {
  documentId: string;
  userId: string;
  action: 'view' | 'download' | 'delete' | 'update';
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: Record<string, any>;
}

interface GDPRRetentionPolicy {
  assessmentId: string;
  companyId: string;
  retentionPeriodDays: number;
  deletionScheduledAt: string;
  documents: Array<{
    documentId: string;
    s3Key: string;
    originalFilename: string;
  }>;
}

interface DocumentData {
  documentId: string;
  companyId: string;
  assessmentId: string;
  originalFilename: string;
  fileSize: number;
  contentType: string;
  s3Key: string;
  uploadedBy: string;
  uploadedAt: string;
  processing?: {
    status: string;
    extractedText?: string;
  };
  categorization?: {
    category?: string;
    confidence?: number;
  };
}

interface AssessmentData {
  assessmentId: string;
  companyId: string;
  status: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Log document access for audit trail
 */
export const logDocumentAccess = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'log-document-access' });

  try {
    // Extract parameters
    const assessmentId = event.pathParameters?.assessmentId;
    const documentId = event.pathParameters?.documentId;
    const action = event.queryStringParameters?.action as DocumentAccessLog['action'];

    if (!assessmentId || !documentId || !action) {
      return createErrorResponse(400, 'MISSING_PARAMETERS', 'Assessment ID, document ID, and action are required', requestId);
    }

    // Authenticate user
    const authResult = await authorization.authenticateAndAuthorize(
      event,
      'assessments:read',
      { assessmentId }
    );

    if (!authResult.success) {
      return createErrorResponse(401, 'UNAUTHORIZED', authResult.message || 'Unauthorized', requestId);
    }

    const { user } = authResult;
    if (!user) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not found in auth result', requestId);
    }

    // Verify document access
    const documentService = new DocumentService();
    const document = await documentService.getDocument(assessmentId, documentId, user.companyId);

    if (!document) {
      // Log failed access attempt
      await logAccessAttempt({
        documentId,
        userId: user.sub,
        action,
        timestamp: new Date().toISOString(),
        ipAddress: event.requestContext?.identity?.sourceIp || 'unknown',
        userAgent: event.headers?.['User-Agent'] || 'unknown',
        success: false,
        details: { reason: 'document_not_found' }
      });

      return createErrorResponse(404, 'DOCUMENT_NOT_FOUND', 'Document not found', requestId);
    }

    // Log successful access
    await logAccessAttempt({
      documentId,
      userId: user.sub,
      action,
      timestamp: new Date().toISOString(),
      ipAddress: event.requestContext?.identity?.sourceIp || 'unknown',
      userAgent: event.headers?.['User-Agent'] || 'unknown',
      success: true,
      details: {
        filename: document.originalFilename,
        fileSize: document.fileSize,
        category: document.category
      }
    });

    requestLogger.info('Document access logged', {
      documentId,
      userId: user.sub,
      action,
      success: true
    });

    Monitoring.incrementCounter('DocumentAccess', {
      action,
      success: 'true'
    });

    const response: ApiResponse<{ logged: boolean }> = {
      success: true,
      data: { logged: true },
      meta: {
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    Monitoring.recordError('log-document-access', 'UnexpectedError', error as Error);
    requestLogger.error('Failed to log document access', { error: (error as Error).message });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

/**
 * GDPR compliance - scheduled cleanup of expired documents
 */
export const gdprCleanupScheduled = async (event: ScheduledEvent): Promise<void> => {
  const requestLogger = logger.child({ function: 'gdpr-cleanup-scheduled' });

  try {
    requestLogger.info('Starting GDPR compliance cleanup');

    // Default retention period: 7 years after assessment completion
    const defaultRetentionDays = 7 * 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - defaultRetentionDays);

    // Find assessments that are past retention period
    const expiredAssessments = await findExpiredAssessments(cutoffDate);

    requestLogger.info('Found expired assessments for cleanup', {
      count: expiredAssessments.length,
      cutoffDate: cutoffDate.toISOString()
    });

    let cleanedDocuments = 0;
    let cleanedAssessments = 0;

    for (const assessment of expiredAssessments) {
      try {
        const documentsDeleted = await cleanupAssessmentDocuments(assessment.assessmentId);
        cleanedDocuments += documentsDeleted;
        cleanedAssessments++;

        requestLogger.info('Cleaned up assessment documents', {
          assessmentId: assessment.assessmentId,
          documentsDeleted
        });

      } catch (cleanupError) {
        requestLogger.error('Failed to cleanup assessment', {
          assessmentId: assessment.assessmentId,
          error: (cleanupError as Error).message
        });
      }
    }

    // Clean up old access logs (keep for 2 years)
    const logCutoffDate = new Date();
    logCutoffDate.setDate(logCutoffDate.getDate() - (2 * 365));
    await cleanupOldAccessLogs(logCutoffDate);

    requestLogger.info('GDPR cleanup completed', {
      cleanedAssessments,
      cleanedDocuments,
      totalExpiredAssessments: expiredAssessments.length
    });

    Monitoring.incrementCounter('GDPRCleanupCompleted', {
      assessments: cleanedAssessments.toString(),
      documents: cleanedDocuments.toString()
    });

  } catch (error) {
    Monitoring.recordError('gdpr-cleanup', 'CleanupError', error as Error);
    requestLogger.error('GDPR cleanup failed', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Validate document access permissions
 */
export const validateDocumentAccess = async (
  userId: string,
  companyId: string,
  documentId: string,
  action: 'read' | 'write' | 'delete'
): Promise<{ allowed: boolean; reason?: string }> => {
  const requestLogger = logger.child({ function: 'validate-document-access' });

  try {
    // Find document record
    const documents = await db.query(
      'begins_with(SK, :docPrefix)',
      { ':docPrefix': `DOCUMENT#${documentId}` }
    );

    const document = documents.find(doc =>
      doc.EntityType === 'Document' &&
      (doc.Data as DocumentData)?.documentId === documentId
    );

    if (!document) {
      return { allowed: false, reason: 'Document not found' };
    }

    // Check company ownership
    const documentData = document.Data as DocumentData;
    if (documentData.companyId !== companyId) {
      await logAccessAttempt({
        documentId,
        userId,
        action: action as DocumentAccessLog['action'],
        timestamp: new Date().toISOString(),
        ipAddress: 'system',
        userAgent: 'system',
        success: false,
        details: { reason: 'company_mismatch' }
      });

      return { allowed: false, reason: 'Access denied - company mismatch' };
    }

    // Check if assessment is still active
    const assessmentId = documentData.assessmentId;
    const assessment = await db.get(`ASSESSMENT#${assessmentId}`, 'METADATA');

    if (!assessment) {
      return { allowed: false, reason: 'Assessment not found' };
    }

    // Allow access if assessment belongs to same company
    if (assessment.companyId === companyId) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Access denied' };

  } catch (error) {
    requestLogger.error('Document access validation failed', {
      userId,
      companyId,
      documentId,
      action,
      error: (error as Error).message
    });

    return { allowed: false, reason: 'Validation error' };
  }
};

/**
 * Create audit log entry for document access
 */
async function logAccessAttempt(logEntry: DocumentAccessLog): Promise<void> {
  try {
    const logRecord = {
      PK: `AUDIT#DOCUMENT#${logEntry.documentId}`,
      SK: `ACCESS#${logEntry.timestamp}#${logEntry.userId}`,
      GSI1PK: `USER#${logEntry.userId}`,
      GSI1SK: `ACCESS#${logEntry.timestamp}`,
      EntityType: 'DocumentAccessLog',
      Data: logEntry,
      TTL: Math.floor(Date.now() / 1000) + (2 * 365 * 24 * 60 * 60) // 2 years TTL
    };

    await db.put(logRecord);

  } catch (error) {
    logger.error('Failed to log document access', {
      documentId: logEntry.documentId,
      userId: logEntry.userId,
      error: (error as Error).message
    });
  }
}

/**
 * Find assessments past retention period
 */
async function findExpiredAssessments(cutoffDate: Date): Promise<Array<{ assessmentId: string; companyId: string; completedAt: string }>> {
  try {
    // Query assessments by completion date using GSI2
    const allAssessments = await db.query(
      'EntityType = :entityType',
      { ':entityType': 'Assessment' }
    );

    // Filter assessments completed before cutoff date
    const expiredAssessments = allAssessments.filter(assessment => {
      const assessmentData = assessment.Data as AssessmentData;
      const completedAt = assessmentData?.completedAt;
      if (!completedAt) return false;

      const completionDate = new Date(completedAt);
      return completionDate < cutoffDate;
    });

    return expiredAssessments.map(assessment => {
      const assessmentData = assessment.Data as AssessmentData;
      return {
        assessmentId: assessmentData.assessmentId,
        companyId: assessmentData.companyId,
        completedAt: assessmentData.completedAt || ''
      };
    });

  } catch (error) {
    logger.error('Failed to find expired assessments', {
      cutoffDate: cutoffDate.toISOString(),
      error: (error as Error).message
    });
    return [];
  }
}

/**
 * Clean up all documents for an assessment
 */
async function cleanupAssessmentDocuments(assessmentId: string): Promise<number> {
  try {
    const s3Service = new S3Service();
    let deletedCount = 0;

    // Get all documents for the assessment
    const documents = await db.query(
      'PK = :assessmentId AND begins_with(SK, :docPrefix)',
      {
        ':assessmentId': `ASSESSMENT#${assessmentId}`,
        ':docPrefix': 'DOCUMENT#'
      }
    );

    // Delete each document from S3 and DynamoDB
    for (const document of documents) {
      try {
        const data = document.Data;

        // Delete from S3
        const docData = data as { storage: { s3Key: string }, documentId: string };
        await s3Service.deleteDocument(docData.storage.s3Key);

        // Delete processed content if exists
        const processedKey = docData.storage.s3Key.replace('/raw/', '/processed/').replace(/\.[^.]+$/, '.json');
        try {
          await s3Service.deleteDocument(processedKey);
        } catch (processedError) {
          // Ignore if processed file doesn't exist
        }

        // Delete from DynamoDB
        await db.delete(
          `ASSESSMENT#${assessmentId}`,
          `DOCUMENT#${docData.documentId}`
        );

        deletedCount++;

      } catch (docError) {
        logger.error('Failed to delete individual document', {
          assessmentId,
          documentId: (document.Data as DocumentData)?.documentId,
          error: (docError as Error).message
        });
      }
    }

    return deletedCount;

  } catch (error) {
    logger.error('Failed to cleanup assessment documents', {
      assessmentId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Clean up old access logs
 */
async function cleanupOldAccessLogs(cutoffDate: Date): Promise<void> {
  try {
    const cutoffISO = cutoffDate.toISOString();

    // Find old access logs using query
    const oldLogs = await db.query(
      'begins_with(PK, :auditPrefix) AND SK < :cutoff',
      {
        ':auditPrefix': 'AUDIT#DOCUMENT#',
        ':cutoff': `ACCESS#${cutoffISO}`
      }
    );

    // Delete old logs in batches
    const batchSize = 25; // DynamoDB batch write limit
    for (let i = 0; i < oldLogs.length; i += batchSize) {
      const batch = oldLogs.slice(i, i + batchSize);

      await Promise.all(
        batch.map(log => {
          const logData = log as { PK: string, SK: string };
          return db.delete(logData.PK, logData.SK);
        })
      );
    }

    logger.info('Cleaned up old access logs', {
      count: oldLogs.length,
      cutoffDate: cutoffISO
    });

  } catch (error) {
    logger.error('Failed to cleanup old access logs', {
      cutoffDate: cutoffDate.toISOString(),
      error: (error as Error).message
    });
  }
}

function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId: string
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: { code, message },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS'
    },
    body: JSON.stringify(response),
  };
}