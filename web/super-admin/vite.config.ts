import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@hlm-theme': fileURLToPath(new URL('../shared/theme', import.meta.url)),
      '@hlm-legal': fileURLToPath(new URL('../shared/legal', import.meta.url)),
      '@hlm-brand': fileURLToPath(new URL('../shared/brand/index.ts', import.meta.url)),
      '@hlm-dates': fileURLToPath(new URL('../shared/dates', import.meta.url)),
      '@hlm-money-flow': fileURLToPath(new URL('../shared/moneyFlow', import.meta.url)),
    },
  },
  server: {
    port: 5176,
    watch: {
      ignored: ['**/logs/**', '**/.cursor/**', '**/target/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
