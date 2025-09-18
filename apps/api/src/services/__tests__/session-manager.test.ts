import { SessionManager } from '../session-manager';
import { auditLogger } from '../audit-logger';
import { db } from '../database';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

// Mock dependencies
jest.mock('../audit-logger');
jest.mock('../database');
jest.mock('../../utils/logger');
jest.mock('../../utils/monitoring');

const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockMonitoring = Monitoring as jest.Mocked<typeof Monitoring>;
const mockAuditLogger = auditLogger as jest.Mocked<typeof auditLogger>;

describe('SessionManager', () => {
  let testSessionManager: SessionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    testSessionManager = new SessionManager();

    // Mock logger methods
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.debug = jest.fn();
    mockLogger.child = jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    });

    // Mock monitoring methods
    mockMonitoring.incrementCounter = jest.fn();
    mockMonitoring.recordError = jest.fn();

    // Mock audit logger methods
    mockAuditLogger.logSessionEvent = jest.fn().mockResolvedValue('event-id');
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const userId = 'user123';
      const refreshToken = 'refresh-token-123';

      mockDb.put.mockResolvedValue(undefined);
      mockDb.query.mockResolvedValue([]); // No existing sessions

      const session = await testSessionManager.createSession({
        userId,
        refreshToken,
        deviceId: 'desktop',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });

      expect(session.userId).toBe(userId);
      expect(session.refreshToken).toBe(refreshToken);
      expect(session.isActive).toBe(true);
      expect(session.deviceId).toBe('desktop');
      expect(mockDb.put).toHaveBeenCalledWith(
        expect.objectContaining({
          PK: expect.stringContaining('SESSION#'),
          SK: 'METADATA',
          GSI2PK: `USER#${userId}`,
          userId,
          refreshToken,
          isActive: true
        })
      );
    });

    it('should enforce session limit and revoke old sessions', async () => {
      const userId = 'user123';
      const existingSessions = Array.from({ length: 10 }, (_, i) => ({
        sessionId: `session-${i}`,
        userId,
        lastUsedAt: new Date(Date.now() - i * 1000).toISOString(),
        isActive: true
      }));

      mockDb.query.mockResolvedValue(existingSessions);
      mockDb.put.mockResolvedValue(undefined);
      mockDb.update.mockResolvedValue(null);

      await testSessionManager.createSession({
        userId,
        refreshToken: 'new-token'
      });

      // Should revoke the oldest session
      expect(mockDb.update).toHaveBeenCalledWith(
        `SESSION#${existingSessions[9]!.sessionId}`, // Oldest session
        'METADATA',
        expect.stringContaining('SET isActive = :inactive'),
        expect.objectContaining({
          ':inactive': false,
          ':reason': 'session_limit_exceeded'
        })
      );
    });
  });

  describe('validateSession', () => {
    it('should validate an active session successfully', async () => {
      const sessionId = 'session123';
      const mockSession = {
        sessionId,
        userId: 'user123',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        deviceId: 'desktop'
      };

      mockDb.get.mockResolvedValue(mockSession);
      mockDb.update.mockResolvedValue(null); // For updating last used

      const result = await testSessionManager.validateSession(sessionId);

      expect(result.isValid).toBe(true);
      expect(result.session).toEqual(mockSession);
      expect(mockDb.update).toHaveBeenCalledWith(
        `SESSION#${sessionId}`,
        'METADATA',
        'SET lastUsedAt = :lastUsed',
        expect.objectContaining({
          ':lastUsed': expect.any(String)
        })
      );
    });

    it('should reject session that does not exist', async () => {
      const sessionId = 'nonexistent';
      mockDb.get.mockResolvedValue(null);

      const result = await testSessionManager.validateSession(sessionId);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should reject inactive session', async () => {
      const sessionId = 'session123';
      const mockSession = {
        sessionId,
        userId: 'user123',
        isActive: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      mockDb.get.mockResolvedValue(mockSession);

      const result = await testSessionManager.validateSession(sessionId);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Session is inactive');
    });

    it('should reject expired session and revoke it', async () => {
      const sessionId = 'session123';
      const mockSession = {
        sessionId,
        userId: 'user123',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000).toISOString() // Expired 1 second ago
      };

      mockDb.get.mockResolvedValue(mockSession);
      mockDb.update.mockResolvedValue(null);

      const result = await testSessionManager.validateSession(sessionId);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Session expired');

      // Should have revoked the expired session
      expect(mockDb.update).toHaveBeenCalledWith(
        `SESSION#${sessionId}`,
        'METADATA',
        expect.stringContaining('SET isActive = :inactive'),
        expect.objectContaining({
          ':inactive': false,
          ':reason': 'expired'
        })
      );
    });
  });

  describe('revokeSession', () => {
    it('should revoke a specific session', async () => {
      const sessionId = 'session123';
      mockDb.update.mockResolvedValue(null);

      await testSessionManager.revokeSession({
        sessionId,
        reason: 'user_logout',
        revokedBy: 'user123'
      });

      expect(mockDb.update).toHaveBeenCalledWith(
        `SESSION#${sessionId}`,
        'METADATA',
        'SET isActive = :inactive, revokedAt = :revokedAt, revokedBy = :revokedBy, revokeReason = :reason',
        expect.objectContaining({
          ':inactive': false,
          ':revokedBy': 'user123',
          ':reason': 'user_logout'
        })
      );
    });

    it('should revoke all sessions for a user', async () => {
      const userId = 'user123';
      const mockSessions = [
        { sessionId: 'session1', userId, isActive: true },
        { sessionId: 'session2', userId, isActive: true },
        { sessionId: 'session3', userId, isActive: true }
      ];

      mockDb.query.mockResolvedValue(mockSessions);
      mockDb.update.mockResolvedValue(null);

      await testSessionManager.revokeSession({
        userId,
        reason: 'security_breach',
        revokedBy: 'admin'
      });

      // Should revoke all 3 sessions
      expect(mockDb.update).toHaveBeenCalledTimes(3);
      mockSessions.forEach(session => {
        expect(mockDb.update).toHaveBeenCalledWith(
          `SESSION#${session.sessionId}`,
          'METADATA',
          expect.stringContaining('SET isActive = :inactive'),
          expect.objectContaining({
            ':inactive': false,
            ':reason': 'security_breach'
          })
        );
      });
    });

    it('should revoke all sessions except excluded one', async () => {
      const userId = 'user123';
      const excludeSessionId = 'session2';
      const mockSessions = [
        { sessionId: 'session1', userId, isActive: true },
        { sessionId: 'session2', userId, isActive: true },
        { sessionId: 'session3', userId, isActive: true }
      ];

      mockDb.query.mockResolvedValue(mockSessions);
      mockDb.update.mockResolvedValue(null);

      await testSessionManager.revokeSession({
        userId,
        reason: 'password_change',
        revokedBy: 'user123',
        excludeSessionId
      });

      // Should revoke 2 sessions (excluding session2)
      expect(mockDb.update).toHaveBeenCalledTimes(2);
      expect(mockDb.update).toHaveBeenCalledWith(
        'SESSION#session1',
        'METADATA',
        expect.stringContaining('SET isActive = :inactive'),
        expect.anything()
      );
      expect(mockDb.update).toHaveBeenCalledWith(
        'SESSION#session3',
        'METADATA',
        expect.stringContaining('SET isActive = :inactive'),
        expect.anything()
      );
    });
  });

  describe('getUserSessions', () => {
    it('should return active sessions sorted by last used', async () => {
      const userId = 'user123';
      const mockSessions = [
        {
          sessionId: 'session1',
          userId,
          isActive: true,
          lastUsedAt: '2023-01-01T10:00:00Z'
        },
        {
          sessionId: 'session2',
          userId,
          isActive: false, // Inactive session should be filtered out
          lastUsedAt: '2023-01-01T12:00:00Z'
        },
        {
          sessionId: 'session3',
          userId,
          isActive: true,
          lastUsedAt: '2023-01-01T11:00:00Z'
        }
      ];

      mockDb.query.mockResolvedValue(mockSessions);

      const result = await testSessionManager.getUserSessions(userId);

      expect(result).toHaveLength(2); // Only active sessions
      expect(result[0]!.sessionId).toBe('session3'); // Most recently used
      expect(result[1]!.sessionId).toBe('session1'); // Least recently used
    });
  });

  describe('getSessionByRefreshToken', () => {
    it('should find session by refresh token', async () => {
      const userId = 'user123';
      const refreshToken = 'refresh-token-123';
      const mockSessions = [
        { sessionId: 'session1', userId, refreshToken: 'other-token', isActive: true },
        { sessionId: 'session2', userId, refreshToken, isActive: true },
        { sessionId: 'session3', userId, refreshToken: 'another-token', isActive: true }
      ];

      mockDb.query.mockResolvedValue(mockSessions);

      const result = await testSessionManager.getSessionByRefreshToken(refreshToken, userId);

      expect(result).toBeTruthy();
      expect(result!.sessionId).toBe('session2');
      expect(result!.refreshToken).toBe(refreshToken);
    });

    it('should return null if session not found', async () => {
      const userId = 'user123';
      const refreshToken = 'nonexistent-token';
      const mockSessions = [
        { sessionId: 'session1', userId, refreshToken: 'other-token', isActive: true }
      ];

      mockDb.query.mockResolvedValue(mockSessions);

      const result = await testSessionManager.getSessionByRefreshToken(refreshToken, userId);

      expect(result).toBeNull();
    });
  });

  describe('updateSessionRefreshToken', () => {
    it('should update session refresh token', async () => {
      const sessionId = 'session123';
      const newRefreshToken = 'new-refresh-token';

      mockDb.update.mockResolvedValue(null);

      await testSessionManager.updateSessionRefreshToken(sessionId, newRefreshToken);

      expect(mockDb.update).toHaveBeenCalledWith(
        `SESSION#${sessionId}`,
        'METADATA',
        'SET refreshToken = :token, lastUsedAt = :lastUsed',
        expect.objectContaining({
          ':token': newRefreshToken,
          ':lastUsed': expect.any(String)
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully in validateSession', async () => {
      const sessionId = 'session123';
      const dbError = new Error('Database connection failed');

      mockDb.get.mockRejectedValue(dbError);

      const result = await testSessionManager.validateSession(sessionId);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Session validation error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Session validation failed',
        expect.objectContaining({
          sessionId,
          error: 'Database connection failed'
        })
      );
    });

    it('should handle database errors in revokeSession', async () => {
      const sessionId = 'session123';
      const dbError = new Error('Database update failed');

      mockDb.get.mockResolvedValue({ userId: 'user123', sessionId });
      mockDb.update.mockRejectedValue(dbError);

      await expect(testSessionManager.revokeSession({
        sessionId,
        reason: 'test',
        revokedBy: 'user'
      })).rejects.toThrow('Database update failed');
    });
  });
});