import { defineConfig } from '@tarojs/cli'
import path from 'node:path'

const tailwindPlugin = path.resolve(__dirname, 'tailwind.cjs')

export default defineConfig({
  projectName: 'table-top',
  date: '2026-11-04',
  designWidth: 375,
  deviceRatio: { 375: 2, 640: 1.17, 750: 1, 828: 0.905 },
  sourceRoot: 'src',
  outputRoot: process.env.TARO_ENV === 'h5' ? 'dist-h5' : 'dist-weapp',
  framework: 'react',
  compiler: { type: 'webpack5', prebundle: { enable: false } },
  plugins: ['@tarojs/plugin-html'],
  defineConstants: {
    __API_BASE__: JSON.stringify(process.env.TARO_APP_API_BASE ?? 'http://127.0.0.1:8787/api'),
    __BACKEND__: JSON.stringify(process.env.TARO_APP_BACKEND ?? 'rest'),
  },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      autoprefixer: { enable: true, config: {} },
      [tailwindPlugin]: { enable: true, config: {} },
      cssModules: { enable: false },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: { enable: true, config: {} },
      [tailwindPlugin]: { enable: true, config: {} },
      cssModules: { enable: false },
    },
  },
})
