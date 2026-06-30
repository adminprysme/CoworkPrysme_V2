import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@coworkprysme/db", "@coworkprysme/shared"],
};

export default nextConfig;
