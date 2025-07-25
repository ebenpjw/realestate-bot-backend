
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Generate stable build ID for Railway
  generateBuildId: async () => {
    return process.env.RAILWAY_GIT_COMMIT_SHA || 'railway-' + Date.now()
  },
  output: 'standalone', // Enable standalone build for Railway deployment
  trailingSlash: false, // Disable trailing slash to prevent routing issues
  serverExternalPackages: ['@supabase/supabase-js', 'socket.io-client'],
  // Environment variables will be set via Railway environment variables
  images: {
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: true,
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.railway.app',
      },
    ],
  },
  // Optimize for Railway deployment
  poweredByHeader: false,
  compress: true,
  // Optimize caching for production
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
