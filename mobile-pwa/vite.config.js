import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Sümen Garson',
        short_name: 'Garson',
        description: 'Sümen Garson Mobil Sistemi',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',

        // BÜYÜ BURADA: Chrome'a uygulamanın sınırlarını öğretiyoruz
        display: 'standalone',
        start_url: '/',
        scope: '/', // <--- HAYAT KURTARAN SATIR BU

        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5174,
    host: true,
  }
});