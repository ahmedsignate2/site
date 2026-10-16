import type { NextConfig } from "next";

// Domaines autorisés en plus du domaine du site (tunnels, domaines secondaires), séparés par des virgules.
// Ex. ALLOWED_ORIGINS=boutique.fr,www.boutique.fr,*.trycloudflare.com
const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const siteHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : null;
  } catch {
    return null;
  }
})();
const origins = ["localhost:3847", "127.0.0.1:3847", ...(siteHost ? [siteHost] : []), ...extraOrigins];

const nextConfig: NextConfig = {
  // Docker / VPS : NEXT_OUTPUT=standalone produit un serveur autonome (.next/standalone).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  allowedDevOrigins: origins,
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
      allowedOrigins: origins,
    },
  },
};

export default nextConfig;
