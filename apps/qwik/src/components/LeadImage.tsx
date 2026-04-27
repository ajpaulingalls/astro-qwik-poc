// Lead/hero image used by HeroCard (LCP eager) + StoryCard (lazy) + ArticleHeader
// (eager + extra layout classes). Centralises the attribute set so a future
// "tweak how images load" change is one edit, not three.
//
// PARITY: keep in lockstep with apps/astro/src/components/LeadImage.tsx — both
// apps must emit the same loading/fetchpriority/decoding attributes for M13
// fairness. The one intentional difference is JSX attribute casing: Astro/
// Preact uses `fetchpriority` (lowercase HTML attr), Qwik uses `fetchPriority`
// (camelCase). Both compile to the same DOM attribute.
//
// extraClass is PREPENDED to BASE_CLASS, never replaces it — pass it for
// per-call layout tweaks (margin, semantic hook class) only, not to override
// the canonical w-full/aspect-ratio/object-cover combo.
import type { HomepageImage } from '@aje-poc/shared-types';
import { resolveImageUrl } from '../lib/image-url';

interface Props {
  image: HomepageImage;
  priority: 'eager' | 'lazy';
  extraClass?: string;
}

const BASE_CLASS = 'w-full h-auto rounded aspect-[3/2] object-cover';

export function LeadImage({ image, priority, extraClass }: Props) {
  const cls = extraClass ? `${extraClass} ${BASE_CLASS}` : BASE_CLASS;
  return (
    <img
      src={resolveImageUrl(image.sourceUrl)}
      alt={image.alt ?? ''}
      width={image.width}
      height={image.height}
      loading={priority}
      fetchPriority={priority === 'eager' ? 'high' : undefined}
      decoding="async"
      class={cls}
    />
  );
}
