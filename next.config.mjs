/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],
  experimental: { agentUpgrade: 'security' },
  async headers() {
    const resetHeaders = [
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ];
    return [
      { source: '/set-password', headers: resetHeaders },
      { source: '/reset-password', headers: resetHeaders },
    ];
  },
};

export default nextConfig;
