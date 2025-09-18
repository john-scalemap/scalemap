import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

import { auditLogger } from '../services/audit-logger';
import { corsPolicy } from '../services/cors-policy';

import { logger } from './logger';
import { Monitoring } from './monitoring';

export interface ErrorContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  functionName?: string;
}

export interface SecuritySensitiveError {
  code: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  shouldAudit: boolean;
  category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'SESSION' | 'DATA_ACCESS' | 'SECURITY' | 'SYSTEM';
}

export class ErrorHandler {
  private readonly PRODUCTION_ENV = process.env.NODE_ENV === 'production';
  private readonly STAGING_ENV = process.env.NODE_ENV === 'staging';
  private readonly HIDE_DETAILS = this.PRODUCTION_ENV || this.STAGING_ENV;

  // Standardized error codes and messages
  private readonly ERROR_DEFINITIONS: Record<string, SecuritySensitiveError> = {
    // Authentication Errors
    'ACCOUNT_SUSPENDED': {
      code: 'ACCOUNT_SUSPENDED',
      message: 'Account is suspended',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'AUTHENTICATION'
    },
    'EMAIL_NOT_VERIFIED': {
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address before logging in',
      severity: 'LOW',
      shouldAudit: true,
      category: 'AUTHENTICATION'
    },
    'TOKEN_EXPIRED': {
      code: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired',
      severity: 'LOW',
      shouldAudit: false,
      category: 'AUTHENTICATION'
    },
    'TOKEN_INVALID': {
      code: 'TOKEN_INVALID',
      message: 'Invalid authentication token',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'AUTHENTICATION'
    },

    // Authorization Errors
    'UNAUTHORIZED': {
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'AUTHORIZATION'
    },
    'FORBIDDEN': {
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'AUTHORIZATION'
    },
    'MISSING_PERMISSIONS': {
      code: 'MISSING_PERMISSIONS',
      message: 'Missing required permissions',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'AUTHORIZATION'
    },

    // Session Errors
    'SESSION_EXPIRED': {
      code: 'SESSION_EXPIRED',
      message: 'Session has expired. Please log in again.',
      severity: 'LOW',
      shouldAudit: false,
      category: 'SESSION'
    },
    'SESSION_INVALID': {
      code: 'SESSION_INVALID',
      message: 'Invalid session. Please log in again.',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'SESSION'
    },
    'SESSION_REVOKED': {
      code: 'SESSION_REVOKED',
      message: 'Session has been revoked. Please log in again.',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'SESSION'
    },

    // Rate Limiting
    'RATE_LIMIT_EXCEEDED': {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'SECURITY'
    },

    // Data Validation
    'INVALID_REQUEST': {
      code: 'INVALID_REQUEST',
      message: 'Invalid request data',
      severity: 'LOW',
      shouldAudit: false,
      category: 'SYSTEM'
    },
    'INVALID_CREDENTIALS': {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'AUTHENTICATION'
    },
    'MISSING_REQUIRED_FIELDS': {
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'Required fields are missing',
      severity: 'LOW',
      shouldAudit: false,
      category: 'SYSTEM'
    },

    // Resource Errors
    'RESOURCE_NOT_FOUND': {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Requested resource not found',
      severity: 'LOW',
      shouldAudit: false,
      category: 'SYSTEM'
    },
    'RESOURCE_CONFLICT': {
      code: 'RESOURCE_CONFLICT',
      message: 'Resource conflict detected',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'DATA_ACCESS'
    },

    // Internal Errors
    'INTERNAL_ERROR': {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      severity: 'HIGH',
      shouldAudit: true,
      category: 'SYSTEM'
    },
    'DATABASE_ERROR': {
      code: 'DATABASE_ERROR',
      message: 'Database operation failed',
      severity: 'HIGH',
      shouldAudit: true,
      category: 'SYSTEM'
    },
    'EXTERNAL_SERVICE_ERROR': {
      code: 'EXTERNAL_SERVICE_ERROR',
      message: 'External service unavailable',
      severity: 'MEDIUM',
      shouldAudit: true,
      category: 'SYSTEM'
    }
  };

