import { AuthError, PasswordStrength, PasswordValidationResult } from '@scalemap/shared/types/auth';

interface PasswordPolicyConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  forbiddenPatterns: string[];
  forbiddenWords: string[];
}

const DEFAULT_CONFIG: PasswordPolicyConfig = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  forbiddenPatterns: [
    // Sequential patterns
    '123',
    'abc',
    'qwerty',
    'password',
    'admin',
    'letmein',
    'welcome',
    // Keyboard patterns
    'qwer',
    'asdf',
    'zxcv',
    // Repeated characters
    '111',
    'aaa',
    '000'
  ],
  forbiddenWords: [
    'password',
    'admin',
    'user',
    'login',
    'guest',
    'test',
    'demo',
    'temp',
    'scalemap',
    'company'
  ]
};

/**
 * Frontend password validation utility
 * Provides real-time password strength assessment and validation
 */
export class PasswordValidator {
  private config: PasswordPolicyConfig;

  constructor(config: PasswordPolicyConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Validate password and return comprehensive results
   */
  validatePassword(
    password: string,
    email?: string,
    firstName?: string,
    lastName?: string
  ): PasswordValidationResult {
    const errors: AuthError[] = [];
    const feedback: string[] = [];

    // Length validation
    if (password.length < this.config.minLength) {
      errors.push({
        code: 'PASSWORD_TOO_SHORT',
        message: `Password must be at least ${this.config.minLength} characters long`
      });
      feedback.push(`Use at least ${this.config.minLength} characters`);
    }

    if (password.length > this.config.maxLength) {
      errors.push({
        code: 'PASSWORD_TOO_LONG',
        message: `Password must not exceed ${this.config.maxLength} characters`
      });
    }

    // Character type requirements
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push({
        code: 'PASSWORD_MISSING_UPPERCASE',
        message: 'Password must contain at least one uppercase letter'
      });
      feedback.push('Add uppercase letters');
    }

    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push({
        code: 'PASSWORD_MISSING_LOWERCASE',
        message: 'Password must contain at least one lowercase letter'
      });
      feedback.push('Add lowercase letters');
    }

    if (this.config.requireNumbers && !/[0-9]/.test(password)) {
      errors.push({
        code: 'PASSWORD_MISSING_NUMBERS',
        message: 'Password must contain at least one number'
      });
      feedback.push('Add numbers');
    }

