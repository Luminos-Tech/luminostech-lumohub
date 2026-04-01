/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    domains: ["localhost", "api.lumohub.com"],
  },
};

module.exports = nextConfig;
