import {
  passwordValidator,
  PasswordValidator,
  validatePassword,
  getPasswordStrength,
  isPasswordValid
} from '../password-validation';

describe('Password Validation Utils', () => {
  describe('PasswordValidator class', () => {
    describe('validatePassword', () => {
      it('should validate a strong password correctly', () => {
        const result = passwordValidator.validatePassword('MySecureP@ss2024');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.strength.score).toBeGreaterThanOrEqual(2);
      });

      it('should reject weak passwords', () => {
        const result = passwordValidator.validatePassword('weak');

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.strength.score).toBeLessThan(2);
      });

      it('should detect personal information in passwords', () => {
        const email = 'john.doe@example.com';
        const firstName = 'John';
        const lastName = 'Doe';

        const testCases = [
          {
            password: 'JohnP@ssw0rd123',
            expectNameError: true,
            expectEmailError: false
          },
          {
            password: 'DoeP@ssw0rd123',
            expectNameError: true,
            expectEmailError: false
          },
          {
            password: 'john.doeP@ssw0rd123',
            expectNameError: false,
            expectEmailError: true
          }
        ];

        testCases.forEach(({ password, expectNameError, expectEmailError }) => {
          const result = passwordValidator.validatePassword(password, email, firstName, lastName);

          if (expectNameError) {
            expect(result.errors.some(e => e.code === 'PASSWORD_CONTAINS_NAME')).toBe(true);
          }

          if (expectEmailError) {
            expect(result.errors.some(e => e.code === 'PASSWORD_CONTAINS_EMAIL')).toBe(true);
          }
        });
      });

      it('should detect common patterns and words', () => {
        const testPasswords = [
          'MyPassword2024!',   // Contains "password"
          'AdminKeyP@ss123',   // Contains "admin"
          'MySecretP@ss123',   // Contains "123"
          'QwertySecure2024!', // Contains "qwerty"
        ];

        testPasswords.forEach(password => {
          const result = passwordValidator.validatePassword(password);

          expect(
            result.errors.some(e =>
              e.code === 'PASSWORD_COMMON_WORD' ||
              e.code === 'PASSWORD_COMMON_PATTERN'
            )
          ).toBe(true);
        });
      });
    });

    describe('calculatePasswordStrength', () => {
      it('should assign higher scores to longer passwords', () => {
        const shortPassword = passwordValidator.validatePassword('Short1!');
        const longPassword = passwordValidator.validatePassword('VeryLongPasswordWithManyCharacters123!');

        expect(longPassword.strength.score).toBeGreaterThan(shortPassword.strength.score);
      });

      it('should assign higher scores to passwords with more character variety', () => {
        const basicPassword = passwordValidator.validatePassword('securekey2024');
        const complexPassword = passwordValidator.validatePassword('MySecureP@ss2024!');

        expect(complexPassword.strength.score).toBeGreaterThan(basicPassword.strength.score);
      });
    });

    describe('getStrengthDescription', () => {
      it('should return appropriate descriptions for different scores', () => {
        const descriptions = [
          { score: 0, expected: 'Very Weak' },
          { score: 1, expected: 'Very Weak' },
          { score: 2, expected: 'Weak' },
          { score: 3, expected: 'Good' },
          { score: 4, expected: 'Very Strong' }
        ];

        descriptions.forEach(({ score, expected }) => {
          const result = passwordValidator.getStrengthDescription(score);
          expect(result.label).toBe(expected);
          expect(result.color).toContain('text-');
          expect(result.bgColor).toContain('bg-');
        });
      });
    });

    describe('getStrengthBarWidth', () => {
      it('should return appropriate widths for different scores', () => {
        expect(passwordValidator.getStrengthBarWidth(0)).toBe(10); // Minimum
        expect(passwordValidator.getStrengthBarWidth(2)).toBe(50);
        expect(passwordValidator.getStrengthBarWidth(4)).toBe(100);
      });
    });

    describe('isMinimumViable', () => {
      it('should correctly identify viable passwords', () => {
        const viablePasswords = [
          'MySecureP@ss2024',
          'ValidSecure1!',
          'SecureKey@2024'
        ];

        viablePasswords.forEach(password => {
          expect(passwordValidator.isMinimumViable(password)).toBe(true);
        });
      });

      it('should reject non-viable passwords', () => {
        const nonViablePasswords = [
          'short',                  // Too short
          'nostrongpassword123!',   // No uppercase
          'NOSTRONGPASSWORD123!',   // No lowercase
          'NoStrongPassword!',      // No numbers
          'NoStrongPassword123'     // No special chars
        ];

        nonViablePasswords.forEach(password => {
          expect(passwordValidator.isMinimumViable(password)).toBe(false);
        });
      });
    });

    describe('getPolicyRequirements', () => {
      it('should return an array of requirements', () => {
        const requirements = passwordValidator.getPolicyRequirements();

        expect(Array.isArray(requirements)).toBe(true);
        expect(requirements.length).toBeGreaterThan(0);
        expect(requirements.some(req => req.includes('12 characters'))).toBe(true);
        expect(requirements.some(req => req.includes('uppercase'))).toBe(true);
        expect(requirements.some(req => req.includes('lowercase'))).toBe(true);
        expect(requirements.some(req => req.includes('number'))).toBe(true);
        expect(requirements.some(req => req.includes('special character'))).toBe(true);
      });
    });
  });

  describe('Custom configuration', () => {
    it('should accept and use custom configuration', () => {
      const customValidator = new PasswordValidator({
        minLength: 8,
        maxLength: 64,
        requireUppercase: false,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        forbiddenPatterns: [],
        forbiddenWords: []
      });

      const result = customValidator.validatePassword('password123');

      // Should pass with custom config (no uppercase/special chars required)
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_UPPERCASE')).toBe(false);
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_SPECIAL_CHARS')).toBe(false);
    });
  });

  describe('Utility functions', () => {
    describe('validatePassword', () => {
      it('should be a wrapper around passwordValidator.validatePassword', () => {
        const password = 'MySecureP@ss2024';
        const result = validatePassword(password);

        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('errors');
        expect(result).toHaveProperty('strength');
      });

      it('should handle personal information parameters', () => {
        const result = validatePassword(
          'MySecureP@ss2024',
          'test@example.com',
          'Test',
          'User'
        );

        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('errors');
        expect(result).toHaveProperty('strength');
      });
    });

    describe('getPasswordStrength', () => {
      it('should return only strength information', () => {
        const strength = getPasswordStrength('MySecureP@ss2024');

        expect(strength).toHaveProperty('score');
        expect(strength).toHaveProperty('feedback');
        expect(strength).toHaveProperty('isValid');
        expect(typeof strength.score).toBe('number');
        expect(Array.isArray(strength.feedback)).toBe(true);
        expect(typeof strength.isValid).toBe('boolean');
      });
    });

    describe('isPasswordValid', () => {
      it('should return boolean for password validity', () => {
        expect(isPasswordValid('MySecureP@ss2024')).toBe(true);
        expect(isPasswordValid('weak')).toBe(false);
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty strings gracefully', () => {
      const result = validatePassword('');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.strength.score).toBe(0);
    });

    it('should handle undefined/null parameters gracefully', () => {
      expect(() => {
        validatePassword('TestP@ssw0rd123', undefined, undefined, undefined);
      }).not.toThrow();
    });

    it('should handle very long passwords', () => {
      const veryLongPassword = 'A'.repeat(200) + '1!a';
      const result = validatePassword(veryLongPassword);

      expect(result.errors.some(e => e.code === 'PASSWORD_TOO_LONG')).toBe(true);
    });

    it('should handle special unicode characters', () => {
      const unicodePassword = 'TestP@ssw0rd123α';
      const result = validatePassword(unicodePassword);

      // Should not crash and should still validate other requirements
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
    });

    it('should handle passwords with only special characters', () => {
      const specialOnlyPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const result = validatePassword(specialOnlyPassword);

      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_UPPERCASE')).toBe(true);
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_LOWERCASE')).toBe(true);
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_NUMBERS')).toBe(true);
    });

    it('should detect excessive repetition patterns', () => {
      const repetitivePasswords = [
        'TestP@ssw0rd1111!',  // 4 consecutive same chars
        'TestP@ssw0rdaaaa!',  // 4 consecutive same chars
        'TestPassabababab!',  // Alternating pattern
      ];

      repetitivePasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.errors.some(e => e.code === 'PASSWORD_REPETITIVE')).toBe(true);
      });
    });

    it('should handle case-insensitive personal information detection', () => {
      const result = validatePassword(
        'JOHNp@ssw0rd123',
        'john.doe@example.com',
        'john',
        'DOE'
      );

      expect(result.errors.some(e => e.code === 'PASSWORD_CONTAINS_NAME')).toBe(true);
    });

    it('should not flag very short personal information', () => {
      const result = validatePassword(
        'ValidP@ssw0rd123',
        'a@b.co',
        'A',
        'B'
      );

      expect(result.errors.some(e =>
        e.code === 'PASSWORD_CONTAINS_EMAIL' ||
        e.code === 'PASSWORD_CONTAINS_NAME'
      )).toBe(false);
    });
  });

  describe('Performance and consistency', () => {
    it('should return consistent results for the same input', () => {
      const password = 'TestP@ssw0rd123';
      const result1 = validatePassword(password);
      const result2 = validatePassword(password);

      expect(result1.isValid).toBe(result2.isValid);
      expect(result1.errors.length).toBe(result2.errors.length);
      expect(result1.strength.score).toBe(result2.strength.score);
    });

    it('should handle rapid successive calls efficiently', () => {
      const passwords = Array.from({ length: 100 }, (_, i) => `TestP@ssw0rd${i}!`);

      const startTime = Date.now();
      passwords.forEach(password => validatePassword(password));
      const endTime = Date.now();

      // Should complete within reasonable time (less than 1 second for 100 passwords)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});