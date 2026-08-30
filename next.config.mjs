/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    outputFileTracingExcludes: {
      '/api/**': ['**/node_modules/@sqlite.org/sqlite-wasm/**/*'],
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'onnxruntime-node', '@sqlite.org/sqlite-wasm'];
    } else {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        crypto: false,
        zlib: false,
        'node:zlib': false,
      };
      config.module = config.module || {};
      config.module.rules = config.module.rules || [];
      config.module.rules.push({
        test: /\.node$/,
        type: 'asset/resource',
        generator: {
          emit: false,
        },
      });
    }
    return config;
  },
};

export default nextConfig;
