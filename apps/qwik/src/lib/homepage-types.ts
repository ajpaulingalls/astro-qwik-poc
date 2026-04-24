// Mirror of apps/astro/src/lib/homepage-types.ts. Both apps consume the
// same fixture shape; per-app duplication is acknowledged in plan concern
// 1fa6ff30b786, deferred to a packages/shared-types/ extraction once
// drift becomes painful.

export interface HomepageImage {
  sourceUrl: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface HomepagePost {
  id: string;
  title: string;
  excerpt?: string;
  link: string;
  postType?: string;
  isLive?: boolean;
  isBreaking?: boolean;
  featuredImage?: HomepageImage | null;
  replacementHeadline?: string;
}

export interface CuratedCollectionItem {
  title: string;
  overrideLink?: string;
  posts: HomepagePost[];
}

export interface VerticalVideo {
  id: string;
  name: string;
  thumbnail: string;
  poster?: string;
  duration?: string;
  accountId: string;
}

export interface Livestream {
  accountId: string;
  playerID: string;
  videoID: string;
  title: string;
  source?: string;
  bcPlaybackUrl?: string;
  featuredImage?: HomepageImage | null;
}
