import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  allowedDevOrigins: [
    "localhost:3847",
    "127.0.0.1:3847",
    "*.trycloudflare.com",
    "across-steady-facial-merchandise.trycloudflare.com",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3847",
        "127.0.0.1:3847",
        "*.trycloudflare.com",
        "across-steady-facial-merchandise.trycloudflare.com",
      ],
    },
  },
};

export default nextConfig;
