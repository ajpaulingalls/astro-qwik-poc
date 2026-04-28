import { component$ } from '@qwik.dev/core';
import { routeLoader$, type DocumentHead, type RequestEventLoader } from '@qwik.dev/router';
import {
  GEO_API_CATEGORY_TYPE,
  getSectionType,
  type HomepagePost,
  SECTION_PAGE_SIZE,
  type SectionType,
} from '@aje-poc/shared-types';
import { graphqlFetch, GraphqlHttpError } from '../../lib/graphql';
import { computeLcpPreloadLink } from '../../lib/lcp-preload';
import { LoadMoreButton } from '../../components/LoadMoreButton';
import { StoryCard } from '../../components/StoryCard';

interface SectionMeta {
  name?: string;
}

interface GeoSectionData {
  category: SectionMeta | null;
  articles: HomepagePost[];
}

interface TopicPageData {
  topicsPage: { name?: string; featuredPosts: HomepagePost[] } | null;
}

export interface SectionLoaderResult {
  slug: string;
  sectionType: SectionType;
  title: string;
  cards: HomepagePost[];
}

// Exported for unit tests — `routeLoader$` wraps this directly. Behavior is
// the same; naming the body lets vitest call it without a Qwik runtime.
export async function loadSectionData(
  ctx: Pick<RequestEventLoader, 'params' | 'fail'>,
): Promise<SectionLoaderResult | { notFound: true; slug: string }> {
  const { params, fail } = ctx;
  const slug = params.section ?? '';
  const sectionType = getSectionType(slug);
  try {
    if (sectionType === 'geographic') {
      const data = await graphqlFetch<GeoSectionData>({
        operationName: 'ArchipelagoSectionQuery',
        variables: {
          name: slug,
          categoryType: GEO_API_CATEGORY_TYPE,
          quantity: SECTION_PAGE_SIZE,
          offset: 0,
        },
      });
      // Trim the loader payload — Qwik 2 serializes the full return value into
      // the resume payload, so trimming here directly shrinks what ships to
      // the browser (matches news/[...slug]/index.tsx pattern).
      return {
        slug,
        sectionType,
        title: data.category?.name ?? slug,
        cards: data.articles ?? [],
      };
    }
    const data = await graphqlFetch<TopicPageData>({
      operationName: 'ArchipelagoTopicsPageQuery',
      variables: { slug },
    });
    return {
      slug,
      sectionType,
      title: data.topicsPage?.name ?? slug,
      cards: data.topicsPage?.featuredPosts ?? [],
    };
  } catch (err) {
    if (err instanceof GraphqlHttpError && err.status === 404) {
      return fail(404, { notFound: true, slug });
    }
    throw err;
  }
}

export const useSectionData = routeLoader$<SectionLoaderResult | { notFound: true; slug: string }>(
  (ctx) => loadSectionData(ctx),
);

export default component$(() => {
  const data = useSectionData();
  if ('notFound' in data.value) {
    // Layout owns the <main> landmark — content wrapper stays a <div> to
    // avoid nested-main (HTML5 forbids; perf-harness asserts exactly 1).
    return <div class="mx-auto max-w-7xl px-4 py-6">Section not found: {data.value.slug}</div>;
  }
  const { slug, sectionType, title, cards } = data.value;
  return (
    // Layout owns the <main> landmark — content wrapper stays a <div>.
    <div class="mx-auto max-w-7xl px-4 py-6">
      <h1 class="text-2xl font-bold mb-4">{title}</h1>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((post) => (
          <StoryCard key={post.id} post={post} />
        ))}
      </div>
      <LoadMoreButton section={slug} categoryType={sectionType} initialOffset={SECTION_PAGE_SIZE} />
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(useSectionData);
  if ('notFound' in data) {
    return { title: 'Section not found' };
  }
  // LCP assumption: cards[0] is the visual LCP candidate for the 3-col grid.
  // A future redesign that adds a hero above the grid would shift this target.
  const preloadLink = computeLcpPreloadLink(data.cards[0]?.featuredImage);
  return {
    title: data.title,
    ...(preloadLink && { links: [preloadLink] }),
  };
};
