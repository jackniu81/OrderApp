import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** 后端地址：与小程序 h5 dev 代理保持一致 */
const API_TARGET = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 10087,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      // 商家端订单推送（specs/03-api.md §9.1）
      '/ws': { target: API_TARGET.replace('http://', 'ws://'), ws: true, changeOrigin: true },
    },
  },
});
