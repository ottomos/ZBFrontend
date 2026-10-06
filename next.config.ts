import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable hot reload and file watching
  reactStrictMode: true,
  output: 'standalone',
  
  // WSL-specific configuration for hot reload
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Enable polling for WSL file watching
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding
        ignored: /node_modules/, // Don't watch node_modules
      };
      
      // Enable file system events for WSL
      config.resolve.symlinks = false;
    }
    return config;
  },
  
};

export default nextConfig;
