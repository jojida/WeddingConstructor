import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost',          port: '4000' },
      { protocol: 'https', hostname: 'api.weddingcraft.ru', port: '' },
      { protocol: 'https', hostname: 'images.unsplash.com', port: '' },
    ],
  },
};

export default nextConfig;

