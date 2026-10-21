import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the Spring Gateway so the browser stays same-origin (no CORS hassle).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@hlm-theme': fileURLToPath(new URL('../shared/theme', import.meta.url)),
      '@hlm-legal': fileURLToPath(new URL('../shared/legal', import.meta.url)),
      '@hlm-brand': fileURLToPath(new URL('../shared/brand/index.ts', import.meta.url)),
      '@hlm-laundry': fileURLToPath(new URL('../shared/laundry/index.ts', import.meta.url)),
      '@hlm-dates': fileURLToPath(new URL('../shared/dates', import.meta.url)),
      react: fileURLToPath(new URL('./node_modules/react', import.meta.url)),
      'react-dom': fileURLToPath(new URL('./node_modules/react-dom', import.meta.url)),
      'react-router-dom': fileURLToPath(new URL('./node_modules/react-router-dom', import.meta.url)),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
