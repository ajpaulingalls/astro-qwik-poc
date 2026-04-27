import { useState } from 'preact/hooks';
import { graphqlFetch, GraphqlHttpError } from '../lib/graphql';
import { GEO_API_CATEGORY_TYPE, SECTION_PAGE_SIZE, type SectionType } from '../lib/section-type';
import type { HomepagePost } from '@aje-poc/shared-types';
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

async function fetchPage(
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

export function LoadMoreButton({ section, categoryType, initialOffset }: Props) {
  const [posts, setPosts] = useState<HomepagePost[]>([]);
  const [offset, setOffset] = useState(initialOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchPage(section, categoryType, offset);
      setPosts((prev) => [...prev, ...next]);
      setOffset((prev) => prev + SECTION_PAGE_SIZE);
    } catch (err) {
      if (err instanceof GraphqlHttpError && err.status === 404) {
        setError('No more stories available.');
      } else {
        console.error('LoadMoreButton fetch failed:', err);
        setError('Failed to load more stories.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {posts.length > 0 && (
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {posts.map((post) => (
            <StoryCard key={post.id} post={post} />
          ))}
        </div>
      )}
      <div class="mt-6 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleLoad}
          disabled={loading}
          aria-busy={loading}
          class="px-4 py-2 border border-neutral-400 rounded hover:bg-neutral-100 disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
        {error && (
          <p role="alert" class="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
