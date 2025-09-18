import { randomUUID } from 'crypto';

import { auditLogger } from './audit-logger';
import { db } from './database';
import { logger } from '../utils/logger';
import { Monitoring } from '../utils/monitoring';

export interface SessionData {
  sessionId: string;
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  refreshToken: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string;
  isActive: boolean;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  session?: SessionData;
  error?: string;
}

export interface CreateSessionOptions {
  userId: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  refreshToken: string;
  expiresAt?: Date;
}

export interface SessionRevocationOptions {
  sessionId?: string;
  userId?: string;
  reason: string;
  revokedBy: string;
  excludeSessionId?: string; // For revoking all sessions except current one
}

export class SessionManager {
  private readonly MAX_SESSIONS_PER_USER = 10;
  private readonly DEFAULT_SESSION_TTL_DAYS = 7;

  /**
   * Create a new session
   */
  async createSession(options: CreateSessionOptions): Promise<SessionData> {
    const sessionId = `${options.userId}:${Date.now()}:${randomUUID().substring(0, 8)}`;
    const now = new Date();
    const expiresAt = options.expiresAt || new Date(now.getTime() + (this.DEFAULT_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000));

    const sessionData: SessionData = {
      sessionId,
      userId: options.userId,
      deviceId: options.deviceId || 'unknown',
      ipAddress: options.ipAddress || 'unknown',
      userAgent: options.userAgent || 'unknown',
      refreshToken: options.refreshToken,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
      isActive: true
    };

    // Check for session limit and cleanup if needed
    await this.enforceSessionLimit(options.userId);

    // Store session in DynamoDB
    const sessionRecord = {
      PK: `SESSION#${sessionId}`,
      SK: 'METADATA',
      GSI2PK: `USER#${options.userId}`,
      GSI2SK: `SESSION#${now.toISOString()}`,
      ...sessionData,
      TTL: Math.floor(expiresAt.getTime() / 1000)
    };

    await db.put(sessionRecord);

    logger.info('Session created successfully', {
      sessionId,
      userId: options.userId,
      deviceId: sessionData.deviceId,
      expiresAt: sessionData.expiresAt
    });

    Monitoring.incrementCounter('SessionsCreated', {
      deviceType: this.getDeviceType(sessionData.userAgent)
    });

    return sessionData;
  }

