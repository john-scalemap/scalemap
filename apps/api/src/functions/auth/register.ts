import { randomUUID } from 'crypto';

import {
  RegisterCredentials,
  CompanyRegistration,
  AuthError,
  ApiResponse
} from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as bcrypt from 'bcrypt';

import { db } from '../../services/database';
import { emailService } from '../../services/email';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';


interface RegisterRequestBody {
  user: RegisterCredentials;
  company: CompanyRegistration;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'register' });

  try {
    requestLogger.info('User registration requested');
    Monitoring.incrementCounter('RegistrationRequests');

    // Parse and validate request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId);
    }

    const { user, company }: RegisterRequestBody = JSON.parse(event.body);

    // Validate required fields
    const validationError = validateRegistrationData(user, company);
    if (validationError) {
      return createErrorResponse(400, validationError.code, validationError.message, requestId);
    }

    // Check if user already exists
    const existingUser = await checkUserExists(user.email);
    if (existingUser) {
      Monitoring.incrementCounter('RegistrationFailures', { reason: 'email_exists' });
      return createErrorResponse(409, 'EMAIL_ALREADY_EXISTS', 'A user with this email already exists', requestId);
    }

    // Generate IDs
    const userId = randomUUID();
    const companyId = randomUUID();
    const cognitoUserId = randomUUID(); // In real implementation, this would come from Cognito
    const verificationToken = randomUUID();

    // Hash password
    const hashedPassword = await bcrypt.hash(user.password, 12);

    // Create user record
    const userData = {
      PK: `USER#${userId}`,
      SK: 'METADATA',
      GSI1PK: `EMAIL#${user.email.toLowerCase()}`,
      GSI1SK: `USER#${userId}`,
      id: userId,
      cognitoUserId,
      email: user.email.toLowerCase(),
      emailVerified: false,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId,
      role: 'admin', // First user is admin
      status: 'pending',
      passwordHash: hashedPassword,
      gdprConsent: {
        consentGiven: user.gdprConsent,
        consentDate: new Date().toISOString(),
        consentVersion: '1.0',
        ipAddress: event.requestContext?.identity?.sourceIp || 'unknown',
        userAgent: event.headers?.['User-Agent'] || 'unknown',
        dataProcessingPurposes: ['authentication', 'service_delivery', 'analytics']
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Create company record
    const companyData = {
      PK: `COMPANY#${companyId}`,
      SK: 'METADATA',
      GSI1PK: `USER#${cognitoUserId}`,
      GSI1SK: `COMPANY#${companyId}`,
      id: companyId,
      name: company.name,
      industry: {
        sector: company.industry.sector,
        subSector: company.industry.subSector,
        regulatoryClassification: company.industry.regulatoryClassification,
        specificRegulations: company.industry.specificRegulations || []
      },
      businessModel: company.businessModel,
      size: company.size,
      description: company.description || '',
      website: company.website || '',
      headquarters: company.headquarters || { country: 'Unknown', city: 'Unknown' },
      ownerId: userId,
      subscription: {
        planId: 'starter',
        status: 'trial',
        billingPeriod: 'monthly',
        startDate: new Date().toISOString(),
        features: ['basic_assessments', 'basic_agents'],
        limits: {
          maxAssessments: 5,
          maxAgents: 2,
          maxUsers: 1,
          maxStorageGB: 1
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Create email verification record
    const verificationData = {
      PK: `EMAIL_VERIFICATION#${verificationToken}`,
      SK: 'METADATA',
      GSI2PK: `EMAIL#${user.email.toLowerCase()}`,
      GSI2SK: `PENDING#${new Date().toISOString()}`,
      token: verificationToken,
      email: user.email.toLowerCase(),
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      attempts: 0,
      maxAttempts: 5,
      TTL: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
      createdAt: new Date().toISOString()
    };

    // Store all records in database
    await Promise.all([
      db.put(userData),
      db.put(companyData),
      db.put(verificationData)
    ]);

    requestLogger.info('User and company created successfully', {
      userId,
      companyId,
      email: user.email
    });

    // Send verification email
    await emailService.sendVerificationEmail(user.email, verificationToken);

    requestLogger.info('Verification email sent', {
      userId,
      email: user.email
    });

    Monitoring.incrementCounter('RegistrationSuccess');

    const response: ApiResponse = {
      success: true,
      data: {
        userId,
        email: user.email,
        emailVerified: false,
        message: 'Registration successful. Please check your email for verification instructions.'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    Monitoring.recordError('register', 'UnexpectedError', error as Error);
    requestLogger.error('Registration failed', { error: (error as Error).message });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

function validateRegistrationData(user: RegisterCredentials, company: CompanyRegistration): AuthError | null {
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(user.email)) {
    return { code: 'INVALID_EMAIL_FORMAT', message: 'Invalid email format' };
  }

  // Password validation
  if (user.password.length < 8) {
    return { code: 'PASSWORD_TOO_WEAK', message: 'Password must be at least 8 characters long' };
  }

  if (user.password !== user.confirmPassword) {
    return { code: 'PASSWORD_MISMATCH', message: 'Passwords do not match' };
  }

  // GDPR consent validation
  if (!user.gdprConsent) {
    return { code: 'GDPR_CONSENT_REQUIRED', message: 'GDPR consent is required' };
  }

  // Required fields validation
  if (!user.firstName?.trim() || !user.lastName?.trim()) {
    return { code: 'INVALID_CREDENTIALS', message: 'First name and last name are required' };
  }

  if (!company.name?.trim()) {
    return { code: 'COMPANY_REGISTRATION_FAILED', message: 'Company name is required' };
  }

  if (!company.industry?.sector || !company.industry?.subSector) {
    return { code: 'COMPANY_REGISTRATION_FAILED', message: 'Company industry information is required' };
  }

  if (!company.businessModel || !company.size) {
    return { code: 'COMPANY_REGISTRATION_FAILED', message: 'Business model and company size are required' };
  }

  return null;
}

async function checkUserExists(email: string): Promise<boolean> {
  try {
    const result = await db.query(
      'GSI1PK = :email',
      { ':email': `EMAIL#${email.toLowerCase()}` },
      { indexName: 'GSI1' }
    );
    return result.length > 0;
  } catch (error) {
    logger.error('Error checking if user exists', { error: (error as Error).message });
    throw error;
  }
}

function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId: string
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: { code, message },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    },
    body: JSON.stringify(response),
  };
}