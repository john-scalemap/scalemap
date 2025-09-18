import {
  LoginCredentials,
  AuthTokens,
  AuthUser,
  AuthError,
  ApiResponse,
  UserRole
} from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as bcrypt from 'bcryptjs';

import { authRateLimiters } from '../../services/auth-rate-limiter';
import { auditLogger } from '../../services/audit-logger';
import { corsPolicy } from '../../services/cors-policy';
import { db } from '../../services/database';
import { jwtService } from '../../services/jwt';
import { sessionManager } from '../../services/session-manager';
import { errorHandler } from '../../utils/error-handler';
import { parseEventBody } from '../../utils/json-parser';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyId: string;
    role: string;
    emailVerified: boolean;
  };
  tokens: AuthTokens;
  sessionId: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'login' });

  try {
    requestLogger.info('Login attempt initiated');
    Monitoring.incrementCounter('LoginAttempts');

    // Check rate limit first
    const rateLimitResult = await authRateLimiters.login.checkRateLimit(event);
    if (!rateLimitResult.allowed) {
      requestLogger.warn('Login attempt rate limited', {
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      });
      return rateLimitResult.result!;
    }

    // Parse request body
    const parseResult = parseEventBody<LoginCredentials>(event.body, requestId);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const credentials = parseResult.data;

    // Validate required fields
    const validationError = validateCredentials(credentials);
    if (validationError) {
      return errorHandler.createErrorResponse(400, validationError.code, {
        requestId,
        email: credentials.email,
        endpoint: event.path,
        method: event.httpMethod,
        functionName: 'login'
      }, validationError.message);
    }

    // Get user by email
    const userRecords = await db.query(
      'GSI1PK = :email',
      { ':email': `EMAIL#${credentials.email.toLowerCase()}` },
      { indexName: 'GSI1' }
    );

    if (userRecords.length === 0) {
      requestLogger.warn('Login attempt with non-existent email', {
        email: credentials.email
      });
      Monitoring.incrementCounter('LoginFailures', { reason: 'user_not_found' });

      // Log failed authentication attempt
      await auditLogger.logAuthEvent({
        eventType: 'LOGIN_FAILED',
        email: credentials.email,
        ipAddress: event.requestContext?.identity?.sourceIp,
        userAgent: event.headers?.['User-Agent'],
        outcome: 'FAILURE',
        details: { reason: 'user_not_found' },
        requestId
      });

      // Use same error message to avoid email enumeration
      return errorHandler.createErrorResponse(401, 'INVALID_CREDENTIALS', {
        requestId,
        email: credentials.email,
        ipAddress: event.requestContext?.identity?.sourceIp,
        userAgent: event.headers?.['User-Agent'],
        endpoint: event.path,
        method: event.httpMethod,
        functionName: 'login'
      });
    }

    const userRecord = userRecords[0]!; // Safe: we checked length > 0 above

    // Check if user account is active
    if (userRecord.status !== 'active') {
      requestLogger.warn('Login attempt on inactive account', {
        userId: userRecord.id,
        status: userRecord.status
      });

      let errorCode = 'ACCOUNT_SUSPENDED';
      let errorMessage = 'Account is suspended';

      if (userRecord.status === 'pending') {
        errorCode = 'EMAIL_NOT_VERIFIED';
        errorMessage = 'Please verify your email address before logging in';
      }

      // Log failed authentication attempt
      await auditLogger.logAuthEvent({
        eventType: 'LOGIN_FAILED',
        userId: userRecord.id as string,
        email: credentials.email,
        ipAddress: event.requestContext?.identity?.sourceIp,
        userAgent: event.headers?.['User-Agent'],
        outcome: 'FAILURE',
        details: { reason: 'account_inactive', status: userRecord.status },
        requestId
      });

      Monitoring.incrementCounter('LoginFailures', { reason: 'account_inactive' });
      return errorHandler.createErrorResponse(403, errorCode, {
        requestId,
        userId: userRecord.id as string,
        email: credentials.email,
        ipAddress: event.requestContext?.identity?.sourceIp,
        userAgent: event.headers?.['User-Agent'],
        endpoint: event.path,
        method: event.httpMethod,
        functionName: 'login'
      }, errorMessage);
    }

    // Verify password
    const passwordHash = userRecord.passwordHash as string;
    const passwordValid = await bcrypt.compare(credentials.password, passwordHash);

    if (!passwordValid) {
      requestLogger.warn('Login attempt with invalid password', {
        userId: userRecord.id,
        email: credentials.email
      });

      // Log failed authentication attempt
      await auditLogger.logAuthEvent({
        eventType: 'LOGIN_FAILED',
        userId: userRecord.id as string,
        email: credentials.email,
        ipAddress: event.requestContext?.identity?.sourceIp,
        userAgent: event.headers?.['User-Agent'],
        outcome: 'FAILURE',
        details: { reason: 'invalid_password' },
        requestId
      });

      Monitoring.incrementCounter('LoginFailures', { reason: 'invalid_password' });

      return errorHandler.createErrorResponse(401, 'INVALID_CREDENTIALS', {
        requestId,
        userId: userRecord.id as string,
        email: credentials.email,
        ipAddress: event.requestContext?.identity?.sourceIp,
        userAgent: event.headers?.['User-Agent'],
        endpoint: event.path,
        method: event.httpMethod,
        functionName: 'login'
      });
    }

    // Get company information
    const companyRecord = await db.get(`COMPANY#${userRecord.companyId}`, 'METADATA');
    if (!companyRecord) {
      requestLogger.error('Company not found for user', {
        userId: userRecord.id,
        companyId: userRecord.companyId
      });
      return errorHandler.createErrorResponse(500, 'INTERNAL_ERROR', {
        requestId,
        userId: userRecord.id as string,
        endpoint: event.path,
        method: event.httpMethod,
        functionName: 'login'
      }, 'Account configuration error');
    }

    // Build AuthUser object for JWT generation
    const authUser: AuthUser = {
      id: userRecord.id as string,
      email: userRecord.email as string,
      firstName: userRecord.firstName as string,
      lastName: userRecord.lastName as string,
      companyId: userRecord.companyId as string,
      role: userRecord.role as UserRole,
      emailVerified: userRecord.emailVerified as boolean,
      permissions: getPermissionsForRole(userRecord.role as string)
    };

    // Generate JWT tokens
    const tokens = await jwtService.generateTokens(authUser);

    // Create session using session manager
    const sessionData = await sessionManager.createSession({
      userId: userRecord.id as string,
      deviceId: event.headers?.['User-Agent']?.substring(0, 50) || 'unknown',
      ipAddress: event.requestContext?.identity?.sourceIp || 'unknown',
      userAgent: event.headers?.['User-Agent'] || 'unknown',
      refreshToken: tokens.refreshToken
    });

    // Update user last login
    await db.update(
      `USER#${userRecord.id}`,
      'METADATA',
      'SET lastLoginAt = :lastLogin, updatedAt = :updatedAt',
      { ':lastLogin': new Date().toISOString() }
    );

    requestLogger.info('Login successful', {
      userId: userRecord.id,
      email: credentials.email,
      role: userRecord.role,
      sessionId: sessionData.sessionId
    });

    // Log successful authentication
    await auditLogger.logAuthEvent({
      eventType: 'LOGIN',
      userId: userRecord.id as string,
      email: credentials.email,
      sessionId: sessionData.sessionId,
      ipAddress: event.requestContext?.identity?.sourceIp,
      userAgent: event.headers?.['User-Agent'],
      outcome: 'SUCCESS',
      details: {
        role: userRecord.role,
        companyId: userRecord.companyId
      },
      requestId
    });

    // Log session creation
    await auditLogger.logSessionEvent({
      eventType: 'SESSION_CREATED',
      userId: userRecord.id as string,
      sessionId: sessionData.sessionId,
      ipAddress: event.requestContext?.identity?.sourceIp,
      userAgent: event.headers?.['User-Agent'],
      outcome: 'SUCCESS',
      details: {
        deviceId: sessionData.deviceId,
        expiresAt: sessionData.expiresAt
      },
      requestId
    });

    Monitoring.incrementCounter('LoginSuccess', {
      userRole: userRecord.role as string
    });

    // Prepare response
    const loginResponse: LoginResponse = {
      user: {
        id: authUser.id,
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        companyId: authUser.companyId,
        role: authUser.role,
        emailVerified: authUser.emailVerified
      },
      tokens,
      sessionId: sessionData.sessionId
    };

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: loginResponse,
      meta: {
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    return {
      statusCode: 200,
      headers: corsPolicy.getAllHeaders(event),
      body: JSON.stringify(response),
    };

  } catch (error) {
    return errorHandler.handleUnexpectedError(error as Error, {
      requestId,
      ipAddress: event.requestContext?.identity?.sourceIp,
      userAgent: event.headers?.['User-Agent'],
      endpoint: event.path,
      method: event.httpMethod,
      functionName: 'login'
    });
  }
};

function validateCredentials(credentials: LoginCredentials): AuthError | null {
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(credentials.email)) {
    return { code: 'INVALID_CREDENTIALS', message: 'Invalid email format' };
  }

  // Password validation
  if (!credentials.password || credentials.password.length < 1) {
    return { code: 'INVALID_CREDENTIALS', message: 'Password is required' };
  }

  return null;
}

function getPermissionsForRole(role: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    'admin': [
      'assessments:create',
      'assessments:read',
      'assessments:update',
      'assessments:delete',
      'agents:create',
      'agents:read',
      'agents:update',
      'agents:delete',
      'company:read',
      'company:update',
      'users:read',
      'users:update',
      'analytics:read'
    ],
    'user': [
      'assessments:create',
      'assessments:read',
      'assessments:update',
      'agents:read',
      'agents:update',
      'company:read',
      'analytics:read'
    ],
    'viewer': [
      'assessments:read',
      'agents:read',
      'company:read',
      'analytics:read'
    ]
  };

  return rolePermissions[role] || rolePermissions['viewer'] || [];
}