    if (this.config.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push({
        code: 'PASSWORD_MISSING_SPECIAL_CHARS',
        message: 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)'
      });
      feedback.push('Add special characters');
    }

    // Pattern validation
    const lowerPassword = password.toLowerCase();
    for (const pattern of this.config.forbiddenPatterns) {
      if (lowerPassword.includes(pattern.toLowerCase())) {
        errors.push({
          code: 'PASSWORD_COMMON_PATTERN',
          message: 'Password contains common patterns or sequences'
        });
        feedback.push('Avoid common patterns and sequences');
        break;
      }
    }

    // Forbidden words validation
    for (const word of this.config.forbiddenWords) {
      if (lowerPassword.includes(word.toLowerCase())) {
        errors.push({
          code: 'PASSWORD_COMMON_WORD',
          message: 'Password contains common or dictionary words'
        });
        feedback.push('Avoid common words');
        break;
      }
    }

    // Personal information validation
    if (email) {
      const emailParts = email.toLowerCase().split('@');
      const emailUsername = emailParts[0] || '';
      if (emailUsername.length > 3 && lowerPassword.includes(emailUsername)) {
        errors.push({
          code: 'PASSWORD_CONTAINS_EMAIL',
          message: 'Password should not contain parts of your email address'
        });
        feedback.push('Avoid using parts of your email');
      }
    }

    if (firstName && firstName.length > 2 && lowerPassword.includes(firstName.toLowerCase())) {
      errors.push({
        code: 'PASSWORD_CONTAINS_NAME',
        message: 'Password should not contain your first name'
      });
      feedback.push('Avoid using your name');
    }

    if (lastName && lastName.length > 2 && lowerPassword.includes(lastName.toLowerCase())) {
      errors.push({
        code: 'PASSWORD_CONTAINS_NAME',
        message: 'Password should not contain your last name'
      });
      feedback.push('Avoid using your name');
    }

    // Repetition validation
    if (this.hasExcessiveRepetition(password)) {
      errors.push({
        code: 'PASSWORD_REPETITIVE',
        message: 'Password contains too many repeated characters'
      });
      feedback.push('Avoid repeating characters');
    }

    // Calculate strength score
    const strength = this.calculatePasswordStrength(password, feedback);

    return {
      isValid: errors.length === 0,
      errors,
      strength
    };
  }

  /**
   * Calculate password strength score
   */
  private calculatePasswordStrength(password: string, feedback: string[]): PasswordStrength {
    let score = 0;
    const strengthFeedback: string[] = [...feedback];

    // Length scoring
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety scoring
    let charTypes = 0;
    if (/[a-z]/.test(password)) charTypes++;
    if (/[A-Z]/.test(password)) charTypes++;
    if (/[0-9]/.test(password)) charTypes++;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) charTypes++;

    if (charTypes >= 3) score += 1;
    if (charTypes >= 4) score += 1;

    // Entropy and complexity
    const entropy = this.calculateEntropy(password);
    if (entropy > 40) score += 1;

    // Cap at 4
    score = Math.min(score, 4);

    return {
      score,
      feedback: strengthFeedback,
      isValid: score >= 2 && feedback.length === 0
    };
  }

  /**
   * Calculate password entropy
   */
  private calculateEntropy(password: string): number {
    const charset = this.getCharsetSize(password);
    return Math.log2(Math.pow(charset, password.length));
  }

  /**
   * Get character set size for entropy calculation
   */
  private getCharsetSize(password: string): number {
    let charset = 0;
    if (/[a-z]/.test(password)) charset += 26;
    if (/[A-Z]/.test(password)) charset += 26;
    if (/[0-9]/.test(password)) charset += 10;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) charset += 32;
    return charset || 1;
  }

  /**
   * Check for excessive character repetition
   */
  private hasExcessiveRepetition(password: string): boolean {
    // Check for more than 3 consecutive identical characters
    for (let i = 0; i < password.length - 3; i++) {
      if (password[i] === password[i + 1] &&
          password[i] === password[i + 2] &&
          password[i] === password[i + 3]) {
        return true;
      }
    }

    // Check for simple patterns (e.g., "abab")
    for (let i = 0; i < password.length - 3; i++) {
      if (password[i] === password[i + 2] &&
          password[i + 1] === password[i + 3]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get strength description
   */
  getStrengthDescription(score: number): {
    label: string;
    color: string;
    bgColor: string;
  } {
    switch (score) {
      case 0:
      case 1:
        return {
          label: 'Very Weak',
          color: 'text-red-600',
          bgColor: 'bg-red-100'
        };
      case 2:
        return {
          label: 'Weak',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100'
        };
      case 3:
        return {
          label: 'Good',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100'
        };
      case 4:
        return {
          label: 'Very Strong',
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        };
      default:
        return {
          label: 'Unknown',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
        };
    }
  }

  /**
   * Get progress bar width percentage
   */
  getStrengthBarWidth(score: number): number {
    return Math.max(10, (score / 4) * 100);
  }

  /**
   * Check if password meets minimum requirements
   */
  isMinimumViable(password: string): boolean {
    return password.length >= this.config.minLength &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  }

  /**
   * Get policy requirements as array
   */
  getPolicyRequirements(): string[] {
    const requirements = [];

    requirements.push(`At least ${this.config.minLength} characters long`);

    if (this.config.requireUppercase) requirements.push('At least one uppercase letter');
    if (this.config.requireLowercase) requirements.push('At least one lowercase letter');
    if (this.config.requireNumbers) requirements.push('At least one number');
    if (this.config.requireSpecialChars) requirements.push('At least one special character');

    requirements.push('No common patterns or dictionary words');
    requirements.push('No personal information (name, email)');

    return requirements;
  }
}

// Export default instance
export const passwordValidator = new PasswordValidator();

// Export utility functions
export const validatePassword = (
  password: string,
  email?: string,
  firstName?: string,
  lastName?: string
): PasswordValidationResult => {
  return passwordValidator.validatePassword(password, email, firstName, lastName);
};

export const getPasswordStrength = (password: string): PasswordStrength => {
  return passwordValidator.validatePassword(password).strength;
};

export const isPasswordValid = (password: string): boolean => {
  return passwordValidator.validatePassword(password).isValid;
};