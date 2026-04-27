// Production routes /{section} as either a geographic section (apps/astro/
// docs/ARCHITECTURE.md §Section Type Resolution) or a topic page. The
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
