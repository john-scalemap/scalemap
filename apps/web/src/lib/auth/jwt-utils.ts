import * as jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';

interface TokenPayload extends JwtPayload {
  sub: string; // user ID
  userId?: string; // legacy support
  email: string;
  companyId: string;
  role: string;
  permissions: string[];
  emailVerified: boolean;
  scope?: string[]; // legacy support
}

/**
 * JWT utility functions for secure token handling
 * Replaces unsafe manual JWT parsing with proper validation
 */
export class JwtUtils {
  /**
   * Decode JWT token and validate structure (without signature verification)
   * Only use for checking expiration - backend must verify signatures
   */
  static decodeToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.decode(token) as TokenPayload;

      if (!decoded || typeof decoded !== 'object') {
        return null;
      }

      // Validate required fields
      if ((!decoded.sub && !decoded.userId) || !decoded.email || !decoded.exp || !decoded.companyId) {
        return null;
      }

      return decoded;
    } catch (error) {
      console.error('JWT decode error:', error);
      return null;
    }
  }

  /**
   * Check if token is expired with buffer time
   * @param token JWT token string
   * @param bufferSeconds Buffer time in seconds (default 5 minutes)
   */
  static isTokenExpired(token: string, bufferSeconds: number = 300): boolean {
    const payload = this.decodeToken(token);

    if (!payload || !payload.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= (now + bufferSeconds);
  }

  /**
   * Get token expiration timestamp
   */
  static getTokenExpiration(token: string): number | null {
    const payload = this.decodeToken(token);
    return payload?.exp || null;
  }

  /**
   * Get user ID from token
   */
  static getUserId(token: string): string | null {
    const payload = this.decodeToken(token);
    return payload?.userId || null;
  }

  /**
   * Get user email from token
   */
  static getUserEmail(token: string): string | null {
    const payload = this.decodeToken(token);
    return payload?.email || null;
  }

  /**
   * Get company ID from token
   */
  static getCompanyId(token: string): string | null {
    const payload = this.decodeToken(token);
    return payload?.companyId || null;
  }

  /**
   * Check if token has specific scope
   */
  static hasScope(token: string, requiredScope: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload?.scope) {
      return false;
    }
    return payload.scope.includes(requiredScope);
  }
}