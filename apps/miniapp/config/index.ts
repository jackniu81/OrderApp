const path = require('path');

const IS_DEV = process.env.NODE_ENV === 'development';
const IS_PROD = !IS_DEV;

/** H5 本地联调后端地址 */
const h5DevApiTarget = 'http://localhost:3000';

const config = {
  projectName: 'orderapp-miniapp',
  date: '2026-10-18',
  designWidth: 375,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
    375: 2,
  },
  sourceRoot: 'src',
  outputRoot: `dist/${process.env.TARO_ENV}`,
  plugins: [
    '@tarojs/plugin-platform-weapp',
    '@tarojs/plugin-platform-h5',
  ],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: {
    type: 'webpack5',
    prebundle: { enable: false },
  },
  cache: {
    enable: false,
  },
  sass: {},
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    output: {
      filename: 'js/[name].[hash:8].js',
      chunkFilename: 'js/[name].[chunkhash:8].js',
    },
    miniCssExtractPluginOption: {
      ignoreOrder: true,
      filename: 'css/[name].[hash].css',
      chunkFilename: 'css/[name].[chunkhash].css',
    },
    postcss: {
      autoprefixer: { enable: true },
      pxtransform: { enable: true, config: {} },
      cssModules: { enable: false },
    },
    devServer: {
      port: 10086,
      proxy: {
        '/api': {
          target: h5DevApiTarget,
          changeOrigin: true,
        },
      },
    },
  },
};

module.exports = (ctx) => config;
