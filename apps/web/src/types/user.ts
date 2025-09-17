export interface User {
  id: string;
  cognitoUserId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  companyId: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt?: string;
  gdprConsent: GDPRConsent;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'user' | 'viewer';

export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export interface GDPRConsent {
  consentGiven: boolean;
  consentDate: string;
  consentVersion: string;
  ipAddress: string;
  userAgent: string;
  dataProcessingPurposes: string[];
}

export interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  timezone?: string;
  language: string;
  preferences: UserPreferences;
  updatedAt: string;
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  dashboard: DashboardPreferences;
  privacy: PrivacyPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  assessmentComplete: boolean;
  weeklyDigest: boolean;
  marketingCommunications: boolean;
}

export interface DashboardPreferences {
  defaultView: 'overview' | 'assessments' | 'agents' | 'analytics';
  itemsPerPage: number;
  compactMode: boolean;
}

export interface PrivacyPreferences {
  profileVisibility: 'private' | 'company' | 'public';
  dataRetention: 'standard' | 'extended' | 'minimal';
  analyticsOptOut: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  role: UserRole;
  emailVerified: boolean;
  permissions: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  gdprConsent: boolean;
  marketingConsent?: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CompanyRegistration {
  name: string;
  industry: CompanyIndustry;
  size: CompanySize;
  businessModel: BusinessModel;
  description?: string;
  website?: string;
  headquarters?: {
    country: string;
    city: string;
  };
}

export interface CompanyIndustry {
  sector: string;
  subSector: string;
  regulatoryClassification: 'highly-regulated' | 'moderately-regulated' | 'lightly-regulated';
  specificRegulations: string[];
}

export type CompanySize =
  | 'micro'     // 1-10 employees
  | 'small'     // 11-50 employees
  | 'medium'    // 51-250 employees
  | 'large'     // 251-1000 employees
  | 'enterprise'; // 1000+ employees

export type BusinessModel =
  | 'b2b-saas'
  | 'b2c-saas'
  | 'marketplace'
  | 'ecommerce'
  | 'consulting'
  | 'manufacturing'
  | 'retail'
  | 'healthcare'
  | 'fintech'
  | 'other';