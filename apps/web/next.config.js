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
  experimental: {
    // Reserved for future experimental features
  }
}

module.exports = nextConfig