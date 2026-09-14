import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'" },
    ] }];
  },
  /* В разработке Next пропускает к себе только localhost. Для работы со
     студии с телефона или второго компьютера разрешаем адреса локальной
     сети — на продакшн-сборку это не влияет. */
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.16.*.*', '*.local'],

  typescript: {
    ignoreBuildErrors: false,
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

