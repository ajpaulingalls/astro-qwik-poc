import { qwikVite } from '@qwik.dev/core/optimizer';
import { qwikRouter } from '@qwik.dev/router/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [qwikRouter(), qwikVite(), tailwindcss()],
    server: {
      headers: { 'Cache-Control': 'public, max-age=0' },
    },
    preview: {
      headers: { 'Cache-Control': 'public, max-age=600' },
    },
  };
});
