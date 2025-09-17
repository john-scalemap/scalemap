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
  // Force App Router only, disable legacy Pages Router
  experimental: {
    appDir: true, // Explicitly enable App Router
    esmExternals: 'loose' // Help with build issues
  }
}

module.exports = nextConfig