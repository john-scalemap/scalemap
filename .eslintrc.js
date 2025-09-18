module.exports = {
  extends: ['@scalemap/eslint-config'],
  root: true,
  env: {
    node: true,
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    'cdk.out/',
    '*.config.js',
    '*.config.ts'
  ],
  rules: {
    'react/jsx-no-target-blank': 'off',
    '@next/next/no-html-link-for-pages': 'off',
  },
  overrides: [
    {
      files: ['apps/web/**/*'],
      extends: ['@scalemap/eslint-config/react'],
    },
    {
      files: ['apps/api/**/*'],
      extends: ['@scalemap/eslint-config'],
    },
    {
      files: ['packages/**/*'],
      extends: ['@scalemap/eslint-config'],
    },
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    }
  ]
};