// next.config.js

module.exports = {
  // Basic configuration
  reactStrictMode: true,

  // Webpack configuration to address cache warnings
  webpack: (config) => {
    // Optimize cache handling
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
      cacheDirectory: path.resolve('.next/cache'),
      name: 'nextjs-webpack-cache',
      version: '1.0.0',
    };

    // Optimize split chunks
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          // Add any custom cache groups here
        },
      },
    };

    return config;
  },

  // Add any other Next.js configurations here
};
