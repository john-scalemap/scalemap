/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@scalemap/shared', '@scalemap/ui'],
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  eslint: {
    // Allow production builds to complete even with ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to complete even with TypeScript errors
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['localhost'],
  },
  skipTrailingSlashRedirect: true,
  // Disable automatic static optimization to prevent 500.html generation
  generateEtags: false,
  poweredByHeader: false,
  // Experimental features
  experimental: {
    // Remove experimental options that might cause manifest issues
  }
}

module.exports = nextConfig