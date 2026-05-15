import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@match3d/farkle-engine': fileURLToPath(
        new URL('../../packages/farkle-engine/src/index.ts', import.meta.url),
      ),
      '@match3d/farkle-shared': fileURLToPath(
        new URL('../../packages/farkle-shared/src/index.ts', import.meta.url),
      ),
      zustand: fileURLToPath(
        new URL('./node_modules/zustand/esm/index.mjs', import.meta.url),
      ),
      'zustand/middleware': fileURLToPath(
        new URL('./node_modules/zustand/esm/middleware.mjs', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  define: {
    'process.env.REACT_APP_API_URL': JSON.stringify(
      process.env.REACT_APP_API_URL || ''
    ),
  },
});
