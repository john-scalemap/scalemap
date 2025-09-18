import { JWTService } from '../jwt';

describe('JWT Secret Security Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should allow default development secrets in development', () => {
      process.env.JWT_ACCESS_SECRET = 'dev-access-secret-change-in-production';
      process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret-change-in-production';

      expect(() => new JWTService()).not.toThrow();
    });

    it('should enforce minimum 16 character length in development', () => {
      process.env.JWT_ACCESS_SECRET = 'short';
      process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret-change-in-production';

      expect(() => new JWTService()).toThrow('JWT secrets must be at least 16 characters long');
    });

    it('should require different secrets for access and refresh tokens', () => {
      process.env.JWT_ACCESS_SECRET = 'same-secret-for-both-tokens';
      process.env.JWT_REFRESH_SECRET = 'same-secret-for-both-tokens';

      expect(() => new JWTService()).toThrow('Access token and refresh token secrets must be different');
    });
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should reject default development secrets', () => {
      process.env.JWT_ACCESS_SECRET = 'dev-access-secret-change-in-production';
      process.env.JWT_REFRESH_SECRET = 'strong-production-refresh-secret-123!';

      expect(() => new JWTService()).toThrow('Default development JWT secrets detected');
    });

    it('should reject secrets with "change-in-production" text', () => {
      process.env.JWT_ACCESS_SECRET = 'dev-access-secret-change-in-production';
      process.env.JWT_REFRESH_SECRET = 'strong-production-refresh-secret-123!';

      expect(() => new JWTService()).toThrow('Default development JWT secrets detected');
    });

    it('should require minimum 32 character length', () => {
      process.env.JWT_ACCESS_SECRET = 'ShortProdSecret123!'; // 19 chars
      process.env.JWT_REFRESH_SECRET = 'StrongProductionRefreshSecret123!@#';

      expect(() => new JWTService()).toThrow('access token secret must be at least 32 characters long for production');
    });

    it('should require complexity (3 of 4 character types)', () => {
      process.env.JWT_ACCESS_SECRET = 'weakproductionaccesssecretwithnouppercase'; // 40 chars, lowercase only
      process.env.JWT_REFRESH_SECRET = 'StrongProductionRefreshSecret123!@#';

      expect(() => new JWTService()).toThrow('access token secret must contain at least 3 of: lowercase, uppercase, numbers, symbols');
    });

    it('should detect weak patterns', () => {
      process.env.JWT_ACCESS_SECRET = 'Password123!@#$%^&*()1234567890ABCDEFG'; // Contains "password", 40 chars
      process.env.JWT_REFRESH_SECRET = 'X7$kN9#mP2&qL5@wE8*uI3!zR6%tY1^vB4';

      expect(() => new JWTService()).toThrow('access token secret appears to be weak');
    });

    it('should accept strong production secrets', () => {
      process.env.JWT_ACCESS_SECRET = 'X7$kN9#mP2&qL5@wE8*uI3!zR6%tY1^vB4';
      process.env.JWT_REFRESH_SECRET = 'A9*dF2@sG8#hJ4$kL7!mN1%pQ5&rT3^wX6';

      expect(() => new JWTService()).not.toThrow();
    });

    it('should detect repeated characters', () => {
      process.env.JWT_ACCESS_SECRET = 'X7$kN9#mP2&qL5@wE8*uI3!11111R6%tY1^vB4'; // 5 consecutive 1s
      process.env.JWT_REFRESH_SECRET = 'A9*dF2@sG8#hJ4$kL7!mN1%pQ5&rT3^wX6';

      expect(() => new JWTService()).toThrow('access token secret appears to be weak');
    });
  });

  describe('Staging Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'staging';
    });

    it('should enforce same rules as production', () => {
      process.env.JWT_ACCESS_SECRET = 'dev-access-secret-change-in-production';
      process.env.JWT_REFRESH_SECRET = 'StrongStagingRefreshSecret123!@#';

      expect(() => new JWTService()).toThrow('Default development JWT secrets detected');
    });

    it('should accept strong staging secrets', () => {
      process.env.JWT_ACCESS_SECRET = 'M8$pQ3#rT9&vW2@xZ5!nB7%cD1^fG4*kL6';
      process.env.JWT_REFRESH_SECRET = 'H2*jK5@lN8#oP1$qR4!sT7%uV9&wX3^yA6';

      expect(() => new JWTService()).not.toThrow();
    });
  });
});