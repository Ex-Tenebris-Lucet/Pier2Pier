const webpack = require('webpack');

module.exports = function override(config) {
  // Add polyfills
  config.resolve.fallback = {
    ...config.resolve.fallback,
    process: require.resolve('process/browser'),
    buffer: require.resolve('buffer/'),
    stream: require.resolve('stream-browserify')
  };

  // Provide process and Buffer globals
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ];

  return config;
}; 