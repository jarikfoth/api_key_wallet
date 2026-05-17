/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  transpilePackages: ['@akw/crypto', '@akw/db', '@akw/providers'],
};

export default nextConfig;
