module.exports = {
  projects: [
    '<rootDir>/packages/*/jest.config.js',
    '<rootDir>/apps/*/jest.config.js',
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    'apps/*/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '<rootDir>/packages/*/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/packages/*/src/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/apps/*/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/apps/*/src/**/*.{test,spec}.{ts,tsx}',
  ],
};