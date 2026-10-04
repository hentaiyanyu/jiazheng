import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 前端统一请求 /api，由 Vite 代理到后端，避免跨域配置
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 上传的照片由后端静态目录提供
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
