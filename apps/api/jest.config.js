module.exports = {
  displayName: '@scalemap/api',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.{ts,tsx}', '<rootDir>/src/**/*.{test,spec}.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/infrastructure/**', // Exclude CDK infrastructure code from coverage
  ],
  coverageDirectory: '<rootDir>/coverage',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testTimeout: 30000, // API tests may need more time
};