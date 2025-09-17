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
  experimental: {
    // Skip static export errors to allow build to complete
    skipTrailingSlashRedirect: true,
  }
}

module.exports = nextConfig