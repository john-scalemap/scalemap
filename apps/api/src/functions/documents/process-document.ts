import { S3Event, S3EventRecord } from 'aws-lambda';

import { db } from '../../services/database';
import { S3Service } from '../../services/s3-service';
import { TextractService } from '../../services/textract-service';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface DocumentProcessingResult {
  success: boolean;
  documentId: string;
  extractedText?: string;
  confidence?: number;
  processingTime: number;
  error?: string;
}

export const handler = async (event: S3Event): Promise<void> => {
  const requestLogger = logger.child({ function: 'process-document' });

  try {
    requestLogger.info('Document processing started', { recordCount: event.Records.length });

    // Process each S3 event record
    const results = await Promise.allSettled(
      event.Records.map(record => processDocumentRecord(record, requestLogger))
    );

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    requestLogger.info('Document processing completed', {
      total: results.length,
      successful,
      failed
    });

    Monitoring.incrementCounter('DocumentProcessingBatch', {
      successful: successful.toString(),
      failed: failed.toString()
    });

  } catch (error) {
    Monitoring.recordError('process-document', 'BatchProcessingError', error as Error);
    requestLogger.error('Document processing batch failed', { error: (error as Error).message });
    throw error;
  }
};

async function processDocumentRecord(
  record: S3EventRecord,
  requestLogger: any
): Promise<DocumentProcessingResult> {
  const startTime = Date.now();
  const s3Key = record.s3.object.key;
  const bucketName = record.s3.bucket.name;

  try {
    requestLogger.info('Processing document', { s3Key, bucketName });

    // Parse document ID from S3 key
    const documentId = extractDocumentIdFromKey(s3Key);
    if (!documentId) {
      throw new Error(`Unable to extract document ID from S3 key: ${s3Key}`);
    }

    // Find document record in DynamoDB
    const documentRecord = await findDocumentRecord(documentId);
    if (!documentRecord) {
      throw new Error(`Document record not found for ID: ${documentId}`);
    }

    const assessmentId = documentRecord.assessmentId;

    // Update document status to processing
    await updateDocumentStatus(assessmentId, documentId, 'processing', {
      processingStartedAt: new Date().toISOString()
    });

    // Initialize services
    const textractService = new TextractService();
    const s3Service = new S3Service();

    // Check file size to determine processing method
    const fileSize = record.s3.object.size;
    const useSyncProcessing = fileSize < 5 * 1024 * 1024; // 5MB threshold

    let extractedText = '';
    let confidence = 0;
    let processingError: string | undefined;

    try {
      if (useSyncProcessing) {
        // Synchronous processing for small files
        const result = await textractService.analyzeDocument(bucketName, s3Key);

        extractedText = result.text;
        confidence = result.confidence;

        requestLogger.info('Synchronous processing completed', {
          documentId,
          textLength: extractedText.length,
          confidence
        });

      } else {
        // Asynchronous processing for large files
        const jobResult = await textractService.startDocumentAnalysis(bucketName, s3Key);

        // Store job ID for later polling
        await updateDocumentStatus(assessmentId, documentId, 'processing', {
          textractJobId: jobResult.jobId,
          processingMethod: 'async'
        });

        requestLogger.info('Asynchronous processing started', {
          documentId,
          jobId: jobResult.jobId
        });

        // For async processing, we'll handle completion in a separate function
        // triggered by Textract completion notifications
        return {
          success: true,
          documentId,
          processingTime: Date.now() - startTime
        };
      }

    } catch (textractError) {
      processingError = `Textract processing failed: ${(textractError as Error).message}`;
      requestLogger.error('Textract processing failed', {
        documentId,
        error: processingError
      });
    }

    // Update document with processing results
    const updateData: any = {
      processingCompletedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime
    };

    if (processingError) {
      updateData.status = 'failed';
      updateData.processingErrors = [processingError];
    } else {
      updateData.status = 'completed';
      updateData.extractedText = extractedText;
      updateData.confidence = confidence;
      updateData.processingErrors = [];
    }

    await updateDocumentProcessing(assessmentId, documentId, updateData);

    // Create processed document storage
    if (extractedText && !processingError) {
      await storeProcessedContent(s3Service, s3Key, {
        documentId,
        extractedText,
        confidence,
        processingTime: Date.now() - startTime,
        processedAt: new Date().toISOString()
      });
    }

    const result: DocumentProcessingResult = {
      success: !processingError,
      documentId,
      extractedText: processingError ? undefined : extractedText,
      confidence: processingError ? undefined : confidence,
      processingTime: Date.now() - startTime,
      error: processingError
    };

    Monitoring.incrementCounter('DocumentProcessed', {
      success: result.success.toString(),
      method: useSyncProcessing ? 'sync' : 'async'
    });

    requestLogger.info('Document processing completed', result);

    return result;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    requestLogger.error('Document processing failed', {
      s3Key,
      error: errorMessage,
      processingTime
    });

    // Try to update document status to failed
    try {
      const documentId = extractDocumentIdFromKey(s3Key);
      if (documentId) {
        const documentRecord = await findDocumentRecord(documentId);
        if (documentRecord) {
          await updateDocumentStatus(documentRecord.assessmentId, documentId, 'failed', {
            processingErrors: [errorMessage],
            processingCompletedAt: new Date().toISOString()
          });
        }
      }
    } catch (updateError) {
      requestLogger.error('Failed to update document status after error', {
        updateError: (updateError as Error).message
      });
    }

    Monitoring.recordError('process-document', 'ProcessingError', error as Error);

    throw error;
  }
}

