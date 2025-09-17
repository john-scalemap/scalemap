import { randomUUID } from 'crypto';

import { JWTPayload, AuthTokens, AuthUser } from '@scalemap/shared';
import * as jwt from 'jsonwebtoken';

import { logger } from '../utils/logger';
import { Monitoring } from '../utils/monitoring';


interface JWTServiceConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenTTL: number; // seconds
  refreshTokenTTL: number; // seconds
  issuer: string;
}

export class JWTService {
  private config: JWTServiceConfig;

  constructor() {
    this.config = {
      accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production',
      refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
      accessTokenTTL: parseInt(process.env.JWT_ACCESS_TTL || '900'), // 15 minutes default
      refreshTokenTTL: parseInt(process.env.JWT_REFRESH_TTL || '604800'), // 7 days default
      issuer: process.env.JWT_ISSUER || 'scalemap.com'
    };

    // Enhanced security validation
    if (process.env.NODE_ENV === 'production') {
      if (this.config.accessTokenSecret.includes('dev-') ||
          this.config.refreshTokenSecret.includes('dev-')) {
        throw new Error('JWT secrets must be configured for production environment');
      }

      // Validate secret strength in production
      if (this.config.accessTokenSecret.length < 32 ||
          this.config.refreshTokenSecret.length < 32) {
        throw new Error('JWT secrets must be at least 32 characters long for production');
      }
    }
  }

  /**
   * Generate access and refresh tokens for a user
   */
  async generateTokens(user: AuthUser): Promise<AuthTokens> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const jti = randomUUID(); // JWT ID for token revocation

      const accessPayload: JWTPayload = {
        sub: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
        permissions: user.permissions,
        emailVerified: user.emailVerified,
        iat: now,
        exp: now + this.config.accessTokenTTL,
        jti
      };

      const refreshPayload = {
        sub: user.id,
        type: 'refresh',
        iat: now,
        exp: now + this.config.refreshTokenTTL,
        jti: randomUUID()
      };

      const accessToken = jwt.sign(accessPayload, this.config.accessTokenSecret, {
        issuer: this.config.issuer,
        audience: 'scalemap-api'
      });

      const refreshToken = jwt.sign(refreshPayload, this.config.refreshTokenSecret, {
        issuer: this.config.issuer,
        audience: 'scalemap-api'
      });

      logger.info('Tokens generated successfully', {
        userId: user.id,
        tokenId: jti
      });

      Monitoring.incrementCounter('TokensGenerated', {
        userRole: user.role
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.config.accessTokenTTL,
        tokenType: 'Bearer',
        scope: user.permissions
      };

    } catch (error) {
      logger.error('Failed to generate tokens', {
        error: (error as Error).message,
        userId: user.id
      });
      Monitoring.recordError('jwt', 'TokenGenerationError', error as Error);
      throw error;
    }
  }

  /**
   * Validate and decode an access token
   */
  async validateAccessToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, this.config.accessTokenSecret, {
        issuer: this.config.issuer,
        audience: 'scalemap-api'
      }) as JWTPayload;

      // Check if token is expired (additional check)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now) {
        throw new Error('Token has expired');
      }

      Monitoring.incrementCounter('TokenValidations', {
        result: 'success'
      });

      return payload;

    } catch (error) {
      const errorMessage = (error as Error).message;

      logger.warn('Token validation failed', {
        error: errorMessage,
        tokenPrefix: token.substring(0, 20) + '...'
      });

      Monitoring.incrementCounter('TokenValidations', {
        result: 'failure',
        reason: this.getTokenErrorType(errorMessage)
      });

      throw error;
    }
  }

  /**
   * Validate a refresh token
   */
  async validateRefreshToken(token: string): Promise<{ sub: string; jti: string }> {
    try {
      const payload = jwt.verify(token, this.config.refreshTokenSecret, {
        issuer: this.config.issuer,
        audience: 'scalemap-api'
      }) as any;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now) {
        throw new Error('Refresh token has expired');
      }

      Monitoring.incrementCounter('RefreshTokenValidations', {
        result: 'success'
      });

      return {
        sub: payload.sub,
        jti: payload.jti
      };

    } catch (error) {
      const errorMessage = (error as Error).message;

      logger.warn('Refresh token validation failed', {
        error: errorMessage
      });

      Monitoring.incrementCounter('RefreshTokenValidations', {
        result: 'failure',
        reason: this.getTokenErrorType(errorMessage)
      });

      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, user: AuthUser): Promise<AuthTokens> {
    try {
      // Validate refresh token
      await this.validateRefreshToken(refreshToken);

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      logger.info('Access token refreshed successfully', {
        userId: user.id
      });

      Monitoring.incrementCounter('TokenRefresh', {
        result: 'success'
      });

      return tokens;

    } catch (error) {
      logger.error('Failed to refresh access token', {
        error: (error as Error).message,
        userId: user.id
      });

      Monitoring.incrementCounter('TokenRefresh', {
        result: 'failure'
      });

      throw error;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1] || null;
  }

  /**
   * Decode token without verification (for debugging/logging)
   */
  decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch {
      return null;
    }
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(token: string): number | null {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded?.exp || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const exp = this.getTokenExpiry(token);
    if (!exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return exp <= now;
  }

  /**
   * Get remaining token lifetime in seconds
   */
  getTokenRemainingLifetime(token: string): number {
    const exp = this.getTokenExpiry(token);
    if (!exp) return 0;

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, exp - now);
  }

  private getTokenErrorType(errorMessage: string): string {
    if (errorMessage.includes('expired')) return 'expired';
    if (errorMessage.includes('invalid')) return 'invalid';
    if (errorMessage.includes('malformed')) return 'malformed';
    if (errorMessage.includes('signature')) return 'signature';
    return 'unknown';
  }
}

// Default JWT service instance
export const jwtService = new JWTService();