  /**
   * Create standardized error response
   */
  async createErrorResponse(
    statusCode: number,
    errorCode: string,
    context: ErrorContext,
    customMessage?: string,
    details?: Record<string, any>
  ): Promise<APIGatewayProxyResult> {
    const errorDef = this.ERROR_DEFINITIONS[errorCode];
    const finalMessage = customMessage || errorDef?.message || 'An error occurred';

    // Audit security-sensitive errors
    if (errorDef?.shouldAudit) {
      await this.auditSecurityError(errorCode, errorDef, context, details);
    }

    // Log error for monitoring
    this.logError(statusCode, errorCode, finalMessage, context, details);

    // Create response without sensitive information
    const response: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message: this.sanitizeErrorMessage(finalMessage, statusCode),
        ...(this.shouldIncludeDetails(statusCode) && details ? { details } : {})
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: context.requestId
      }
    };

    return {
      statusCode,
      headers: this.getErrorHeaders(),
      body: JSON.stringify(response)
    };
  }

  /**
   * Handle unexpected errors
   */
  async handleUnexpectedError(
    error: Error,
    context: ErrorContext,
    functionName?: string
  ): Promise<APIGatewayProxyResult> {
    const errorId = this.generateErrorId();

    // Log detailed error information
    logger.error('Unexpected error occurred', {
      errorId,
      error: error.message,
      stack: this.HIDE_DETAILS ? undefined : error.stack,
      context,
      functionName: functionName || context.functionName
    });

    // Record error metrics
    Monitoring.recordError(
      functionName || context.functionName || 'unknown',
      'UnexpectedError',
      error
    );

    // Audit high-severity errors
    await auditLogger.logSecurityEvent({
      eventType: 'SUSPICIOUS_ACTIVITY',
      userId: context.userId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      severity: 'HIGH',
      details: {
        errorId,
        errorMessage: error.message,
        functionName: functionName || context.functionName,
        endpoint: context.endpoint,
        method: context.method
      },
      requestId: context.requestId
    });

    return this.createErrorResponse(
      500,
      'INTERNAL_ERROR',
      context,
      undefined,
      this.HIDE_DETAILS ? { errorId } : { errorId, error: error.message }
    );
  }

  /**
   * Handle validation errors
   */
  async handleValidationError(
    validationErrors: Array<{ field: string; message: string }>,
    context: ErrorContext
  ): Promise<APIGatewayProxyResult> {
    // Log validation error
    logger.warn('Validation error', {
      validationErrors,
      context
    });

    return this.createErrorResponse(
      400,
      'INVALID_REQUEST',
      context,
      'Request validation failed',
      { validationErrors }
    );
  }

  /**
   * Handle database errors
   */
  async handleDatabaseError(
    error: Error,
    operation: string,
    context: ErrorContext
  ): Promise<APIGatewayProxyResult> {
    const errorId = this.generateErrorId();

    logger.error('Database error', {
      errorId,
      operation,
      error: error.message,
      context
    });

    Monitoring.recordError('database', 'DatabaseError', error);

    // High severity for database errors
    await auditLogger.logSecurityEvent({
      eventType: 'SECURITY_VIOLATION',
      userId: context.userId,
      severity: 'HIGH',
      details: {
        errorId,
        operation,
        errorMessage: error.message
      },
      requestId: context.requestId
    });

    return this.createErrorResponse(
      500,
      'DATABASE_ERROR',
      context,
      undefined,
      { errorId, operation }
    );
  }

  /**
   * Handle external service errors
   */
  async handleExternalServiceError(
    service: string,
    error: Error,
    context: ErrorContext
  ): Promise<APIGatewayProxyResult> {
    const errorId = this.generateErrorId();

    logger.error('External service error', {
      errorId,
      service,
      error: error.message,
      context
    });

    Monitoring.recordError('external-service', 'ExternalServiceError', error);

    return this.createErrorResponse(
      502,
      'EXTERNAL_SERVICE_ERROR',
      context,
      `${service} service is currently unavailable`,
      { errorId, service }
    );
  }

  /**
   * Create authentication error response
   */
  async createAuthErrorResponse(
    errorCode: string,
    context: ErrorContext,
    customMessage?: string
  ): Promise<APIGatewayProxyResult> {
    const statusCode = errorCode === 'UNAUTHORIZED' ? 401 : 403;

    const response = await this.createErrorResponse(
      statusCode,
      errorCode,
      context,
      customMessage
    );

    // Add WWW-Authenticate header for 401 responses
    if (statusCode === 401) {
      const headers = JSON.parse(JSON.stringify(response.headers));
      headers['WWW-Authenticate'] = 'Bearer realm="scalemap-api"';
      return { ...response, headers };
    }

    return response;
  }

  /**
   * Audit security-sensitive errors
   */
  private async auditSecurityError(
    errorCode: string,
    errorDef: SecuritySensitiveError,
    context: ErrorContext,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await auditLogger.logSecurityEvent({
        eventType: 'SECURITY_VIOLATION',
        userId: context.userId,
        sessionId: context.sessionId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        severity: errorDef.severity,
        details: {
          errorCode,
          endpoint: context.endpoint,
          method: context.method,
          functionName: context.functionName,
          ...details
        },
        requestId: context.requestId
      });
    } catch (auditError) {
      // Don't fail the request if auditing fails
      logger.error('Failed to audit security error', {
        auditError: (auditError as Error).message,
        originalError: errorCode,
        context
      });
    }
  }

  /**
   * Log error for monitoring and debugging
   */
  private logError(
    statusCode: number,
    errorCode: string,
    message: string,
    context: ErrorContext,
    details?: Record<string, any>
  ): void {
    const logData = {
      statusCode,
      errorCode,
      message,
      context,
      details
    };

    if (statusCode >= 500) {
      logger.error('Server error', logData);
    } else if (statusCode >= 400) {
      logger.warn('Client error', logData);
    } else {
      logger.info('Error response', logData);
    }

    // Record metrics
    Monitoring.incrementCounter('ErrorResponses', {
      statusCode: statusCode.toString(),
      errorCode,
      endpoint: context.endpoint || 'unknown'
    });
  }

  /**
   * Sanitize error messages for production
   */
  private sanitizeErrorMessage(message: string, statusCode: number): string {
    if (!this.HIDE_DETAILS) {
      return message;
    }

    // Don't expose internal details in production
    if (statusCode >= 500) {
      return 'Internal server error';
    }

    // Client errors can be more specific but still sanitized
    return message;
  }

  /**
   * Determine if error details should be included
   */
  private shouldIncludeDetails(statusCode: number): boolean {
    // Only include details for client errors in non-production
    return statusCode < 500 && !this.HIDE_DETAILS;
  }

  /**
   * Get standardized error headers
   */
  private getErrorHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...corsPolicy.getAllHeaders(),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    };
  }

  /**
   * Generate unique error ID for tracking
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Check if error code is defined
   */
  isKnownErrorCode(errorCode: string): boolean {
    return errorCode in this.ERROR_DEFINITIONS;
  }

  /**
   * Get error definition
   */
  getErrorDefinition(errorCode: string): SecuritySensitiveError | undefined {
    return this.ERROR_DEFINITIONS[errorCode];
  }
}

// Default error handler instance
export const errorHandler = new ErrorHandler();

// Convenience functions for common error responses
export const createAuthError = (
  errorCode: string,
  context: ErrorContext,
  customMessage?: string
) => errorHandler.createAuthErrorResponse(errorCode, context, customMessage);

export const createValidationError = (
  validationErrors: Array<{ field: string; message: string }>,
  context: ErrorContext
) => errorHandler.handleValidationError(validationErrors, context);

export const createDatabaseError = (
  error: Error,
  operation: string,
  context: ErrorContext
) => errorHandler.handleDatabaseError(error, operation, context);

export const createUnexpectedError = (
  error: Error,
  context: ErrorContext,
  functionName?: string
) => errorHandler.handleUnexpectedError(error, context, functionName);