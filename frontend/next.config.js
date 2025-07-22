
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Minimal configuration for Railway deployment
  trailingSlash: false,
  poweredByHeader: false,
}

module.exports = nextConfig
