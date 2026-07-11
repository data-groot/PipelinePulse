const nextConfig: import('next').NextConfig = {
  // Standalone build for the Cloud Run container image.
  // API/auth proxying lives in middleware.ts so BACKEND_URL is read at
  // request time, not baked in at build time.
  output: 'standalone',
};

export default nextConfig;
