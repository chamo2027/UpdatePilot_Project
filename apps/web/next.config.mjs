/** @type {import('next').NextConfig} */
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
    if (process.env.API_INTERNAL_URL) {
      const rawApiUrl = process.env.API_INTERNAL_URL.trim().replace(/\/$/, '');
      const apiUrl = rawApiUrl.startsWith('http://') || rawApiUrl.startsWith('https://')
        ? rawApiUrl
        : `https://${rawApiUrl}`;
      return [
        {
          source: '/api/v1/:path*',
          destination: `${apiUrl}/api/v1/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
