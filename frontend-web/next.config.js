/** @type {import('next').NextConfig} */
const internalApi = (process.env.INTERNAL_API_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    domains: ["localhost", "api.lumohub.com"],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${internalApi}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
