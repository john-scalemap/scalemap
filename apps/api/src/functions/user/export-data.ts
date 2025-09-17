import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { withAuth, AuthenticatedEvent } from '../../shared/middleware/auth-middleware';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

const exportUserDataHandler = async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'export-user-data' });

  try {
    requestLogger.info('User data export requested', { userId: event.user.sub });
    Monitoring.incrementCounter('DataExportRequests');

    const userId = event.user.sub;

    // Get user profile data
    const userRecord = await db.get(`USER#${userId}`, 'METADATA');
    if (!userRecord) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User profile not found', requestId);
    }

    // Get company data if user is associated with one
    let companyRecord = null;
    if (userRecord.companyId) {
      companyRecord = await db.get(`COMPANY#${userRecord.companyId}`, 'METADATA');
    }

    // Query for all user-related data across different entity types
    const userDataQueries = await Promise.allSettled([
      // User sessions
      db.query(
        'GSI1PK = :userPK AND begins_with(GSI1SK, :sessionPrefix)',
        {
          ':userPK': `USER#${userId}`,
          ':sessionPrefix': 'SESSION#'
        },
        { indexName: 'GSI1' }
      ),
      // User assessments (when we add this feature)
      db.query(
        'GSI1PK = :userPK AND begins_with(GSI1SK, :assessmentPrefix)',
        {
          ':userPK': `USER#${userId}`,
          ':assessmentPrefix': 'ASSESSMENT#'
        },
        { indexName: 'GSI1' }
      ),
      // User audit logs
      db.query(
        'GSI1PK = :userPK AND begins_with(GSI1SK, :auditPrefix)',
        {
          ':userPK': `USER#${userId}`,
          ':auditPrefix': 'AUDIT#'
        },
        { indexName: 'GSI1' }
      )
    ]);

    // Process query results
    const sessions = userDataQueries[0].status === 'fulfilled' ? userDataQueries[0].value : [];
    const assessments = userDataQueries[1].status === 'fulfilled' ? userDataQueries[1].value : [];
    const auditLogs = userDataQueries[2].status === 'fulfilled' ? userDataQueries[2].value : [];

    // Compile comprehensive user data export
    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        exportedBy: userId,
        requestId,
        dataRetentionPolicy: (userRecord.preferences as any)?.privacy?.dataRetention || 'standard'
      },
      personalInformation: {
        id: userRecord.id,
        email: userRecord.email,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        phone: userRecord.phone,
        timezone: userRecord.timezone,
        language: userRecord.language,
        role: userRecord.role,
        emailVerified: userRecord.emailVerified,
        status: userRecord.status,
        createdAt: userRecord.createdAt,
        updatedAt: userRecord.updatedAt,
        lastLoginAt: userRecord.lastLoginAt
      },
      preferences: userRecord.preferences || {},
      companyInformation: companyRecord ? {
        id: companyRecord.id,
        name: companyRecord.name,
        description: companyRecord.description,
        website: companyRecord.website,
        industry: companyRecord.industry,
        businessModel: companyRecord.businessModel,
        size: companyRecord.size,
        headquarters: companyRecord.headquarters,
        createdAt: companyRecord.createdAt,
        updatedAt: companyRecord.updatedAt
      } : null,
      sessionData: sessions.map((session: any) => ({
        id: session.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastUsedAt: session.lastUsedAt
      })),
      assessmentData: assessments.map((assessment: any) => ({
        id: assessment.id,
        type: assessment.type,
        status: assessment.status,
        results: assessment.results,
        createdAt: assessment.createdAt,
        completedAt: assessment.completedAt
      })),
      activityLogs: auditLogs.map((log: any) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        timestamp: log.timestamp,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent
      })),
      gdprInfo: {
        legalBasisForProcessing: 'Contract performance and legitimate interests',
        dataRetentionPeriod: getDataRetentionPeriod((userRecord.preferences as any)?.privacy?.dataRetention),
        rightsInformation: {
          rightToAccess: 'This export fulfills your right to access your personal data',
          rightToRectification: 'You can update your data through your profile settings',
          rightToErasure: 'You can request account deletion through your account settings',
          rightToPortability: 'This export provides your data in a machine-readable format',
          rightToObject: 'You can opt out of certain data processing in your privacy settings'
        }
      }
    };

    requestLogger.info('User data export completed', {
      userId,
      recordCount: {
        sessions: sessions.length,
        assessments: assessments.length,
        auditLogs: auditLogs.length
      }
    });

    Monitoring.incrementCounter('DataExportSuccess');

    const response: ApiResponse = {
      success: true,
      data: exportData,
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
        'Content-Disposition': `attachment; filename="scalemap-data-export-${userId}-${Date.now()}.json"`,
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify(response, null, 2),
    };

  } catch (error) {
    Monitoring.recordError('export-user-data', 'UnexpectedError', error as Error);
    requestLogger.error('User data export failed', {
      error: (error as Error).message,
      userId: event.user.sub
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

function getDataRetentionPeriod(retentionSetting?: string): string {
  switch (retentionSetting) {
    case 'minimal':
      return '1 year after account deletion';
    case 'extended':
      return '7 years after account deletion';
    case 'standard':
    default:
      return '3 years after account deletion';
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
export const handler = withAuth(exportUserDataHandler, {
  requireEmailVerification: true
});