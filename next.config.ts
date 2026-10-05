import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Buyer documents (profile, organisation credentials) are up to 5 MB each
      // and both can be submitted in the same form; messages carry up to 3 shared documents of 5 MB.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
