// Consolidation target for concern 1fa6ff30b786: previously duplicated in
// apps/{astro,qwik}/src/lib/homepage-types.ts. Both apps now import from here.

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

export interface ArticleAuthor {
  name: string;
  link: string;
}

export interface ArticleCategory {
  name: string;
  link: string;
  slug: string;
}

export interface Article {
  title: string;
  subheading?: string;
  date: string;
  content: string;
  author: ArticleAuthor[];
  categories: ArticleCategory[];
}
