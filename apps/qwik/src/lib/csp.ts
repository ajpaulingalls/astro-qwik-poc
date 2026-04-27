// Parallels apps/astro/astro.config.mjs CSP allowlist — origins match for
// fair comparison; the inline-content strategy diverges (see below). Astro
// injects via the `security.csp` config; Qwik 2 has no equivalent
// build-time API yet, so server.ts sets this header on prod SSR responses
// and vite.config.ts applies it to dev/preview.
//
// 'unsafe-inline' on both script-src and style-src is necessary because
// Qwik 2 emits inline <style> blocks (Tailwind 4's CSS-first pipeline +
// Qwik's resumability container) AND inline resumability bootstrap
// scripts. Without 'unsafe-inline':
// - inline stylesheets are blocked (document.styleSheets empty, body
//   falls back to Times, document.fonts is never populated with @font-face)
// - inline resumability scripts are blocked (qwikloader fails to bind
//   onClick$ handlers — verified empirically: console error
//   "this.ot is not a function" when click is dispatched).
// Astro avoids this by auto-generating per-bundle script+style hashes;
// Qwik 2 has no equivalent yet (worth revisiting on Qwik 2 stable).
export const CSP = [
  "default-src 'self'",
  "img-src 'self' https: data: http://localhost:4455",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:4455",
  "script-src 'self' 'unsafe-inline' https://platform.twitter.com https://www.instagram.com https://players.brightcove.net",
  "style-src 'self' 'unsafe-inline'",
  'frame-src https://platform.twitter.com https://syndication.twitter.com https://www.instagram.com https://players.brightcove.net https://www.youtube.com https://www.youtube-nocookie.com',
].join('; ');
