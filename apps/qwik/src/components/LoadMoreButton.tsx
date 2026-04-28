import { $, component$, useSignal, useVisibleTask$ } from '@qwik.dev/core';
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
  const btnRef = useSignal<HTMLButtonElement>();

  // Hydration marker for the perf-harness acceptance suite. document-ready
  // strategy fires once the document load event completes, regardless of
  // whether the button is in the viewport (qvisible would block forever
  // when the LoadMore is below the fold on the test viewport). By the time
  // this $() runs Qwik has resumed its QRL chunks, so the click handler is
  // bound. The acceptance suite waits for `data-hydrated="true"` before
  // timing the click, so we don't measure the QRL-download round-trip.
  // The imperative setAttribute is deliberate — using a useSignal<boolean>
  // would force a re-render of the loading/disabled/aria-busy branches
  // for a one-shot DOM annotation that no JSX consumer reads.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      btnRef.value?.setAttribute('data-hydrated', 'true');
    },
    { strategy: 'document-ready' },
  );

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
          ref={btnRef}
          type="button"
          onClick$={handleLoad}
          disabled={loading.value}
          aria-busy={loading.value}
          data-hydrated="false"
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
