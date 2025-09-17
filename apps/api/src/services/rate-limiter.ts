import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { logger } from '../utils/logger';
import { Monitoring } from '../utils/monitoring';

interface RateLimitEntry {
  count: number;
  lastReset: number;
  blocked: boolean;
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  keyGenerator: (event: APIGatewayProxyEvent) => string;
  blockDurationMs?: number; // Duration to block after limit exceeded
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if request should be rate limited
   */
  async isAllowed(event: APIGatewayProxyEvent): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    result?: APIGatewayProxyResult;
  }> {
    const key = this.config.keyGenerator(event);
    const now = Date.now();

    let entry = this.store.get(key);

    // Create new entry if doesn't exist
    if (!entry) {
      entry = {
        count: 0,
        lastReset: now,
        blocked: false
      };
      this.store.set(key, entry);
    }

    // Reset window if time has passed
    if (now - entry.lastReset >= this.config.windowMs) {
      entry.count = 0;
      entry.lastReset = now;
      entry.blocked = false;
    }

    // Check if still in block period
    if (entry.blocked && this.config.blockDurationMs) {
      const blockEndTime = entry.lastReset + this.config.blockDurationMs;
      if (now < blockEndTime) {
        const resetTime = Math.ceil(blockEndTime / 1000);

        logger.warn('Rate limit block still active', {
          key,
          blockEndTime,
          currentTime: now
        });

        Monitoring.incrementCounter('RateLimitBlocked', {
          endpoint: event.path || 'unknown',
          reason: 'block_period_active'
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          result: {
            statusCode: 429,
            headers: {
              ...CORS_HEADERS,
              'X-RateLimit-Limit': this.config.max.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': resetTime.toString(),
              'Retry-After': Math.ceil((blockEndTime - now) / 1000).toString()
            },
            body: JSON.stringify({
              error: 'Rate limit exceeded',
              message: `Too many requests. Please try again in ${Math.ceil((blockEndTime - now) / 1000)} seconds.`,
              retryAfter: Math.ceil((blockEndTime - now) / 1000)
            })
          }
        };
      } else {
        // Block period has ended
        entry.blocked = false;
        entry.count = 0;
        entry.lastReset = now;
      }
    }

    // Check if request exceeds limit
    if (entry.count >= this.config.max) {
      entry.blocked = true;
      const resetTime = Math.ceil((entry.lastReset + this.config.windowMs) / 1000);

      logger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        max: this.config.max,
        windowMs: this.config.windowMs
      });

      Monitoring.incrementCounter('RateLimitExceeded', {
        endpoint: event.path || 'unknown',
        userAgent: event.headers['User-Agent'] || 'unknown'
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        result: {
          statusCode: 429,
          headers: {
            ...CORS_HEADERS,
            'X-RateLimit-Limit': this.config.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toString(),
            'Retry-After': Math.ceil(this.config.windowMs / 1000).toString()
          },
          body: JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Limit is ${this.config.max} requests per ${this.config.windowMs / 1000} seconds.`,
            retryAfter: Math.ceil(this.config.windowMs / 1000)
          })
        }
      };
    }

    // Increment count for allowed request
    entry.count++;
    const remaining = this.config.max - entry.count;
    const resetTime = Math.ceil((entry.lastReset + this.config.windowMs) / 1000);

    logger.debug('Rate limit check passed', {
      key,
      count: entry.count,
      remaining,
      resetTime
    });

    Monitoring.incrementCounter('RateLimitChecked', {
      endpoint: event.path || 'unknown',
      result: 'allowed'
    });

    return {
      allowed: true,
      remaining,
      resetTime
    };
  }

  /**
   * Record request result for conditional rate limiting
   */
  recordResult(event: APIGatewayProxyEvent, statusCode: number): void {
    const key = this.config.keyGenerator(event);
    const entry = this.store.get(key);

    if (!entry) return;

    // Adjust count based on configuration
    if (this.config.skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) {
      entry.count = Math.max(0, entry.count - 1);
    } else if (this.config.skipFailedRequests && statusCode >= 400) {
      entry.count = Math.max(0, entry.count - 1);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      const isExpired = now - entry.lastReset >= this.config.windowMs;
      const isUnblocked = !entry.blocked || (
        this.config.blockDurationMs &&
        now - entry.lastReset >= this.config.blockDurationMs
      );

      if (isExpired && isUnblocked) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.store.delete(key));

    if (expiredKeys.length > 0) {
      logger.debug('Rate limiter cleanup completed', {
        removedEntries: expiredKeys.length,
        totalEntries: this.store.size
      });
    }
  }

  /**
   * Get current statistics
   */
  getStats(): {
    totalKeys: number;
    activeBlocks: number;
    averageRequestsPerKey: number;
  } {
    let totalRequests = 0;
    let activeBlocks = 0;

    for (const entry of this.store.values()) {
      totalRequests += entry.count;
      if (entry.blocked) activeBlocks++;
    }

    return {
      totalKeys: this.store.size,
      activeBlocks,
      averageRequestsPerKey: this.store.size > 0 ? totalRequests / this.store.size : 0
    };
  }

  /**
   * Clear all rate limit data (for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Destroy rate limiter and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Common key generators
export const keyGenerators = {
  /**
   * Rate limit by IP address
   */
  byIP: (event: APIGatewayProxyEvent): string => {
    return event.requestContext?.identity?.sourceIp || 'unknown-ip';
  },

  /**
   * Rate limit by user ID from JWT token
   */
  byUser: (event: APIGatewayProxyEvent): string => {
    // This would extract user ID from validated JWT token
    // For now, fall back to IP if no user context
    const userId = event.requestContext?.authorizer?.claims?.sub;
    return userId || event.requestContext?.identity?.sourceIp || 'unknown-user';
  },

  /**
   * Rate limit by combination of user and IP
   */
  byUserAndIP: (event: APIGatewayProxyEvent): string => {
    const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';
    const ip = event.requestContext?.identity?.sourceIp || 'unknown-ip';
    return `${userId}:${ip}`;
  },

  /**
   * Rate limit by endpoint and IP
   */
  byEndpointAndIP: (event: APIGatewayProxyEvent): string => {
    const endpoint = event.path || 'unknown-endpoint';
    const ip = event.requestContext?.identity?.sourceIp || 'unknown-ip';
    return `${endpoint}:${ip}`;
  }
};

// Pre-configured rate limiters for common use cases
export const rateLimiters = {
  /**
   * Strict rate limiter for sensitive operations (5 requests per minute)
   */
  strict: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    keyGenerator: keyGenerators.byIP,
    blockDurationMs: 5 * 60 * 1000, // 5 minute block
    skipSuccessfulRequests: false
  }),

  /**
   * Moderate rate limiter for API endpoints (30 requests per minute)
   */
  moderate: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    keyGenerator: keyGenerators.byIP,
    blockDurationMs: 2 * 60 * 1000, // 2 minute block
    skipSuccessfulRequests: false
  }),

  /**
   * Lenient rate limiter for general use (100 requests per minute)
   */
  lenient: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    keyGenerator: keyGenerators.byIP,
    skipSuccessfulRequests: true
  })
};