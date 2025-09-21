/** @type {import('next').NextConfig} */

const nextConfig = {
  // Transpile shared packages
  transpilePackages: ['@scalemap/shared', '@scalemap/ui'],

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  },

  // Experimental features
  experimental: {
    // Enable strict mode for better development experience
    strictNextHead: true,
  },

  // Output configuration
  output: 'standalone',

  // TypeScript configuration
  typescript: {
    // Only run type checking in CI/production builds
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },

  // ESLint configuration
  eslint: {
    // Only run ESLint in CI/production builds for development speed
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
};

module.exports = nextConfig;
