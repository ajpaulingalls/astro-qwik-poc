// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import preact from '@astrojs/preact';
import deno from '@deno/astro-adapter';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: deno({
    port: Number(process.env.PORT ?? 8080),
    hostname: '0.0.0.0',
  }),
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: [400, 600, 700],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' https: data:",
        "font-src 'self' data:",
        "connect-src 'self' http://localhost:4455",
      ],
    },
  },
});
