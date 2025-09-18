import { passwordPolicy, PasswordPolicy } from '../password-policy';

describe('PasswordPolicy', () => {
  describe('validatePassword', () => {
    describe('Length validation', () => {
      it('should reject passwords shorter than 12 characters', () => {
        const result = passwordPolicy.validatePassword('Short1!');

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.code).toBe('PASSWORD_TOO_SHORT');
        expect(result.errors[0]?.message).toContain('12 characters');
      });

      it('should accept passwords with 12 or more characters', () => {
        const result = passwordPolicy.validatePassword('MySecureP@ss2024');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject passwords longer than 128 characters', () => {
        const longPassword = 'A'.repeat(129) + '1!';
        const result = passwordPolicy.validatePassword(longPassword);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'PASSWORD_TOO_LONG')).toBe(true);
      });
    });

    describe('Character type requirements', () => {
      it('should require uppercase letters', () => {
        const result = passwordPolicy.validatePassword('validpass123!');

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_UPPERCASE')).toBe(true);
      });

      it('should require lowercase letters', () => {
        const result = passwordPolicy.validatePassword('VALIDPASS123!');

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_LOWERCASE')).toBe(true);
      });

      it('should require numbers', () => {
        const result = passwordPolicy.validatePassword('ValidPassword!');

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_NUMBERS')).toBe(true);
      });

      it('should require special characters', () => {
        const result = passwordPolicy.validatePassword('ValidPassword123');

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_SPECIAL_CHARS')).toBe(true);
      });

      it('should accept passwords with all required character types', () => {
        const result = passwordPolicy.validatePassword('MySecureP@ss2024');

        expect(result.isValid).toBe(true);
        expect(result.errors.filter(e =>
          e.code.startsWith('PASSWORD_MISSING_')
        )).toHaveLength(0);
      });
    });

    describe('Common pattern detection', () => {
      it('should reject passwords with sequential patterns', () => {
        const passwords = [
          'MyPassword123456!',
          'ValidPassword123!',
          'TestPasswordabc!',
          'MyPasswordqwerty!'
        ];

        passwords.forEach(password => {
          const result = passwordPolicy.validatePassword(password);
          expect(result.errors.some(e => e.code === 'PASSWORD_COMMON_PATTERN')).toBe(true);
        });
      });

      it('should reject passwords with keyboard patterns', () => {
        const passwords = [
          'MyPasswordqwer!',
          'ValidPasswordasdf!',
          'TestPasswordzxcv!'
        ];

        passwords.forEach(password => {
          const result = passwordPolicy.validatePassword(password);
          expect(result.errors.some(e => e.code === 'PASSWORD_COMMON_PATTERN')).toBe(true);
        });
      });

      it('should reject passwords with repeated characters', () => {
        const passwords = [
          'MyPassword111!',
          'ValidPasswordaaa!',
          'TestPassword000!'
        ];

        passwords.forEach(password => {
          const result = passwordPolicy.validatePassword(password);
          expect(result.errors.some(e => e.code === 'PASSWORD_COMMON_PATTERN')).toBe(true);
        });
      });
    });

    describe('Common word detection', () => {
      it('should reject passwords with forbidden words', () => {
        const passwords = [
          'MyPasswordAdmin123!',
          'UserLoginPassword123!',
          'ScaleMapPassword123!',
          'CompanyPassword123!'
        ];

        passwords.forEach(password => {
          const result = passwordPolicy.validatePassword(password);
          expect(result.errors.some(e => e.code === 'PASSWORD_COMMON_WORD')).toBe(true);
        });
      });

      it('should accept passwords without forbidden words', () => {
        const result = passwordPolicy.validatePassword('ComplexValidP@ssw0rd');

        expect(result.errors.some(e => e.code === 'PASSWORD_COMMON_WORD')).toBe(false);
      });
    });

    describe('Personal information detection', () => {
      it('should reject passwords containing email username', () => {
        const email = 'john.doe@example.com';
        const result = passwordPolicy.validatePassword('john.doePassword123!', email);

        expect(result.errors.some(e => e.code === 'PASSWORD_CONTAINS_EMAIL')).toBe(true);
      });

      it('should accept passwords not containing email username', () => {
        const email = 'john.doe@example.com';
        const result = passwordPolicy.validatePassword('MySecureP@ss2024', email);

        expect(result.errors.some(e => e.code === 'PASSWORD_CONTAINS_EMAIL')).toBe(false);
      });

      it('should reject passwords containing first name', () => {
        const result = passwordPolicy.validatePassword('JohnPassword123!', 'test@example.com', 'John');

        expect(result.errors.some(e => e.code === 'PASSWORD_CONTAINS_NAME')).toBe(true);
      });

      it('should reject passwords containing last name', () => {
        const result = passwordPolicy.validatePassword('DoePassword123!', 'test@example.com', 'Jane', 'Doe');

        expect(result.errors.some(e => e.code === 'PASSWORD_CONTAINS_NAME')).toBe(true);
      });

      it('should accept passwords not containing personal information', () => {
        const result = passwordPolicy.validatePassword(
          'MySecureP@ss2024',
          'john.doe@example.com',
          'John',
          'Doe'
        );

        expect(result.errors.some(e =>
          e.code === 'PASSWORD_CONTAINS_EMAIL' || e.code === 'PASSWORD_CONTAINS_NAME'
        )).toBe(false);
      });
    });

    describe('Repetition detection', () => {
      it('should reject passwords with excessive repetition', () => {
        const passwords = [
          'ValidPassword1111!',  // 4 consecutive identical
          'ValidPasswordaaaa!',  // 4 consecutive identical
          'ValidPassabababab!',  // Pattern repetition
        ];

        passwords.forEach(password => {
          const result = passwordPolicy.validatePassword(password);
          expect(result.errors.some(e => e.code === 'PASSWORD_REPETITIVE')).toBe(true);
        });
      });

      it('should accept passwords without excessive repetition', () => {
        const result = passwordPolicy.validatePassword('MySecureP@ss2024');

        expect(result.errors.some(e => e.code === 'PASSWORD_REPETITIVE')).toBe(false);
      });
    });

    describe('Password strength calculation', () => {
      it('should calculate strength score correctly', () => {
        const tests = [
          { password: 'weak', expectedScore: 0 },
          { password: 'MySecureP@ss2024', expectedScore: 4 },
          { password: 'VeryLongAndComplexSecretKey2024!', expectedScore: 4 }
        ];

        tests.forEach(({ password, expectedScore }) => {
          const result = passwordPolicy.validatePassword(password);
          expect(result.strength.score).toBe(expectedScore);
        });
      });

      it('should provide appropriate feedback', () => {
        const result = passwordPolicy.validatePassword('weak');

        expect(result.strength.feedback.length).toBeGreaterThan(0);
        expect(result.strength.feedback.some(f => f.includes('characters'))).toBe(true);
      });
    });
  });

  describe('isMinimumViable', () => {
    it('should return true for passwords meeting minimum requirements', () => {
      const result = passwordPolicy.isMinimumViable('MySecureP@ss2024');
      expect(result).toBe(true);
    });

    it('should return false for passwords not meeting minimum requirements', () => {
      const passwords = [
        'short',               // Too short
        'securepass2024!',     // No uppercase
        'SECUREPASS2024!',     // No lowercase
        'SecurePassKey!',      // No numbers
        'SecurePassKey2024'    // No special chars
      ];

      passwords.forEach(password => {
        const result = passwordPolicy.isMinimumViable(password);
        expect(result).toBe(false);
      });
    });
  });

  describe('getPolicyDescription', () => {
    it('should return policy requirements as string', () => {
      const description = passwordPolicy.getPolicyDescription();

      expect(description).toContain('12 characters');
      expect(description).toContain('uppercase');
      expect(description).toContain('lowercase');
      expect(description).toContain('number');
      expect(description).toContain('special character');
      expect(description).toContain('common patterns');
      expect(description).toContain('personal information');
    });
  });

  describe('Custom configuration', () => {
    it('should accept custom configuration', () => {
      const customPolicy = new PasswordPolicy({
        minLength: 8,
        maxLength: 64,
        requireUppercase: false,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        forbiddenPatterns: [],
        forbiddenWords: []
      });

      const result = customPolicy.validatePassword('password123');

      // Should only require lowercase and numbers
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_UPPERCASE')).toBe(false);
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_SPECIAL_CHARS')).toBe(false);
      expect(result.errors.some(e => e.code === 'PASSWORD_TOO_SHORT')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty password', () => {
      const result = passwordPolicy.validatePassword('');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.strength.score).toBe(0);
    });

    it('should handle undefined personal information', () => {
      const result = passwordPolicy.validatePassword('ValidPassword123!', undefined, undefined, undefined);

      expect(result.errors.some(e =>
        e.code === 'PASSWORD_CONTAINS_EMAIL' || e.code === 'PASSWORD_CONTAINS_NAME'
      )).toBe(false);
    });

    it('should handle special characters correctly', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      for (const char of specialChars) {
        const password = `ValidPassword123${char}`;
        const result = passwordPolicy.validatePassword(password);

        expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_SPECIAL_CHARS')).toBe(false);
      }
    });

    it('should handle very short personal information gracefully', () => {
      const result = passwordPolicy.validatePassword(
        'ValidPassword123!',
        'a@b.co',
        'A',
        'B'
      );

      // Should not flag short names/emails
      expect(result.errors.some(e =>
        e.code === 'PASSWORD_CONTAINS_EMAIL' || e.code === 'PASSWORD_CONTAINS_NAME'
      )).toBe(false);
    });
  });
});