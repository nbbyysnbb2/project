import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.dev.coze.site'],
  // 服务器外部包（确保在服务端正确加载）
  serverExternalPackages: [
    'ali-oss',
    'proxy-agent',
    'urllib',
    'agentkeepalive',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
