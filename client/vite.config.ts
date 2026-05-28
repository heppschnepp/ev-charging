import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'EV Charging Finder',
        short_name: 'EV Finder',
        description: 'Find EV charging stations near any city',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/ev-icon-192.png?v=2',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/ev-icon-512.png?v=2',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      injectRegister: 'script',
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