function extractDocumentIdFromKey(s3Key: string): string | null {
  // Expected format: {companyId}/{assessmentId}/raw/{documentId}.{ext}
  const parts = s3Key.split('/');
  if (parts.length >= 4 && parts[2] === 'raw' && parts[3]) {
    const filename = parts[3];
    const documentId = filename.split('.')[0];
    return documentId || null;
  }
  return null;
}

async function findDocumentRecord(documentId: string): Promise<any> {
  // Query documents by GSI to find the document record
  const records = await db.query(
    'begins_with(SK, :docPrefix)',
    { ':docPrefix': `DOCUMENT#${documentId}` }
  );

  const documentRecord = records.find(record => {
    const rec = record as any;
    return rec.EntityType === 'Document' && rec.Data?.documentId === documentId;
  });

  return documentRecord?.Data || null;
}

async function updateDocumentStatus(
  assessmentId: string,
  documentId: string,
  status: string,
  additionalData: Record<string, any> = {}
): Promise<void> {
  let updateExpression = 'SET #processing.#status = :status';
  const expressionAttributeNames: Record<string, string> = {
    '#processing': 'processing',
    '#status': 'status'
  };
  const expressionAttributeValues: Record<string, any> = {
    ':status': status
  };

  // Add additional fields to update
  Object.entries(additionalData).forEach(([key, value], index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;

    updateExpression += `, #processing.${attrName} = ${attrValue}`;
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = value;
  });

  await db.update(
    `ASSESSMENT#${assessmentId}`,
    `DOCUMENT#${documentId}`,
    updateExpression,
    expressionAttributeValues,
    expressionAttributeNames
  );
}

async function updateDocumentProcessing(
  assessmentId: string,
  documentId: string,
  processingData: Record<string, any>
): Promise<void> {
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(processingData).forEach(([key, value], index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;

    updateExpressions.push(`#processing.${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = value;
  });

  expressionAttributeNames['#processing'] = 'processing';

  const updateExpression = `SET ${updateExpressions.join(', ')}`;

  await db.update(
    `ASSESSMENT#${assessmentId}`,
    `DOCUMENT#${documentId}`,
    updateExpression,
    expressionAttributeValues,
    expressionAttributeNames
  );
}

async function storeProcessedContent(
  s3Service: S3Service,
  originalS3Key: string,
  processedData: {
    documentId: string;
    extractedText: string;
    confidence: number;
    processingTime: number;
    processedAt: string;
  }
): Promise<void> {
  // Generate processed content S3 key
  const processedKey = originalS3Key.replace('/raw/', '/processed/').replace(/\.[^.]+$/, '.json');

  const processedContent = {
    documentId: processedData.documentId,
    extractedText: processedData.extractedText,
    confidence: processedData.confidence,
    processingTime: processedData.processingTime,
    processedAt: processedData.processedAt,
    metadata: {
      originalKey: originalS3Key,
      processingVersion: '1.0'
    }
  };

  const buffer = Buffer.from(JSON.stringify(processedContent, null, 2));

  await s3Service.uploadDocument(processedKey, buffer, {
    originalName: `${processedData.documentId}.json`,
    size: buffer.length,
    contentType: 'application/json',
    uploadedAt: new Date().toISOString(),
    assessmentId: 'processed'
  });
}