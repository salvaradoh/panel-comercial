import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: process.env.VITE_BASE_URL || '/',
  server: {
    allowedHosts: ['dashboard-v2.serveousercontent.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('recharts') || id.includes('lightweight-charts')) return 'vendor-charts';
          if (id.includes('react-simple-maps') || id.includes('topojson-client')) return 'vendor-maps';
          if (id.includes('@react-oauth')) return 'vendor-oauth';
        },
      },
    },
  },
});
