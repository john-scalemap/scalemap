import {
  LoginCredentials,
  AuthTokens,
  AuthUser,
  AuthError,
  ApiResponse,
  UserRole
} from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as bcrypt from 'bcrypt';

import { db } from '../../services/database';
import { jwtService } from '../../services/jwt';
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
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'login' });

  try {
    requestLogger.info('Login attempt initiated');
    Monitoring.incrementCounter('LoginAttempts');

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_CREDENTIALS', 'Request body is required', requestId);
    }

    const credentials: LoginCredentials = JSON.parse(event.body);

    // Validate required fields
    const validationError = validateCredentials(credentials);
    if (validationError) {
      return createErrorResponse(400, validationError.code, validationError.message, requestId);
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

      // Use same error message to avoid email enumeration
      return createErrorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password', requestId);
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

      Monitoring.incrementCounter('LoginFailures', { reason: 'account_inactive' });
      return createErrorResponse(403, errorCode, errorMessage, requestId);
    }

    // Verify password
    const passwordHash = userRecord.passwordHash as string;
    const passwordValid = await bcrypt.compare(credentials.password, passwordHash);

    if (!passwordValid) {
      requestLogger.warn('Login attempt with invalid password', {
        userId: userRecord.id,
        email: credentials.email
      });
      Monitoring.incrementCounter('LoginFailures', { reason: 'invalid_password' });

      return createErrorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password', requestId);
    }

    // Get company information
    const companyRecord = await db.get(`COMPANY#${userRecord.companyId}`, 'METADATA');
    if (!companyRecord) {
      requestLogger.error('Company not found for user', {
        userId: userRecord.id,
        companyId: userRecord.companyId
      });
      return createErrorResponse(500, 'INTERNAL_ERROR', 'Account configuration error', requestId);
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

    // Create session record in database
    const sessionId = `${userRecord.id}:${Date.now()}`;
    const sessionData = {
      PK: `SESSION#${sessionId}`,
      SK: 'METADATA',
      GSI2PK: `USER#${userRecord.id}`,
      GSI2SK: `SESSION#${new Date().toISOString()}`,
      sessionId,
      userId: userRecord.id,
      deviceId: event.headers?.['User-Agent']?.substring(0, 50) || 'unknown',
      ipAddress: event.requestContext?.identity?.sourceIp || 'unknown',
      userAgent: event.headers?.['User-Agent'] || 'unknown',
      expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(), // 7 days
      refreshToken: tokens.refreshToken,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      TTL: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
    };

    // Store session and update user last login
    await Promise.all([
      db.put(sessionData),
      db.update(
        `USER#${userRecord.id}`,
        'METADATA',
        'SET lastLoginAt = :lastLogin',
        { ':lastLogin': new Date().toISOString() }
      )
    ]);

    requestLogger.info('Login successful', {
      userId: userRecord.id,
      email: credentials.email,
      role: userRecord.role,
      sessionId
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
      tokens
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';"
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    Monitoring.recordError('login', 'UnexpectedError', error as Error);
    requestLogger.error('Login failed', { error: (error as Error).message });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
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