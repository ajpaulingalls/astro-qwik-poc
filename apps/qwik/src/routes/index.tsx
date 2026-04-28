import { component$ } from '@qwik.dev/core';
import { routeLoader$, type DocumentHead } from '@qwik.dev/router';
import { graphqlFetch } from '../lib/graphql';
import { HeroCard } from '../components/HeroCard';
import { StoryCard } from '../components/StoryCard';
import { MostPopular } from '../components/MostPopular';
import { CuratedCollection } from '../components/CuratedCollection';
import { VerticalVideoCarousel } from '../components/VerticalVideoCarousel';
import { LivestreamPlayer } from '../components/LivestreamPlayer';
import type {
  HomepagePost,
  CuratedCollectionItem,
  VerticalVideo,
  Livestream,
} from '@aje-poc/shared-types';

interface HomePageData {
  homepage: {
    layout: string;
    featuredPosts: HomepagePost[];
    mostPopular: HomepagePost[];
    verticalVideos: VerticalVideo[];
    livestream: Livestream | null;
    layoutMetaData?: { topStories?: number };
  };
}

interface CuratedFeedData {
  homepage: {
    curatedCollection: CuratedCollectionItem[];
  };
}

export interface HomepageLoaderResult {
  page: HomePageData;
  curated: CuratedFeedData;
}

// Exported for unit tests — `routeLoader$` wraps this directly. Behavior is
// the same; naming the body lets vitest call it without a Qwik runtime.
export async function loadHomepageData(): Promise<HomepageLoaderResult> {
  const [pageData, curatedData] = await Promise.all([
    graphqlFetch<HomePageData>({
      operationName: 'HomePageQuery',
      variables: { isAtf: true, atfLength: 2, slug: '', preview: '' },
    }),
    graphqlFetch<CuratedFeedData>({
      operationName: 'HomePageCuratedFeedQuery',
      variables: { offset: 0 },
    }),
  ]);
  return { page: pageData, curated: curatedData };
}

export const useHomepageData = routeLoader$(() => loadHomepageData());

export default component$(() => {
  const data = useHomepageData();
  const homepage = data.value.page.homepage;
  const featured = homepage.featuredPosts ?? [];
  const heroPost = featured[0];
  const topStoriesCount = homepage.layoutMetaData?.topStories ?? 8;
  const gridPosts = featured.slice(1, 1 + topStoriesCount);
  const collections = data.value.curated.homepage.curatedCollection ?? [];
  const featuredCollection = collections[0];

  return (
    <>
      <h1 class="sr-only">Al Jazeera English — Homepage</h1>
      <div class="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div class="lg:col-span-8 space-y-8">
          {heroPost && <HeroCard post={heroPost} />}
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {gridPosts.map((post) => (
              <StoryCard key={post.id} post={post} />
            ))}
          </div>
          {featuredCollection && <CuratedCollection collection={featuredCollection} />}
        </div>
        <aside class="lg:col-span-4 space-y-8">
          {homepage.livestream && <LivestreamPlayer livestream={homepage.livestream} />}
          <MostPopular items={homepage.mostPopular ?? []} />
          <VerticalVideoCarousel videos={homepage.verticalVideos ?? []} />
          {collections.slice(1).map((collection) => (
            <CuratedCollection key={collection.title} collection={collection} />
          ))}
        </aside>
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: 'AJE PoC — Qwik 2',
};
