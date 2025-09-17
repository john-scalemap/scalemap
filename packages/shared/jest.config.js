module.exports = {
  displayName: '@scalemap/shared',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.{ts,tsx}', '<rootDir>/src/**/*.{test,spec}.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
};