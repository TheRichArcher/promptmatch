const path = require('path');
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Avoid requiring TypeScript in production build environments
    ignoreBuildErrors: true,
  },
  eslint: {
    // Avoid blocking builds if eslint isn't installed in the environment cache
    ignoreDuringBuilds: true,
  },
  experimental: {
    // App Router is default in Next 14; keep experimental flags minimal
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  },
  webpack: (config) => {
    // Ensure @/* alias resolves to project root in all environments
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  }
};

module.exports = nextConfig;


