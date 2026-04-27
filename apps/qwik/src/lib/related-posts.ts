import type { CuratedCollectionItem, HomepagePost } from '@aje-poc/shared-types';

export const MAX_RELATED = 6;

// Pulls article-page related stories from the homepage curated feed.
// flatMap-all (vs `[0]?.posts`) gives a more diverse "more on this site" mix
// — Astro and Qwik must agree on the source so the same article shows the
// same recommendations across the two PoCs (M13 apples-to-apples).
export function relatedPostsFrom(collections: CuratedCollectionItem[]): HomepagePost[] {
  return collections.flatMap((c) => c.posts).slice(0, MAX_RELATED);
}