  /**
   * Validate a session by sessionId
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    try {
      const sessionRecord = await db.get(`SESSION#${sessionId}`, 'METADATA');

      if (!sessionRecord) {
        return { isValid: false, error: 'Session not found' };
      }

      const session = sessionRecord as unknown as SessionData;

      // Check if session is marked as inactive
      if (!session.isActive) {
        return { isValid: false, error: 'Session is inactive' };
      }

      // Check if session is expired
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      if (expiresAt <= now) {
        // Mark session as inactive
        await this.revokeSession({
          sessionId,
          reason: 'expired',
          revokedBy: 'system'
        });

        // Log session expiration
        await auditLogger.logSessionEvent({
          eventType: 'SESSION_EXPIRED',
          userId: session.userId,
          sessionId,
          outcome: 'SUCCESS',
          details: { reason: 'expired', expiresAt: session.expiresAt }
        });

        return { isValid: false, error: 'Session expired' };
      }

      // Update last used timestamp
      await this.updateSessionLastUsed(sessionId);

      // Log session validation
      await auditLogger.logSessionEvent({
        eventType: 'SESSION_VALIDATED',
        userId: session.userId,
        sessionId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        outcome: 'SUCCESS',
        details: { lastUsedAt: session.lastUsedAt }
      });

      logger.debug('Session validated successfully', {
        sessionId,
        userId: session.userId
      });

      Monitoring.incrementCounter('SessionValidations', {
        result: 'success'
      });

      return { isValid: true, session };

    } catch (error) {
      logger.error('Session validation failed', {
        sessionId,
        error: (error as Error).message
      });

      Monitoring.incrementCounter('SessionValidations', {
        result: 'error'
      });

      return { isValid: false, error: 'Session validation error' };
    }
  }

  /**
   * Revoke a session or multiple sessions
   */
  async revokeSession(options: SessionRevocationOptions): Promise<void> {
    try {
      if (options.sessionId) {
        // Revoke specific session
        await this.revokeSingleSession(options.sessionId, options.reason, options.revokedBy);
      } else if (options.userId) {
        // Revoke all sessions for user
        await this.revokeAllUserSessions(options.userId, options.reason, options.revokedBy, options.excludeSessionId);
      } else {
        throw new Error('Either sessionId or userId must be provided for revocation');
      }
    } catch (error) {
      logger.error('Session revocation failed', {
        options,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const sessions = await db.query(
        'GSI2PK = :userKey AND begins_with(GSI2SK, :sessionPrefix)',
        {
          ':userKey': `USER#${userId}`,
          ':sessionPrefix': 'SESSION#'
        },
        { indexName: 'GSI2' }
      );

      const typedSessions = sessions as unknown as SessionData[];
      return typedSessions
        .filter(session => session.isActive)
        .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());

    } catch (error) {
      logger.error('Failed to get user sessions', {
        userId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get session by refresh token
   */
  async getSessionByRefreshToken(refreshToken: string, userId: string): Promise<SessionData | null> {
    try {
      const sessions = await this.getUserSessions(userId);
      return sessions.find(session => session.refreshToken === refreshToken) || null;
    } catch (error) {
      logger.error('Failed to get session by refresh token', {
        userId,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Update session refresh token
   */
  async updateSessionRefreshToken(sessionId: string, newRefreshToken: string): Promise<void> {
    try {
      await db.update(
        `SESSION#${sessionId}`,
        'METADATA',
        'SET refreshToken = :token, lastUsedAt = :lastUsed',
        {
          ':token': newRefreshToken,
          ':lastUsed': new Date().toISOString()
        }
      );

      logger.info('Session refresh token updated', { sessionId });
    } catch (error) {
      logger.error('Failed to update session refresh token', {
        sessionId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      // DynamoDB TTL will handle automatic cleanup, but we can also do manual cleanup
      // This method can be called periodically to ensure cleanup

      // Query for sessions that might be expired but not yet cleaned up
      // This is a backup cleanup mechanism

      logger.info('Session cleanup completed');
      return 0; // TTL handles cleanup automatically
    } catch (error) {
      logger.error('Session cleanup failed', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Enforce session limit per user
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    try {
      const sessions = await this.getUserSessions(userId);

      if (sessions.length >= this.MAX_SESSIONS_PER_USER) {
        // Sort by last used (oldest first) and revoke excess sessions
        const sortedSessions = sessions.sort(
          (a, b) => new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime()
        );

        const sessionsToRevoke = sortedSessions.slice(0, sessions.length - this.MAX_SESSIONS_PER_USER + 1);

        for (const session of sessionsToRevoke) {
          await this.revokeSingleSession(session.sessionId, 'session_limit_exceeded', 'system');
        }

        logger.info('Enforced session limit', {
          userId,
          revokedCount: sessionsToRevoke.length,
          remainingCount: this.MAX_SESSIONS_PER_USER - 1
        });
      }
    } catch (error) {
      logger.error('Failed to enforce session limit', {
        userId,
        error: (error as Error).message
      });
      // Don't throw - this shouldn't prevent session creation
    }
  }

  /**
   * Revoke a single session
   */
  private async revokeSingleSession(sessionId: string, reason: string, revokedBy: string): Promise<void> {
    const now = new Date().toISOString();

    // Get session details for audit logging
    const sessionRecord = await db.get(`SESSION#${sessionId}`, 'METADATA');

    await db.update(
      `SESSION#${sessionId}`,
      'METADATA',
      'SET isActive = :inactive, revokedAt = :revokedAt, revokedBy = :revokedBy, revokeReason = :reason',
      {
        ':inactive': false,
        ':revokedAt': now,
        ':revokedBy': revokedBy,
        ':reason': reason
      }
    );

    // Log session revocation
    if (sessionRecord) {
      await auditLogger.logSessionEvent({
        eventType: 'SESSION_REVOKED',
        userId: sessionRecord.userId as string,
        sessionId,
        ipAddress: sessionRecord.ipAddress as string,
        userAgent: sessionRecord.userAgent as string,
        outcome: 'SUCCESS',
        details: { reason, revokedBy }
      });
    }

    logger.info('Session revoked', {
      sessionId,
      reason,
      revokedBy
    });

    Monitoring.incrementCounter('SessionsRevoked', {
      reason
    });
  }

  /**
   * Revoke all sessions for a user
   */
  private async revokeAllUserSessions(
    userId: string,
    reason: string,
    revokedBy: string,
    excludeSessionId?: string
  ): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    const sessionsToRevoke = excludeSessionId
      ? sessions.filter(session => session.sessionId !== excludeSessionId)
      : sessions;

    const revokePromises = sessionsToRevoke.map(session =>
      this.revokeSingleSession(session.sessionId, reason, revokedBy)
    );

    await Promise.all(revokePromises);

    logger.info('All user sessions revoked', {
      userId,
      revokedCount: sessionsToRevoke.length,
      excludeSessionId,
      reason,
      revokedBy
    });
  }

  /**
   * Update session last used timestamp
   */
  private async updateSessionLastUsed(sessionId: string): Promise<void> {
    try {
      await db.update(
        `SESSION#${sessionId}`,
        'METADATA',
        'SET lastUsedAt = :lastUsed',
        { ':lastUsed': new Date().toISOString() }
      );
    } catch (error) {
      // Log but don't throw - this shouldn't fail the request
      logger.warn('Failed to update session last used timestamp', {
        sessionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Get device type from user agent
   */
  private getDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile')) return 'mobile';
    if (ua.includes('tablet')) return 'tablet';
    if (ua.includes('desktop')) return 'desktop';
    return 'unknown';
  }
}

// Default session manager instance
export const sessionManager = new SessionManager();