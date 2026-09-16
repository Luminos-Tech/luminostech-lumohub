/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "localhost" },
      { protocol: "https", hostname: "api.lumohub.com" },
    ],
  },
  // API proxy: dùng app/api/v1/[...path]/route.ts để đọc INTERNAL_API_URL lúc chạy (Docker),
  // tránh rewrite bị bake sai lúc build (127.0.0.1 trong container).
};

module.exports = nextConfig;
