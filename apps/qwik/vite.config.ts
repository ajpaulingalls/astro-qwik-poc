import { qwikVite } from '@qwik.dev/core/optimizer';
import { qwikRouter } from '@qwik.dev/router/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { CSP } from './src/lib/csp.ts';

// Same-origin proxy for /wp-content/uploads/* → mock-api. Default 4455 lines
// up with stand-alone `bun run mock-api`; perf-harness sets PUBLIC_API_BASE
// to override (see packages/perf-harness/spawn.ts:MOCK_API_PORT).
const UPLOADS_PROXY = {
  '/wp-content/uploads': { target: process.env.PUBLIC_API_BASE ?? 'http://localhost:4455' },
};

export default defineConfig(() => {
  return {
    plugins: [qwikRouter(), qwikVite(), tailwindcss()],
    server: {
      headers: { 'Cache-Control': 'public, max-age=0', 'Content-Security-Policy': CSP },
      proxy: UPLOADS_PROXY,
    },
    preview: {
      headers: { 'Cache-Control': 'public, max-age=600', 'Content-Security-Policy': CSP },
      proxy: UPLOADS_PROXY,
    },
  };
});
