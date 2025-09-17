import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { authorization } from '../../services/authorization';
import { DocumentService } from '../../services/document-service';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

/**
 * List documents for an assessment with filtering
 */
export const listDocuments = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'list-documents' });

  try {
    requestLogger.info('List documents request initiated');

    const assessmentId = event.pathParameters?.assessmentId;
    if (!assessmentId) {
      return createErrorResponse(400, 'MISSING_ASSESSMENT_ID', 'Assessment ID is required', requestId);
    }

    // Authenticate and authorize user
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

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const searchOptions = {
      category: queryParams.category,
      status: queryParams.status,
      uploadedBy: queryParams.uploadedBy,
      dateFrom: queryParams.dateFrom,
      dateTo: queryParams.dateTo,
      search: queryParams.search,
      page: queryParams.page ? parseInt(queryParams.page) : 1,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 20
    };

    // Get documents
    const documentService = new DocumentService();
    const result = await documentService.listDocuments(assessmentId, user.companyId, searchOptions);

    Monitoring.incrementCounter('DocumentsListed', {
      assessmentId,
      totalDocuments: result.documents.length.toString()
    });

    const apiResponse: ApiResponse<typeof result> = {
      success: true,
      data: result,
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
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(apiResponse)
    };

  } catch (error) {
    Monitoring.recordError('list-documents', 'UnexpectedError', error as Error);
    requestLogger.error('List documents failed', { error: (error as Error).message });
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

/**
 * Get document details
 */
export const getDocument = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'get-document' });

  try {
    const assessmentId = event.pathParameters?.assessmentId;
    const documentId = event.pathParameters?.documentId;

    if (!assessmentId || !documentId) {
      return createErrorResponse(400, 'MISSING_PARAMETERS', 'Assessment ID and document ID are required', requestId);
    }

    // Authenticate and authorize user
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

    // Get document details
    const documentService = new DocumentService();
    const document = await documentService.getDocument(assessmentId, documentId, user.companyId);

    if (!document) {
      return createErrorResponse(404, 'DOCUMENT_NOT_FOUND', 'Document not found', requestId);
    }

    const apiResponse: ApiResponse<typeof document> = {
      success: true,
      data: document,
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
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(apiResponse)
    };

  } catch (error) {
    Monitoring.recordError('get-document', 'UnexpectedError', error as Error);
    requestLogger.error('Get document failed', { error: (error as Error).message });
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'delete-document' });

  try {
    const assessmentId = event.pathParameters?.assessmentId;
    const documentId = event.pathParameters?.documentId;

    if (!assessmentId || !documentId) {
      return createErrorResponse(400, 'MISSING_PARAMETERS', 'Assessment ID and document ID are required', requestId);
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

    // Delete document
    const documentService = new DocumentService();
    await documentService.deleteDocument(assessmentId, documentId, user.companyId, user.sub);

    const apiResponse: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
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
        'Access-Control-Allow-Methods': 'DELETE,OPTIONS'
      },
      body: JSON.stringify(apiResponse)
    };

  } catch (error) {
    Monitoring.recordError('delete-document', 'UnexpectedError', error as Error);
    requestLogger.error('Delete document failed', { error: (error as Error).message });
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

/**
 * Update document metadata
 */
export const updateDocument = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'update-document' });

  try {
    const assessmentId = event.pathParameters?.assessmentId;
    const documentId = event.pathParameters?.documentId;

    if (!assessmentId || !documentId) {
      return createErrorResponse(400, 'MISSING_PARAMETERS', 'Assessment ID and document ID are required', requestId);
    }

    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId);
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

    // Parse and validate update request
    const updateData = JSON.parse(event.body);
    const allowedUpdates = ['originalFilename', 'category'];
    const updates: any = {};

    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = updateData[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return createErrorResponse(400, 'NO_VALID_UPDATES', 'No valid update fields provided', requestId);
    }

    // Update document metadata
    const documentService = new DocumentService();
    await documentService.updateDocumentMetadata(assessmentId, documentId, user.companyId, updates);

    const apiResponse: ApiResponse<{ updated: boolean }> = {
      success: true,
      data: { updated: true },
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
        'Access-Control-Allow-Methods': 'PUT,PATCH,OPTIONS'
      },
      body: JSON.stringify(apiResponse)
    };

  } catch (error) {
    Monitoring.recordError('update-document', 'UnexpectedError', error as Error);
    requestLogger.error('Update document failed', { error: (error as Error).message });
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

/**
 * Retry document processing
 */
export const retryProcessing = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'retry-processing' });

  try {
    const assessmentId = event.pathParameters?.assessmentId;
    const documentId = event.pathParameters?.documentId;

    if (!assessmentId || !documentId) {
      return createErrorResponse(400, 'MISSING_PARAMETERS', 'Assessment ID and document ID are required', requestId);
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

    // Retry processing
    const documentService = new DocumentService();
    await documentService.retryProcessing(assessmentId, documentId, user.companyId);

    const apiResponse: ApiResponse<{ retryInitiated: boolean }> = {
      success: true,
      data: { retryInitiated: true },
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
      body: JSON.stringify(apiResponse)
    };

  } catch (error) {
    Monitoring.recordError('retry-processing', 'UnexpectedError', error as Error);
    requestLogger.error('Retry processing failed', { error: (error as Error).message });
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

/**
 * Get document statistics for an assessment
 */
export const getDocumentStatistics = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'get-document-statistics' });

  try {
    const assessmentId = event.pathParameters?.assessmentId;
    if (!assessmentId) {
      return createErrorResponse(400, 'MISSING_ASSESSMENT_ID', 'Assessment ID is required', requestId);
    }

    // Authenticate and authorize user
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

    // Get document statistics
    const documentService = new DocumentService();
    const statistics = await documentService.getDocumentStatistics(assessmentId, user.companyId);

    const apiResponse: ApiResponse<typeof statistics> = {
      success: true,
      data: statistics,
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
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(apiResponse)
    };

  } catch (error) {
    Monitoring.recordError('get-document-statistics', 'UnexpectedError', error as Error);
    requestLogger.error('Get document statistics failed', { error: (error as Error).message });
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

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
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    },
    body: JSON.stringify(response),
  };
}