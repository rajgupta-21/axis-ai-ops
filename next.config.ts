import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],

  // Emits .next/standalone with a minimal server.js and only the traced
  // node_modules, so the Docker image ships without a node_modules install.
  // Inert for `next dev` and `next start`, which ignore it.
  output: "standalone",
};

export default nextConfig;
