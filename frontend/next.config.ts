const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig: import('next').NextConfig = {
  async rewrites() {
    return [
      { source: '/auth/:path*', destination: `${BACKEND_URL}/auth/:path*` },
      { source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
