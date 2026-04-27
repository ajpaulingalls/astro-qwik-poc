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
      weights: [400, 700],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  security: {
    csp: {
      // Embed provider scripts (M7 — story-003). Each is loaded by an embed
      // component on demand via useEmbedScript: Twitter widgets.js, Instagram
      // embed.js, Brightcove per-account player. scriptDirective.resources
      // OVERRIDES the default sources, so 'self' must be re-included
      // explicitly — without it, Astro's bundled scripts would only be
      // allowed via hash and dynamic chunk loads (e.g. Preact island
      // hydration follow-ups) would be blocked. 'unsafe-inline' is
      // intentionally NOT used — provider scripts are added as external
      // <script src> elements.
      scriptDirective: {
        resources: [
          "'self'",
          'https://platform.twitter.com',
          'https://www.instagram.com',
          'https://players.brightcove.net',
        ],
      },
      directives: [
        "default-src 'self'",
        "img-src 'self' https: data: http://localhost:4455",
        "font-src 'self' data:",
        "connect-src 'self' http://localhost:4455",
        // Iframes injected by the provider scripts after they execute, plus
        // YouTube (figure or bare-iframe extracted by parse-embeds; no provider
        // script needed). syndication.twitter.com is required because Twitter
        // widgets render their embed iframe to that origin too — without it,
        // some browsers silently leave the embed blank with no console error.
        'frame-src https://platform.twitter.com https://syndication.twitter.com https://www.instagram.com https://players.brightcove.net https://www.youtube.com https://www.youtube-nocookie.com',
      ],
    },
  },
});
