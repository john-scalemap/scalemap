import {
  validateEmail,
  validatePhone,
  validateUrl,
  sanitizeString,
  isNonEmptyString,
} from '../validation';

describe('Validation utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should validate phone numbers', () => {
      expect(validatePhone('1234567890')).toBe(true);
      expect(validatePhone('+1-555-123-4567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should validate URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://localhost:3000')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });
  });

  describe('isNonEmptyString', () => {
    it('should validate non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('  world  ')).toBe(true);
    });

    it('should reject empty or non-string values', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });
});