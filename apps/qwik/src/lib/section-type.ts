// Production routes /{section} as either a geographic section (apps/qwik/
// docs/ARCHITECTURE.md §Section Type Resolution) or a topic page. The
// allowlist is the only authority for the geographic branch — slugs not in
// it are treated as topics, and 404 is decided by fixture/live presence at
// fetch time. Mirrors apps/astro/src/lib/section-type.ts byte-for-byte;
// extraction to a shared package is deferred (sprint-008 customer decision).

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
// click). Mirrored in mock-api fixtures and tests.
export const SECTION_PAGE_SIZE = 9;

// API value of `categoryType` for geographic sections. Internal vocabulary
// is 'geographic'/'topic' (SectionType); production GraphQL expects 'where'.
// Mapped at the API boundary by [section]/index.tsx and LoadMoreButton.
export const GEO_API_CATEGORY_TYPE = 'where';
