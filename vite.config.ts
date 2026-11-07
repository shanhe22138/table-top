import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: {
    __API_BASE__: JSON.stringify(process.env.VITE_API_BASE ?? '/api'),
    __BACKEND__: JSON.stringify(process.env.VITE_BACKEND ?? ''),
    ENABLE_INNER_HTML: false,
    ENABLE_ADJACENT_HTML: false,
    ENABLE_CLONE_NODE: false,
    ENABLE_CONTAINS: false,
    ENABLE_SIZE_APIS: false,
    ENABLE_TEMPLATE_CONTENT: false,
    ENABLE_MUTATION_OBSERVER: false,
    'process.env.TARO_PLATFORM': JSON.stringify('web'),
    'process.env.TARO_ENV': JSON.stringify('h5'),
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      // 本地启动 Java 后端后，前端自动探测并切到服务器模式
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
