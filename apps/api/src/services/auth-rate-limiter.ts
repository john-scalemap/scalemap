import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { logger } from '../utils/logger';
import { Monitoring } from '../utils/monitoring';

import { auditLogger } from './audit-logger';
import { db } from './database';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  blockDurationMs: number; // Duration to block after limit exceeded
  keyPrefix: string; // Prefix for DynamoDB keys
}

interface RateLimitEntry {
  PK: string;
  SK: string;
  count: number;
  windowStart: string;
  blocked: boolean;
  expiresAt: string;
  TTL: number;
}

/**
 * DynamoDB-backed rate limiter for authentication endpoints
 * Provides distributed rate limiting across Lambda instances
 */
export class AuthRateLimiter {
  constructor(private config: RateLimitConfig) {}

  /**
   * Check if request should be rate limited
   */
  async checkRateLimit(
    event: APIGatewayProxyEvent,
    identifier: string = this.getClientIdentifier(event)
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    result?: APIGatewayProxyResult;
  }> {
    const requestLogger = logger.child({
      function: 'checkRateLimit',
      identifier,
      endpoint: event.path
    });

    try {
      const now = Date.now();
      const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
      const key = `${this.config.keyPrefix}#${identifier}`;

      requestLogger.debug('Checking rate limit', {
        key,
        windowStart: new Date(windowStart).toISOString(),
        maxRequests: this.config.max
      });

      // Get existing rate limit entry
      let entry = await this.getRateLimitEntry(key, windowStart);

      if (!entry) {
        // Create new entry
        entry = await this.createRateLimitEntry(key, windowStart);
      }

      // Check if currently blocked
      if (entry.blocked && now < new Date(entry.expiresAt).getTime()) {
        const resetTime = Math.ceil(new Date(entry.expiresAt).getTime() / 1000);

        requestLogger.warn('Request blocked by rate limit', {
          key,
          count: entry.count,
          expiresAt: entry.expiresAt
        });

        Monitoring.incrementCounter('AuthRateLimitBlocked', {
          endpoint: event.path || 'unknown',
          reason: 'exceeded_limit'
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          result: this.createRateLimitResponse(resetTime, entry.expiresAt)
        };
      }

      // Check if window has expired
      const entryWindowStart = new Date(entry.windowStart).getTime();
      if (now - entryWindowStart >= this.config.windowMs) {
        // Reset for new window
        entry = await this.resetRateLimitEntry(key, windowStart);
      }

      // Check if request would exceed limit
      if (entry.count >= this.config.max) {
        // Block the client
        const blockUntil = new Date(now + this.config.blockDurationMs);
        await this.blockClient(key, windowStart, blockUntil);

        const resetTime = Math.ceil(blockUntil.getTime() / 1000);

        requestLogger.warn('Rate limit exceeded, blocking client', {
          key,
          count: entry.count,
          maxRequests: this.config.max,
          blockUntil: blockUntil.toISOString()
        });

        // Log security event for rate limit exceeded
        await auditLogger.logSecurityEvent({
          eventType: 'RATE_LIMIT_EXCEEDED',
          ipAddress: event.requestContext?.identity?.sourceIp,
          userAgent: event.headers?.['User-Agent'],
          severity: 'MEDIUM',
          details: {
            endpoint: event.path,
            method: event.httpMethod,
            count: entry.count,
            maxRequests: this.config.max,
            windowMs: this.config.windowMs,
            blockDurationMs: this.config.blockDurationMs,
            blockUntil: blockUntil.toISOString(),
            clientId: identifier
          },
          requestId: event.requestContext?.requestId
        });

        Monitoring.incrementCounter('AuthRateLimitExceeded', {
          endpoint: event.path || 'unknown',
          clientType: this.getClientType(event)
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          result: this.createRateLimitResponse(resetTime, blockUntil.toISOString())
        };
      }

      // Increment counter
      await this.incrementCounter(key, windowStart);

      const remaining = this.config.max - (entry.count + 1);
      const resetTime = Math.ceil((entryWindowStart + this.config.windowMs) / 1000);

      requestLogger.debug('Rate limit check passed', {
        key,
        currentCount: entry.count + 1,
        remaining,
        resetTime
      });

      Monitoring.incrementCounter('AuthRateLimitChecked', {
        endpoint: event.path || 'unknown',
        result: 'allowed'
      });

      return {
        allowed: true,
        remaining,
        resetTime
      };

    } catch (error) {
      requestLogger.error('Rate limit check failed', {
        error: (error as Error).message
      });

      Monitoring.recordError('auth-rate-limiter', 'CheckFailed', error as Error);

      // On error, allow the request but log the issue
      return {
        allowed: true,
        remaining: this.config.max - 1,
        resetTime: Math.ceil((Date.now() + this.config.windowMs) / 1000)
      };
    }
  }

  /**
   * Get client identifier from request
   */
  private getClientIdentifier(event: APIGatewayProxyEvent): string {
    const ip = event.requestContext?.identity?.sourceIp || 'unknown';
    const userAgent = event.headers?.['User-Agent']?.substring(0, 50) || 'unknown';

    // Combine IP and User-Agent hash for better identification
    return `${ip}:${this.hashString(userAgent)}`;
  }

  /**
   * Get client type for monitoring
   */
  private getClientType(event: APIGatewayProxyEvent): string {
    const userAgent = event.headers?.['User-Agent'] || '';

    if (userAgent.includes('curl')) return 'curl';
    if (userAgent.includes('Postman')) return 'postman';
    if (userAgent.includes('Mozilla')) return 'browser';
    if (userAgent.includes('node')) return 'nodejs';

    return 'unknown';
  }

  /**
   * Simple hash function for strings
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get rate limit entry from DynamoDB
   */
  private async getRateLimitEntry(key: string, _windowStart: number): Promise<RateLimitEntry | null> {
    try {
      const result = await db.get(key, 'RATE_LIMIT');
      if (!result) return null;

      return result as unknown as RateLimitEntry;
    } catch (error) {
      logger.error('Failed to get rate limit entry', {
        key,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Create new rate limit entry
   */
  private async createRateLimitEntry(key: string, windowStart: number): Promise<RateLimitEntry> {
    const expiresAt = new Date(windowStart + this.config.windowMs + this.config.blockDurationMs);

    const entry: RateLimitEntry = {
      PK: key,
      SK: 'RATE_LIMIT',
      count: 0,
      windowStart: new Date(windowStart).toISOString(),
      blocked: false,
      expiresAt: expiresAt.toISOString(),
      TTL: Math.floor(expiresAt.getTime() / 1000)
    };

    await db.put(entry as unknown as Record<string, unknown>);
    return entry;
  }

  /**
   * Reset rate limit entry for new window
   */
  private async resetRateLimitEntry(key: string, windowStart: number): Promise<RateLimitEntry> {
    const expiresAt = new Date(windowStart + this.config.windowMs + this.config.blockDurationMs);

    const entry: RateLimitEntry = {
      PK: key,
      SK: 'RATE_LIMIT',
      count: 0,
      windowStart: new Date(windowStart).toISOString(),
      blocked: false,
      expiresAt: expiresAt.toISOString(),
      TTL: Math.floor(expiresAt.getTime() / 1000)
    };

    await db.put(entry as unknown as Record<string, unknown>);
    return entry;
  }

  /**
   * Block client after rate limit exceeded
   */
  private async blockClient(key: string, windowStart: number, blockUntil: Date): Promise<void> {
    const updateExpression = 'SET blocked = :blocked, expiresAt = :expiresAt, #ttl = :ttl, updatedAt = :updatedAt';
    const expressionAttributeValues = {
      ':blocked': true,
      ':expiresAt': blockUntil.toISOString(),
      ':ttl': Math.floor(blockUntil.getTime() / 1000),
      ':updatedAt': new Date().toISOString()
    };
    const expressionAttributeNames = {
      '#ttl': 'TTL'
    };

    await db.update(
      key,
      'RATE_LIMIT',
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );
  }

  /**
   * Increment request counter
   */
  private async incrementCounter(key: string, _windowStart: number): Promise<void> {
    const updateExpression = 'ADD #count :increment SET updatedAt = :updatedAt';
    const expressionAttributeValues = {
      ':increment': 1,
      ':updatedAt': new Date().toISOString()
    };
    const expressionAttributeNames = {
      '#count': 'count'
    };

    await db.update(
      key,
      'RATE_LIMIT',
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );
  }

  /**
   * Create rate limit exceeded response
   */
  private createRateLimitResponse(resetTime: number, expiresAt: string): APIGatewayProxyResult {
    const retryAfter = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);

    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'X-RateLimit-Limit': this.config.max.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toString(),
        'Retry-After': retryAfter.toString(),
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please try again in ${retryAfter} seconds.`
        },
        meta: {
          timestamp: new Date().toISOString(),
          retryAfter,
          resetTime
        }
      })
    };
  }
}

// Pre-configured rate limiters for authentication endpoints
export const authRateLimiters = {
  /**
   * Strict rate limiter for login attempts (5 attempts per 15 minutes)
   */
  login: new AuthRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    blockDurationMs: 15 * 60 * 1000, // 15 minute block
    keyPrefix: 'AUTH_LOGIN'
  }),

  /**
   * Moderate rate limiter for registration (3 attempts per 10 minutes)
   */
  register: new AuthRateLimiter({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3,
    blockDurationMs: 30 * 60 * 1000, // 30 minute block
    keyPrefix: 'AUTH_REGISTER'
  }),

  /**
   * Strict rate limiter for password reset (3 attempts per hour)
   */
  passwordReset: new AuthRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    blockDurationMs: 60 * 60 * 1000, // 1 hour block
    keyPrefix: 'AUTH_PASSWORD_RESET'
  })
};