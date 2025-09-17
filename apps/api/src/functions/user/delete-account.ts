import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { withAuth, AuthenticatedEvent } from '../../shared/middleware/auth-middleware';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface DeleteAccountRequest {
  confirmationPhrase: string;
  reason?: string;
  feedback?: string;
}

const deleteAccountHandler = async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'delete-account' });

  try {
    requestLogger.info('Account deletion requested', { userId: event.user.sub });
    Monitoring.incrementCounter('AccountDeletionRequests');

    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId);
    }

    const deleteData: DeleteAccountRequest = JSON.parse(event.body);

    // Validate confirmation phrase
    const expectedPhrase = 'DELETE MY ACCOUNT PERMANENTLY';
    if (deleteData.confirmationPhrase !== expectedPhrase) {
      return createErrorResponse(400, 'INVALID_CONFIRMATION',
        `You must type "${expectedPhrase}" to confirm account deletion`, requestId);
    }

    const userId = event.user.sub;

    // Get user record to check if they're a company admin
    const userRecord = await db.get(`USER#${userId}`, 'METADATA');
    if (!userRecord) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found', requestId);
    }

    // Check if user is the sole admin of their company
    if (userRecord.role === 'admin' && userRecord.companyId) {
      // Query for other admins in the company
      const otherAdmins = await db.query(
        'GSI1PK = :companyPK AND begins_with(GSI1SK, :userPrefix)',
        {
          ':companyPK': `COMPANY#${userRecord.companyId}`,
          ':userPrefix': 'USER#',
          ':role': 'admin',
          ':currentUser': userId
        },
        {
          indexName: 'GSI1',
          filterExpression: '#role = :role AND #userId <> :currentUser',
          expressionAttributeNames: {
            '#role': 'role',
            '#userId': 'id'
          }
        }
      );

      if (otherAdmins.length === 0) {
        return createErrorResponse(400, 'SOLE_ADMIN_DELETION',
          'Cannot delete account as you are the sole administrator. Please assign another admin first.', requestId);
      }
    }

    // Begin account deletion process
    const deletionTimestamp = new Date().toISOString();
    const anonymizedId = `DELETED_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Step 1: Anonymize user data instead of immediate deletion (GDPR compliance)
    const anonymizedUserData = {
      id: userRecord.id, // Keep ID for referential integrity
      email: `deleted.user.${anonymizedId}@example.com`,
      firstName: 'Deleted',
      lastName: 'User',
      phone: null,
      timezone: 'UTC',
      language: 'en',
      role: userRecord.role, // Keep role for system integrity
      companyId: userRecord.companyId, // Keep for company association
      emailVerified: false,
      status: 'deleted',
      deletedAt: deletionTimestamp,
      deletionReason: deleteData.reason || 'No reason provided',
      deletionFeedback: deleteData.feedback || null,
      originalCreatedAt: userRecord.createdAt,
      preferences: null, // Clear preferences
      lastLoginAt: null,
      updatedAt: deletionTimestamp
    };

    // Step 2: Update user record with anonymized data
    await db.put({
      PK: `USER#${userId}`,
      SK: 'METADATA',
      ...anonymizedUserData
    });

    // Step 3: Mark all user sessions for deletion (they will be cleaned up by TTL)
    const userSessions = await db.query(
      'GSI1PK = :userPK AND begins_with(GSI1SK, :sessionPrefix)',
      {
        ':userPK': `USER#${userId}`,
        ':sessionPrefix': 'SESSION#'
      },
      {
        indexName: 'GSI1'
      }
    );

    // Set TTL to expire sessions immediately
    for (const session of userSessions) {
      await db.update(
        session.PK as string,
        session.SK as string,
        'SET #ttl = :ttl, #status = :status',
        {
          ':ttl': Math.floor(Date.now() / 1000), // Expire immediately
          ':status': 'deleted'
        },
        {
          '#ttl': 'ttl',
          '#status': 'status'
        }
      );
    }

    // Step 4: Create audit log for deletion
    await db.put({
      PK: `AUDIT#${userId}`,
      SK: `DELETION#${Date.now()}`,
      action: 'ACCOUNT_DELETION',
      userId,
      timestamp: deletionTimestamp,
      reason: deleteData.reason,
      feedback: deleteData.feedback,
      ipAddress: event.requestContext?.identity?.sourceIp,
      userAgent: event.headers?.['User-Agent'],
      companyId: userRecord.companyId,
      ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60 * 7) // Keep audit for 7 years
    });

    // Step 5: Schedule data purging based on retention policy
    const retentionPolicy = (userRecord.preferences as any)?.privacy?.dataRetention || 'standard';
    const purgeDelayDays = getPurgeDelay(retentionPolicy);
    const purgeDate = new Date();
    purgeDate.setDate(purgeDate.getDate() + purgeDelayDays);

    await db.put({
      PK: `SCHEDULED_PURGE#${userId}`,
      SK: 'METADATA',
      userId,
      scheduledFor: purgeDate.toISOString(),
      retentionPolicy,
      createdAt: deletionTimestamp,
      ttl: Math.floor(purgeDate.getTime() / 1000)
    });

    requestLogger.info('Account deletion completed', {
      userId,
      companyId: userRecord.companyId,
      retentionPolicy,
      scheduledPurgeDate: purgeDate.toISOString()
    });

    Monitoring.incrementCounter('AccountDeletionSuccess');

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Your account has been successfully deleted',
        deletedAt: deletionTimestamp,
        dataRetentionInfo: {
          policy: retentionPolicy,
          description: getRetentionDescription(retentionPolicy),
          scheduledPurgeDate: purgeDate.toISOString()
        }
      },
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
        'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    Monitoring.recordError('delete-account', 'UnexpectedError', error as Error);
    requestLogger.error('Account deletion failed', {
      error: (error as Error).message,
      userId: event.user.sub
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

function getPurgeDelay(retentionPolicy?: string): number {
  switch (retentionPolicy) {
    case 'minimal':
      return 365; // 1 year
    case 'extended':
      return 365 * 7; // 7 years
    case 'standard':
    default:
      return 365 * 3; // 3 years
  }
}

function getRetentionDescription(retentionPolicy?: string): string {
  switch (retentionPolicy) {
    case 'minimal':
      return 'Your data will be permanently purged after 1 year';
    case 'extended':
      return 'Your data will be permanently purged after 7 years';
    case 'standard':
    default:
      return 'Your data will be permanently purged after 3 years';
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
      'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    },
    body: JSON.stringify(response),
  };
}

// Export the handler wrapped with authentication middleware
export const handler = withAuth(deleteAccountHandler, {
  requireEmailVerification: true
});