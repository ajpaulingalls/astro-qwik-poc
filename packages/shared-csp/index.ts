// The two builders diverge ONLY on inline-content strategy:
// - Astro 6 auto-emits per-bundle script + style hashes via scriptDirective.
//   Inline content is allowed via hash, not 'unsafe-inline'.
// - Qwik 2 beta has no equivalent hash-emission API. Inline <style> blocks
//   (Tailwind 4 + resumability) and inline resumability bootstrap scripts
//   must be allowed via 'unsafe-inline'. See apps/qwik/docs/QWIK2_NOTES.md.

// Inline-style attribute sanitization paired with the CSP above. CMS HTML
// rendered via dangerouslySetInnerHTML must be sanitized before insertion
// because style-src-attr falls back to default-src 'self', which neither
// app's CSP allows. See strip-inline-styles.ts for the rationale and the
// sprint-012 story-004 audit trail.
export { stripInlineStyles } from './strip-inline-styles.ts';

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

export function assertSafeApiBase(apiBase: string): void {
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

// Astro's `security.csp.directives` field is a template-literal union (each
// entry must start with a known CSP directive name). Defined inline here so
// shared-csp stays framework-agnostic — we don't want a runtime dep on astro
// just to satisfy build-time typing. Keep this list aligned with the keys the
// builder actually emits below; if a new directive is added (e.g. media-src)
// it must be added here too or the literal will fall back to `string` and
// break Astro's typecheck.
type CspDirectivePrefix =
  | `default-src${string}`
  | `img-src${string}`
  | `font-src${string}`
  | `connect-src${string}`
  | `frame-src${string}`;

// Compile-time lock: if CspDirectivePrefix above is widened (e.g. a prefix
// removed, or accidentally `string`) without updating the list below, tsc
// fails with "Type 'false' is not assignable to type 'true'". Without this,
// widening to `string` is silent — Astro's directive narrowing breaks but
// every test still passes. Keep the two lists in lockstep.
type _Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type _Expect<T extends true> = T;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _CspDirectivePrefixIsExact = _Expect<
  _Equal<
    CspDirectivePrefix,
    | `default-src${string}`
    | `img-src${string}`
    | `font-src${string}`
    | `connect-src${string}`
    | `frame-src${string}`
  >
>;

export function buildAstroCspConfig(apiBase: string): {
  scriptDirective: { resources: string[] };
  directives: CspDirectivePrefix[];
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
