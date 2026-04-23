import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost',          port: '4000' },
      { protocol: 'https', hostname: 'api.weddingcraft.ru', port: '' },
    ],
  },
};

export default nextConfig;

