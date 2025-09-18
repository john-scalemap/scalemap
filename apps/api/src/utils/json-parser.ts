import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

/**
 * Safely parse JSON from API Gateway event body with proper error handling
 */
export function parseEventBody<T>(
  body: string | null,
  requestId: string
): { success: true; data: T } | { success: false; response: APIGatewayProxyResult } {
  if (!body) {
    return {
      success: false,
      response: createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId)
    };
  }

  try {
    const parsed = JSON.parse(body) as T;
    return { success: true, data: parsed };
  } catch (parseError) {
    return {
      success: false,
      response: createErrorResponse(
        400,
        'INVALID_REQUEST',
        'Invalid JSON in request body',
        requestId
      )
    };
  }
}

/**
 * Create standardized error response
 */
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
      'Access-Control-Allow-Methods': 'POST,PUT,PATCH,DELETE,OPTIONS',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    },
    body: JSON.stringify(response),
  };
}