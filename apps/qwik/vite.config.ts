import { qwikVite } from '@qwik.dev/core/optimizer';
import { qwikRouter } from '@qwik.dev/router/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Same-origin proxy for /wp-content/uploads/* → mock-api. Default 4455 lines
// up with stand-alone `bun run mock-api`; perf-harness sets PUBLIC_API_BASE
// to override (see packages/perf-harness/spawn.ts:MOCK_API_PORT).
const UPLOADS_PROXY = {
  '/wp-content/uploads': { target: process.env.PUBLIC_API_BASE ?? 'http://localhost:4455' },
};

// Vite dev/preview intentionally do NOT set Content-Security-Policy.
// The CSP value lives in @aje-poc/shared-csp (a .ts-only workspace
// package); vite.config.ts is loaded by Node's ESM loader at config-load
// time, which cannot resolve .ts imports. Production SSR sets the header
// via apps/qwik/server.ts (which runs under bun and CAN load .ts), so
// the perf-harness and M11 prod paths both get the shared CSP. Dev/
// preview run unprotected — acceptable because they target localhost
// debugging surfaces, never user traffic. Acceptance tests use the
// production server via spawn.ts, so they exercise the CSP path.
export default defineConfig(() => {
  return {
    plugins: [qwikRouter(), qwikVite(), tailwindcss()],
    server: {
      headers: { 'Cache-Control': 'public, max-age=0' },
      proxy: UPLOADS_PROXY,
    },
    preview: {
      headers: { 'Cache-Control': 'public, max-age=600' },
      proxy: UPLOADS_PROXY,
    },
  };
});
