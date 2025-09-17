export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_SUSPENDED'
  | 'PASSWORD_TOO_WEAK'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'REFRESH_TOKEN_INVALID'
  | 'RATE_LIMIT_EXCEEDED'
  | 'GDPR_CONSENT_REQUIRED'
  | 'INVALID_EMAIL_FORMAT'
  | 'PASSWORD_MISMATCH'
  | 'COMPANY_REGISTRATION_FAILED'
  | 'EMAIL_VERIFICATION_FAILED'
  | 'PASSWORD_RESET_FAILED';

export interface EmailVerification {
  token: string;
  email: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
}

export interface PasswordResetToken {
  token: string;
  email: string;
  expiresAt: string;
  used: boolean;
  attempts: number;
  maxAttempts: number;
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  deviceId?: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: string;
  refreshToken: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface SecuritySettings {
  passwordPolicy: PasswordPolicy;
  sessionSettings: SessionSettings;
  emailSettings: EmailSettings;
  rateLimits: RateLimits;
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  forbidCommonPasswords: boolean;
  historyCount: number; // prevent reuse of last N passwords
}

export interface SessionSettings {
  accessTokenTTL: number; // seconds
  refreshTokenTTL: number; // seconds
  maxConcurrentSessions: number;
  requireReauthForSensitiveOperations: boolean;
  sessionTimeoutWarning: number; // seconds before expiry to warn user
}

export interface EmailSettings {
  verificationTokenTTL: number; // seconds
  resetTokenTTL: number; // seconds
  maxVerificationAttempts: number;
  maxResetAttempts: number;
  cooldownPeriod: number; // seconds between email requests
}

export interface RateLimits {
  loginAttempts: {
    maxAttempts: number;
    windowMinutes: number;
    lockoutMinutes: number;
  };
  registrationAttempts: {
    maxAttempts: number;
    windowMinutes: number;
  };
  passwordResetAttempts: {
    maxAttempts: number;
    windowMinutes: number;
  };
  emailVerificationAttempts: {
    maxAttempts: number;
    windowMinutes: number;
  };
}

export interface JWTPayload {
  sub: string; // user ID
  email: string;
  companyId: string;
  role: string;
  permissions: string[];
  emailVerified: boolean;
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  actions: string[];
  conditions?: Record<string, unknown>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  companyId?: string; // null for system roles
}

export interface AuthAuditLog {
  id: string;
  userId?: string;
  email: string;
  action: AuthAction;
  outcome: 'success' | 'failure';
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export type AuthAction =
  | 'login'
  | 'logout'
  | 'register'
  | 'verify_email'
  | 'password_reset_request'
  | 'password_reset_confirm'
  | 'password_change'
  | 'token_refresh'
  | 'account_lock'
  | 'account_unlock'
  | 'gdpr_consent_update';