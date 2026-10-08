import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.WC_BUILD_DIR || '.next',
  poweredByHeader: false,
  // Keep original TS/TSX sources out of publicly served production bundles.
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'" },
    ] }, {
      // Mutable public assets get a bounded cache; HTML and code stay revalidated.
      source: '/:asset((?:invite|envelope|brand|print)/.+\\.(?:webp|png|jpg|jpeg|gif|svg|avif|mp4|webm|mp3|m4a|ogg|wav|woff|woff2))',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
    }, {
      // Content-hashed font files can be reused across pages and invitations.
      source: '/invite/assets/fonts/google/:asset([a-f0-9]{20}\\.(?:css|woff2|ttf))',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }];
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

