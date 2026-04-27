import { component$ } from '@qwik.dev/core';
import { routeLoader$, type DocumentHead } from '@qwik.dev/router';
import { graphqlFetch, GraphqlHttpError } from '../../lib/graphql';
import {
  GEO_API_CATEGORY_TYPE,
  getSectionType,
  SECTION_PAGE_SIZE,
  type SectionType,
} from '../../lib/section-type';
import { computeLcpPreloadLink } from '../../lib/lcp-preload';
import { LoadMoreButton } from '../../components/LoadMoreButton';
import { StoryCard } from '../../components/StoryCard';
import type { HomepagePost } from '@aje-poc/shared-types';

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

interface SectionLoaderResult {
  slug: string;
  sectionType: SectionType;
  title: string;
  cards: HomepagePost[];
}

export const useSectionData = routeLoader$<SectionLoaderResult | { notFound: true; slug: string }>(
  async ({ params, fail }) => {
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
  },
);

export default component$(() => {
  const data = useSectionData();
  if ('notFound' in data.value) {
    return <main class="mx-auto max-w-7xl px-4 py-6">Section not found: {data.value.slug}</main>;
  }
  const { slug, sectionType, title, cards } = data.value;
  return (
    <main class="mx-auto max-w-7xl px-4 py-6">
      <h1 class="text-2xl font-bold mb-4">{title}</h1>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((post) => (
          <StoryCard key={post.id} post={post} />
        ))}
      </div>
      <LoadMoreButton section={slug} categoryType={sectionType} initialOffset={SECTION_PAGE_SIZE} />
    </main>
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
