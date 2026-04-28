import { component$ } from '@qwik.dev/core';
import type { StoryCardData } from '@aje-poc/shared-types';
import { getDisplayHeadline } from '../lib/headline';
import { LeadImage } from './LeadImage';
import { LiveBadge } from './LiveBadge';

interface Props {
  post: StoryCardData;
}

// Stays as component$ — used inside LoadMoreButton's reactive `posts.value.map(...)`
// (LoadMoreButton.tsx:99). Plain-function leaves are correct in static SSR maps
// (CuratedCollection over routeLoader$ data) but break the reactive append in
// LoadMore. HeroCard/MostPopular/CuratedCollection/Footer follow the leaf
// convention; StoryCard is the documented exception.
export const StoryCard = component$<Props>(({ post }) => {
  const img = post.featuredImage ?? null;
  return (
    <article>
      <a href={post.link} class="block">
        {img && (
          <LeadImage
            image={img}
            priority="lazy"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        )}
        <div class="px-3 py-2">
          <LiveBadge isLive={post.isLive} />
          <h3 class="text-base font-bold mt-1">{getDisplayHeadline(post)}</h3>
          {post.excerpt && <p class="excerpt mt-1 text-sm text-neutral-700">{post.excerpt}</p>}
        </div>
      </a>
    </article>
  );
});
