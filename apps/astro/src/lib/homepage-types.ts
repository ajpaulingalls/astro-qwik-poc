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
