import { config } from "dotenv";
config({ path: ".env", override: false });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a self-contained server bundle under .next/standalone —
  // required for the Docker image (see Dockerfile).
  output: "standalone",
  // react-markdown and its remark/rehype ecosystem are ESM-only packages;
  // Next.js must transpile them so webpack can bundle them for client components.
  transpilePackages: [
    "react-markdown",
    "remark-gfm",
    "remark-parse",
    "remark-rehype",
    "unified",
    "unist-util-visit",
    "vfile",
    "hast-util-whitespace",
    "property-information",
    "comma-separated-tokens",
    "space-separated-tokens",
  ],
};

export default nextConfig;
