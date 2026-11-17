/** @type {import('next').NextConfig} */
const rawApiUrl = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000').trim().replace(/\/$/, '');
const apiUrl = rawApiUrl.startsWith('http://') || rawApiUrl.startsWith('https://')
  ? rawApiUrl
  : `https://${rawApiUrl}`;

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.UPDATEPILOT_WEB_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
