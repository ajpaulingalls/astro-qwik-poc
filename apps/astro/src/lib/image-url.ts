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
//
// Caller contract: `width` (and `height` when supplied) MUST be positive
// integers. The helper does not validate — it is consumed only by LeadImage
// today, which passes integer literals from a constant array. If a future
// caller threads in user input, validate before calling.
//
// Not safe for building a srcset over a mix of relative and absolute sources:
// absolute URLs pass through unchanged regardless of `width`, so all srcset
// candidates over the same absolute source would yield the same URL — invalid
// srcset semantics. Relative-only is the supported path.
export function resizedImageUrl(
  sourceUrl: string | null | undefined,
  opts: { width: number; height?: number },
): string {
  if (!sourceUrl) return '';
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  const { width, height = width } = opts;
  return `${sourceUrl}?w=${width}&resize=${width}%2C${height}`;
}

// Width the article-page <link rel="preload"> targets. Must match a value in
// LeadImage's DEFAULT_WIDTHS so the browser reuses the preloaded bytes for
// the matching srcset candidate. 800w covers most viewports without
// over-fetching on mobile.
export const LCP_PRELOAD_WIDTH = 800;

// Computes the matched height for a target width given a source image's
// natural aspect ratio. Returns null when natural dims are missing — caller
// decides whether to skip the resize hint entirely (honest path) or fall
// back to a width-only resize.
export function proportionalHeight(
  width: number,
  image: { width?: number; height?: number },
): number | null {
  if (!image.width || !image.height) return null;
  return Math.round((width * image.height) / image.width);
}
