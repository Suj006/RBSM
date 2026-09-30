import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Buyer documents (profile, organisation credentials) are up to 5 MB each
      // and both can be submitted in the same form.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
