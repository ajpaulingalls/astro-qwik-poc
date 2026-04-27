import { resolveApiBase } from './graphql';

// Coexists with the same-origin proxy in vite.config.ts (dev/preview) and
// server.ts (perf-harness production); removing it requires per-component audits.
// See apps/qwik/docs/QWIK2_NOTES.md § sprint-007.
export function resolveImageUrl(sourceUrl: string | null | undefined): string {
  if (!sourceUrl) return '';
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  return `${resolveApiBase()}${sourceUrl}`;
}

// Builds a resize-hint URL matching production WordPress' `?w=N&resize=W,H`
// contract. Returns RELATIVE URLs for relative input so the same-origin
// /wp-content/uploads/* proxy (vite.config.ts dev/preview + server.ts
// perf-harness production) stays in the request path. Absolute URLs pass
// through unchanged — production fixtures already carry resize hints;
// re-stamping would clobber them.
export function resizedImageUrl(
  sourceUrl: string | null | undefined,
  opts: { width: number; height?: number },
): string {
  if (!sourceUrl) return '';
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  const { width, height = width } = opts;
  return `${sourceUrl}?w=${width}&resize=${width}%2C${height}`;
}
