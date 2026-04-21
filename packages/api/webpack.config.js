const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
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

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  resolve: {
    // Mirror the `customConditions: ['abak-erp']` entry in tsconfig.base.json so
    // webpack resolves workspace packages to their `src/*.ts` entry points
    // instead of the emitted `dist/*.js` files.
    conditionNames: ['abak-erp', 'import', 'require', 'node', 'default'],
  },
  // Keep every node_modules dep external — bundling Express 5's router breaks
  // its `is-promise` interop (throws TypeError at runtime), and bundling
  // pino's worker transports breaks their relative worker-file loads. The
  // allowlist keeps workspace `shared-*` packages bundled in because they
  // have no published dist entry.
  externals: [
    nodeExternals({
      allowlist: [/^shared-/],
    }),
  ],
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
      // Preserve the top-level `externals` array so workspace libs stay
      // bundled while every other node_modules dep is loaded at runtime.
      mergeExternals: true,
    }),
  ],
};
