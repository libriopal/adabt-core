import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Exact-match regex aliases for zustand to avoid prefix collision with sub-paths
      // (zustand/vanilla, zustand/react, etc. must resolve naturally, not via alias)
      { find: /^zustand\/middleware$/, replacement: fileURLToPath(new URL('./node_modules/zustand/esm/middleware.mjs', import.meta.url)) },
      { find: /^zustand$/, replacement: fileURLToPath(new URL('./node_modules/zustand/esm/index.mjs', import.meta.url)) },

      // Local workspace package aliases
      { find: '@match3d/farkle-engine', replacement: fileURLToPath(new URL('../../packages/farkle-engine/src/index.ts', import.meta.url)) },
      { find: '@match3d/farkle-shared', replacement: fileURLToPath(new URL('../../packages/farkle-shared/src/index.ts', import.meta.url)) },
      { find: '@match3d/game-core', replacement: fileURLToPath(new URL('../../packages/game-core/src/index.ts', import.meta.url)) },

      // Transitive deps of game-core — resolved from frontend node_modules
      // (game-core has no local node_modules in this workspace layout)
      { find: 'uuid', replacement: fileURLToPath(new URL('./node_modules/uuid/dist/index.js', import.meta.url)) },
      { find: 'eventemitter3', replacement: fileURLToPath(new URL('./node_modules/eventemitter3/index.mjs', import.meta.url)) },
      { find: 'nanoid', replacement: fileURLToPath(new URL('./node_modules/nanoid/index.browser.js', import.meta.url)) },
      { find: '@dimforge/rapier3d-compat', replacement: fileURLToPath(new URL('./node_modules/@dimforge/rapier3d-compat/rapier.mjs', import.meta.url)) },
    ],
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
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
