import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { withAuth, AuthenticatedEvent } from '../../shared/middleware/auth-middleware';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  timezone?: string;
  language?: string;
  preferences?: {
    notifications?: {
      email?: boolean;
      push?: boolean;
      assessmentComplete?: boolean;
      weeklyDigest?: boolean;
      marketingCommunications?: boolean;
    };
    dashboard?: {
      defaultView?: 'overview' | 'assessments' | 'agents' | 'analytics';
      itemsPerPage?: number;
      compactMode?: boolean;
    };
    privacy?: {
      profileVisibility?: 'private' | 'company' | 'public';
      dataRetention?: 'standard' | 'extended' | 'minimal';
      analyticsOptOut?: boolean;
    };
  };
}

const updateProfileHandler = async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'update-profile' });

  try {
    requestLogger.info('User profile update requested', { userId: event.user.sub });
    Monitoring.incrementCounter('ProfileUpdateRequests');

    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId);
    }

    const updateData: UpdateProfileRequest = JSON.parse(event.body);

    // Validate the update data
    const validationError = validateUpdateData(updateData);
    if (validationError) {
      return createErrorResponse(400, validationError.code, validationError.message, requestId);
    }

    // Get current user data
    const userId = event.user.sub;
    const currentUser = await db.get(`USER#${userId}`, 'METADATA');
    if (!currentUser) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found', requestId);
    }

    // Build update expression dynamically
    const updateExpression: string[] = [];
    const expressionAttributeValues: Record<string, any> = {
      ':updatedAt': new Date().toISOString()
    };
    const expressionAttributeNames: Record<string, string> = {};

    // Handle basic profile fields
    if (updateData.firstName !== undefined) {
      updateExpression.push('firstName = :firstName');
      expressionAttributeValues[':firstName'] = updateData.firstName.trim();
    }

    if (updateData.lastName !== undefined) {
      updateExpression.push('lastName = :lastName');
      expressionAttributeValues[':lastName'] = updateData.lastName.trim();
    }

    if (updateData.phone !== undefined) {
      updateExpression.push('phone = :phone');
      expressionAttributeValues[':phone'] = updateData.phone.trim() || null;
    }

    if (updateData.timezone !== undefined) {
      updateExpression.push('timezone = :timezone');
      expressionAttributeValues[':timezone'] = updateData.timezone;
    }

    if (updateData.language !== undefined) {
      updateExpression.push('#lang = :language');
      expressionAttributeNames['#lang'] = 'language';
      expressionAttributeValues[':language'] = updateData.language;
    }

    // Handle nested preferences
    if (updateData.preferences) {
      const currentPreferences = (currentUser.preferences as any) || {};

      // Merge notification preferences
      if (updateData.preferences.notifications) {
        const notifications = {
          ...currentPreferences.notifications,
          ...updateData.preferences.notifications
        };
        updateExpression.push('preferences.notifications = :notifications');
        expressionAttributeValues[':notifications'] = notifications;
      }

      // Merge dashboard preferences
      if (updateData.preferences.dashboard) {
        const dashboard = {
          ...currentPreferences.dashboard,
          ...updateData.preferences.dashboard
        };
        updateExpression.push('preferences.dashboard = :dashboard');
        expressionAttributeValues[':dashboard'] = dashboard;
      }

      // Merge privacy preferences
      if (updateData.preferences.privacy) {
        const privacy = {
          ...currentPreferences.privacy,
          ...updateData.preferences.privacy
        };
        updateExpression.push('preferences.privacy = :privacy');
        expressionAttributeValues[':privacy'] = privacy;
      }

      // If no preferences existed, initialize the structure
      if (!currentPreferences || Object.keys(currentPreferences).length === 0) {
        const defaultPreferences = {
          notifications: currentPreferences.notifications || {
            email: true,
            push: false,
            assessmentComplete: true,
            weeklyDigest: true,
            marketingCommunications: false
          },
          dashboard: currentPreferences.dashboard || {
            defaultView: 'overview',
            itemsPerPage: 20,
            compactMode: false
          },
          privacy: currentPreferences.privacy || {
            profileVisibility: 'private',
            dataRetention: 'standard',
            analyticsOptOut: false
          }
        };

        updateExpression.push('preferences = :preferences');
        expressionAttributeValues[':preferences'] = {
          ...defaultPreferences,
          ...updateData.preferences
        };
      }
    }

    updateExpression.push('updatedAt = :updatedAt');

    // Perform the update
    const updatedUser = await db.update(
      `USER#${userId}`,
      'METADATA',
      `SET ${updateExpression.join(', ')}`,
      expressionAttributeValues,
      Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined
    );

    if (!updatedUser) {
      return createErrorResponse(500, 'UPDATE_FAILED', 'Failed to update profile', requestId);
    }

    requestLogger.info('User profile updated successfully', {
      userId,
      updatedFields: Object.keys(updateData)
    });

    Monitoring.incrementCounter('ProfileUpdateSuccess');

    // Prepare response data (exclude sensitive fields)
    const responseData = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      timezone: updatedUser.timezone,
      language: updatedUser.language,
      preferences: updatedUser.preferences,
      updatedAt: updatedUser.updatedAt
    };

    const response: ApiResponse = {
      success: true,
      data: responseData,
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
        'Access-Control-Allow-Methods': 'PUT,OPTIONS',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    Monitoring.recordError('update-profile', 'UnexpectedError', error as Error);
    requestLogger.error('Profile update failed', {
      error: (error as Error).message,
      userId: event.user.sub
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

function validateUpdateData(data: UpdateProfileRequest): { code: string; message: string } | null {
  // Validate first name
  if (data.firstName !== undefined && (!data.firstName || data.firstName.trim().length === 0)) {
    return { code: 'INVALID_FIRST_NAME', message: 'First name cannot be empty' };
  }

  // Validate last name
  if (data.lastName !== undefined && (!data.lastName || data.lastName.trim().length === 0)) {
    return { code: 'INVALID_LAST_NAME', message: 'Last name cannot be empty' };
  }

  // Validate phone number format (basic validation)
  if (data.phone !== undefined && data.phone.trim() !== '') {
    const phoneRegex = /^[+]?[\d\s\-()]{10,}$/;
    if (!phoneRegex.test(data.phone.trim())) {
      return { code: 'INVALID_PHONE', message: 'Invalid phone number format' };
    }
  }

  // Validate timezone
  if (data.timezone !== undefined) {
    try {
      // Basic timezone validation - can be enhanced
      new Date().toLocaleString('en-US', { timeZone: data.timezone });
    } catch {
      return { code: 'INVALID_TIMEZONE', message: 'Invalid timezone' };
    }
  }

  // Validate language code
  if (data.language !== undefined) {
    const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
    if (!validLanguages.includes(data.language)) {
      return { code: 'INVALID_LANGUAGE', message: 'Unsupported language' };
    }
  }

  // Validate preferences
  if (data.preferences) {
    if (data.preferences.dashboard) {
      const { defaultView, itemsPerPage } = data.preferences.dashboard;

      if (defaultView && !['overview', 'assessments', 'agents', 'analytics'].includes(defaultView)) {
        return { code: 'INVALID_DEFAULT_VIEW', message: 'Invalid default view' };
      }

      if (itemsPerPage && (itemsPerPage < 5 || itemsPerPage > 100)) {
        return { code: 'INVALID_ITEMS_PER_PAGE', message: 'Items per page must be between 5 and 100' };
      }
    }

    if (data.preferences.privacy) {
      const { profileVisibility, dataRetention } = data.preferences.privacy;

      if (profileVisibility && !['private', 'company', 'public'].includes(profileVisibility)) {
        return { code: 'INVALID_PROFILE_VISIBILITY', message: 'Invalid profile visibility setting' };
      }

      if (dataRetention && !['standard', 'extended', 'minimal'].includes(dataRetention)) {
        return { code: 'INVALID_DATA_RETENTION', message: 'Invalid data retention setting' };
      }
    }
  }

  return null;
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
      'Access-Control-Allow-Methods': 'PUT,OPTIONS',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    },
    body: JSON.stringify(response),
  };
}

// Export the handler wrapped with authentication middleware
export const handler = withAuth(updateProfileHandler, {
  requireEmailVerification: true
});