import { component$ } from '@qwik.dev/core';
import type { StoryCardData } from '@aje-poc/shared-types';
import { getDisplayHeadline } from '../lib/headline';
import { LeadImage } from './LeadImage';
import { LiveBadge } from './LiveBadge';

interface Props {
  post: StoryCardData;
}

export const HeroCard = component$<Props>(({ post }) => {
  const img = post.featuredImage ?? null;
  return (
    <article>
      <a href={post.link} class="block">
        {img && (
          <LeadImage image={img} priority="eager" sizes="(min-width: 1024px) 1024px, 100vw" />
        )}
        <div class="px-4 py-3">
          <LiveBadge isLive={post.isLive} />
          <h2 class="text-2xl font-bold mt-1">{getDisplayHeadline(post)}</h2>
          {post.excerpt && <p class="excerpt mt-2 text-neutral-700">{post.excerpt}</p>}
        </div>
      </a>
    </article>
  );
});
