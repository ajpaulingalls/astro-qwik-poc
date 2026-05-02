// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import preact from '@astrojs/preact';
import deno from '@deno/astro-adapter';
import tailwindcss from '@tailwindcss/vite';
import { buildAstroCspConfig, DEFAULT_API_BASE } from '@aje-poc/shared-csp';

// PUBLIC_API_BASE is baked into Astro CSP at build time. Local dev and
// perf-harness:astro both run the mock-api on 4455, matching the default;
// for M11 prod build, set PUBLIC_API_BASE=https://… in the build env so
// img-src + connect-src reflect the actual API host.
const API_BASE = process.env.PUBLIC_API_BASE ?? DEFAULT_API_BASE;

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
      weights: [400, 700],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      // Editorial display headline. Single weight 700 — used by HeroCard h2
      // and ArticleHeader h1 only via DISPLAY_HEADLINE_CLASS in lib/typography.ts.
      // display: 'swap' so the LCP image (which is the actual LCP element on
      // both surfaces) is never blocked waiting on the font; readers see the
      // Georgia fallback first, then a swap. Astro auto-generates size-adjust
      // metrics for the fallback to keep CLS tight.
      provider: fontProviders.google(),
      name: 'Noto Serif Display',
      cssVariable: '--font-serif-display',
      weights: [700],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
      fallbacks: ['Georgia', 'serif'],
    },
  ],
  security: {
    // Origins (frame-src, script-src resources) live in the shared package
    // packages/shared-csp/index.ts; a parity test there enforces that
    // both apps allow the same set. apiBase is substituted into img-src +
    // connect-src so M11 prod build can re-point at the live API host.
    csp: buildAstroCspConfig(API_BASE),
  },
});
