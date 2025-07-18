/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Enable type checking during build for better code quality
    ignoreBuildErrors: false,
  },
  eslint: {
    // Enable ESLint during build for better code quality
    ignoreDuringBuilds: false,
  },
  // Generate unique build ID for Railway deployments
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  // Handle build errors gracefully
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Enable SSR for dynamic features
  // output: 'export', // Disabled - pages use dynamic features
  output: 'standalone', // Enable standalone build for Railway deployment
  trailingSlash: true,
  // Configure for static export
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js', 'socket.io-client'],
  },
  poweredByHeader: false,
  env: {
    // In unified deployment, API is on same domain
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || (
      process.env.NODE_ENV === 'production'
        ? '' // Same domain in production
        : 'http://localhost:8080'
    ),
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || (
      process.env.NODE_ENV === 'production'
        ? 'wss://' + (process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080')
        : 'ws://localhost:8080'
    ),
  },
  // No rewrites needed for unified deployment - API is on same server
  async rewrites() {
    return [];
  },
  // Image optimization configuration for Railway deployment
  images: {
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Enable optimization for Railway deployment
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.railway.app',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
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
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
    ]
  },
  compress: true,
  generateEtags: true,
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Webpack optimizations
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle analyzer
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: isServer ? '../analyze/server.html' : './analyze/client.html',
        })
      )
    }

    // Optimize chunks for production
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            reuseExistingChunk: true,
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            priority: 20,
            reuseExistingChunk: true,
          },
        },
      }
    }

    return config
  },
};

module.exports = nextConfig;
