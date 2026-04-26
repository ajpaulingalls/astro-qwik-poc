import { resolveApiBase } from './graphql';

// Coexists with the same-origin proxy in vite.config.ts (dev/preview) and
// server.ts (perf-harness production); removing it requires per-component audits.
// See apps/qwik/docs/QWIK2_NOTES.md § sprint-007.
export function resolveImageUrl(sourceUrl: string | null | undefined): string {
  if (!sourceUrl) return '';
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  return `${resolveApiBase()}${sourceUrl}`;
}
