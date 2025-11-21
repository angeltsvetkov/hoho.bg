import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh4.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh5.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh6.googleusercontent.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/__/auth/handler',
        destination: '/firebase-handler/auth/handler',
      },
      {
        source: '/__/firebase/init.json',
        destination: '/firebase-handler/firebase/init.json',
      },
      {
        source: '/__/firebase/init.js',
        destination: '/firebase-handler/firebase/init.js',
      },
    ];
  },
};
  async redirects() {
    return [];
  },
  async headers() {
    return [
      {
        source: '/api/stripe-webhook',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
