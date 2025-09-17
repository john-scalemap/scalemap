import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { withAuth, AuthenticatedEvent } from '../../shared/middleware/auth-middleware';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

const getProfileHandler = async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'get-profile' });

  try {
    requestLogger.info('User profile requested', { userId: event.user.sub });
    Monitoring.incrementCounter('ProfileGetRequests');

    const userId = event.user.sub;

    // Get user profile
    const userRecord = await db.get(`USER#${userId}`, 'METADATA');
    if (!userRecord) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User profile not found', requestId);
    }

    // Get company information
    const companyRecord = await db.get(`COMPANY#${userRecord.companyId}`, 'METADATA');
    if (!companyRecord) {
      requestLogger.warn('Company not found for user', {
        userId,
        companyId: userRecord.companyId
      });
    }

    requestLogger.info('User profile retrieved successfully', { userId });
    Monitoring.incrementCounter('ProfileGetSuccess');

    // Prepare profile data (exclude sensitive information)
    const profileData = {
      user: {
        id: userRecord.id,
        email: userRecord.email,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        phone: userRecord.phone || null,
        timezone: userRecord.timezone || 'UTC',
        language: userRecord.language || 'en',
        role: userRecord.role,
        emailVerified: userRecord.emailVerified,
        status: userRecord.status,
        lastLoginAt: userRecord.lastLoginAt,
        preferences: userRecord.preferences || getDefaultPreferences(),
        createdAt: userRecord.createdAt,
        updatedAt: userRecord.updatedAt
      },
      company: companyRecord ? {
        id: companyRecord.id,
        name: companyRecord.name,
        industry: companyRecord.industry,
        businessModel: companyRecord.businessModel,
        size: companyRecord.size,
        description: companyRecord.description,
        website: companyRecord.website,
        headquarters: companyRecord.headquarters
      } : null
    };

    const response: ApiResponse = {
      success: true,
      data: profileData,
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
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    Monitoring.recordError('get-profile', 'UnexpectedError', error as Error);
    requestLogger.error('Get profile failed', {
      error: (error as Error).message,
      userId: event.user.sub
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

function getDefaultPreferences() {
  return {
    notifications: {
      email: true,
      push: false,
      assessmentComplete: true,
      weeklyDigest: true,
      marketingCommunications: false
    },
    dashboard: {
      defaultView: 'overview',
      itemsPerPage: 20,
      compactMode: false
    },
    privacy: {
      profileVisibility: 'private',
      dataRetention: 'standard',
      analyticsOptOut: false
    }
  };
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
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    },
    body: JSON.stringify(response),
  };
}

// Export the handler wrapped with authentication middleware
export const handler = withAuth(getProfileHandler, {
  requireEmailVerification: true
});