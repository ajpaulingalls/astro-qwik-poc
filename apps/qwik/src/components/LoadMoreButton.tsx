import { $, component$, useSignal } from '@qwik.dev/core';
import {
  GEO_API_CATEGORY_TYPE,
  type HomepagePost,
  SECTION_PAGE_SIZE,
  type SectionType,
} from '@aje-poc/shared-types';
import { graphqlFetch, GraphqlHttpError } from '../lib/graphql';
import { StoryCard } from './StoryCard';

interface Props {
  section: string;
  categoryType: SectionType;
  initialOffset: number;
}

interface GeoFeed {
  articles: HomepagePost[];
}

interface TopicFeed {
  topicsFeedData: { articles: HomepagePost[] };
}

// Exported for unit tests — see LoadMoreButton.test.tsx header for the
// qwikLoader/createDOM rationale.
export async function fetchPage(
  section: string,
  categoryType: SectionType,
  offset: number,
): Promise<HomepagePost[]> {
  if (categoryType === 'geographic') {
    const data = await graphqlFetch<GeoFeed>({
      operationName: 'ArchipelagoAjeSectionPostsQuery',
      variables: {
        category: section,
        categoryType: GEO_API_CATEGORY_TYPE,
        quantity: SECTION_PAGE_SIZE,
        offset,
      },
    });
    return data.articles ?? [];
  }
  const data = await graphqlFetch<TopicFeed>({
    operationName: 'ArchipelagoPaginatedTopicsFeedQuery',
    variables: { slug: section, quantity: SECTION_PAGE_SIZE, offset },
  });
  return (data.topicsFeedData?.articles ?? []).slice(0, SECTION_PAGE_SIZE);
}

export const LoadMoreButton = component$<Props>(({ section, categoryType, initialOffset }) => {
  const posts = useSignal<HomepagePost[]>([]);
  const offset = useSignal(initialOffset);
  const loading = useSignal(false);
  const error = useSignal<string | null>(null);

  const handleLoad = $(async () => {
    loading.value = true;
    error.value = null;
    try {
      const next = await fetchPage(section, categoryType, offset.value);
      posts.value = [...posts.value, ...next];
      offset.value = offset.value + SECTION_PAGE_SIZE;
    } catch (err) {
      if (err instanceof GraphqlHttpError && err.status === 404) {
        error.value = 'No more stories available.';
      } else {
        console.error('LoadMoreButton fetch failed:', err);
        error.value = 'Failed to load more stories.';
      }
    } finally {
      loading.value = false;
    }
  });

  return (
    <>
      {posts.value.length > 0 && (
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {posts.value.map((post) => (
            <StoryCard key={post.id} post={post} />
          ))}
        </div>
      )}
      <div class="mt-6 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick$={handleLoad}
          disabled={loading.value}
          aria-busy={loading.value}
          class="px-4 py-2 border border-neutral-400 rounded hover:bg-neutral-100 disabled:opacity-60"
        >
          {loading.value ? 'Loading…' : 'Load more'}
        </button>
        {error.value && (
          <p role="alert" class="text-sm text-red-700">
            {error.value}
          </p>
        )}
      </div>
    </>
  );
});
