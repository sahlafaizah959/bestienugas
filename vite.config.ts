import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Ini "jembatan" agar frontend bisa ngobrol dengan server.ts
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // KITA HAPUS BAGIAN DEFINE API_KEY DI SINI DEMI KEAMANAN
});