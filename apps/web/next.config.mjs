/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  transpilePackages: ['@akw/crypto', '@akw/db', '@akw/providers'],
  webpack: (config) => {
    // Workspace packages use NodeNext-style `.js` extensions on their TS imports.
    // Map them to `.ts` / `.tsx` so webpack can find the actual source files.
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

export default nextConfig;
