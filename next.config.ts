import type { NextConfig } from "next";

const pages = process.env.GITHUB_PAGES === "true";
const basePath = pages ? "/folio" : "";

const nextConfig: NextConfig = {
  ...(pages
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: basePath,
        images: { unoptimized: true },
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: !pages,
  partialPrefetching: !pages,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
