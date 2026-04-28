// Consolidation target for cross-app shared types and section-routing
// constants. Previously duplicated under apps/{astro,qwik}/src/lib/
// (homepage-types.ts, section-type.ts). Both apps import from here.

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

// The fields a card component (StoryCard, HeroCard, MostPopular,
// CuratedCollection) actually reads. Used as Props.post type so the
// component's read contract is documented at the boundary; routeLoaders
// today still return full HomepagePost arrays (assignable to this type
// because every required field of StoryCardData is present on
// HomepagePost). If a future routeLoader optimization wants to project
// down to this shape at the data boundary, the target type already exists.
export type StoryCardData = Pick<
  HomepagePost,
  'id' | 'title' | 'excerpt' | 'link' | 'isLive' | 'featuredImage' | 'replacementHeadline'
>;

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
  link?: string;
}

export interface ArticleCategory {
  name: string;
  link: string;
  slug: string;
}

export interface Article {
  id: string;
  title: string;
  link: string;
  subheading?: string;
  excerpt?: string;
  replacementHeadline?: string;
  date: string;
  content: string;
  author: ArticleAuthor[];
  categories: ArticleCategory[];
  featuredImage?: HomepageImage | null;
}

// Production routes /{section} as either a geographic section (apps/{astro,
// qwik}/docs/ARCHITECTURE.md §Section Type Resolution) or a topic page. The
// allowlist is the only authority for the geographic branch — slugs not in
// it are treated as topics, and 404 is decided by fixture/live presence at
// fetch time.
export const GEOGRAPHIC_SECTIONS = [
  'middle-east',
  'asia-pacific',
  'us-canada',
  'europe',
  'africa',
  'latin-america',
] as const;

export type SectionType = 'geographic' | 'topic';

export function getSectionType(slug: string): SectionType {
  return (GEOGRAPHIC_SECTIONS as readonly string[]).includes(slug) ? 'geographic' : 'topic';
}

// Production page-size for section feeds (initial render and each LoadMore
// click). Mirrored in mock-api fixtures and perf-harness acceptance tests.
export const SECTION_PAGE_SIZE = 9;

// API value of `categoryType` for geographic sections. Internal vocabulary
// is 'geographic'/'topic' (SectionType); production GraphQL expects 'where'.
// Mapped at the API boundary by the section route + LoadMoreButton in each app.
export const GEO_API_CATEGORY_TYPE = 'where';
