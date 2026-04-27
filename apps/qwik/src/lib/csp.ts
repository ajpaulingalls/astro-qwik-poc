// Mirrors apps/astro/astro.config.mjs CSP directives — both PoCs must
// enforce the same allowlist for fair comparison. Astro injects via the
// `security.csp` config; Qwik 2 has no equivalent build-time API yet, so
// server.ts sets this header on prod SSR responses and vite.config.ts
// applies it to dev/preview.
export const CSP = [
  "default-src 'self'",
  "img-src 'self' https: data: http://localhost:4455",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:4455",
  "script-src 'self' https://platform.twitter.com https://www.instagram.com https://players.brightcove.net",
  'frame-src https://platform.twitter.com https://syndication.twitter.com https://www.instagram.com https://players.brightcove.net https://www.youtube.com https://www.youtube-nocookie.com',
].join('; ');
