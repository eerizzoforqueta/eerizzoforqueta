/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['firebasestorage.googleapis.com','oaidalleapiprodscus.blob.core.windows.net','drive.google.com'],
  },
 webpack: (config) => {
    config.resolve.conditionNames = ['require', '...'];
    return config;
  },
  transpilePackages: ['@mui/x-data-grid'],
};

export default nextConfig;
