import { resolveApiBase } from './graphql';

// Coexists with the same-origin proxy at src/pages/wp-content/uploads/[...path].ts;
// removing it requires per-component audits + a CSP simplification.
// See apps/astro/docs/SECURITY.md § Same-origin proxy for /wp-content/uploads/*.
export function resolveImageUrl(sourceUrl: string | null | undefined): string {
  if (!sourceUrl) return '';
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  return `${resolveApiBase()}${sourceUrl}`;
}
