import { LCP_PRELOAD_WIDTH, proportionalHeight, resizedImageUrl } from './image-url';
import type { HomepageImage } from '@aje-poc/shared-types';

interface LcpPreloadLink {
  rel: 'preload';
  as: 'image';
  href: string;
  fetchPriority: 'high';
}

// Returns a DocumentHead-compatible <link rel="preload"> entry for the page's
// LCP image. fetchPriority=high alone reorders the request after parser
// discovery; preload starts it immediately. Caller is responsible for
// spreading {links: [...]} into the DocumentHead return.
export function computeLcpPreloadLink(
  image: HomepageImage | null | undefined,
): LcpPreloadLink | null {
  if (!image) return null;
  const height = proportionalHeight(LCP_PRELOAD_WIDTH, image);
  if (height === null) return null;
  return {
    rel: 'preload',
    as: 'image',
    href: resizedImageUrl(image.sourceUrl, { width: LCP_PRELOAD_WIDTH, height }),
    fetchPriority: 'high',
  };
}
