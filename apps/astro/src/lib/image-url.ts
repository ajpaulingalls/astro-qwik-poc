import { resolveApiBase } from './graphql';

// Coexists with the same-origin proxy at src/pages/wp-content/uploads/[...path].ts;
// removing it requires per-component audits + a CSP simplification.
// See apps/astro/docs/SECURITY.md § Same-origin proxy for /wp-content/uploads/*.
export function resolveImageUrl(sourceUrl: string | null | undefined): string {
  if (!sourceUrl) return '';
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  return `${resolveApiBase()}${sourceUrl}`;
}

// Builds a resize-hint URL matching production WordPress' `?w=N&resize=W,H`
// contract. Returns RELATIVE URLs for relative input so the same-origin
// /wp-content/uploads/[...path] proxy stays in the request path (story-010
// invariant). Absolute URLs pass through unchanged — production fixtures
// already carry resize hints; re-stamping would clobber them.
export function resizedImageUrl(
  sourceUrl: string | null | undefined,
  opts: { width: number; height?: number },
): string {
  if (!sourceUrl) return '';
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  const { width, height = width } = opts;
  return `${sourceUrl}?w=${width}&resize=${width}%2C${height}`;
}
