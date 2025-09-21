// Authentication types based on backend API contract

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  role: 'admin' | 'user' | 'viewer';
  emailVerified: boolean;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope: string[];
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  sessionId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  user: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    gdprConsent: boolean;
    marketingConsent: boolean;
  };
  company: {
    name: string;
    industry: {
      sector: string;
      subSector: string;
      regulatoryClassification: string;
      specificRegulations: string[];
    };
    businessModel: string;
    size: string;
    description: string;
    website?: string;
    headquarters: {
      country: string;
      city: string;
    };
  };
}

export interface RegisterResponse {
  userId: string;
  companyId: string;
  email: string;
  emailVerified: boolean;
  verificationEmailSent: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope: string[];
}

export interface JWTPayload {
  sub: string;           // User ID
  email: string;         // User email address
  companyId: string;     // Company ID for the user
  role: string;          // User role (admin|user|viewer)
  permissions: string[]; // Array of permission strings
  emailVerified: boolean;// Email verification status
  iat: number;          // Issued at timestamp
  exp: number;          // Expiration timestamp
  jti: string;          // JWT ID for revocation
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  register: (data: RegisterRequest) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<AuthTokens | null>;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

// Device information for session tracking
export interface DeviceInfo {
  userAgent: string;
  ipAddress?: string;
  deviceId: string;
  platform: string;
  browser: string;
}

// Session storage interface
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  sessionId: string;
  deviceId: string;
  user: User;
}

// Token manager interface
export interface TokenManager {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (tokens: AuthTokens, sessionId: string, user: User) => void;
  clearTokens: () => void;
  isTokenExpired: (token?: string) => boolean;
  getTokenExpiration: (token?: string) => number | null;
  shouldRefreshToken: () => boolean;
}

// Auth error types
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_SUSPENDED'
  | 'TOKEN_EXPIRED'
  | 'REFRESH_TOKEN_INVALID'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'EMAIL_ALREADY_EXISTS'
  | 'VALIDATION_ERROR'
  | 'PASSWORD_TOO_WEAK'
  | 'UNAUTHORIZED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// Permission constants
export const PERMISSIONS = {
  ASSESSMENTS_CREATE: 'assessments:create',
  ASSESSMENTS_READ: 'assessments:read',
  ASSESSMENTS_UPDATE: 'assessments:update',
  ASSESSMENTS_DELETE: 'assessments:delete',
  AGENTS_CREATE: 'agents:create',
  AGENTS_READ: 'agents:read',
  AGENTS_UPDATE: 'agents:update',
  AGENTS_DELETE: 'agents:delete',
  COMPANY_READ: 'company:read',
  COMPANY_UPDATE: 'company:update',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  ANALYTICS_READ: 'analytics:read',
} as const;

// Role constants
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
} as const;

// Default permissions by role
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.ASSESSMENTS_CREATE,
    PERMISSIONS.ASSESSMENTS_READ,
    PERMISSIONS.ASSESSMENTS_UPDATE,
    PERMISSIONS.ASSESSMENTS_DELETE,
    PERMISSIONS.AGENTS_CREATE,
    PERMISSIONS.AGENTS_READ,
    PERMISSIONS.AGENTS_UPDATE,
    PERMISSIONS.AGENTS_DELETE,
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.COMPANY_UPDATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.ANALYTICS_READ,
  ],
  [ROLES.USER]: [
    PERMISSIONS.ASSESSMENTS_CREATE,
    PERMISSIONS.ASSESSMENTS_READ,
    PERMISSIONS.ASSESSMENTS_UPDATE,
    PERMISSIONS.AGENTS_READ,
    PERMISSIONS.AGENTS_UPDATE,
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.ASSESSMENTS_READ,
    PERMISSIONS.AGENTS_READ,
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
} as const;