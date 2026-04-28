// The two builders diverge ONLY on inline-content strategy:
// - Astro 6 auto-emits per-bundle script + style hashes via scriptDirective.
//   Inline content is allowed via hash, not 'unsafe-inline'.
// - Qwik 2 beta has no equivalent hash-emission API. Inline <style> blocks
//   (Tailwind 4 + resumability) and inline resumability bootstrap scripts
//   must be allowed via 'unsafe-inline'. See apps/qwik/docs/QWIK2_NOTES.md.

export const FRAME_SRC_ORIGINS: readonly string[] = [
  'https://platform.twitter.com',
  'https://syndication.twitter.com',
  'https://www.instagram.com',
  'https://players.brightcove.net',
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
];

export const SCRIPT_SRC_ORIGINS: readonly string[] = [
  'https://platform.twitter.com',
  'https://www.instagram.com',
  'https://players.brightcove.net',
];

// Single source of truth for the dev-default mock-api URL. Consumers fall
// back to this when PUBLIC_API_BASE is unset: apps/astro/astro.config.mjs,
// apps/astro/src/lib/graphql.ts, apps/qwik/src/lib/csp.ts, apps/qwik/server.ts,
// apps/qwik/src/lib/graphql.ts. (apps/qwik/vite.config.ts also uses the
// literal but cannot import .ts workspace packages — left inline; see
// QWIK2_NOTES sprint-007 b419d0cc2c87.) M11 prod build sets PUBLIC_API_BASE
// to override.
export const DEFAULT_API_BASE = 'http://localhost:4455';

// Reject apiBase values that could break out of the CSP source-list grammar
// or the Content-Security-Policy header value: whitespace splits a source
// list, ';' splits a directive, ',' splits a multi-policy header. Quotes,
// angle brackets, backslashes, and control chars aren't valid in URLs per
// RFC 3986 but would corrupt CSP if smuggled in — reject defensively.
const APIBASE_INJECTION_CHARS = /[\s;,'"<>\\]/;

function assertSafeApiBase(apiBase: string): void {
  if (APIBASE_INJECTION_CHARS.test(apiBase)) {
    throw new Error(
      `apiBase contains characters that would corrupt CSP: ${JSON.stringify(apiBase)}`,
    );
  }
  for (let i = 0; i < apiBase.length; i++) {
    const code = apiBase.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      throw new Error(`apiBase contains a control character at index ${i}`);
    }
  }
}

export function buildAstroCspConfig(apiBase: string): {
  scriptDirective: { resources: string[] };
  directives: string[];
} {
  assertSafeApiBase(apiBase);
  return {
    scriptDirective: { resources: ["'self'", ...SCRIPT_SRC_ORIGINS] },
    directives: [
      "default-src 'self'",
      `img-src 'self' https: data: ${apiBase}`,
      "font-src 'self' data:",
      `connect-src 'self' ${apiBase}`,
      `frame-src ${FRAME_SRC_ORIGINS.join(' ')}`,
    ],
  };
}

export function buildQwikCsp(apiBase: string): string {
  assertSafeApiBase(apiBase);
  return [
    "default-src 'self'",
    `img-src 'self' https: data: ${apiBase}`,
    "font-src 'self' data:",
    `connect-src 'self' ${apiBase}`,
    `script-src 'self' 'unsafe-inline' ${SCRIPT_SRC_ORIGINS.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `frame-src ${FRAME_SRC_ORIGINS.join(' ')}`,
  ].join('; ');
}
