import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

import { authorization } from '../../services/authorization';
import { db } from '../../services/database';
import { S3Service } from '../../services/s3-service';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';


interface DocumentUploadRequest {
  filename: string;
  contentType: string;
  size: number;
  domain?: string;
}

interface DocumentUploadResponse {
  uploadUrl: string;
  documentId: string;
  maxFileSize: number;
  allowedTypes: string[];
  expiresAt: string;
}

// Supported file types as per AC requirements
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB as per requirements
const UPLOAD_URL_EXPIRY = 300; // 5 minutes

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'upload-handler' });

  try {
    requestLogger.info('Document upload URL request initiated');
    Monitoring.incrementCounter('DocumentUploadUrlRequests');

    // Extract assessment ID from path
    const assessmentId = event.pathParameters?.assessmentId;
    if (!assessmentId) {
      return createErrorResponse(400, 'MISSING_ASSESSMENT_ID', 'Assessment ID is required', requestId);
    }

    // Authenticate and authorize user
    const authResult = await authorization.authenticateAndAuthorize(
      event,
      'assessments:update',
      { assessmentId }
    );

    if (!authResult.success) {
      return createErrorResponse(401, 'UNAUTHORIZED', authResult.message || 'Unauthorized', requestId);
    }

    const { user } = authResult;
    if (!user) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not found in auth result', requestId);
    }

    // Validate request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId);
    }

    const uploadRequest: DocumentUploadRequest = JSON.parse(event.body);

    // Validate upload request
    const validationError = validateUploadRequest(uploadRequest);
    if (validationError) {
      return createErrorResponse(400, validationError.code, validationError.message, requestId);
    }

    // Verify assessment exists and belongs to user's company
    const assessment = await db.get(`ASSESSMENT#${assessmentId}`, 'METADATA');
    if (!assessment) {
      requestLogger.warn('Assessment not found', { assessmentId, userId: user.sub });
      return createErrorResponse(404, 'ASSESSMENT_NOT_FOUND', 'Assessment not found', requestId);
    }

    if (assessment.companyId !== user.companyId) {
      requestLogger.warn('Access denied to assessment', {
        assessmentId,
        userId: user.sub,
        userCompanyId: user.companyId,
        assessmentCompanyId: assessment.companyId
      });
      return createErrorResponse(403, 'ACCESS_DENIED', 'Access denied to assessment', requestId);
    }

    // Check total document count and size limits
    const existingDocuments = await db.query(
      'PK = :assessmentId AND begins_with(SK, :docPrefix)',
      {
        ':assessmentId': `ASSESSMENT#${assessmentId}`,
        ':docPrefix': 'DOCUMENT#'
      }
    );

    const totalSize = existingDocuments.reduce((sum, doc) => {
      const docData = doc.Data as any;
      return sum + (docData?.metadata?.fileSize || 0);
    }, 0);
    const maxTotalSize = 500 * 1024 * 1024; // 500MB total per assessment

    if (totalSize + uploadRequest.size > maxTotalSize) {
      return createErrorResponse(413, 'STORAGE_LIMIT_EXCEEDED', 'Total storage limit exceeded for assessment', requestId);
    }

    // Generate document ID and S3 key
    const documentId = uuidv4();
    const s3Service = new S3Service();
    const s3Key = generateS3Key(user.companyId, assessmentId, documentId, uploadRequest.filename);

    // Generate presigned upload URL
    const uploadUrl = await s3Service.getPresignedUploadUrl(
      s3Key,
      uploadRequest.contentType,
      UPLOAD_URL_EXPIRY
    );

    // Create document metadata record in DynamoDB
    const documentRecord = {
      PK: `ASSESSMENT#${assessmentId}`,
      SK: `DOCUMENT#${documentId}`,
      GSI1PK: `COMPANY#${user.companyId}`,
      GSI1SK: `DOCUMENT#${new Date().toISOString()}`,
      EntityType: 'Document',
      Data: {
        documentId,
        assessmentId,
        companyId: user.companyId,
        metadata: {
          originalFilename: uploadRequest.filename,
          fileSize: uploadRequest.size,
          mimeType: uploadRequest.contentType,
          uploadedAt: new Date().toISOString(),
          uploadedBy: user.sub,
          status: 'pending_upload'
        },
        storage: {
          s3Key,
          s3Bucket: process.env.S3_BUCKET_NAME || 'scalemap-documents-prod',
          encryptionStatus: 'encrypted'
        },
        processing: {
          status: 'pending',
          extractedText: null,
          processingErrors: [],
          textractJobId: null
        },
        categorization: {
          category: uploadRequest.domain || null,
          confidence: null,
          manualOverride: uploadRequest.domain ? true : false,
          suggestedCategories: []
        }
      },
      TTL: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hour TTL for pending uploads
    };

    await db.put(documentRecord);

    requestLogger.info('Document upload URL generated', {
      documentId,
      assessmentId,
      userId: user.sub,
      filename: uploadRequest.filename,
      size: uploadRequest.size,
      domain: uploadRequest.domain
    });

    Monitoring.incrementCounter('DocumentUploadUrlGenerated', {
      domain: uploadRequest.domain || 'unspecified',
      fileType: uploadRequest.contentType
    });

    const response: DocumentUploadResponse = {
      uploadUrl,
      documentId,
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes: ALLOWED_FILE_TYPES,
      expiresAt: new Date(Date.now() + (UPLOAD_URL_EXPIRY * 1000)).toISOString()
    };

    const apiResponse: ApiResponse<DocumentUploadResponse> = {
      success: true,
      data: response,
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
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      },
      body: JSON.stringify(apiResponse)
    };

  } catch (error) {
    Monitoring.recordError('upload-handler', 'UnexpectedError', error as Error);
    requestLogger.error('Document upload URL generation failed', { error: (error as Error).message });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

function validateUploadRequest(request: DocumentUploadRequest): { code: string; message: string } | null {
  // Validate filename
  if (!request.filename || typeof request.filename !== 'string' || request.filename.trim().length === 0) {
    return { code: 'INVALID_FILENAME', message: 'Valid filename is required' };
  }

  // Validate filename length and characters
  if (request.filename.length > 255) {
    return { code: 'INVALID_FILENAME', message: 'Filename too long (max 255 characters)' };
  }

  // Check for dangerous filename patterns
  const dangerousPatterns = [/\.\./g, /[<>:"|?*]/g, /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i];
  if (dangerousPatterns.some(pattern => pattern.test(request.filename))) {
    return { code: 'INVALID_FILENAME', message: 'Filename contains invalid characters' };
  }

  // Validate content type
  if (!request.contentType || !ALLOWED_FILE_TYPES.includes(request.contentType)) {
    return {
      code: 'UNSUPPORTED_FILE_TYPE',
      message: `Unsupported file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`
    };
  }

  // Validate file size
  if (!request.size || typeof request.size !== 'number' || request.size <= 0) {
    return { code: 'INVALID_FILE_SIZE', message: 'Valid file size is required' };
  }

  if (request.size > MAX_FILE_SIZE) {
    return {
      code: 'FILE_TOO_LARGE',
      message: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  // Validate domain if provided
  if (request.domain && typeof request.domain !== 'string') {
    return { code: 'INVALID_DOMAIN', message: 'Domain must be a valid string' };
  }

  return null;
}

function generateS3Key(companyId: string, assessmentId: string, documentId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileExtension = sanitizedFilename.split('.').pop() || 'unknown';

  return `${companyId}/${assessmentId}/raw/${documentId}.${fileExtension}`;
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
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    },
    body: JSON.stringify(response),
  };
}