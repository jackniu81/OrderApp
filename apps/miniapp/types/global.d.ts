/// <reference types="@tarojs/taro" />

declare module '*.png';
declare module '*.gif';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.css';
declare module '*.scss';

declare let process: {
  env: {
    NODE_ENV: 'development' | 'production';
    TARO_ENV: 'weapp' | 'h5' | 'swan' | 'alipay' | 'tt' | 'qq' | 'jd' | 'rn' | 'quickapp-webview';
  };
};
