import { resolveApiBase } from './graphql';

// Fixture image URLs are relative (/wp-content/uploads/<year>/<month>/...) — they
// resolve against the page origin (4173) and 404, breaking Lighthouse LCP.
// This helper rewrites them to absolute URLs against PUBLIC_API_BASE so the
// browser fetches from mock-api in dev/perf and from aljazeera.com in M11 demo.
export function resolveImageUrl(sourceUrl: string | null | undefined): string {
  if (!sourceUrl) return '';
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  return `${resolveApiBase()}${sourceUrl}`;
}
