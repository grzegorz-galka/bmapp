// vitest/config re-exports Vite's defineConfig widened with the `test` block.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const apiProxy = {
  '/api': {
    target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Inside docker-compose the dev server must listen on all interfaces for
    // the published port to reach it; the host side is pinned to 127.0.0.1.
    host: true,
    // Bind mounts do not deliver inotify events on every host (notably a
    // Windows drive mounted into WSL2), so the container polls instead.
    // Off by default: polling is pure overhead when running natively.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : undefined,
    // The browser calls /api on the dev server, which forwards to the backend.
    // Same origin, so no CORS preflight in development.
    proxy: apiProxy,
  },
  // `vite preview` serves the production build and does not inherit
  // server.proxy, so the same mapping is repeated for it. Without this the
  // built application cannot reach the API and can only be tested by hand.
  preview: {
    port: 4173,
    host: true,
    proxy: apiProxy,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
