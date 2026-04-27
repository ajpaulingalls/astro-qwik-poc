// Lead/hero image used by HeroCard (LCP eager) + StoryCard (lazy) + ArticleHeader
// (eager + extra layout classes). Centralises the attribute set so a future
// "tweak how images load" change is one edit, not three. Emits a srcset+sizes
// pair so the browser picks the right pixel size — relies on the production
// WordPress `?w=N&resize=W,H` URL contract (mock-api honors the same params).
//
// PARITY: keep in lockstep with apps/qwik/src/components/LeadImage.tsx — both
// apps must emit the same loading/fetchpriority/decoding/srcset attributes for
// M13 fairness. The one intentional difference is JSX attribute casing: Astro/
// Preact uses `fetchpriority` (lowercase HTML attr), Qwik uses `fetchPriority`
// (camelCase). Both compile to the same DOM attribute.
//
// extraClass is PREPENDED to BASE_CLASS, never replaces it — pass it for
// per-call layout tweaks (margin, semantic hook class) only.
import type { HomepageImage } from '@aje-poc/shared-types';
import { resizedImageUrl, resolveImageUrl } from '../lib/image-url';

interface Props {
  image: HomepageImage;
  priority: 'eager' | 'lazy';
  /** Caller-overridable srcset widths. Defaults cover mobile/tablet/desktop hero. */
  widths?: number[];
  /** Caller-overridable `sizes` attr. Defaults to 100vw (full-width). */
  sizes?: string;
  extraClass?: string;
}

const BASE_CLASS = 'w-full h-auto rounded';
const DEFAULT_WIDTHS = [400, 800, 1200];
const DEFAULT_SIZES = '100vw';

export function LeadImage({
  image,
  priority,
  widths = DEFAULT_WIDTHS,
  sizes = DEFAULT_SIZES,
  extraClass,
}: Props) {
  const cls = extraClass ? `${extraClass} ${BASE_CLASS}` : BASE_CLASS;
  // Only build srcset when we have a real aspect ratio. Faking it (square
  // fallback) would silently emit wrong-aspect resize URLs; honest move is
  // to skip srcset and let the browser request the natural-size src.
  const srcset =
    image.width && image.height
      ? widths
          .map((w) => {
            const h = Math.round((w * image.height!) / image.width!);
            return `${resizedImageUrl(image.sourceUrl, { width: w, height: h })} ${w}w`;
          })
          .join(', ')
      : undefined;
  return (
    <img
      src={resolveImageUrl(image.sourceUrl)}
      srcset={srcset}
      sizes={sizes}
      alt={image.alt ?? ''}
      width={image.width}
      height={image.height}
      loading={priority}
      fetchpriority={priority === 'eager' ? 'high' : undefined}
      decoding="async"
      class={cls}
    />
  );
}
