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
    this.validateSecretSecurity();
  }

  /**
   * Validate JWT secret security requirements
   */
  private validateSecretSecurity(): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const isStaging = process.env.NODE_ENV === 'staging';
    const requiresStrongSecrets = isProduction || isStaging;

    // Check for development secrets in any non-development environment
    if (requiresStrongSecrets) {
      if (this.config.accessTokenSecret.includes('dev-') ||
          this.config.refreshTokenSecret.includes('dev-') ||
          this.config.accessTokenSecret.includes('change-in-production') ||
          this.config.refreshTokenSecret.includes('change-in-production')) {
        throw new Error('Default development JWT secrets detected. Configure production secrets immediately.');
      }
    }

    // Validate secret strength for production and staging
    if (requiresStrongSecrets) {
      this.validateSecretStrength(this.config.accessTokenSecret, 'access token');
      this.validateSecretStrength(this.config.refreshTokenSecret, 'refresh token');
    }

    // Additional checks for all environments
    if (this.config.accessTokenSecret === this.config.refreshTokenSecret) {
      throw new Error('Access token and refresh token secrets must be different');
    }

    // Basic minimum length check for all environments
    if (this.config.accessTokenSecret.length < 16 ||
        this.config.refreshTokenSecret.length < 16) {
      throw new Error('JWT secrets must be at least 16 characters long');
    }
  }

  /**
   * Validate individual secret strength
   */
  private validateSecretStrength(secret: string, type: string): void {
    if (secret.length < 32) {
      throw new Error(`${type} secret must be at least 32 characters long for production`);
    }

    // Check for entropy - secret should contain mixed case, numbers, and symbols
    const hasLowerCase = /[a-z]/.test(secret);
    const hasUpperCase = /[A-Z]/.test(secret);
    const hasNumbers = /[0-9]/.test(secret);
    const hasSymbols = /[!@#$%^&*(),.?":{}|<>]/.test(secret);

    const complexityScore = [hasLowerCase, hasUpperCase, hasNumbers, hasSymbols].filter(Boolean).length;

    if (complexityScore < 3) {
      throw new Error(`${type} secret must contain at least 3 of: lowercase, uppercase, numbers, symbols`);
    }

    // Check for common weak patterns
    if (this.isWeakSecret(secret)) {
      throw new Error(`${type} secret appears to be weak. Use a cryptographically secure random string`);
    }
  }

  /**
   * Check for common weak secret patterns
   */
  private isWeakSecret(secret: string): boolean {
    const weakPatterns = [
      /^123456/,
      /password/i,
      /secret/i,
      /^abc/i,
      /^qwe/i,
      /(.)\1{4,}/,  // Repeated characters (5 or more in a row)
      /^.{0,15}$/   // Too short (already checked but double-check)
    ];

    return weakPatterns.some(pattern => pattern.test(secret));
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