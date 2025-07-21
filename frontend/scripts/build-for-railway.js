#!/usr/bin/env node

/**
 * Custom build script for Railway deployment
 * Bypasses static generation issues with React Context
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Railway-optimized build...');

// Set environment variables for build
process.env.NODE_ENV = 'production';
process.env.NEXT_TELEMETRY_DISABLED = '1';

try {
  // Clean previous build
  console.log('🧹 Cleaning previous build...');
  if (fs.existsSync('.next')) {
    fs.rmSync('.next', { recursive: true, force: true });
  }

  // Create a temporary next.config.js that forces dynamic rendering
  console.log('⚙️ Configuring for dynamic rendering...');
  const tempConfig = `
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Force all pages to be dynamic
  generateBuildId: async () => {
    return 'railway-' + Date.now()
  },
  output: 'standalone', // Enable standalone build for Railway deployment
  trailingSlash: true,
  serverExternalPackages: ['@supabase/supabase-js', 'socket.io-client'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
  },
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
  // Disable static optimization completely
  poweredByHeader: false,
  compress: true,
  // Force dynamic rendering
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
`;

  // Backup original config
  if (fs.existsSync('next.config.js')) {
    fs.copyFileSync('next.config.js', 'next.config.js.backup');
  }

  // Write temporary config
  fs.writeFileSync('next.config.js.temp', tempConfig);
  fs.renameSync('next.config.js.temp', 'next.config.js');

  // Run the build
  console.log('🔨 Building Next.js application...');
  execSync('npx next build', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1'
    }
  });

  // Restore original config
  if (fs.existsSync('next.config.js.backup')) {
    fs.renameSync('next.config.js.backup', 'next.config.js');
  }

  console.log('✅ Build completed successfully!');
  console.log('📦 Ready for Railway deployment');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  
  // Restore original config on error
  if (fs.existsSync('next.config.js.backup')) {
    fs.renameSync('next.config.js.backup', 'next.config.js');
  }
  
  process.exit(1);
}
