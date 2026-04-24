// DEPRECATED — being migrated to @aje-poc/shared-types in Step 1B/1C of
// concern 1fa6ff30b786 consolidation. Do NOT add fields here; edit
// packages/shared-types/index.ts instead. Imports here will be rewritten
// to @aje-poc/shared-types and this file deleted.

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
