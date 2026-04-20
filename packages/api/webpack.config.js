const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const webpack = require('webpack');
const { join } = require('path');

// NestJS core lazy-imports several optional peer deps it doesn't use at runtime
// for a simple HTTP app (microservices, websockets, cache-manager,
// class-transformer/storage). Webpack still tries to resolve them — IgnorePlugin
// drops them from the bundle so the build passes.
const lazyImports = [
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  '@nestjs/websockets',
  '@nestjs/websockets/socket-module',
  'cache-manager',
  'class-transformer/storage',
];

// Keep all node_modules external so pino's worker-thread transports
// (pino-pretty, thread-stream) can resolve their own files at runtime. Webpack
// bundling breaks pino-pretty because it loads `./lib/worker.js` relative to
// its own package dir.
const externalizeNodeModules = ({ request }, callback) => {
  if (request && /^[a-z@]/i.test(request) && !request.startsWith('.')) {
    return callback(null, 'commonjs ' + request);
  }
  callback();
};

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  externals: [externalizeNodeModules],
  plugins: [
    new webpack.IgnorePlugin({
      checkResource(resource) {
        if (!lazyImports.includes(resource)) return false;
        try {
          require.resolve(resource, { paths: [process.cwd()] });
          return false;
        } catch {
          return true;
        }
      },
    }),
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
