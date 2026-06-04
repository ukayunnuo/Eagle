/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 gzip/brotli 压缩
  compress: true,

  // 安全：隐藏 X-Powered-By 头
  poweredByHeader: false,

  // React 严格模式
  reactStrictMode: true,

  // 图片优化配置
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // 配置 API 代理（开发环境）
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
